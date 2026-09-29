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

Enforcement (`scripts/git-guard/policy.mjs` is the single implementation). Threat model: the local
layers stop accidental and tool/agent-driven violations (a harness asking to push a session branch,
a tool creating a temporary branch) before they happen; they are not a sandbox against someone
deliberately working around git. The GitHub ruleset below is the only boundary for that.

| Layer | Where | What it refuses |
| --- | --- | --- |
| Git hooks (authoritative, local) | installed by `scripts/git-guard/cli.mjs install` into `<git-common-dir>/git-guard/` from the version committed on `dev`, absolute `core.hooksPath`; `.githooks/` holds fallback shims that run the same installed guard | `reference-transaction`: writing a new value to any `refs/heads/*` other than `dev` (git branch, checkout -b, switch -c, worktree add, update-ref, fetch x:y, a commit on such a branch), checked with an exact ref lookup; `pre-commit`/`pre-merge-commit`: committing anywhere but `dev`; `pre-push`: any remote other than `origin`, any target other than `refs/heads/dev`, pushing from a branch other than `dev`, tags, non-fast-forward `dev` (checked on the real graph, ignoring replace refs and grafts), deleting `dev` |
| Claude Code hooks (agents) | `.claude/settings.json` | `SessionStart` (re)installs the guard and states the policy; `PreToolUse` runs the installed guard, repairs `core.hooksPath` drift, fails closed (`\|\| exit 2`) and refuses before they run: branch-creating/switching git commands (abbreviated options included), `branch -m/-c`, `symbolic-ref`, `--no-verify`, hook-disabling config (`core.hooksPath`, `--config-env`, `GIT_CONFIG_*`, aliases, includes, section removal, `init --separate-git-dir`), `git replace`, plumbing pushes (`send-pack`, `remote-*`, `http-push`), writes into `.git/` (Bash and Edit/Write), `gh pr create`/`gh issue develop`/`gh api` ref writes, GitHub MCP tools that create branches, pull requests or Copilot branches or write to another branch, `EnterWorktree`, agents with worktree/remote isolation and remote sessions without `outcome_branch: dev`. Git commands in another existing repository whose remotes are not this project's are not checked |
| CI | `.github/workflows/ci.yml` | `node --test scripts/git-guard/policy.test.mjs` (real repositories: old checkouts, worktrees, `--git-dir`, `-C .git`, decoy refs, replace/graft, hooks-path drift, symlinked paths, rename, pack-refs/gc, tampering) fails if the guard, the Claude wiring or the detector is removed or weakened |
| Server-side detection | `.github/workflows/branch-policy.yml` | hourly (and on demand) from `dev`: fails while any branch other than `dev` exists on GitHub, however it was created; also fails a push to another branch when the pushed commit carries the workflow |

The installed guard is the version committed on `dev` (then `origin/dev`): uncommitted edits and
the checked-out tree never decide what runs, so an old checkout, a detached worktree or
`git --git-dir`/`-C .git` keep the same hooks, and a worktree on an old commit whose installer
points `core.hooksPath` at `.githooks` still runs it through the shims (the next Claude tool call
restores the absolute path). Install it in every clone (Claude Code sessions do it at
`SessionStart`) and check a clone with `verify`:

```bash
node scripts/git-guard/cli.mjs install        # <git-common-dir>/git-guard + core.hooksPath
node scripts/git-guard/cli.mjs verify         # on dev, only dev, = origin/dev, guard installed and current
node scripts/git-guard/cli.mjs verify-remote  # origin has no branch other than dev
```

Known limits of the local layers (why the GitHub ruleset is required):

- a fresh clone is unguarded until `install`/`SessionStart` runs; moving a clone or
  `git init --separate-git-dir` leaves `core.hooksPath` dangling until the next `install`;
- the guard is exactly what is committed on `dev`: a weakened guard committed there is installed;
- outside Claude Code, `git commit/push --no-verify`, git plumbing that pushes without `pre-push`
  (`send-pack`, `remote-https`), hook-disabling config, replace refs/grafts and direct edits of
  `.git/` are not prevented locally (the Claude guard refuses them for agents);
- git 2.43 does not report `git branch -m/-c` or `git symbolic-ref` to `reference-transaction`:
  commits and pushes from such a branch are still refused, `verify` reports it;
- anyone without the guard (another machine, the GitHub web UI or API) is only detected afterwards,
  by the hourly scan.

The durable server-side boundary is a GitHub ruleset that restricts branch creation to `dev` and
blocks force pushes and deletion of `dev`; it is configured in the repository settings, not in
this tree. Deleting a forbidden branch stays allowed by every local layer. A user with
`push.followTags=true` must not create local annotated tags on `dev` (tag pushes are refused).

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
