# EPS Sidecar

Subprocesses the real `claude` CLI in headless mode (`claude --print
--output-format stream-json`) and streams its events to the Vercel chat
rail over Cloudflare Tunnel.

This means the chat agent is byte-identical to running `claude` in a
terminal on the VM — same CLAUDE.md, same custom subagents, same skills,
same MCP servers, same memory, same plugins, same model (Opus 4.7 1M),
same default tools.

The lite chat at `/api/chat` keeps working — this sidecar adds the
heavyweight mode the dashboard routes to via `/api/chat-full` when the
user toggles `FULL` in the rail header.

## What it does differently from the lite chat

| | `/api/chat` (Vercel) | `/api/chat-full` (sidecar) |
|---|---|---|
| Agent | Anthropic SDK + 5 hand-coded tools | Real `claude` CLI process |
| Model | claude-sonnet-4-6 | claude-opus-4-7 1M |
| Tools | list_claims / get_claim / etc. | every tool in your terminal Claude session (Bash, Read, Edit, Grep, MCP, plugins, ...) |
| Project context | none | CLAUDE.md, settings.json, .mcp.json auto-loaded |
| Custom subagents | none | all of `.claude/agents/` |
| Custom skills / slash commands | none | all of `.claude/skills/` (and via `Skill` tool) |
| Memory | none | `~/.claude/projects/.../memory/` auto-loaded |
| Working dir | n/a | `EPS_WORKDIR` (research repo) |
| Cost per query | ~$0.01 | $0.10–$1.00 (Opus + first-message cache miss); subsequent queries cache for ~10 min |
| Per-request budget | n/a | `SIDECAR_MAX_BUDGET_USD` (default $1.00); `SIDECAR_TIMEOUT_S` (default 300s) |

## Setup on the VM

```bash
cd ~/explore-persona-space-dashboard/sidecar
uv sync                          # creates .venv, installs deps
cp .env.example .env
# edit .env:
#   - SIDECAR_SHARED_SECRET=$(openssl rand -hex 32)   # save this; Vercel needs it too
#   - ANTHROPIC_API_KEY=...                            # reuse the project key
#   - EPS_WORKDIR=/home/thomasjiralerspong/explore-persona-space

# smoke-test
uv run python -m eps_sidecar.main
# in another shell:
curl -s http://127.0.0.1:7654/health | jq

# stop with ctrl-c when health works
```

## Run as a systemd service

```bash
sudo tee /etc/systemd/system/eps-sidecar.service > /dev/null <<'EOF'
[Unit]
Description=EPS Dashboard Claude Code sidecar
After=network.target

[Service]
Type=simple
User=thomasjiralerspong
WorkingDirectory=/home/thomasjiralerspong/explore-persona-space-dashboard/sidecar
EnvironmentFile=/home/thomasjiralerspong/explore-persona-space-dashboard/sidecar/.env
ExecStart=/home/thomasjiralerspong/.local/bin/uv run python -m eps_sidecar.main
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now eps-sidecar
journalctl -u eps-sidecar -f          # tail logs
```

## Expose via Cloudflare Tunnel

```bash
# install cloudflared (one-time)
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 \
  -o /tmp/cloudflared && sudo install -m 0755 /tmp/cloudflared /usr/local/bin/

cloudflared tunnel login              # opens browser, auth once
cloudflared tunnel create eps-chat    # records tunnel ID

cat > ~/.cloudflared/config.yml <<EOF
tunnel: eps-chat
credentials-file: $HOME/.cloudflared/<TUNNEL-ID>.json

ingress:
  - hostname: chat.YOUR-DOMAIN.com
    service: http://127.0.0.1:7654
  - service: http_status:404
EOF

cloudflared tunnel route dns eps-chat chat.YOUR-DOMAIN.com
sudo cloudflared service install
sudo systemctl enable --now cloudflared
```

Verify: `curl https://chat.YOUR-DOMAIN.com/health` should return JSON.

## Wire into Vercel

Add two env vars to the Vercel project (we can do this via the Vercel API
once you give the values — see the parent dashboard repo's notes):

```
NEXT_PUBLIC_SIDECAR_URL=https://chat.YOUR-DOMAIN.com
SIDECAR_SHARED_SECRET=<paste the secret you generated above>
```

Then a `/api/chat-full` route will land in the dashboard repo to proxy.

## Manual smoke test through the tunnel

```bash
SECRET="$(grep SIDECAR_SHARED_SECRET .env | cut -d= -f2)"
curl -N -X POST "https://chat.YOUR-DOMAIN.com/chat" \
  -H "Authorization: Bearer ${SECRET}" \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"how many claims are in the dashboard?"}]}'
```

You should see streamed `event: token / tool_use / tool_result / done` lines.

## Known limits

- One agent session per request (no resume yet — `session_id` field is
  reserved for the future)
- 15-turn cap by default — long debugging sessions may need raising
- No CORS to anything besides the Vercel URL — change `allow_origins` if
  testing from elsewhere
