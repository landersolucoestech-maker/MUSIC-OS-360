import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { appendFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  checkCommitBranch, checkPush, checkRefTransaction, checkShellCommand, checkToolUse, shellCommands,
} from './policy.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const A = 'a'.repeat(40);
const B = 'b'.repeat(40);
const Z = '0'.repeat(40);
const refused = (command, branch = 'dev', options) => checkShellCommand(command, branch, options).length > 0;

test('commits are allowed only on dev (or while rebasing dev)', () => {
  assert.deepEqual(checkCommitBranch('refs/heads/dev'), []);
  assert.deepEqual(checkCommitBranch(null, 'refs/heads/dev'), []);
  assert.equal(checkCommitBranch('refs/heads/claude/beautiful-gates-c0kwj5').length, 1);
  assert.equal(checkCommitBranch('refs/heads/main').length, 1);
  assert.equal(checkCommitBranch(null).length, 1);
  assert.equal(checkCommitBranch(null, 'refs/heads/feature/x').length, 1);
});

test('no branch other than dev can be written; deletions, non-branch refs and repacking pass', () => {
  assert.deepEqual(checkRefTransaction([`${Z} ${A} refs/heads/dev`, `${A} ${B} refs/heads/dev`]), []);
  assert.deepEqual(checkRefTransaction([`${A} ${Z} refs/heads/claude/beautiful-gates-c0kwj5`]), []);
  assert.deepEqual(checkRefTransaction([`${Z} ${A} refs/remotes/origin/feature/x`, `${Z} ${A} refs/stash`, `${Z} ${A} HEAD`, `${Z} ${A} refs/tags/v1`]), []);
  for (const ref of ['claude/x', 'feature/x', 'fix/x', 'review/x', 'main', 'staging', 'devx', 'dev/x']) {
    assert.equal(checkRefTransaction([`${Z} ${A} refs/heads/${ref}`]).length, 1, ref);
  }
  // pack-refs/gc present an existing ref with its current value: not a write
  assert.deepEqual(checkRefTransaction([`${Z} ${A} refs/heads/legacy/x`], (ref) => (ref === 'refs/heads/legacy/x' ? A : null)), []);
  assert.equal(checkRefTransaction([`${A} ${B} refs/heads/legacy/x`], () => A).length, 1, 'moving an existing non-dev branch');
});

test('push: only dev -> origin/dev, fast-forward only; forbidden branches may be deleted', () => {
  const base = { remote: 'origin', currentBranchRef: 'refs/heads/dev', isAncestor: () => true };
  assert.deepEqual(checkPush({ ...base, updates: [`refs/heads/dev ${A} refs/heads/dev ${B}`] }), []);
  assert.deepEqual(checkPush({ ...base, updates: [`HEAD ${A} refs/heads/dev ${B}`] }), []);
  assert.deepEqual(checkPush({ ...base, updates: [`refs/heads/dev ${A} refs/heads/dev ${Z}`] }), []);
  assert.deepEqual(checkPush({ ...base, updates: [`(delete) ${Z} refs/heads/claude/beautiful-gates-c0kwj5 ${A}`] }), []);
  const count = (overrides) => checkPush({ ...base, ...overrides }).length;
  assert.equal(count({ updates: [`refs/heads/dev ${A} refs/heads/claude/beautiful-gates-c0kwj5 ${Z}`] }), 1);
  assert.equal(count({ updates: [`refs/heads/dev ${A} refs/heads/main ${B}`] }), 1);
  assert.equal(count({ updates: [`refs/tags/v1 ${A} refs/tags/v1 ${Z}`] }), 1);
  assert.equal(count({ updates: [`(delete) ${Z} refs/heads/dev ${A}`] }), 1);
  assert.equal(count({ updates: [`(delete) ${Z} refs/tags/v1 ${A}`] }), 1);
  assert.equal(count({ updates: [`refs/heads/feature/x ${A} refs/heads/dev ${B}`] }), 1);
  assert.equal(count({ currentBranchRef: 'refs/heads/claude/x', updates: [`HEAD ${A} refs/heads/dev ${B}`] }), 1);
  assert.equal(count({ isAncestor: () => false, updates: [`refs/heads/dev ${A} refs/heads/dev ${B}`] }), 1);
  assert.equal(count({ remote: 'https://github.com/x/y.git', updates: [`refs/heads/dev ${A} refs/heads/dev ${B}`] }), 1);
});

