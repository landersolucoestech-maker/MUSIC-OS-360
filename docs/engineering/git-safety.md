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

Enforcement has four distinct layers. `scripts/git-guard/policy.mjs` is the single implementation of
the two local ones. Threat model: the local layers stop accidental and tool/agent-driven violations
(a harness asking to push a session branch, a tool creating a temporary branch) before they happen;
they are not a sandbox against someone deliberately working around git. Only the remote GitHub
ruleset (layer 4) is a boundary against that, or against anyone without the guard.

### 1. Local Claude interception (PreToolUse, agents only)

`.claude/settings.json` runs the installed guard before every `Bash`, `PowerShell`, `Monitor`,
`Edit`, `Write`, `MultiEdit`, `NotebookEdit`, `EnterWorktree`, `Agent`/`Task` and `mcp__*` tool call,
repairs `core.hooksPath` drift and fails closed (`|| exit 2`). `SessionStart` (re)installs the guard
and states the policy. It refuses before they run:

- git commands that create, switch to, rename, copy or push a branch other than `dev`
  (abbreviated long options included), `--no-verify`, `symbolic-ref` pointing HEAD or a branch
  elsewhere, `stash branch`, `update-ref --stdin`, `subtree push`, `git replace`, plumbing pushes
  (`send-pack`, `remote-*`, `http-push`), and anything that could switch the hooks off
  (`core.hooksPath`, `--config-env`, `GIT_CONFIG_*`, aliases, includes, config section removal,
  `init --separate-git-dir`);
- persistent writes of `push.default` / `remote.*.push` / `remote.*.mirror` and per-command
  `-c` overrides of those keys, except `-c push.default=simple|current|upstream|tracking|nothing`
  (single-branch modes); reading config (`git config <key>`, `--get`, `--list`, `get`) is allowed;
- a push refspec it cannot prove to be `dev -> origin/dev`; `$(git rev-parse --abbrev-ref HEAD)`,
  `$(git branch --show-current)` and `$(git symbolic-ref --short HEAD)` count as `dev` only while the
  project's current branch is `dev`, any other substitution fails closed;
- writes into a `.git` directory: a redirection whose target is a `.git` path, or any program other
  than a small read-only set (`cat`, `ls`, `grep`, `head`, `sed` without `-i`, …) given an argument
  naming a `.git` path at the start of a token or after `/` or `=` (`of=.git/HEAD`); after a
  wrapper (`env`, `sudo`, `xargs`, `flock`, …), any common writer (`rm`, `cp`, `tee`, …) in the
  command; a `>` redirection into `.git` inside script text (`awk '{print > ".git/HEAD"}'`,
  `node -e`, `python -c`, `echo … | sh`); `find` with a `.git` starting point and
  `-delete`/`-exec`/`-ok`, or whose `-exec`/`-ok` command or `-fprint`/`-fls` file writes there;
  `Edit`/`Write` into the git directory (real paths, so a symlinked project path does not bypass
  it). Patterns of `--exclude`, `--exclude-dir`, `--exclude-from`, `--ignore`, `--ignore-dir`
  (`rsync --exclude=.git`), `find` filters (`-not -path './.git/*'`), `.gitignore`, `.github/` and
  names merely containing `.git` are not targets;
- `gh pr create`/`checkout`, `gh issue develop`, `gh api` ref writes and branch renames, GraphQL ref
  or assignee mutations, and any Copilot delegation: `gh agent-task create`, `gh issue|pr create|edit`
  assigning Copilot in any spelling (`--assignee X`, `--assignee=X`, `--add-assignee=X`, `-a X`,
  `-a=X`, `-aX`, any case), `gh api` POST/PATCH/PUT on issue endpoints whose assignee fields name
  Copilot (or whose body comes from `--input`), and the GitHub MCP tools that create branches, pull
  requests or Copilot tasks or write to a branch other than `dev`;
- `EnterWorktree`, agents with worktree/remote isolation, remote sessions without
  `outcome_branch: dev`.

Commands are read as shell text: git/gh/shells are recognised behind `if`/`do`/`!`/`{`,
`VAR=value` and wrappers (`env`, `sudo`, `timeout`, `nice`, `xargs`, `find -exec`…), inside `$(…)`,
backticks, process substitutions, `sh -c [--]`, `eval`, `rebase -x`, `bisect run`, heredocs or
here-strings read by a shell, and `$(…)`/backticks inside unquoted heredoc bodies (a quoted
delimiter keeps the body literal). A command with an unterminated quote, substitution or heredoc
that mentions git/gh is refused. Git commands in another existing repository whose remotes are not
this project's are not checked.

