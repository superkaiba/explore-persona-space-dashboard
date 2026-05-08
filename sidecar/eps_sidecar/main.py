"""FastAPI sidecar that subprocesses Claude Code or Codex in headless mode.

Sessions are PERSISTENT: one `claude` subprocess per chat thread, kept alive
across messages. Cold start (CLAUDE.md, 200+ tools, plugins, MCP, memory)
is ~10-15s on first message; subsequent messages reuse the loaded process
and respond in <1s + agent-thinking time.

Claude subprocess args:
  claude --print --verbose
         --input-format stream-json
         --output-format stream-json
         --include-partial-messages
         --model opus
         --effort xhigh
         --permission-mode bypassPermissions
         --no-session-persistence

Codex subprocess args:
  codex exec --json --model gpt-5.5
         -c model_reasoning_effort="xhigh"
         --dangerously-bypass-approvals-and-sandbox -C <WORKDIR> -

Sessions are GC'd after SESSION_IDLE_S seconds of inactivity.

Auth: shared secret OR short-lived HMAC token (see _verify_hmac_token).
"""

from __future__ import annotations

import asyncio
import base64
import hashlib
import hmac
import json
import logging
import os
import secrets
import time as _time
import uuid
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("eps-sidecar")

# ── Config ────────────────────────────────────────────────────────────────
SHARED_SECRET = os.environ.get("SIDECAR_SHARED_SECRET", "")
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
WORKDIR = os.environ.get("EPS_WORKDIR", os.getcwd())
HOST = os.environ.get("SIDECAR_HOST", "127.0.0.1")
PORT = int(os.environ.get("SIDECAR_PORT", "7654"))
CLAUDE_BIN = os.environ.get("CLAUDE_BIN", "/home/thomasjiralerspong/.local/bin/claude")
CODEX_BIN = os.environ.get("CODEX_BIN", "/home/thomasjiralerspong/.npm-global/bin/codex")
CLAUDE_MODEL = os.environ.get("CLAUDE_MODEL", "opus")
CLAUDE_EFFORT = os.environ.get("CLAUDE_EFFORT", "xhigh")
CODEX_MODEL = os.environ.get("CODEX_MODEL", "gpt-5.5")
CODEX_REASONING_EFFORT = os.environ.get("CODEX_REASONING_EFFORT", "xhigh")
PERMISSION_MODE = os.environ.get("CLAUDE_PERMISSION_MODE", "bypassPermissions")
TURN_TIMEOUT_S = int(os.environ.get("SIDECAR_TURN_TIMEOUT_S", "0"))
SESSION_IDLE_S = int(os.environ.get("SIDECAR_SESSION_IDLE_S", str(30 * 60)))
SESSION_SWEEP_S = 60

if not SHARED_SECRET:
    log.warning("SIDECAR_SHARED_SECRET not set — refusing all requests")
if not ANTHROPIC_API_KEY:
    log.warning("ANTHROPIC_API_KEY not set — claude will fail to authenticate")
if not os.path.isfile(CLAUDE_BIN) or not os.access(CLAUDE_BIN, os.X_OK):
    log.warning("CLAUDE_BIN at %s not executable", CLAUDE_BIN)
if not os.path.isfile(CODEX_BIN) or not os.access(CODEX_BIN, os.X_OK):
    log.warning("CODEX_BIN at %s not executable", CODEX_BIN)


# ── Auth ──────────────────────────────────────────────────────────────────
TOKEN_MAX_TTL_MS = 10 * 60 * 1000


def _b64url_decode(s: str) -> bytes:
    s += "=" * (-len(s) % 4)
    return base64.urlsafe_b64decode(s)