test('shell parsing: quotes, chains, substitutions, nested shells, redirections, heredocs, comments', () => {
  assert.deepEqual(shellCommands(`cd /repo && git commit -m "a && b; c" || echo 'git push x'`), [
    ['cd', '/repo'], ['git', 'commit', '-m', 'a && b; c'], ['echo', 'git push x'],
  ]);
  assert.deepEqual(shellCommands('x=$(git rev-parse HEAD)'), [['git', 'rev-parse', 'HEAD'], ['x=$(git rev-parse HEAD)']]);
  assert.deepEqual(shellCommands('git push origin HEAD:dev 2>&1 | tail -3'), [['git', 'push', 'origin', 'HEAD:dev'], ['tail', '-3']]);
  assert.deepEqual(shellCommands('git push origin dev >/dev/null 2>>err.log </dev/null &>all.log'), [['git', 'push', 'origin', 'dev']]);
  assert.deepEqual(shellCommands('echo a2>f'), [['echo', 'a2']]);
  assert.deepEqual(checkShellCommand(`echo "git checkout -b feature/x"`), []);
  for (const command of [
    'bash -c "git checkout -b feature/x"', 'sh -lc "git switch -c fix/x"', 'bash -xc \'git branch review/x\'', 'eval git switch -c fix/x',
    'echo "$(git checkout -b claude/x)"', 'echo "`git branch feature/y`"', 'diff <(git checkout -b x) y',
    "bash <<'EOF'\ngit checkout -b feature/x\nEOF",
    "cat <<'EOF'\nharmless\nEOF\ngit push origin HEAD:feature/x 2>&1",
    'x=$((1<<2))\ngit branch feature/after-arithmetic', '# a comment <<EOF\ngit branch feature/after-comment',
    "cat <<'EOF' | bash\ngit branch feature/piped\nEOF",
  ]) assert.ok(refused(command), command);
  for (const command of [
    'git push origin HEAD:dev 2>&1 | tail -3', 'git push origin dev > out.txt 2>&1', 'git push -u origin dev &>/dev/null',
    "cat > msg.txt <<'EOF'\ngit push origin claude/x\ngit checkout -b feature/x\nEOF\ngit commit -F msg.txt",
    'python3 - <<-EOF\n\tgit switch -c x\n\tEOF', 'echo $((1<<2)) # git branch not-a-command',
  ]) assert.deepEqual(checkShellCommand(command, 'dev'), [], command);
});

test('Claude guard refuses branch creation, switching, renames and hook bypasses', () => {
  for (const command of [
    'git checkout -b claude/x', 'git checkout -B x origin/dev', 'git checkout --orphan x', 'git checkout -t origin/main',
    'git checkout claude/beautiful-gates-c0kwj5', 'git checkout feature/x', 'git checkout --orph=x',
    'git switch -c feature/x', 'git switch --create=fix/x', 'git switch --cre fix/x', 'git switch main', 'git switch -C review/x',
    'git branch review/x', 'git branch -f x HEAD', 'git branch -m dev dev2', 'git branch -c dev x', 'git branch --mov dev x', 'git branch -D dev',
    'git branch --set-upstream-to=origin/main main', 'git symbolic-ref HEAD refs/heads/feature/x', 'git symbolic-ref refs/heads/x refs/heads/dev',
    'git worktree add ../w', 'git worktree add -b x ../w', 'git update-ref refs/heads/x HEAD',
    'git -c core.hooksPath=/dev/null commit -m x', 'git config core.hooksPath /dev/null', 'git config --unset core.hooksPath',
    'git --config-env=core.hooksPath=HP commit -m x', 'GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=core.hooksPath GIT_CONFIG_VALUE_0=/x git push origin dev',
    'export GIT_CONFIG_PARAMETERS="\'core.hookspath\'=\'/x\'"', "git -c alias.p='!git push' p", 'git config alias.p "!git push origin x"',
    'git send-pack ../o.git dev:refs/heads/x', 'git-send-pack ../o.git dev:refs/heads/x',
    'git commit --no-verify -m x', 'git commit --no-verif -m x', 'git commit -nm x', 'git merge --no-veri x', 'git -C /repo checkout -b x',
    'timeout 60 git branch x', 'nice -n 10 git switch -c x', 'env -i PATH=/usr/bin git branch x', 'xargs -n1 git branch', 'env FOO=1 git checkout -b x',
    'sudo -u root git branch x', 'env -u X git branch x', 'timeout -s KILL 60 git branch x', 'git --attr-source HEAD branch x',
    'git config --remove-section core', 'git config --rename-section core x', 'git config include.path /tmp/x', 'git init --separate-git-dir=/tmp/g',
    'git replace --graft HEAD abc1234', 'git update-ref refs/replace/abc def', 'git remote-https origin https://x/y', 'git-remote-https origin x', 'git http-push x',
    'git branch -v newname', 'git branch --sort=refname newname', 'git push --receive-pack=x origin dev',
    'rm -rf .git/git-guard', 'sed -i s/x/y/ .git/config', 'echo x > .git/config', 'cp a .git/hooks/pre-push', 'printf x >> /repo/.git/info/grafts',
  ]) assert.ok(refused(command), command);
  assert.ok(refused('git commit -m x', 'claude/beautiful-gates-c0kwj5'));

  for (const command of [
    'git status', 'git branch', 'git branch -a', 'git branch -vv', 'git branch --show-current', 'git branch -d claude/x',
    'git branch --contains HEAD', 'git branch --list "claude/*"', 'git branch -u origin/dev', 'git branch -f dev origin/dev',
    'git switch dev', 'git switch --detach HEAD~1', 'git checkout -- file.ts', 'git checkout dev', 'git checkout HEAD~2 -- a.ts',
    'git checkout 6cc2917', 'git checkout origin/dev', 'git checkout --detach 6cc2917', 'git checkout .',
    'git switch -c dev --track origin/dev', 'git checkout -b dev origin/dev', 'git symbolic-ref -q HEAD', 'git symbolic-ref HEAD refs/heads/dev',
    'git worktree add --detach ../review HEAD', 'git config --get core.hooksPath', 'git config --list',
    'git commit -m "fix: core.hooksPath is managed by the guard"', 'git fetch origin dev', 'git log --oneline -3', 'timeout 60 git push origin HEAD:dev',
    'echo git branch x', 'grep -rn "git checkout -b" docs',
    'git checkout abc1234~1 -- a.ts', 'git checkout v1.2.0 -- f', 'git checkout stash@{0} -- a.ts', 'git checkout HEAD@{1} -- a.ts',
    'git checkout ORIG_HEAD -- f', 'git checkout main -- f', 'git commit -mRefactoring', 'git commit -uno -m x', 'git commit -am "x"',
    'git replace --list', 'cat .git/config', 'node .git/git-guard/cli.mjs verify', 'git worktree add ../w abc1234',
  ]) assert.deepEqual(checkShellCommand(command, 'dev'), [], command);
  const resolveRevision = (name) => ({ 'src/a.ts': 'path', 'v1.2.0': 'commit', legacy: 'branch' })[name] ?? null;
  assert.deepEqual(checkShellCommand('git checkout src/a.ts', 'dev', { resolveRevision }), []);
  assert.deepEqual(checkShellCommand('git checkout v1.2.0', 'dev', { resolveRevision }), []);
  assert.ok(refused('git checkout legacy', 'dev', { resolveRevision }));
  assert.ok(refused('git checkout claude/beautiful-gates-c0kwj5', 'dev', { resolveRevision }), 'DWIM from origin');
});

