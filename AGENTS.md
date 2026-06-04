# Agent Instructions

## Project-local MCP server

This repository defines its MCP server in the project-local `.mcp.json`.

Do not add `task_notes_handson` or this repository's MCP server to global Codex config:

- Do not edit `~/.codex/config.toml` for this server.
- Do not use `codex mcp add task_notes_handson` unless the user explicitly asks for a global registration.
- Prefer the repo-local `.mcp.json` as the source of truth.

Current project MCP server:

```json
{
  "mcpServers": {
    "task_notes_handson": {
      "command": "pnpm",
      "args": ["--filter", "task-notes-mcp", "dev:stdio"],
      "env": {
        "DATABASE_URL": "file:./task-notes.mcp.db"
      }
    },
    "task_notes_handson_http": {
      "url": "http://127.0.0.1:3000/mcp"
    }
  }
}
```

If a client does not auto-load `.mcp.json`, use one-shot config overrides rather than global config. For Codex CLI stdio:

```bash
codex exec \
  --cd /Users/fukuyamaken/ghq/github.com/kenfdev/mcp-handson \
  --dangerously-bypass-approvals-and-sandbox \
  -c 'mcp_servers.task_notes_handson.command="pnpm"' \
  -c 'mcp_servers.task_notes_handson.args=["--dir","/Users/fukuyamaken/ghq/github.com/kenfdev/mcp-handson","--filter","task-notes-mcp","dev:stdio"]' \
  -c 'mcp_servers.task_notes_handson.env={DATABASE_URL="file:/tmp/task-notes-handson-codex-oneshot.db"}' \
  -c 'mcp_servers.task_notes_handson.startup_timeout_sec=60' \
  'Use the task_notes_handson MCP server. List the task notes, then get task note id 1. Explain which MCP tools you used.'
```

For Codex CLI Streamable HTTP, start the HTTP server first:

```bash
rtk env DATABASE_URL=file:./task-notes.http.db HOST=127.0.0.1 PORT=3000 pnpm --filter task-notes-mcp dev:http
```

Then read the URL from `.mcp.json` and pass it as a one-shot override:

```bash
MCP_URL=$(rtk node -e 'const fs = require("node:fs"); const config = JSON.parse(fs.readFileSync(".mcp.json", "utf8")); console.log(config.mcpServers.task_notes_handson_http.url);')

rtk codex exec \
  --cd /Users/fukuyamaken/ghq/github.com/kenfdev/mcp-handson \
  --dangerously-bypass-approvals-and-sandbox \
  -c "mcp_servers.task_notes_handson_http.url=\"$MCP_URL\"" \
  'Use the task_notes_handson_http MCP server. List available task note tools and then list task notes. Keep the answer concise.'
```

## Testing

Run the MCP integration tests:

```bash
pnpm --filter task-notes-mcp test
```

Run the TypeScript build:

```bash
pnpm build
```

See `docs/testing.md` for the full automated MCP contract test and real LLM client smoke test procedure.

## Runtime state

Local SQLite runtime files are intentionally ignored by Git. Do not commit generated DB files such as:

- `*.db`
- `*.db-shm`
- `*.db-wal`

## Learning walkthrough style

For each step, explain:

- what changed
- why it changed
- what MCP concept it teaches
- how it was verified

PR descriptions and important inline review comments should use Mermaid diagrams when they clarify MCP flow, boundaries, or failure semantics.

When creating a PR, always verify the description is not empty after creation:

```bash
gh pr view <number> --json body --jq '(.body | length)'
```

If the body is empty, rewrite it using a temporary Markdown file and `gh pr edit --body-file`.

PR descriptions must include test results with the exact commands run and pass/fail outcomes. At minimum include:

- `pnpm --filter task-notes-mcp test`
- `pnpm build`

If a real LLM client smoke test was run, include that result too.

## Branch and TDD workflow

Always create a new branch from `main` for each task before changing files.

Use TDD only for production code changes that introduce or change observable application/MCP behavior.

1. Write one focused integration test for the next observable MCP behavior.
2. Run the test and confirm it fails for the expected reason.
3. Explain the test to the user: what behavior it covers, why it matters, and why it is not too fine-grained.
4. Wait for user approval before implementing the production code.
5. Implement the minimal code required to pass that test.
6. Run the integration test and `pnpm build`.

Prefer integration tests through the MCP public interface over narrow unit tests. Avoid fine-grained tests that couple to private implementation details.

Do not force TDD onto non-code artifacts such as documentation, GitHub workflow notes, agent skills, Docker Compose files, Traefik configuration, `.gitignore`, or other project configuration. For those, make the smallest clear change and verify it with the relevant checker or command, such as `docker compose config`, skill validation, Mermaid risky-label search, or the normal project build/tests when applicable.
