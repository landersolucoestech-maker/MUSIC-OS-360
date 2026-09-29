import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
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

test('commits are allowed only on dev (or while rebasing dev)', () => {
  assert.deepEqual(checkCommitBranch('refs/heads/dev'), []);
  assert.deepEqual(checkCommitBranch(null, 'refs/heads/dev'), []);
  assert.equal(checkCommitBranch('refs/heads/claude/beautiful-gates-c0kwj5').length, 1);
  assert.equal(checkCommitBranch('refs/heads/main').length, 1);
  assert.equal(checkCommitBranch(null).length, 1);
  assert.equal(checkCommitBranch(null, 'refs/heads/feature/x').length, 1);
});

test('no branch other than dev can be written; deletions and non-branch refs pass', () => {
  assert.deepEqual(checkRefTransaction([`${Z} ${A} refs/heads/dev`, `${A} ${B} refs/heads/dev`]), []);
  assert.deepEqual(checkRefTransaction([`${A} ${Z} refs/heads/claude/beautiful-gates-c0kwj5`]), []);
  assert.deepEqual(checkRefTransaction([`${Z} ${A} refs/remotes/origin/feature/x`, `${Z} ${A} refs/stash`, `${Z} ${A} HEAD`, `${Z} ${A} refs/tags/v1`]), []);
  for (const ref of ['claude/x', 'feature/x', 'fix/x', 'review/x', 'main', 'staging', 'devx', 'dev/x']) {
    assert.equal(checkRefTransaction([`${Z} ${A} refs/heads/${ref}`]).length, 1, ref);
  }
  // a rename is one transaction: the creation of the new name aborts it
  assert.equal(checkRefTransaction([`${A} ${Z} refs/heads/dev`, `${Z} ${A} refs/heads/dev2`]).length, 1);
});

test('push: only dev -> origin/dev, fast-forward only; forbidden branches may be deleted', () => {
  const ff = () => true;
  const base = { remote: 'origin', currentBranchRef: 'refs/heads/dev', isAncestor: ff };
  assert.deepEqual(checkPush({ ...base, updates: [`refs/heads/dev ${A} refs/heads/dev ${B}`] }), []);
  assert.deepEqual(checkPush({ ...base, updates: [`HEAD ${A} refs/heads/dev ${B}`] }), []);
  assert.deepEqual(checkPush({ ...base, updates: [`refs/heads/dev ${A} refs/heads/dev ${Z}`] }), []);
  assert.deepEqual(checkPush({ ...base, updates: [`(delete) ${Z} refs/heads/claude/beautiful-gates-c0kwj5 ${A}`] }), []);

  const refused = (overrides) => checkPush({ ...base, ...overrides }).length;
  assert.equal(refused({ updates: [`refs/heads/dev ${A} refs/heads/claude/beautiful-gates-c0kwj5 ${Z}`] }), 1);
  assert.equal(refused({ updates: [`refs/heads/dev ${A} refs/heads/main ${B}`] }), 1);
  assert.equal(refused({ updates: [`refs/tags/v1 ${A} refs/tags/v1 ${Z}`] }), 1);
  assert.equal(refused({ updates: [`(delete) ${Z} refs/heads/dev ${A}`] }), 1);
  assert.equal(refused({ updates: [`(delete) ${Z} refs/tags/v1 ${A}`] }), 1);
  assert.equal(refused({ updates: [`refs/heads/feature/x ${A} refs/heads/dev ${B}`] }), 1);
  assert.equal(refused({ currentBranchRef: 'refs/heads/claude/x', updates: [`HEAD ${A} refs/heads/dev ${B}`] }), 1);
  assert.equal(refused({ isAncestor: () => false, updates: [`refs/heads/dev ${A} refs/heads/dev ${B}`] }), 1);
  assert.equal(refused({ remote: 'https://github.com/x/y.git', updates: [`refs/heads/dev ${A} refs/heads/dev ${B}`] }), 1);
});

test('shell parsing: quotes, chains, subshells and nested shells', () => {
  assert.deepEqual(shellCommands(`cd /repo && git commit -m "a && b; c" || echo 'git push x'`), [
    ['cd', '/repo'], ['git', 'commit', '-m', 'a && b; c'], ['echo', 'git push x'],
  ]);
  assert.deepEqual(shellCommands('x=$(git rev-parse HEAD)'), [['x='], ['git', 'rev-parse', 'HEAD']]);
  assert.equal(checkShellCommand(`bash -c "git checkout -b feature/x"`).length, 1);
  assert.equal(checkShellCommand(`eval git switch -c fix/x`).length, 1);
  assert.deepEqual(checkShellCommand(`echo "git checkout -b feature/x"`), []);
});