test('Claude guard: pushes go only from dev to origin/dev; abbreviated options are recognised', () => {
  for (const command of [
    'git push origin HEAD:dev', 'git push -u origin dev', 'git push origin dev', 'git push origin refs/heads/dev:refs/heads/dev',
    'git push', 'git push origin @:dev', 'git push origin --delete claude/beautiful-gates-c0kwj5', 'git push origin :feature/x', 'git push --dry-run origin dev',
  ]) assert.deepEqual(checkShellCommand(command, 'dev'), [], command);
  for (const command of [
    'git push -u origin claude/beautiful-gates-c0kwj5', 'git push origin HEAD:feature/x', 'git push origin dev:main',
    'git push upstream dev', 'git push --all origin', 'git push --al origin', 'git push --mirror origin', 'git push --mirr origin',
    'git push --tags origin', 'git push --tag origin', 'git push --force origin dev', 'git push -f origin dev', 'git push --force-with-lease origin dev',
    'git push --no-veri --force-with origin dev', 'git push origin +dev', 'git push --no-verify origin dev', 'git push origin --delete dev', 'git push origin :dev',
  ]) assert.ok(refused(command), command);
  assert.ok(refused('git push', 'claude/beautiful-gates-c0kwj5'));
  assert.ok(refused('git push origin HEAD', 'claude/beautiful-gates-c0kwj5'));
});

test('Claude guard: git commands aimed at another repository are not this policy\'s business', () => {
  const options = { cwd: '/repo', isProjectDir: (dir) => dir === '/repo' || dir.startsWith('/repo/') };
  assert.deepEqual(checkShellCommand('cd /tmp/lab && git checkout -b feature/x', 'dev', options), []);
  assert.deepEqual(checkShellCommand('git -C /tmp/lab branch x', 'dev', options), []);
  assert.ok(refused('git -C /repo/sub branch x', 'dev', options));
  assert.ok(refused('git --git-dir=/repo/.git branch x', 'dev', options));
  assert.ok(refused('cd "$DIR" && git branch x', 'dev', options), 'unknown directory counts as this repository');
  assert.ok(refused('cd /tmp/lab && cd /repo && git branch x', 'dev', options));
  assert.ok(refused('(cd /tmp/lab && ls) && git push --no-verify origin HEAD:claude/x', 'dev', options), 'cd in a subshell does not leak');
  assert.ok(refused('echo "$(cd /tmp/lab)" && git branch x', 'dev', options), 'cd in a substitution does not leak');
  assert.ok(refused('export GIT_DIR=/repo/.git; cd /tmp/lab && git branch x', 'dev', options));
  assert.ok(refused('export GIT_DIR="$D"; cd /tmp/lab && git branch x', 'dev', options));
  const withUrls = { ...options, projectUrls: ['https://github.com/o/r', 'https://github.com/o/r.git', '/repo'] };
  assert.ok(refused('cd /tmp/lab && git remote set-url origin https://github.com/o/r.git', 'dev', withUrls));
  assert.ok(refused('cd /tmp/lab && git remote add up /repo', 'dev', withUrls));
  assert.ok(refused('cd /tmp/lab && git remote set-url origin "$(git -C /repo remote get-url origin)"', 'dev', withUrls));
  assert.ok(refused('cd /tmp/lab && git push https://github.com/o/r.git dev:claude/x', 'dev', withUrls));
  assert.deepEqual(checkShellCommand('cd /tmp/lab && git remote add origin https://example.com/lab.git', 'dev', withUrls), []);
});

