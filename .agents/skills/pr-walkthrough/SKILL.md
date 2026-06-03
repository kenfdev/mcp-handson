---
name: pr-walkthrough
description: Use this skill when creating or updating pull requests in this repository, especially for MCP hands-on work that needs a new branch, TDD, filled PR descriptions, test results, Mermaid diagrams, and explanatory GitHub review comments.
---

# PR Walkthrough

Use this workflow for project pull requests. The goal is not just to change code, but to leave a reviewable learning trail that explains what changed, why it changed, and how it was verified.

## Branch Rule

Always start each task from `main` and create a task branch before changing files:

```bash
rtk git switch main
rtk git pull --ff-only
rtk git switch -c codex/<short-task-name>
```

Before editing, run `rtk git status -sb` and keep unrelated local files out of the branch. In this project, do not commit the untracked `docs/walkthrough.md` unless the user explicitly asks for it.

## TDD Rule

For feature work, use a RED/GREEN loop:

1. Write one focused integration test through the MCP public interface.
2. Run it and confirm it fails for the expected reason.
3. Explain the test to the user in Japanese: covered behavior, why it matters, and why it is not too fine-grained.
4. Wait for user approval before implementation.
5. Implement the minimum production code required to pass.
6. Run the integration test and build.

Prefer effective integration tests over narrow unit tests that couple to private implementation details. For non-feature project maintenance, use the most relevant validator plus the normal project tests.

## MCP Project Config

This project uses repo-local `.mcp.json` as the MCP server source of truth.

- Do not edit `~/.codex/config.toml` for this repository's MCP server.
- Do not run `codex mcp add task_notes_handson` unless the user explicitly asks for global registration.
- If a client does not auto-load `.mcp.json`, use a one-shot config override.

## PR Description

Always fill the PR description. In this environment, avoid `gh pr create --body-file -` because it has produced empty bodies. Write the body to a temporary Markdown file first, then pass the file path:

```bash
rtk gh pr create --draft --title "<title>" --body-file /tmp/<pr-body>.md
```

After creation or editing, verify the body is not empty:

```bash
rtk gh pr view <number> --json body --jq '(.body | length)'
```

If it is empty, rewrite it with:

```bash
rtk gh pr edit <number> --body-file /tmp/<pr-body>.md
```

The PR description should include:

- Purpose and learning theme
- What changed and why
- TDD RED/GREEN notes when feature code was built
- Mermaid diagrams when they clarify flow, boundaries, or failure semantics
- Exact test commands and pass/fail outcomes
- Next learning or implementation step

Minimum verification commands to include when applicable:

```bash
rtk pnpm --filter task-notes-mcp test
rtk pnpm build
```

If a real LLM or Codex smoke test was run against the MCP server, include the exact result.

## Inline Comments

Add GitHub PR review comments for code that teaches an important concept. Keep comments explanatory rather than ornamental:

- Explain the MCP concept represented by the code.
- Explain why the code is shaped this way.
- Use Mermaid diagrams where a small flow or sequence diagram makes the behavior clearer.
- Avoid commenting every line; focus on architecture, protocol boundaries, persistence behavior, and test strategy.

## Final Checks

Before handing off the PR:

```bash
rtk git status -sb
rtk gh pr view <number> --json title,body,url
```

Confirm the branch contains only intended files, the PR body has real content, and the test results in the body match commands that were actually run.