test('shell parsing: redirections are not arguments and heredoc bodies are data', () => {
  assert.deepEqual(shellCommands('git push origin HEAD:dev 2>&1 | tail -3'), [['git', 'push', 'origin', 'HEAD:dev'], ['tail', '-3']]);
  assert.deepEqual(shellCommands('git push origin dev >/dev/null 2>>err.log </dev/null &>all.log'), [['git', 'push', 'origin', 'dev']]);
  assert.deepEqual(shellCommands('echo a2>f'), [['echo', 'a2']]);
  for (const command of [
    'git push origin HEAD:dev 2>&1 | tail -3', 'git push origin dev > out.txt 2>&1', 'git push -u origin dev &>/dev/null',
    "cat > msg.txt <<'EOF'\ngit push origin claude/x\ngit checkout -b feature/x\nEOF\ngit commit -F msg.txt",
    'python3 - <<-EOF\n\tgit switch -c x\n\tEOF',
  ]) assert.deepEqual(checkShellCommand(command, 'dev'), [], command);
  assert.equal(checkShellCommand("cat <<'EOF'\nharmless\nEOF\ngit push origin HEAD:feature/x 2>&1").length, 1);
  assert.equal(checkShellCommand('diff <(git checkout -b x) y').length, 1);
});

test('Claude guard refuses branch creation, switching, renames and hook bypasses', () => {
  const refused = [
    'git checkout -b claude/x', 'git checkout -B x origin/dev', 'git checkout --orphan x', 'git checkout -t origin/main',
    'git switch -c feature/x', 'git switch --create=fix/x', 'git switch main', 'git switch -C review/x',
    'git branch review/x', 'git branch -f x HEAD', 'git branch -m dev dev2', 'git branch -c dev x', 'git branch -D dev',
    'git branch --set-upstream-to=origin/main main',
    'git worktree add ../w', 'git worktree add -b x ../w', 'git update-ref refs/heads/x HEAD',
    'git -c core.hooksPath=/dev/null commit -m x', 'git config core.hooksPath /dev/null', 'git config --unset core.hooksPath',
    'git commit --no-verify -m x', 'git commit -nm x', 'git -C /repo checkout -b x',
  ];
  for (const command of refused) assert.ok(checkShellCommand(command, 'dev').length > 0, command);
  assert.ok(checkShellCommand('git commit -m x', 'claude/beautiful-gates-c0kwj5').length > 0);

  const allowed = [
    'git status', 'git branch', 'git branch -a', 'git branch -vv', 'git branch --show-current', 'git branch -d claude/x',
    'git branch --contains HEAD', 'git branch -u origin/dev', 'git branch -f dev origin/dev', 'git switch dev', 'git switch --detach HEAD~1',
    'git checkout -- file.ts', 'git checkout dev', 'git switch -c dev --track origin/dev', 'git checkout -b dev origin/dev',
    'git worktree add --detach ../review HEAD', 'git config --get core.hooksPath', 'git config core.hooksPath .githooks',
    'git commit -m "fix: x"', 'git fetch origin dev', 'git log --oneline -3',
  ];
  for (const command of allowed) assert.deepEqual(checkShellCommand(command, 'dev'), [], command);
});

test('Claude guard: pushes go only from dev to origin/dev', () => {
  const allowed = [
    'git push origin HEAD:dev', 'git push -u origin dev', 'git push origin dev', 'git push origin refs/heads/dev:refs/heads/dev',
    'git push', 'git push origin --delete claude/beautiful-gates-c0kwj5', 'git push origin :feature/x',
  ];
  for (const command of allowed) assert.deepEqual(checkShellCommand(command, 'dev'), [], command);
  const refused = [
    'git push -u origin claude/beautiful-gates-c0kwj5', 'git push origin HEAD:feature/x', 'git push origin dev:main',
    'git push upstream dev', 'git push --all origin', 'git push --mirror origin', 'git push --tags origin',
    'git push --force origin dev', 'git push -f origin dev', 'git push --force-with-lease origin dev', 'git push origin +dev',
    'git push --no-verify origin dev', 'git push origin --delete dev', 'git push origin :dev',
  ];
  for (const command of refused) assert.ok(checkShellCommand(command, 'dev').length > 0, command);
  assert.ok(checkShellCommand('git push', 'claude/beautiful-gates-c0kwj5').length > 0);
  assert.ok(checkShellCommand('git push origin HEAD', 'claude/beautiful-gates-c0kwj5').length > 0);
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
});