test('Claude guard: tools that create temporary branches are refused', () => {
  assert.equal(checkToolUse({ tool_name: 'EnterWorktree', tool_input: {} }).length, 1);
  assert.equal(checkToolUse({ tool_name: 'Agent', tool_input: { isolation: 'worktree' } }).length, 1);
  assert.equal(checkToolUse({ tool_name: 'Agent', tool_input: { isolation: 'remote' } }).length, 1);
  assert.deepEqual(checkToolUse({ tool_name: 'Agent', tool_input: { prompt: 'review' } }), []);
  assert.equal(checkToolUse({ tool_name: 'mcp__Claude_Code_Remote__create_session', tool_input: {} }).length, 1);
  assert.deepEqual(checkToolUse({ tool_name: 'mcp__Claude_Code_Remote__create_session', tool_input: { outcome_branch: 'dev' } }), []);
  assert.equal(checkToolUse({ tool_name: 'Bash', tool_input: { command: 'git checkout -b x' } }, 'dev').length, 1);
  assert.deepEqual(checkToolUse({ tool_name: 'Read', tool_input: { file_path: '/x' } }), []);
  const isGitDirPath = (file) => file.startsWith('/repo/.git/');
  for (const tool_name of ['Edit', 'Write', 'MultiEdit']) {
    assert.equal(checkToolUse({ tool_name, tool_input: { file_path: '/repo/.git/config' } }, 'dev', { isGitDirPath }).length, 1, tool_name);
  }
  assert.deepEqual(checkToolUse({ tool_name: 'Edit', tool_input: { file_path: '/repo/src/a.ts' } }, 'dev', { isGitDirPath }), []);
});

test('Claude guard: GitHub API tools and gh cannot create or write other branches', () => {
  for (const [tool_name, tool_input] of [
    ['mcp__github__create_branch', { owner: 'o', repo: 'r', branch: 'claude/x', from_branch: 'dev' }],
    ['mcp__github__create_pull_request', { owner: 'o', repo: 'r', head: 'feature/x', base: 'dev' }],
    ['mcp__github__update_pull_request_branch', { pullNumber: 1 }],
    ['mcp__github__push_files', { branch: 'fix/x', files: [] }],
    ['mcp__github__create_or_update_file', { branch: 'review/x', path: 'a' }],
    ['mcp__github__delete_file', { path: 'a' }],
    ['mcp__github__assign_copilot_to_issue', { issueNumber: 1 }],
    ['mcp__github__create_pull_request_with_copilot', { problem_statement: 'x' }],
  ]) assert.equal(checkToolUse({ tool_name, tool_input }).length, 1, tool_name);
  assert.deepEqual(checkToolUse({ tool_name: 'mcp__github__push_files', tool_input: { branch: 'dev', files: [] } }), []);
  assert.deepEqual(checkToolUse({ tool_name: 'mcp__github__list_branches', tool_input: {} }), []);
  for (const command of [
    'gh pr create --head feature/x --base dev', 'gh pr checkout 12',
    'gh api repos/o/r/git/refs -f ref=refs/heads/claude/x -f sha=abc', 'gh api -X POST repos/o/r/git/refs --input ref.json',
    'gh api --method PATCH repos/o/r/git/refs/heads/dev -F force=true', 'gh api -X DELETE repos/o/r/git/refs/heads/dev',
    'gh api -X POST repos/o/r/branches/dev/rename -f new_name=main',
    'gh api graphql -f query=\'mutation { createRef(input: {repositoryId: "x", name: "refs/heads/x", oid: "y"}) { ref { id } } }\'',
    'gh issue develop 12 --name claude/x --checkout', 'gh api graphql -f query=\'mutation { createLinkedBranch(input: {}) { linkedBranch { id } } }\'',
    'gh api graphql -F query=@mutation.graphql', 'gh repo sync',
  ]) assert.ok(refused(command), command);
  for (const command of [
    'gh api repos/o/r/branches', 'gh api repos/o/r/git/refs/heads/dev', 'gh pr list', 'gh run view 1',
    'gh api -X DELETE repos/o/r/git/refs/heads/claude/beautiful-gates-c0kwj5', 'gh api graphql -f query=\'{ viewer { login } }\'', 'gh issue develop --list 12',
  ]) assert.deepEqual(checkShellCommand(command, 'dev'), [], command);
});

