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
| Git hooks (authoritative, local) | installed by `scripts/git-guard/cli.mjs install` into `<git-common-dir>/git-guard/` (absolute `core.hooksPath`) | `reference-transaction`: writing a new value to any `refs/heads/*` other than `dev` (git branch, checkout -b, switch -c, worktree add, update-ref, fetch x:y, a commit on such a branch); `pre-commit`/`pre-merge-commit`: committing anywhere but `dev`; `pre-push`: any remote other than `origin`, any target other than `refs/heads/dev`, pushing from a branch other than `dev`, tags, non-fast-forward (rewritten) `dev`, deleting `dev` |
| Claude Code hooks (agents) | `.claude/settings.json` | `SessionStart` installs/refreshes the guard and states the policy; `PreToolUse` runs the installed guard, fails closed (`\|\| exit 2`) and refuses before they run: the same git commands (abbreviated long options included), `git checkout <branch>`, `branch -m/-c`, `symbolic-ref`, `--no-verify`, any `core.hooksPath`/`--config-env`/`GIT_CONFIG_*`/alias override, `send-pack`, `gh pr create`/`gh api` ref writes, GitHub MCP tools that create branches or pull requests or write to another branch, `EnterWorktree`, agents with worktree/remote isolation and remote sessions without `outcome_branch: dev`. Git commands aimed at another repository are not checked |
| CI | `.github/workflows/ci.yml` | `node --test scripts/git-guard/policy.test.mjs` (real repositories: old checkouts, worktrees, `--git-dir`, rename, pack-refs, tampering) fails if the guard, the Claude wiring or the detector is removed or weakened |
| Server-side detection | `.github/workflows/branch-policy.yml` | hourly (and on demand) from `dev`: fails while any branch other than `dev` exists on GitHub, however it was created; also fails a push to another branch when the pushed commit carries the workflow |

The guard installed in the git directory is the version committed on `dev` (then `origin/dev`);
the checked-out tree never decides what runs, so checking out an old commit, a detached worktree or
`git --git-dir`/`-C .git` keeps the same hooks. Install it in every clone (Claude Code sessions do
it at `SessionStart`) and check a clone with `verify`:

```bash
node scripts/git-guard/cli.mjs install        # <git-common-dir>/git-guard + core.hooksPath
node scripts/git-guard/cli.mjs verify         # on dev, only dev, = origin/dev, guard installed and current
node scripts/git-guard/cli.mjs verify-remote  # origin has no branch other than dev
```

Limits of the local layers (why the GitHub ruleset below is still required):

- a fresh clone is unguarded until `install`/`SessionStart` runs;
- `git commit --no-verify` / `git push --no-verify` skip `pre-commit`/`pre-push` (the Claude guard
  refuses them; `reference-transaction` still refuses other branches);
- git 2.43 does not report `git branch -m/-c` or `git symbolic-ref` to `reference-transaction`:
  commits and pushes from such a branch are still refused, `verify` reports it;
- someone without the guard (another machine, the GitHub web UI or API) is only detected afterwards.

The durable server-side boundary is a GitHub ruleset that restricts branch creation to `dev` and
blocks force pushes and deletion of `dev`; it is configured in the repository settings, not in
this tree. Deleting a forbidden branch stays allowed by every local layer.

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