def _verify_hmac_token(token: str) -> bool:
    """Token format: base64url(exp_ms_str) "." base64url(hmac_sha256(SECRET, exp_ms_str))"""
    try:
        payload_b64, sig_b64 = token.split(".", 1)
    except ValueError:
        return False
    try:
        payload = _b64url_decode(payload_b64).decode("ascii")
        exp_ms = int(payload)
    except (ValueError, UnicodeDecodeError):
        return False
    now_ms = int(_time.time() * 1000)
    if exp_ms < now_ms:
        return False
    if exp_ms > now_ms + TOKEN_MAX_TTL_MS:
        return False
    expected_sig = hmac.new(
        SHARED_SECRET.encode("utf-8"),
        payload.encode("utf-8"),
        hashlib.sha256,
    ).digest()
    expected_b64 = base64.urlsafe_b64encode(expected_sig).rstrip(b"=").decode("ascii")
    return hmac.compare_digest(expected_b64, sig_b64)


def require_secret(request: Request) -> None:
    if not SHARED_SECRET:
        raise HTTPException(503, "sidecar not configured (missing SIDECAR_SHARED_SECRET)")
    auth = request.headers.get("authorization", "")
    if not auth.lower().startswith("bearer "):
        raise HTTPException(401, "missing bearer token")
    token = auth[7:].strip()
    if secrets.compare_digest(token, SHARED_SECRET):
        return
    if _verify_hmac_token(token):
        return
    raise HTTPException(403, "invalid token")


# ── Session management ────────────────────────────────────────────────────
class Session:
    """One long-running `claude` subprocess. One turn at a time (lock)."""

    def __init__(self, sid: str, proc: asyncio.subprocess.Process) -> None:
        self.id = sid
        self.proc = proc
        self.queue: asyncio.Queue[dict[str, Any] | None] = asyncio.Queue()
        self.lock = asyncio.Lock()
        self.last_active = _time.time()
        self.ready = asyncio.Event()  # set when init event arrives
        self.reader_task: asyncio.Task[None] | None = None

    async def stop(self) -> None:
        if self.reader_task and not self.reader_task.done():
            self.reader_task.cancel()
        if self.proc.returncode is None:
            self.proc.terminate()
            try:
                await asyncio.wait_for(self.proc.wait(), timeout=5)
            except TimeoutError:
                self.proc.kill()


sessions: dict[str, Session] = {}
sessions_lock = asyncio.Lock()


async def _stdout_reader(session: Session) -> None:
    """Pump JSON lines from claude's stdout into session.queue forever."""
    proc = session.proc
    assert proc.stdout is not None
    buf = b""
    try:
        while True:
            chunk = await proc.stdout.read(65536)
            if not chunk:
                break
            buf += chunk
            while b"\n" in buf:
                raw, buf = buf.split(b"\n", 1)
                line = raw.decode("utf-8", errors="replace").strip()
                if not line:
                    continue
                try:
                    evt = json.loads(line)
                except json.JSONDecodeError:
                    continue
                if evt.get("type") == "system" and evt.get("subtype") == "init":
                    session.ready.set()
                await session.queue.put(evt)
    except asyncio.CancelledError:
        raise
    except Exception:
        log.exception("session %s reader crashed", session.id[:8])
    finally:
        # Signal stream end with a sentinel
        await session.queue.put(None)


DASHBOARD_DATABASE_URL = os.environ.get("DASHBOARD_DATABASE_URL", "")

