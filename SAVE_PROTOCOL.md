# Save Protocol

When the user says "저장", update the project so the next Codex session can resume with minimal scanning.

## Required Actions

1. Inspect current code and project state only as much as needed.
2. Update `AI_HANDOFF.md` with:
   - current product and technical decisions
   - important recent code, asset, or document changes
   - latest observed verification results
   - known blockers or fragile areas
3. Update `RUNBOOK.md` when commands, deployment steps, entrypoints, or verification steps changed.
4. Add a short "Next Recommended Steps" section to `AI_HANDOFF.md`.
5. Run the narrowest practical verification command.
6. Commit the save point to Git unless the user explicitly says not to commit.
7. Push the current branch to the configured remote unless the user explicitly says not to push.

## Commit Guidance

- Keep credentials, API keys, local caches, generated bundles, and build outputs out of Git.
- Treat "저장" as including documentation refresh, handoff refresh, commit, and push.
- Prefer clear commit messages, for example:
  - `Save wherego handoff state`
  - `Add terms pages and app assets`
  - `Document wherego setup`
- Before committing, check:
  - `git status --short`
  - `git diff --stat`
- Before pushing, confirm:
  - `git branch --show-current`
  - `git remote -v`

## Handoff Quality Bar

The next session should know:

- what changed
- what was verified
- what remains risky
- what to do next
- which command to run first
