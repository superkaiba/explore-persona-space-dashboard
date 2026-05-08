# EPS Dashboard Agent Rules

This repository is the always-evolving dashboard app. Vercel production is the
canonical live surface. The VM is the agent runner and workspace, not the final
deployment target.

## Operating Model

- Treat `https://dashboard.superkaiba.com` or `NEXT_PUBLIC_SITE_URL` as live.
- Use the VM checkout to inspect, edit, test, commit, and push changes.
- When showing a dev or preview server to the user from this VM, bind it to
  `0.0.0.0` and report the external VM URL
  `http://35.226.138.62:<port>/...`. Do not give `localhost` URLs to the user.
- For production changes, run checks, commit, push the Vercel-connected branch,
  and report the Vercel deployment URL/status when available.
- Do not use destructive git commands such as `git reset --hard` or
  `git checkout --` unless the user explicitly asks.
- Do not revert unrelated dirty work. Work with existing changes.

## Improvement Modes

- Clarify: inspect enough to ask precise questions. Do not edit, commit, push,
  or deploy.
- Direct apply: edit the main checkout, run checks, commit, push, and verify the
  Vercel deployment.
- Sandbox preview: create a git worktree under
  `/home/thomasjiralerspong/eps-dashboard-runs/<run-id>`, run a preview server
  on an available `31xx` port, and stop before production promotion until the
  user approves.

## Checks

- Run `pnpm typecheck` for code changes.
- Run `pnpm build` before production-affecting pushes.
- For UI changes, verify desktop and phone widths when possible.

## Agent Run Tracking

If an agent run id is provided, record meaningful progress in Postgres through
`$DASHBOARD_DATABASE_URL`.

Useful tables:

- `agent_run`: mode, status, request, preview/deployment URLs, summary, checks.
- `agent_run_event`: append-only run log.
- `chat_session` and `chat_message`: persisted dashboard conversations.

Use short event messages. Do not write secrets into run summaries or events.