test('Claude guard: common command shapes cannot hide git/gh (closure review)', () => {
  const heredocCommit = (message) => `git commit -q -m "$(cat <<'EOF'\n${message}\nEOF\n)"`;
  for (const command of [
    `${heredocCommit("fix: don't break things")} && git push -q --no-verify origin HEAD:claude/leak`,
    `${heredocCommit("fix: it's (half done")} && git -c core.hooksPath=/dev/null push -q origin HEAD:claude/leak3`,
    'git commit -m "unterminated && git push origin HEAD:claude/x',
    'for i in 1 2 3 4; do git push -u origin claude/x && break; sleep $((2**i)); done',
    'if git diff --quiet; then git push -q --no-verify origin HEAD:claude/if; fi',
    '{ git -c core.hooksPath=/dev/null push -q origin HEAD:claude/brace; }', '! git send-pack /o dev:refs/heads/claude/sp',
    'while read b; do git branch "$b"; done < names.txt', 'time git switch -c x',
    'GH_PAGER=cat gh issue develop 3 --name claude/x', 'timeout 30 gh api repos/o/r/git/refs -f ref=refs/heads/x -f sha=abc',
    "/usr/bin/env sh -c 'git push --no-verify origin HEAD:claude/x'", "sudo bash -c 'git branch x'", "xargs -I{} sh -c 'git branch {}'",
    'find . -name x -exec git branch y \\;', '((cd x); (git push origin HEAD:claude/x))',
    'gh agent-task create "fix the bug"', 'gh issue edit 3 --add-assignee @copilot', 'gh issue create -t x --assignee Copilot',
    "echo 'git push origin HEAD:claude/x' | bash", "bash <<< 'git push origin HEAD:claude/x'",
    'git commit -m x -n', 'echo x > .git/refs/heads/feature/direct', "printf 'ref: refs/heads/x' > .git/HEAD", 'tee .git/packed-refs < refs.txt',
    'cp /tmp/HEAD .git/HEAD', 'git stash branch x', 'git update-ref --stdin < updates.txt', 'git subtree push --prefix=lib origin lib-branch',
    'git config push.default matching', 'git config remote.origin.push "refs/heads/*:refs/heads/*"', 'git -c remote.origin.mirror=true push origin',
    'git rebase -x "git push origin HEAD:claude/x" HEAD~2', 'git rebase --exec="git branch y" HEAD~1', 'git bisect run git branch x',
  ]) assert.ok(refused(command), command);
  for (const command of [
    heredocCommit("fix: don't break things"), `${heredocCommit("fix: it's done (really)")} && git push origin HEAD:dev`,
    'for i in 1 2 3; do git push origin HEAD:dev && break; sleep $((2**i)); done', 'if git diff --quiet; then echo clean; fi',
    'git commit -m "-n flag removed"', 'bash scripts/check.sh && git status', 'cat .git/HEAD', 'ls .git/refs/heads',
    'git rebase -x "pnpm test" HEAD~2', 'gh issue edit 3 --add-assignee octocat', 'gh issue develop --list 3', 'echo git branch x',
  ]) assert.deepEqual(checkShellCommand(command, 'dev'), [], command);
  assert.equal(checkToolUse({ tool_name: 'mcp__github__issue_write', tool_input: { method: 'update', assignees: ['Copilot'] } }).length, 1);
  assert.deepEqual(checkToolUse({ tool_name: 'mcp__github__issue_write', tool_input: { method: 'update', assignees: ['octocat'] } }), []);
  assert.equal(checkToolUse({ tool_name: 'PowerShell', tool_input: { command: 'git push origin HEAD:claude/x' } }, 'dev').length, 1);
});

test('project URLs compare in one canonical spelling', async () => {
  const { normalizeUrl } = await import('./cli.mjs');
  const canonical = normalizeUrl('https://github.com/o/r');
  for (const spelling of ['https://github.com/o/r.git', 'https://user:token@GitHub.com/o/r.git/', 'git@github.com:o/r.git', 'ssh://git@github.com/o/./r', 'http://github.com/o/r/']) {
    assert.equal(normalizeUrl(spelling), canonical, spelling);
  }
  assert.equal(normalizeUrl('file:///srv/./repo/'), normalizeUrl('/srv/repo'));
  assert.notEqual(normalizeUrl('https://github.com/o/other'), canonical);
});

const cli = path.join(repoRoot, 'scripts/git-guard/cli.mjs');
const settings = JSON.parse(readFileSync(path.join(repoRoot, '.claude/settings.json'), 'utf8'));
const hookCommand = (event) => settings.hooks[event].flatMap((entry) => entry.hooks.map((hook) => hook.command)).find((command) => command.includes('git-guard'));