DASHBOARD_CONTEXT_PROMPT = """\
EPS Dashboard context (you are running on the project owner's VM):

Dashboard URL:  https://dashboard.superkaiba.com
Repo:           /home/thomasjiralerspong/explore-persona-space-dashboard
DB schema:      <repo>/db/schema.ts (claim, experiment, run, todo, edge,
                figure, comment, agent_task, agent_run, agent_run_event,
                chat_session, chat_message)

Postgres is reachable directly via psql with the env var
$DASHBOARD_DATABASE_URL (already set). Examples:

  # last 7 days of conversations across all claims
  psql "${DASHBOARD_DATABASE_URL%%\\?*}" -c \\
    "SELECT s.id, s.scope_entity_id AS claim_id, c.title, s.last_user_email,
            s.last_message_at,
            (SELECT count(*) FROM chat_message WHERE session_id = s.id) AS msgs
       FROM chat_session s
  LEFT JOIN claim c ON c.id = s.scope_entity_id
      WHERE s.last_message_at > now() - interval '7 days'
   ORDER BY s.last_message_at DESC;"

  # full transcript of one conversation
  psql "${DASHBOARD_DATABASE_URL%%\\?*}" -c \\
    "SELECT role, user_email, body, created_at FROM chat_message
      WHERE session_id = '<sid>' ORDER BY created_at;"

  # recent comments on a claim
  psql "${DASHBOARD_DATABASE_URL%%\\?*}" -c \\
    "SELECT author_email, body, created_at FROM comment
      WHERE entity_kind='claim' AND entity_id='<claim-id>' ORDER BY created_at;"

  # append progress to a dashboard improvement run
  psql "${DASHBOARD_DATABASE_URL%%\\?*}" -c \\
    "INSERT INTO agent_run_event (run_id, event_type, body)
     VALUES ('<run-id>', 'progress', 'Finished typecheck');"

When the user asks about past conversations, comments, or activity that
isn't visible in the current chat thread, use psql to query the dashboard
DB. Results are JSON-friendly via `psql --json` (use -A -F$'\\t' if
piping for parsing)."""


async def create_session(sid: str) -> Session:
    args = [
        CLAUDE_BIN,
        "--print",
        "--verbose",
        "--input-format",
        "stream-json",
        "--output-format",
        "stream-json",
        "--include-partial-messages",
        "--model",
        CLAUDE_MODEL,
        "--effort",
        CLAUDE_EFFORT,
        "--permission-mode",
        PERMISSION_MODE,
        "--no-session-persistence",
        "--append-system-prompt",
        DASHBOARD_CONTEXT_PROMPT,
    ]
    env = {
        **os.environ,
        "ANTHROPIC_API_KEY": ANTHROPIC_API_KEY,
        "DASHBOARD_DATABASE_URL": DASHBOARD_DATABASE_URL,
    }

    proc = await asyncio.create_subprocess_exec(
        *args,
        cwd=WORKDIR,
        env=env,
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        limit=16 * 1024 * 1024,
    )
    session = Session(sid, proc)
    session.reader_task = asyncio.create_task(_stdout_reader(session))
    sessions[sid] = session
    log.info("session %s spawned (pid=%s)", sid[:8], proc.pid)
    return session


async def gc_loop() -> None:
    while True:
        await asyncio.sleep(SESSION_SWEEP_S)
        now = _time.time()
        stale: list[str] = []
        async with sessions_lock:
            for sid, s in list(sessions.items()):
                if s.lock.locked():
                    continue
                if now - s.last_active > SESSION_IDLE_S or s.proc.returncode is not None:
                    stale.append(sid)
        for sid in stale:
            s = sessions.pop(sid, None)
            if s:
                log.info("session %s reaping (idle/dead)", sid[:8])
                await s.stop()


# ── App ───────────────────────────────────────────────────────────────────
app = FastAPI(title="EPS Sidecar")


@app.on_event("startup")
async def _startup() -> None:
    asyncio.create_task(gc_loop())


@app.on_event("shutdown")
async def _shutdown() -> None:
    for s in list(sessions.values()):
        await s.stop()


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://dashboard.superkaiba.com",
        "https://explore-persona-space-dashboard.vercel.app",
    ],
    allow_credentials=False,
    allow_methods=["POST", "GET"],
    allow_headers=["authorization", "content-type"],
)


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "ok": True,
        "workdir": WORKDIR,
        "claude_bin": CLAUDE_BIN,
        "codex_bin": CODEX_BIN,
        "claude_model": CLAUDE_MODEL,
        "claude_effort": CLAUDE_EFFORT,
        "codex_model": CODEX_MODEL,
        "codex_reasoning_effort": CODEX_REASONING_EFFORT,
        "permission_mode": PERMISSION_MODE,
        "turn_timeout_s": TURN_TIMEOUT_S,
        "session_idle_s": SESSION_IDLE_S,
        "active_sessions": len(sessions),
        "has_secret": bool(SHARED_SECRET),
        "has_anthropic_key": bool(ANTHROPIC_API_KEY),
    }


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    session_id: str | None = None
    provider: str | None = "claude_code"


