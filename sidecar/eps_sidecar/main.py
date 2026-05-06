"""FastAPI sidecar that subprocesses the real `claude` CLI in headless mode.

Why subprocess vs the Python claude-agent-sdk:
  - The CLI auto-loads CLAUDE.md, settings.json, .mcp.json from the project,
    plus ~/.claude memory, plugins, custom subagents, skills, and slash
    commands. Identical to running `claude` in a terminal.
  - The Python SDK is a thinner agent runtime that does NOT auto-load any
    of the above; we'd have to reconstruct each piece by hand.
  - We pipe `--output-format stream-json --include-partial-messages` and
    translate to our SSE event shape (token / tool_use / tool_result /
    done / error).

Auth: Vercel proxy must include `Authorization: Bearer <SIDECAR_SHARED_SECRET>`.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import secrets
from collections.abc import AsyncIterator
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
PERMISSION_MODE = os.environ.get("CLAUDE_PERMISSION_MODE", "bypassPermissions")
MAX_BUDGET_USD = os.environ.get("SIDECAR_MAX_BUDGET_USD", "1.00")  # per request
SUBPROC_TIMEOUT_S = int(os.environ.get("SIDECAR_TIMEOUT_S", "300"))

if not SHARED_SECRET:
    log.warning("SIDECAR_SHARED_SECRET not set — refusing all requests")
if not ANTHROPIC_API_KEY:
    log.warning("ANTHROPIC_API_KEY not set — claude will fail to authenticate")
if not os.path.isfile(CLAUDE_BIN) or not os.access(CLAUDE_BIN, os.X_OK):
    log.warning("CLAUDE_BIN at %s not executable", CLAUDE_BIN)


# ── Auth ──────────────────────────────────────────────────────────────────
def require_secret(request: Request) -> None:
    if not SHARED_SECRET:
        raise HTTPException(503, "sidecar not configured (missing SIDECAR_SHARED_SECRET)")
    auth = request.headers.get("authorization", "")
    if not auth.lower().startswith("bearer "):
        raise HTTPException(401, "missing bearer token")
    token = auth[7:].strip()
    if not secrets.compare_digest(token, SHARED_SECRET):
        raise HTTPException(403, "invalid token")


# ── App ───────────────────────────────────────────────────────────────────
app = FastAPI(title="EPS Sidecar")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://explore-persona-space-dashboard.vercel.app"],
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
        "permission_mode": PERMISSION_MODE,
        "max_budget_usd": MAX_BUDGET_USD,
        "has_secret": bool(SHARED_SECRET),
        "has_anthropic_key": bool(ANTHROPIC_API_KEY),
    }


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]


@app.post("/chat", dependencies=[Depends(require_secret)])
async def chat(req: ChatRequest) -> EventSourceResponse:
    """Spawn `claude --print` and translate stream-json → our SSE events."""
    last_user = next((m for m in reversed(req.messages) if m.role == "user"), None)
    if last_user is None:
        raise HTTPException(400, "no user message")
    prompt = last_user.content

    args = [
        CLAUDE_BIN,
        "--print",
        "--verbose",
        "--output-format",
        "stream-json",
        "--include-partial-messages",
        "--permission-mode",
        PERMISSION_MODE,
        "--no-session-persistence",
        "--max-budget-usd",
        MAX_BUDGET_USD,
        prompt,
    ]
    env = {**os.environ, "ANTHROPIC_API_KEY": ANTHROPIC_API_KEY}

    async def event_stream() -> AsyncIterator[dict[str, str]]:
        # claude-code's stream-json `init` event lists every tool / skill /
        # agent / plugin / MCP server, easily exceeding asyncio's default
        # 64KB readline limit. Raise it to 16MB so the parser doesn't choke.
        proc = await asyncio.create_subprocess_exec(
            *args,
            cwd=WORKDIR,
            env=env,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            limit=16 * 1024 * 1024,
        )
        try:
            assert proc.stdout is not None
            async with asyncio.timeout(SUBPROC_TIMEOUT_S):
                buf = b""
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
                        for sse in translate(evt):
                            yield {"event": sse[0], "data": json.dumps(sse[1])}
                code = await proc.wait()
                if code != 0:
                    err = (
                        (await proc.stderr.read()).decode("utf-8", errors="replace")
                        if proc.stderr
                        else ""
                    )
                    yield {
                        "event": "error",
                        "data": json.dumps({"message": f"claude exited {code}: {err[:500]}"}),
                    }
                    yield {"event": "done", "data": json.dumps({"stop_reason": "error"})}
        except TimeoutError:
            proc.terminate()
            yield {
                "event": "error",
                "data": json.dumps({"message": f"timeout after {SUBPROC_TIMEOUT_S}s"}),
            }
            yield {"event": "done", "data": json.dumps({"stop_reason": "timeout"})}
        except asyncio.CancelledError:
            log.info("client disconnected; killing claude subprocess")
            proc.terminate()
            raise
        except Exception as e:
            log.exception("event_stream error")
            yield {"event": "error", "data": json.dumps({"message": str(e)})}
            yield {"event": "done", "data": json.dumps({"stop_reason": "error"})}

    return EventSourceResponse(event_stream())


def translate(evt: dict[str, Any]) -> list[tuple[str, dict[str, Any]]]:
    """Map a claude-code stream-json event to zero+ of our SSE events.

    Our event names mirror the lite chat:
      - token        {text}              partial assistant text
      - tool_use     {name, input}       tool call announce
      - tool_result  {name, ok}          tool finished
      - thinking     {text}              extended-thinking deltas (optional)
      - done         {stop_reason}       final
      - error        {message}
    """
    t = evt.get("type")
    if t == "system":
        # Skip startup hooks / init noise; surface only failures.
        if evt.get("subtype") == "hook_response" and evt.get("exit_code", 0) != 0:
            return [("error", {"message": f"hook failed: {evt.get('hook_name')}"})]
        return []

    if t == "stream_event":
        # Partial deltas streamed as Anthropic SSE events embedded in JSON.
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
        # Whole message — usually arrives alongside stream_event deltas; we
        # only forward tool_use blocks here (text already came as deltas).
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


def main() -> None:
    import uvicorn

    uvicorn.run("eps_sidecar.main:app", host=HOST, port=PORT, log_level="info")


if __name__ == "__main__":
    main()