test('the Claude hook blocks (exit 2) on a violation, on a broken payload and when the guard cannot run at all', () => {
  const run = (payload) => spawnSync(process.execPath, [cli, 'claude-pre-tool-use'], {
    input: JSON.stringify(payload), encoding: 'utf8', env: { ...process.env, CLAUDE_PROJECT_DIR: repoRoot },
  });
  const blocked = run({ tool_name: 'Bash', tool_input: { command: 'git push -u origin claude/beautiful-gates-c0kwj5' }, cwd: repoRoot });
  assert.equal(blocked.status, 2);
  assert.match(blocked.stderr, /origin\/dev/);
  assert.equal(run({ tool_name: 'Bash', tool_input: { command: 'git status' }, cwd: repoRoot }).status, 0);
  assert.equal(spawnSync(process.execPath, [cli, 'claude-pre-tool-use'], { input: '{', encoding: 'utf8' }).status, 2);

  // The command wired in .claude/settings.json fails closed: no guard anywhere -> exit 2, not a non-blocking error.
  const empty = mkdtempSync(path.join(tmpdir(), 'git-guard-empty-'));
  try {
    execFileSync('git', ['init', '-q', empty]);
    const result = spawnSync('sh', ['-c', hookCommand('PreToolUse')], { input: '{"tool_name":"Bash","tool_input":{"command":"git status"}}', encoding: 'utf8', env: { ...process.env, CLAUDE_PROJECT_DIR: empty } });
    assert.equal(result.status, 2);
  } finally {
    rmSync(empty, { recursive: true, force: true });
  }
});