def _prompt_for_session(messages: list[ChatMessage], include_history: bool) -> str:
    last_user = next((m for m in reversed(messages) if m.role == "user"), None)
    if last_user is None:
        raise HTTPException(400, "no user message")
    if not include_history or len(messages) <= 1:
        return last_user.content

    prior = messages[:-1][-12:]
    transcript = "\n\n".join(
        f"{m.role.upper()}:\n{m.content}" for m in prior if m.content.strip()
    )
    return (
        "Resume this saved EPS Dashboard agent conversation. "
        "Use the prior transcript for continuity, but answer the final user message.\n\n"
        f"Prior transcript:\n{transcript}\n\n"
        f"Final user message:\n{last_user.content}"
    )


async def _drain_stderr(proc: asyncio.subprocess.Process) -> list[str]:
    assert proc.stderr is not None
    lines: list[str] = []
    while True:
        raw = await proc.stderr.readline()
        if not raw:
            return lines
        text = raw.decode("utf-8", errors="replace").strip()
        if text:
            lines.append(text)


@asynccontextmanager
async def maybe_turn_timeout() -> AsyncIterator[None]:
    """Wrap a turn in the configured timeout. Set SIDECAR_TURN_TIMEOUT_S=0 to disable."""
    if TURN_TIMEOUT_S <= 0:
        yield
        return
    async with asyncio.timeout(TURN_TIMEOUT_S):
        yield


async def codex_event_stream(req: ChatRequest, sid: str) -> AsyncIterator[dict[str, str]]:
    prompt = _prompt_for_session(req.messages, include_history=len(req.messages) > 1)
    yield {"event": "session", "data": json.dumps({"session_id": sid, "fresh": True})}
    yield {"event": "starting", "data": json.dumps({"phase": "spawning"})}

    args = [
        CODEX_BIN,
        "exec",
        "--json",
        "--model",
        CODEX_MODEL,
        "-c",
        f'model_reasoning_effort="{CODEX_REASONING_EFFORT}"',
        "--dangerously-bypass-approvals-and-sandbox",
        "-C",
        WORKDIR,
        "-",
    ]
    proc = await asyncio.create_subprocess_exec(
        *args,
        cwd=WORKDIR,
        env={**os.environ, "DASHBOARD_DATABASE_URL": DASHBOARD_DATABASE_URL},
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        limit=16 * 1024 * 1024,
    )
    stderr_task = asyncio.create_task(_drain_stderr(proc))
    assert proc.stdin is not None
    proc.stdin.write(prompt.encode("utf-8"))
    await proc.stdin.drain()
    proc.stdin.close()

    yield {"event": "starting", "data": json.dumps({"phase": "loading"})}
    yield {"event": "ready", "data": json.dumps({"model": "codex", "tools": 0})}

    try:
        assert proc.stdout is not None
        async with maybe_turn_timeout():
            while True:
                raw = await proc.stdout.readline()
                if not raw:
                    break
                line = raw.decode("utf-8", errors="replace").strip()
                if not line:
                    continue
                try:
                    evt = json.loads(line)
                except json.JSONDecodeError:
                    continue
                for sse_name, sse_data in translate_codex(evt):
                    yield {"event": sse_name, "data": json.dumps(sse_data)}

            code = await proc.wait()
            stderr_lines = await stderr_task
            if code != 0:
                message = "\n".join(stderr_lines[-8:]) or f"codex exited with {code}"
                yield {"event": "error", "data": json.dumps({"message": message})}
                yield {"event": "done", "data": json.dumps({"stop_reason": "error"})}
                return
            yield {"event": "done", "data": json.dumps({"stop_reason": "end_turn"})}
    except TimeoutError:
        if proc.returncode is None:
            proc.kill()
        yield {
            "event": "error",
            "data": json.dumps({"message": f"turn timed out after {TURN_TIMEOUT_S}s"}),
        }
        yield {"event": "done", "data": json.dumps({"stop_reason": "timeout"})}
    except asyncio.CancelledError:
        if proc.returncode is None:
            proc.terminate()
        raise


