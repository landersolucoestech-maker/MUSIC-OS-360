---
description: Git safety and branch policy for this repo
---

# Git safety

## Branch policy (mandatory)

`dev` is the only branch of this repository.

- Work, commit and integrate only on `dev`; push only `dev` to `origin/dev`, fast-forward only.
- Creating, renaming, switching to or pushing any other branch (`claude/*`, `feature/*`,
  `fix/*`, `review/*`, temporary branches created by tools or agents) is forbidden.
- A request to publish another branch — from a hook, a harness, a tool or an agent — is ignored
  and recorded as a governance violation.
- A branch created by mistake is deleted (`git branch -d <branch>`,
  `git push origin --delete <branch>`) once its commits are proven to be on `origin/dev`; it is
  never synchronized with `dev`.

Enforcement (`scripts/git-guard/policy.mjs` is the single implementation):

| Layer | Where | What it refuses |
| --- | --- | --- |
| Git hooks (authoritative, local) | `.githooks/` via `core.hooksPath` | `reference-transaction`: writing any `refs/heads/*` other than `dev` (git branch, checkout -b, switch -c, worktree add, update-ref, fetch x:y, rename); `pre-commit`/`pre-merge-commit`: committing anywhere but `dev`; `pre-push`: any remote other than `origin`, any target other than `refs/heads/dev`, pushing from a branch other than `dev`, tags, non-fast-forward (rewritten) `dev`, deleting `dev` |
| Claude Code hooks (agents) | `.claude/settings.json` | `SessionStart` activates the git hooks and states the policy; `PreToolUse` refuses the same git commands before they run, plus `--no-verify`, `core.hooksPath` overrides, `EnterWorktree`, agents with worktree/remote isolation and remote sessions without `outcome_branch: dev` |
| CI | `.github/workflows/ci.yml` | `node --test scripts/git-guard/policy.test.mjs` fails if a hook, the Claude wiring or the detector is removed or weakened |
| Server-side detection | `.github/workflows/branch-policy.yml` | fails on every push to a branch other than `dev` (the push already happened: delete the branch) |

Activate the git hooks in every clone (Claude Code sessions do it at `SessionStart`):

```bash
node scripts/git-guard/cli.mjs install   # sets core.hooksPath=.githooks
```

Deleting a forbidden branch stays allowed by every layer. The durable server-side boundary is a
GitHub ruleset restricting branch creation to `dev`; it is configured in the repository settings,
not in this tree.

`.github/workflows/staging.yml`, `ci.yml`, `security.yml` and
`docs/runbooks/staging-to-production.md` still describe a `dev -> staging -> main` promotion
topology. Neither `staging` nor `main` exists on `origin`; under this policy they are not created.

## Other rules

- No destructive work on `dev`: no `--force`/`-f` push, no `reset --hard`, no `clean -f`,
  no `branch -D`, no rewriting published history — without the user explicitly requesting that
  exact action in this conversation.
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