test('Claude guard: GitHub API tools and gh cannot create or write other branches', () => {
  const refused = [
    ['mcp__github__create_branch', { owner: 'o', repo: 'r', branch: 'claude/x', from_branch: 'dev' }],
    ['mcp__github__create_pull_request', { owner: 'o', repo: 'r', head: 'feature/x', base: 'dev' }],
    ['mcp__github__update_pull_request_branch', { pullNumber: 1 }],
    ['mcp__github__push_files', { branch: 'fix/x', files: [] }],
    ['mcp__github__create_or_update_file', { branch: 'review/x', path: 'a' }],
    ['mcp__github__delete_file', { path: 'a' }],
  ];
  for (const [tool_name, tool_input] of refused) assert.equal(checkToolUse({ tool_name, tool_input }).length, 1, tool_name);
  assert.deepEqual(checkToolUse({ tool_name: 'mcp__github__push_files', tool_input: { branch: 'dev', files: [] } }), []);
  assert.deepEqual(checkToolUse({ tool_name: 'mcp__github__list_branches', tool_input: {} }), []);
  assert.deepEqual(checkToolUse({ tool_name: 'mcp__github__get_file_contents', tool_input: { ref: 'refs/heads/claude/x' } }), []);

  for (const command of [
    'gh pr create --head feature/x --base dev', 'gh pr checkout 12',
    'gh api repos/o/r/git/refs -f ref=refs/heads/claude/x -f sha=abc', 'gh api -X POST repos/o/r/git/refs --input ref.json',
    'gh api --method PATCH repos/o/r/git/refs/heads/dev -F force=true', 'gh api -X DELETE repos/o/r/git/refs/heads/dev',
    'gh api -X POST repos/o/r/branches/dev/rename -f new_name=main',
  ]) assert.ok(checkShellCommand(command, 'dev').length > 0, command);
  for (const command of [
    'gh api repos/o/r/branches', 'gh api repos/o/r/git/refs/heads/dev', 'gh pr list', 'gh run view 1',
    'gh api -X DELETE repos/o/r/git/refs/heads/claude/beautiful-gates-c0kwj5',
  ]) assert.deepEqual(checkShellCommand(command, 'dev'), [], command);
});

test('the Claude hook command exits 2 with the reason on a violation and 0 otherwise', () => {
  const run = (payload) => spawnSync(process.execPath, [path.join(repoRoot, 'scripts/git-guard/cli.mjs'), 'claude-pre-tool-use'], {
    input: JSON.stringify(payload), encoding: 'utf8', env: { ...process.env, CLAUDE_PROJECT_DIR: repoRoot },
  });
  const blocked = run({ tool_name: 'Bash', tool_input: { command: 'git push -u origin claude/beautiful-gates-c0kwj5' }, cwd: repoRoot });
  assert.equal(blocked.status, 2);
  assert.match(blocked.stderr, /origin\/dev/);
  assert.equal(run({ tool_name: 'Bash', tool_input: { command: 'git status' }, cwd: repoRoot }).status, 0);
  const garbage = spawnSync(process.execPath, [path.join(repoRoot, 'scripts/git-guard/cli.mjs'), 'claude-pre-tool-use'], { input: '{', encoding: 'utf8' });
  assert.equal(garbage.status, 2);
});