@app.post("/chat", dependencies=[Depends(require_secret)])
async def chat(req: ChatRequest) -> EventSourceResponse:
    last_user = next((m for m in reversed(req.messages) if m.role == "user"), None)
    if last_user is None:
        raise HTTPException(400, "no user message")

    # Use the caller's session_id verbatim if given (creating a new session
    # under that id if it doesn't exist yet); otherwise mint one.
    sid = req.session_id or uuid.uuid4().hex
    provider = (req.provider or "claude_code").strip().lower()
    if provider == "codex":
        return EventSourceResponse(codex_event_stream(req, sid))
    if provider not in {"claude", "claude_code"}:
        raise HTTPException(400, "provider must be claude_code or codex")
    is_new = sid not in sessions

    async def event_stream() -> AsyncIterator[dict[str, str]]:
        # Phase 0: tell client we're alive + which session
        yield {"event": "session", "data": json.dumps({"session_id": sid, "fresh": is_new})}
        yield {
            "event": "starting",
            "data": json.dumps({"phase": "spawning" if is_new else "warm"}),
        }

        try:
            if is_new:
                async with sessions_lock:
                    if sid not in sessions:
                        await create_session(sid)
                session = sessions[sid]
                yield {"event": "starting", "data": json.dumps({"phase": "loading"})}
            else:
                session = sessions[sid]

            async with session.lock:
                session.last_active = _time.time()
                prompt = _prompt_for_session(req.messages, include_history=is_new)

                # Send the user message via stdin
                assert session.proc.stdin is not None
                user_msg = (
                    json.dumps(
                        {"type": "user", "message": {"role": "user", "content": prompt}},
                        ensure_ascii=False,
                    )
                    + "\n"
                )
                session.proc.stdin.write(user_msg.encode("utf-8"))
                await session.proc.stdin.drain()

                # Stream events until the result event for this turn
                async with maybe_turn_timeout():
                    while True:
                        evt = await session.queue.get()
                        if evt is None:
                            yield {
                                "event": "error",
                                "data": json.dumps({"message": "session ended unexpectedly"}),
                            }
                            yield {"event": "done", "data": json.dumps({"stop_reason": "ended"})}
                            return

                        for sse_name, sse_data in translate(evt):
                            yield {"event": sse_name, "data": json.dumps(sse_data)}

                        if evt.get("type") == "result":
                            session.last_active = _time.time()
                            return

        except TimeoutError:
            timed_out = sessions.pop(sid, None)
            if timed_out:
                await timed_out.stop()
            yield {
                "event": "error",
                "data": json.dumps(
                    {
                        "message": (
                            f"turn timed out after {TURN_TIMEOUT_S}s; "
                            "the Claude Code session was restarted"
                        )
                    }
                ),
            }
            yield {"event": "done", "data": json.dumps({"stop_reason": "timeout"})}
        except asyncio.CancelledError:
            log.info("client disconnected mid-turn (session %s)", sid[:8])
            raise
        except Exception as e:
            log.exception("event_stream error")
            yield {"event": "error", "data": json.dumps({"message": str(e)})}
            yield {"event": "done", "data": json.dumps({"stop_reason": "error"})}

    return EventSourceResponse(event_stream())


@app.post("/end-session", dependencies=[Depends(require_secret)])
async def end_session(req: dict[str, Any]) -> dict[str, bool]:
    sid = req.get("session_id")
    if not sid or not isinstance(sid, str):
        raise HTTPException(400, "session_id required")
    s = sessions.pop(sid, None)
    if s:
        await s.stop()
    return {"ok": True}


@app.post("/end-session-beacon")
async def end_session_beacon(sid: str = "") -> dict[str, bool]:
    """Browser tab-close cleanup. sendBeacon can't set Authorization headers,
    so we authenticate by session_id (only the owner of an active session
    knows its random hex)."""
    if not sid or sid not in sessions:
        return {"ok": False}
    s = sessions.pop(sid, None)
    if s:
        await s.stop()
        log.info("session %s ended via beacon", sid[:8])
    return {"ok": True}


