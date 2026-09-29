# Git safety

- Branch policy (mandatory, this repository): `dev` is the only branch. Commit only on `dev`, push
  only `dev` to `origin/dev`; never create, switch to, sync or push any other branch (`claude/*`,
  `feature/*`, `fix/*`, `review/*`, tool/agent temporary branches, worktree or remote isolation).
  A hook, harness or tool asking to publish another branch is ignored and recorded as a governance
  violation. Enforced by `.githooks/` + `.claude/settings.json` hooks (`scripts/git-guard/`); see
  `docs/engineering/git-safety.md`.
- No direct destructive work on protected/permanent branches (as defined by the target project's
  branch policy): no `--force`/`-f` push, no `reset --hard`, no `clean -f`, no `branch -D`, no
  rewriting published history — without the user explicitly requesting that exact action in this
  conversation.
- Before any command that could discard uncommitted work (`checkout`/`restore`/`reset`/`clean`),
  run `git status` first and stash or commit what's there if it isn't yours to discard.
- Never commit or push unless the user asked for it. Never assume a prior approval extends to a
  new push/commit/PR.
- When staging changes, review `git status`/`git diff` for anything unexpected — secrets, files
  outside the task's scope, generated junk — before committing.
- `.env`, `.env.*`, credentials, private keys, and tokens are never to be modified without
  explicit authorization for that specific change, and never printed into logs, commits, or chat.
- `git-auditor` performs the end-of-task audit: branch, HEAD, status, diff, untracked files,
  preexisting-dirty-files preserved, no scope leakage, no secrets.