test('against a real repository: the versioned hooks block other branches, commits off dev and pushes off origin/dev', () => {
  const work = mkdtempSync(path.join(tmpdir(), 'git-guard-'));
  try {
    const origin = path.join(work, 'origin.git');
    const clone = path.join(work, 'clone');
    const env = { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@x', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@x', GIT_CONFIG_GLOBAL: '/dev/null' };
    const git = (args, cwd = clone) => spawnSync('git', args, { cwd, env, encoding: 'utf8' });
    execFileSync('git', ['init', '-q', '--bare', '-b', 'dev', origin], { env });
    execFileSync('git', ['init', '-q', '-b', 'dev', clone], { env });
    mkdirSync(path.join(clone, 'scripts'), { recursive: true });
    cpSync(path.join(repoRoot, 'scripts/git-guard'), path.join(clone, 'scripts/git-guard'), { recursive: true });
    cpSync(path.join(repoRoot, '.githooks'), path.join(clone, '.githooks'), { recursive: true });
    for (const hook of ['pre-commit', 'pre-merge-commit', 'pre-push', 'reference-transaction']) chmodSync(path.join(clone, '.githooks', hook), 0o755);
    writeFileSync(path.join(clone, 'a.txt'), '1\n');
    assert.equal(git(['remote', 'add', 'origin', origin]).status, 0);
    assert.equal(spawnSync(process.execPath, ['scripts/git-guard/cli.mjs', 'install'], { cwd: clone, env, encoding: 'utf8' }).status, 0);
    assert.equal(git(['config', '--get', 'core.hooksPath']).stdout.trim(), '.githooks');

    assert.equal(git(['add', '.']).status, 0);
    assert.equal(git(['commit', '-qm', 'first']).status, 0, 'commit on dev');
    assert.equal(git(['push', '-q', 'origin', 'dev']).status, 0, 'push dev -> origin/dev');

    for (const args of [['branch', 'claude/x'], ['checkout', '-b', 'feature/x'], ['switch', '-c', 'fix/x'], ['worktree', 'add', path.join(work, 'w')]]) {
      const result = git(args);
      assert.notEqual(result.status, 0, args.join(' '));
      assert.match(result.stderr, /only branch allowed/, args.join(' '));
    }
    assert.equal(git(['branch', '--list']).stdout.trim(), '* dev');

    assert.equal(git(['switch', '-q', '--detach']).status, 0);
    const detached = git(['commit', '-q', '--allow-empty', '-m', 'detached']);
    assert.notEqual(detached.status, 0);
    assert.match(detached.stderr, /commits are allowed only on "dev"/);
    assert.equal(git(['switch', '-q', 'dev']).status, 0);

    const other = git(['push', 'origin', 'dev:refs/heads/claude/beautiful-gates-c0kwj5']);
    assert.notEqual(other.status, 0);
    assert.match(other.stderr, /pushes go only to origin\/dev/);
    const tag = git(['tag', 'v1']);
    assert.equal(tag.status, 0);
    assert.notEqual(git(['push', 'origin', 'v1']).status, 0, 'tag push');
    assert.equal(git(['ls-remote', '--heads', '--tags', 'origin']).stdout.trim().split('\n').length, 1, 'origin only has dev');

    writeFileSync(path.join(clone, 'a.txt'), '2\n');
    assert.equal(git(['commit', '-qam', 'second']).status, 0);
    assert.equal(git(['push', '-q', 'origin', 'HEAD:dev']).status, 0);
    assert.equal(git(['rev-parse', 'dev'], origin).stdout.trim(), git(['rev-parse', 'HEAD']).stdout.trim());
    assert.equal(readFileSync(path.join(clone, 'a.txt'), 'utf8'), '2\n');
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});

test('the guard stays wired: executable hooks, Claude hooks, CI step and server-side detector', () => {
  for (const hook of ['pre-commit', 'pre-merge-commit', 'pre-push', 'reference-transaction']) {
    const file = path.join(repoRoot, '.githooks', hook);
    assert.ok(statSync(file).mode & 0o111, `${hook} must be executable`);
    assert.match(readFileSync(file, 'utf8'), /scripts\/git-guard\/cli\.mjs" (pre-commit|pre-merge-commit|pre-push|reference-transaction)/, hook);
  }
  const settings = JSON.parse(readFileSync(path.join(repoRoot, '.claude/settings.json'), 'utf8'));
  assert.match(JSON.stringify(settings.hooks.SessionStart), /git-guard\/cli\.mjs\\" session-start/);
  const preToolUse = settings.hooks.PreToolUse.find((entry) => /git-guard\/cli\.mjs\\?" claude-pre-tool-use/.test(JSON.stringify(entry)));
  assert.ok(preToolUse, 'PreToolUse guard');
  for (const tool of ['Bash', 'EnterWorktree', 'Agent', 'mcp__Claude_Code_Remote__create_session', 'mcp__github__create_branch', 'mcp__github__push_files']) {
    assert.match(tool, new RegExp(`^(?:${preToolUse.matcher})$`), `matcher covers ${tool}`);
  }
  assert.match(readFileSync(path.join(repoRoot, '.github/workflows/ci.yml'), 'utf8'), /node --test scripts\/git-guard\/policy\.test\.mjs/);
  assert.match(readFileSync(path.join(repoRoot, '.github/workflows/branch-policy.yml'), 'utf8'), /branches-ignore: \[dev\]/);
});