test('against a real repository: the installed guard survives old checkouts, worktrees and --git-dir, and allows normal dev work', () => {
  const work = mkdtempSync(path.join(tmpdir(), 'git-guard-'));
  try {
    const origin = path.join(work, 'origin.git');
    const clone = path.join(work, 'clone');
    const env = { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@x', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@x', GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' };
    const git = (args, cwd = clone) => spawnSync('git', args, { cwd, env, encoding: 'utf8' });
    const refusedBy = (result, pattern, label) => {
      assert.notEqual(result.status, 0, `${label} must fail`);
      assert.match(result.stderr, pattern, label);
    };
    execFileSync('git', ['init', '-q', '--bare', '-b', 'dev', origin], { env });
    execFileSync('git', ['init', '-q', '-b', 'dev', clone], { env });
    assert.equal(git(['remote', 'add', 'origin', origin]).status, 0);
    writeFileSync(path.join(clone, 'a.txt'), '1\n');
    assert.equal(git(['add', '.']).status, 0);
    assert.equal(git(['commit', '-qm', 'pre-guard']).status, 0);
    const old = git(['rev-parse', 'HEAD']).stdout.trim();
    assert.equal(git(['branch', 'legacy/x']).status, 0, 'a branch created before the guard (e.g. by a harness)');

    mkdirSync(path.join(clone, 'scripts'), { recursive: true });
    cpSync(path.join(repoRoot, 'scripts/git-guard'), path.join(clone, 'scripts/git-guard'), { recursive: true });
    cpSync(path.join(repoRoot, '.githooks'), path.join(clone, '.githooks'), { recursive: true });
    assert.equal(git(['add', '.']).status, 0);
    assert.equal(git(['commit', '-qm', 'guard']).status, 0);
    const install = spawnSync(process.execPath, ['scripts/git-guard/cli.mjs', 'install'], { cwd: clone, env, encoding: 'utf8' });
    assert.equal(install.status, 0, install.stderr);
    const hooksDir = path.join(clone, '.git', 'git-guard', 'hooks');
    assert.equal(git(['config', '--get', 'core.hooksPath']).stdout.trim(), hooksDir, 'absolute hooks path inside the git directory');
    assert.equal(git(['push', '-q', 'origin', 'dev']).status, 0, 'first push of dev');

    // repacking an existing non-dev branch is not a write; deleting it stays possible
    assert.equal(git(['pack-refs', '--all']).status, 0, 'pack-refs with a legacy branch');
    assert.equal(git(['gc', '-q']).status, 0, 'gc with a legacy branch');
    assert.equal(git(['branch', '-D', 'legacy/x']).status, 0, 'deleting a forbidden branch');

    const only = /only branch allowed/;
    for (const args of [['branch', 'claude/x'], ['checkout', '-b', 'feature/x'], ['switch', '-c', 'fix/x'], ['worktree', 'add', path.join(work, 'w0')]]) {
      refusedBy(git(args), only, args.join(' '));
    }
    refusedBy(git(['checkout', '-b', 'hotfix/y', old]), only, 'checkout -b onto a pre-guard commit');
    assert.equal(git(['symbolic-ref', 'HEAD']).stdout.trim(), 'refs/heads/dev');
    assert.equal(git(['checkout', '-q', 'dev']).status, 0);
    refusedBy(git(['checkout', '-q', '--track', 'origin/dev', '-b', 'review/z']), only, 'tracking branch');

    // an old checkout keeps the hooks (they live in the git directory)
    assert.equal(git(['checkout', '-q', old]).status, 0);
    assert.ok(!existsSync(path.join(clone, 'scripts/git-guard')), 'the old tree has no guard');
    refusedBy(git(['switch', '-c', 'x']), only, 'switch -c from an old checkout');
    refusedBy(git(['commit', '-q', '--allow-empty', '-m', 'detached']), /commits are allowed only on "dev"/, 'commit on detached HEAD');
    refusedBy(git(['push', 'origin', 'HEAD:refs/heads/x']), /pushes go only to origin\/dev/, 'push from an old checkout');
    assert.equal(git(['switch', '-q', 'dev']).status, 0);

    // a detached worktree on the old commit shares the same hooks
    const worktree = path.join(work, 'w1');
    assert.equal(git(['worktree', 'add', '-q', '--detach', worktree, old]).status, 0);
    refusedBy(git(['switch', '-c', 'x'], worktree), only, 'switch -c in a worktree');
    refusedBy(git(['commit', '-q', '--allow-empty', '-m', 'w'], worktree), /commits are allowed only on "dev"/, 'commit in a detached worktree');
    refusedBy(git(['push', 'origin', 'HEAD:refs/heads/x'], worktree), /pushes go only to origin\/dev/, 'push from a worktree');
    assert.equal(git(['worktree', 'remove', worktree]).status, 0);

    // git pointed at the repository from elsewhere keeps the same hooks
    refusedBy(git([`--git-dir=${path.join(clone, '.git')}`, 'branch', 'x'], work), only, '--git-dir');
    refusedBy(git(['-C', '.git', 'branch', 'x']), only, '-C .git');

    // decoy refs whose DWIM lookup matches the new branch's value do not let it through
    assert.equal(git(['tag', 'refs/heads/feature/c']).status, 0);
    refusedBy(git(['branch', 'feature/c']), only, 'branch behind a decoy tag');
    refusedBy(git(['fetch', '-q', '.', 'dev:refs/heads/feature/c']), only, 'fetch behind a decoy tag');
    assert.equal(git(['tag', '-d', 'refs/heads/feature/c']).status, 0);
    assert.equal(git(['update-ref', 'refs/refs/heads/feature/b', 'HEAD']).status, 0);
    refusedBy(git(['branch', 'feature/b']), only, 'branch behind a decoy ref');
    assert.equal(git(['update-ref', '-d', 'refs/refs/heads/feature/b']).status, 0);

    // rename is invisible to reference-transaction on some git versions: either it is refused, or
    // commit/push from the renamed branch are refused and verify reports it
    if (git(['branch', '-m', 'dev', 'feature/renamed']).status === 0) {
      refusedBy(git(['commit', '-q', '--allow-empty', '-m', 'r']), /commits are allowed only on "dev"/, 'commit on a renamed branch');
      refusedBy(git(['push', 'origin', 'feature/renamed']), /pushes go only to origin\/dev/, 'push of a renamed branch');
      refusedBy(spawnSync(process.execPath, [path.join(hooksDir, '..', 'cli.mjs'), 'verify'], { cwd: clone, env, encoding: 'utf8' }), /not refs\/heads\/dev/, 'verify after rename');
      assert.equal(git(['branch', '-m', 'feature/renamed', 'dev']).status, 0);
    }
    assert.equal(git(['symbolic-ref', 'HEAD']).stdout.trim(), 'refs/heads/dev');

    // pushes
    refusedBy(git(['push', 'origin', 'dev:refs/heads/claude/beautiful-gates-c0kwj5']), /pushes go only to origin\/dev/, 'push to another branch');
    assert.equal(git(['tag', 'v1']).status, 0);
    refusedBy(git(['push', 'origin', 'v1']), /pushes go only to origin\/dev/, 'tag push');
    assert.equal(git(['ls-remote', '--heads', '--tags', 'origin']).stdout.trim().split('\n').length, 1, 'origin only has dev');

    // normal work on dev
    writeFileSync(path.join(clone, 'a.txt'), '2\n');
    assert.equal(git(['commit', '-qam', 'second']).status, 0);
    assert.equal(git(['push', '-q', 'origin', 'HEAD:dev']).status, 0);
    assert.equal(git(['rev-parse', 'dev'], origin).stdout.trim(), git(['rev-parse', 'HEAD']).stdout.trim());
    const verify = spawnSync(process.execPath, ['scripts/git-guard/cli.mjs', 'verify'], { cwd: clone, env, encoding: 'utf8' });
    assert.equal(verify.status, 0, verify.stderr);

    // a replace ref/graft cannot pass a rewritten dev off as a fast-forward
    const published = git(['rev-parse', 'HEAD']).stdout.trim();
    assert.equal(git(['reset', '-q', '--soft', 'HEAD~1']).status, 0);
    assert.equal(git(['commit', '-qm', 'rewritten']).status, 0);
    const rewritten = git(['rev-parse', 'HEAD']).stdout.trim();
    assert.equal(git(['replace', '--graft', rewritten, published]).status, 0);
    refusedBy(git(['push', 'origin', 'dev']), /not an ancestor/, 'push of a grafted rewrite');
    assert.equal(git(['replace', '-d', rewritten]).status, 0);
    assert.equal(git(['reset', '-q', '--hard', published]).status, 0);

    // an older installer pointing core.hooksPath at the in-tree .githooks: the shims still run the
    // installed guard, and the Claude hook puts the absolute hooks path back
    assert.equal(git(['config', 'core.hooksPath', '.githooks']).status, 0);
    refusedBy(git(['branch', 'drift/x']), only, 'branch with the fallback shims');
    const repair = spawnSync(process.execPath, ['scripts/git-guard/cli.mjs', 'claude-pre-tool-use'], {
      cwd: clone, env: { ...env, CLAUDE_PROJECT_DIR: clone }, encoding: 'utf8', input: '{"tool_name":"Read","tool_input":{"file_path":"a.txt"}}',
    });
    assert.equal(repair.status, 0, repair.stderr);
    assert.equal(git(['config', '--get', 'core.hooksPath']).stdout.trim(), hooksDir, 'hooks path repaired');

    // invoked through a symlinked path, the CLI still runs (and still blocks)
    const link = path.join(work, 'link');
    symlinkSync(clone, link);
    const viaLink = spawnSync(process.execPath, [path.join(link, 'scripts/git-guard/cli.mjs'), 'verify'], { cwd: clone, env, encoding: 'utf8' });
    assert.equal(viaLink.status, 0, viaLink.stderr);
    assert.match(viaLink.stdout, /OK:/);
    const blockedViaLink = spawnSync(process.execPath, [path.join(link, 'scripts/git-guard/cli.mjs'), 'claude-pre-tool-use'], {
      cwd: clone, env: { ...env, CLAUDE_PROJECT_DIR: link }, encoding: 'utf8', input: '{"tool_name":"Bash","tool_input":{"command":"git checkout -b claude/x"}}',
    });
    assert.equal(blockedViaLink.status, 2, blockedViaLink.stderr);
    const writeViaLink = spawnSync(process.execPath, [path.join(link, 'scripts/git-guard/cli.mjs'), 'claude-pre-tool-use'], {
      cwd: link, env: { ...env, CLAUDE_PROJECT_DIR: link }, encoding: 'utf8', input: JSON.stringify({ tool_name: 'Write', tool_input: { file_path: path.join(link, '.git', 'config') }, cwd: link }),
    });
    assert.equal(writeViaLink.status, 2, 'Write into .git through a symlinked project path');

    // restoring a tracked file deleted in the work tree is not a branch checkout
    rmSync(path.join(clone, 'a.txt'));
    const restore = spawnSync(process.execPath, ['scripts/git-guard/cli.mjs', 'claude-pre-tool-use'], {
      cwd: clone, env: { ...env, CLAUDE_PROJECT_DIR: clone }, encoding: 'utf8', input: JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'git checkout a.txt' }, cwd: clone }),
    });
    assert.equal(restore.status, 0, restore.stderr);
    assert.equal(git(['checkout', '--', 'a.txt']).status, 0);

    // a tampered installed guard is reported, and install restores the committed version
    appendFileSync(path.join(clone, '.git', 'git-guard', 'policy.mjs'), '\n// tampered\n');
    refusedBy(spawnSync(process.execPath, ['scripts/git-guard/cli.mjs', 'verify'], { cwd: clone, env, encoding: 'utf8' }), /policy\.mjs differs/, 'verify after tampering');
    assert.equal(spawnSync(process.execPath, ['scripts/git-guard/cli.mjs', 'install'], { cwd: clone, env, encoding: 'utf8' }).status, 0);
    assert.equal(spawnSync(process.execPath, ['scripts/git-guard/cli.mjs', 'verify'], { cwd: clone, env, encoding: 'utf8' }).status, 0);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});