### 2. Local git hook enforcement (every git client of a guarded clone)

`scripts/git-guard/cli.mjs install` copies the guard committed on `dev` (then `origin/dev`) into
`<git-common-dir>/git-guard/` and sets an absolute `core.hooksPath`; `.githooks/` holds fallback
shims that run the same installed guard.

- `reference-transaction`: writing a new value to any `refs/heads/*` other than `dev` (git branch,
  checkout -b, switch -c, worktree add, update-ref, fetch x:y, a commit on such a branch), checked
  with an exact ref lookup;
- `pre-commit`/`pre-merge-commit`: committing anywhere but `dev` (a rebase of `dev` is allowed);
- `pre-push`: any remote other than `origin`, any target other than `refs/heads/dev`, pushing from a
  branch other than `dev`, tags, non-fast-forward `dev` (checked on the real graph, ignoring replace
  refs and grafts), deleting `dev`.

The installed guard is the version committed on `dev`: uncommitted edits and the checked-out tree
never decide what runs, so an old checkout, a detached worktree or `git --git-dir`/`-C .git` keep
the same hooks. An installer from an older commit (d374b0e–6f0e0e1) points `core.hooksPath` at the
relative `.githooks`: checkouts that carry the shims (9d97f74 and later) still run the installed
guard through them, checkouts older than that run no hooks until the next Claude tool call restores
the absolute path (or `install` is run). Install it in every clone (Claude Code sessions do it at
`SessionStart`) and check a clone with `verify`:

```bash
node scripts/git-guard/cli.mjs install        # <git-common-dir>/git-guard + core.hooksPath
node scripts/git-guard/cli.mjs verify         # on dev, only dev, = origin/dev, guard installed and current
node scripts/git-guard/cli.mjs verify-remote  # origin has no branch other than dev
```

CI (`.github/workflows/ci.yml`) runs `node --test scripts/git-guard/policy.test.mjs` (real
repositories: old checkouts, worktrees, `--git-dir`, `-C .git`, decoy refs, replace/graft,
hooks-path drift, symlinked paths, rename, pack-refs/gc, tampering); it fails if the guard, the
Claude wiring or the detector is removed or weakened.

### 3. Remote detection (after the fact)

`.github/workflows/branch-policy.yml` is detection, not prevention. It is configured with an hourly
schedule (`cron: "23 * * * *"`) and `workflow_dispatch`; each run lists every branch through the
API from `dev` and fails while any branch other than `dev` exists. It also fails a push to another
branch when the pushed commit carries the workflow. A configured schedule is not evidence that
runs happen: check the Actions history of "Branch policy" for actual runs.

### 4. Remote authoritative boundary: GitHub ruleset (owner-configured)

The only boundary against actors without the guard (another machine, the GitHub web UI or API,
deliberate work-arounds) is a repository ruleset, configured by the owner in the repository
settings, not in this tree. It must target all branches and restrict creation of any branch other
than `dev`, and on `dev` block force pushes and deletion. At the time of this change no ruleset
exists (`GET /repos/{owner}/{repo}/rulesets` and `/rules/branches/dev` return `[]`, `dev` is not
protected): the policy is enforced locally and detected remotely, not enforced remotely.

Known limits of the local layers:

- a fresh clone is unguarded until `install`/`SessionStart` runs; moving a clone or
  `git init --separate-git-dir` leaves `core.hooksPath` dangling until the next `install`;
- the guard is exactly what is committed on `dev`: a weakened guard committed there is installed;
- outside Claude Code, `git commit/push --no-verify`, git plumbing that pushes without `pre-push`
  (`send-pack`, `remote-https`), hook-disabling config, replace refs/grafts and direct edits of
  `.git/` are not prevented locally (layer 1 refuses them for agents);
- the Claude guard reads shell text, not what other interpreters run: git or the GitHub API driven
  from `node -e`, `python -c`, `curl`, package scripts, `git submodule foreach`, arguments fed
  through `xargs` from a pipe, or user aliases that already exist in git config are not inspected
  (the git hooks still apply to git itself); likewise `.git` files written through an
  interpreter's own API (`open('.git/HEAD', 'w')`, `fs.writeFileSync`) or named by a glob
  (`.gi?/HEAD`) are not recognised;
- git 2.43 does not report `git branch -m/-c` or `git symbolic-ref` to `reference-transaction`:
  commits and pushes from such a branch are still refused, `verify` reports it;
- anyone without the guard is only detected afterwards, by layer 3, until layer 4 exists.

Deleting a forbidden branch stays allowed by every local layer. A user with `push.followTags=true`
must not create local annotated tags on `dev` (tag pushes are refused).

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
