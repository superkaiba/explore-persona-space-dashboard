"""FastAPI sidecar that spawns Claude Code agents and streams events via SSE.

The Vercel /api/chat-full route is the only authorized caller; it forwards
the user's message and a shared secret. We start a fresh Claude Code agent
for each chat turn (or resume a session via session_id), give it filesystem
+ shell access scoped to EPS_WORKDIR, and stream the agent's events back as
Server-Sent Events.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import secrets
from collections.abc import AsyncIterator
from typing import Any

from claude_agent_sdk import ClaudeAgentOptions, ClaudeSDKClient
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
MAX_TURNS = int(os.environ.get("SIDECAR_MAX_TURNS", "15"))
MODEL = os.environ.get("SIDECAR_MODEL", "claude-sonnet-4-6")
HOST = os.environ.get("SIDECAR_HOST", "127.0.0.1")
PORT = int(os.environ.get("SIDECAR_PORT", "7654"))

if not SHARED_SECRET:
    log.warning("SIDECAR_SHARED_SECRET not set — refusing all requests")
if not ANTHROPIC_API_KEY:
    log.warning("ANTHROPIC_API_KEY not set — agent will fail")


SYSTEM_PROMPT = f"""You are the research assistant for the EPS Dashboard.
You're running on the user's VM with full filesystem and shell access scoped
to {WORKDIR}. The user is the project owner — an AI alignment researcher
working on persona representations and emergent misalignment in LLMs.

You can:
- Read any file in the working directory (the research repo)
- Run shell commands (gh, git, python scripts, sqlite3, etc.)
- Query the dashboard's Supabase Postgres via the DATABASE_URL env var
- Read WandB results via the WANDB_API_KEY env var
- Browse GitHub via gh CLI

Defaults:
- Be concise. Technical fluency assumed.
- When citing claims, prefer GitHub issue numbers ("#237") and dashboard
  detail links ("/claim/<id>").
- Only run experiments via /issue N — never inline.
- Never modify files without explicit user approval.
- If asked to plan a new experiment, suggest creating a status:proposed
  GitHub issue, don't actually create one without confirmation."""


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
        "model": MODEL,
        "max_turns": MAX_TURNS,
        "has_secret": bool(SHARED_SECRET),
        "has_anthropic_key": bool(ANTHROPIC_API_KEY),
    }


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    session_id: str | None = None


@app.post("/chat", dependencies=[Depends(require_secret)])
async def chat(req: ChatRequest) -> EventSourceResponse:
    """Stream agent events as SSE.

    Event types we emit (matches the lite chat in /api/chat):
      - token:        {text: "..."}     -- assistant text delta
      - tool_use:     {name, input}     -- tool call announce
      - tool_result:  {name, ok}        -- tool finished
      - error:        {message}
      - done:         {stop_reason}
    """
    last_user = next((m for m in reversed(req.messages) if m.role == "user"), None)
    if last_user is None:
        raise HTTPException(400, "no user message")
    prompt = last_user.content

    options = ClaudeAgentOptions(
        cwd=WORKDIR,
        model=MODEL,
        max_turns=MAX_TURNS,
        system_prompt=SYSTEM_PROMPT,
        permission_mode="bypassPermissions",  # trusted environment, owner-only via shared secret
    )

    async def event_stream() -> AsyncIterator[dict[str, str]]:
        try:
            async with ClaudeSDKClient(options=options) as client:
                await client.query(prompt)
                async for msg in client.receive_messages():
                    payload = _serialize(msg)
                    if payload is None:
                        continue
                    event_name, data = payload
                    yield {"event": event_name, "data": json.dumps(data)}
                    if event_name == "done":
                        return
        except asyncio.CancelledError:
            log.info("client disconnected")
            raise
        except Exception as e:
            log.exception("agent error")
            yield {"event": "error", "data": json.dumps({"message": str(e)})}
            yield {"event": "done", "data": json.dumps({"stop_reason": "error"})}

    return EventSourceResponse(event_stream())


def _serialize(msg: Any) -> tuple[str, dict[str, Any]] | None:
    """Map Claude Agent SDK messages to our SSE event names."""
    cls = msg.__class__.__name__
    if cls == "AssistantMessage":
        for block in getattr(msg, "content", []):
            block_cls = block.__class__.__name__
            if block_cls == "TextBlock":
                return ("token", {"text": getattr(block, "text", "")})
            if block_cls == "ToolUseBlock":
                return (
                    "tool_use",
                    {
                        "name": getattr(block, "name", "?"),
                        "input": getattr(block, "input", {}),
                    },
                )
        return None
    if cls == "UserMessage":
        for block in getattr(msg, "content", []):
            if block.__class__.__name__ == "ToolResultBlock":
                return (
                    "tool_result",
                    {
                        "name": getattr(block, "tool_use_id", ""),
                        "ok": not getattr(block, "is_error", False),
                    },
                )
        return None
    if cls == "ResultMessage":
        return ("done", {"stop_reason": getattr(msg, "subtype", "end_turn")})
    return None


def main() -> None:
    import uvicorn

    uvicorn.run("eps_sidecar.main:app", host=HOST, port=PORT, log_level="info")


if __name__ == "__main__":
    main()