test('the guard stays wired: fallback shims, Claude hooks fail closed, CI runs these tests, the detector scans every branch', () => {
  for (const hook of ['pre-commit', 'pre-merge-commit', 'pre-push', 'reference-transaction']) {
    const file = path.join(repoRoot, '.githooks', hook);
    assert.ok(statSync(file).mode & 0o111, `${hook} shim must be executable`);
    assert.match(readFileSync(file, 'utf8'), /--git-common-dir\)\/git-guard\/cli\.mjs" (pre-commit|pre-merge-commit|pre-push|reference-transaction)/, hook);
  }
  assert.match(hookCommand('SessionStart'), /scripts\/git-guard\/cli\.mjs.* session-start$/);
  const preToolUse = hookCommand('PreToolUse');
  assert.match(preToolUse, /git-guard\/cli\.mjs.* claude-pre-tool-use \|\| exit 2$/);
  assert.match(preToolUse, /--git-common-dir/, 'prefers the installed guard');
  const matcher = settings.hooks.PreToolUse.find((entry) => JSON.stringify(entry).includes('claude-pre-tool-use')).matcher;
  for (const tool of ['Bash', 'Edit', 'Write', 'MultiEdit', 'EnterWorktree', 'Agent', 'mcp__Claude_Code_Remote__create_session', 'mcp__github__create_branch', 'mcp__github__push_files']) {
    assert.match(tool, new RegExp(`^(?:${matcher})$`), `matcher covers ${tool}`);
  }
  assert.match(readFileSync(path.join(repoRoot, '.github/workflows/ci.yml'), 'utf8'), /node --test scripts\/git-guard\/policy\.test\.mjs/);
  const detector = readFileSync(path.join(repoRoot, '.github/workflows/branch-policy.yml'), 'utf8');
  assert.match(detector, /branches-ignore: \[dev\]/);
  assert.match(detector, /schedule:/);
  assert.match(detector, /repos\/\$REPO\/branches/);
});