def translate(evt: dict[str, Any]) -> list[tuple[str, dict[str, Any]]]:
    """Map a claude-code stream-json event to zero+ of our SSE events."""
    t = evt.get("type")
    if t == "system":
        sub = evt.get("subtype")
        if sub == "init":
            return [("ready", {"model": evt.get("model"), "tools": len(evt.get("tools", []))})]
        if sub == "hook_response" and evt.get("exit_code", 0) != 0:
            return [("error", {"message": f"hook failed: {evt.get('hook_name')}"})]
        return []

    if t == "stream_event":
        inner = evt.get("event", {})
        if inner.get("type") == "content_block_delta":
            delta = inner.get("delta", {})
            d_type = delta.get("type")
            if d_type == "text_delta":
                return [("token", {"text": delta.get("text", "")})]
            if d_type == "thinking_delta":
                return [("thinking", {"text": delta.get("thinking", "")})]
        return []

    if t == "assistant":
        msg = evt.get("message", {})
        out: list[tuple[str, dict[str, Any]]] = []
        for block in msg.get("content", []):
            if block.get("type") == "tool_use":
                out.append(
                    (
                        "tool_use",
                        {
                            "name": block.get("name", "?"),
                            "input": block.get("input", {}),
                            "id": block.get("id"),
                        },
                    )
                )
        return out

    if t == "user":
        msg = evt.get("message", {})
        out = []
        for block in msg.get("content", []):
            if block.get("type") == "tool_result":
                content = block.get("content", "")
                if isinstance(content, list):
                    content = "".join(c.get("text", "") for c in content if c.get("type") == "text")
                content_str = str(content)
                if len(content_str) > 8000:
                    content_str = (
                        content_str[:8000] + f"\n…[truncated, {len(content_str) - 8000} more chars]"
                    )
                out.append(
                    (
                        "tool_result",
                        {
                            "tool_use_id": block.get("tool_use_id", ""),
                            "ok": not block.get("is_error", False),
                            "content": content_str,
                        },
                    )
                )
        return out

    if t == "result":
        return [
            (
                "done",
                {
                    "stop_reason": evt.get("subtype", "end_turn"),
                    "cost_usd": evt.get("total_cost_usd"),
                    "duration_ms": evt.get("duration_ms"),
                    "num_turns": evt.get("num_turns"),
                },
            )
        ]

    return []


def translate_codex(evt: dict[str, Any]) -> list[tuple[str, dict[str, Any]]]:
    """Map Codex CLI JSONL events to the dashboard SSE event shape."""
    t = evt.get("type")
    item = evt.get("item") if isinstance(evt.get("item"), dict) else {}
    out: list[tuple[str, dict[str, Any]]] = []

    if t == "item.started" and item.get("type") == "command_execution":
        out.append(
            (
                "tool_use",
                {
                    "name": "Bash",
                    "input": {"command": item.get("command", "")},
                    "id": item.get("id"),
                },
            )
        )
        return out

    if t == "item.completed" and item.get("type") == "command_execution":
        content = str(item.get("aggregated_output", ""))
        if len(content) > 8000:
            content = content[:8000] + f"\n…[truncated, {len(content) - 8000} more chars]"
        out.append(
            (
                "tool_result",
                {
                    "tool_use_id": item.get("id", ""),
                    "ok": item.get("exit_code") == 0,
                    "content": content,
                },
            )
        )
        return out

    if t == "item.completed" and item.get("type") == "agent_message":
        text = str(item.get("text", ""))
        if text:
            out.append(("token", {"text": text}))
        return out

    if t == "turn.failed":
        return [("error", {"message": str(evt.get("error", "codex turn failed"))})]

    return out


def main() -> None:
    import uvicorn

    uvicorn.run("eps_sidecar.main:app", host=HOST, port=PORT, log_level="info")


if __name__ == "__main__":
    main()
