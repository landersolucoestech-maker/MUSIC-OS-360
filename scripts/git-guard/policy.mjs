/**
 * scripts/git-guard/policy.mjs
 *
 * Single source of truth for the repository's branch policy
 * (docs/engineering/git-safety.md): all work happens on the `dev` branch.
 *   - commits: only on `dev`;
 *   - pushes: only `dev` -> `origin/dev`, never forced;
 *   - creating, renaming or updating any other local branch: forbidden;
 *   - tools/agents that create temporary branches or worktrees: forbidden.
 *
 * Pure functions only; scripts/git-guard/cli.mjs wires them to the git hooks
 * in .githooks/ and to the Claude Code hooks in .claude/settings.json.
 * Every check returns a list of violations (empty = allowed).
 */

export const ALLOWED_BRANCH = 'dev';
export const ALLOWED_REMOTE = 'origin';
export const HOOKS_PATH = '.githooks';

const ALLOWED_REF = `refs/heads/${ALLOWED_BRANCH}`;
const ZERO_OID = /^0+$/;

function isDeletion(oid) {
  return ZERO_OID.test(oid);
}

/** pre-commit / pre-merge-commit: `branchRef` is `git symbolic-ref -q HEAD` (null when detached). */
export function checkCommitBranch(branchRef, rebaseHeadRef = null) {
  if (branchRef === ALLOWED_REF) return [];
  if (!branchRef && rebaseHeadRef === ALLOWED_REF) return [];
  const where = branchRef ? `branch "${branchRef.replace(/^refs\/heads\//, '')}"` : 'a detached HEAD';
  return [`commit refused on ${where}: commits are allowed only on "${ALLOWED_BRANCH}" (git switch ${ALLOWED_BRANCH}).`];
}

/**
 * reference-transaction (state "prepared"): each line is
 * "<old-value> <new-value> <ref-name>". Any non-deletion write to a branch
 * other than dev (git branch/checkout -b/switch -c/worktree add/fetch x:y/
 * update-ref/rename) aborts the transaction. Deletions stay allowed so a
 * forbidden branch can always be removed.
 */
export function checkRefTransaction(lines) {
  const violations = [];
  for (const line of lines) {
    const [, newValue, refName] = line.trim().split(/\s+/);
    if (!refName || !refName.startsWith('refs/heads/')) continue;
    if (refName === ALLOWED_REF || isDeletion(newValue ?? '')) continue;
    violations.push(`branch "${refName.slice('refs/heads/'.length)}" refused: "${ALLOWED_BRANCH}" is the only branch allowed in this repository.`);
  }
  return violations;
}

/**
 * pre-push: `updates` are the stdin lines "<local-ref> <local-oid> <remote-ref> <remote-oid>".
 * `currentBranchRef` is `git symbolic-ref -q HEAD`; `isAncestor(a, b)` answers
 * whether commit a is an ancestor of b (false when a is not available locally).
 */
export function checkPush({ remote, updates, currentBranchRef, isAncestor }) {
  const violations = [];
  if (remote !== ALLOWED_REMOTE) {
    violations.push(`push refused: the only push target is "${ALLOWED_REMOTE}" (got "${remote}").`);
  }
  for (const line of updates) {
    const [localRef, localOid, remoteRef, remoteOid] = line.trim().split(/\s+/);
    if (!remoteRef) continue;
    if (isDeletion(localOid ?? '')) {
      if (remoteRef.startsWith('refs/heads/') && remoteRef !== ALLOWED_REF) continue;
      violations.push(`push refused: deleting "${remoteRef}" is not allowed.`);
      continue;
    }
    if (remoteRef !== ALLOWED_REF) {
      violations.push(`push refused: "${remoteRef}" is not "${ALLOWED_REF}"; pushes go only to ${ALLOWED_REMOTE}/${ALLOWED_BRANCH}.`);
      continue;
    }
    const fromDev = localRef === ALLOWED_REF || (localRef === 'HEAD' && currentBranchRef === ALLOWED_REF);
    if (!fromDev) {
      violations.push(`push refused: ${ALLOWED_REMOTE}/${ALLOWED_BRANCH} is updated only from the local "${ALLOWED_BRANCH}" branch (got "${localRef}").`);
      continue;
    }
    if (!isDeletion(remoteOid ?? '') && !isAncestor(remoteOid, localOid)) {
      violations.push(`push refused: ${ALLOWED_REMOTE}/${ALLOWED_BRANCH} (${remoteOid.slice(0, 12)}) is not an ancestor of the pushed commit; fetch and integrate first, history is never rewritten.`);
    }
  }
  return violations;
}

// ─── Claude Code PreToolUse guard ───────────────────────────────────────────

/** Splits a shell command line into simple commands and words (quotes honoured, no expansion). */
export function shellCommands(command) {
  const commands = [];
  let words = [];
  let word = '';
  let hasWord = false;
  let quote = null;
  const endWord = () => {
    if (hasWord) words.push(word);
    word = '';
    hasWord = false;
  };
  const endCommand = () => {
    endWord();
    if (words.length) commands.push(words);
    words = [];
  };
  for (let i = 0; i < command.length; i += 1) {
    const ch = command[i];
    if (quote) {
      if (ch === quote) quote = null;
      else if (ch === '\\' && quote === '"' && i + 1 < command.length) word += command[++i];
      else word += ch;
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      hasWord = true;
    } else if (ch === '\\' && i + 1 < command.length) {
      if (command[i + 1] !== '\n') word += command[i + 1];
      hasWord = hasWord || command[i + 1] !== '\n';
      i += 1;
    } else if (ch === ';' || ch === '|' || ch === '&' || ch === '\n' || ch === '(' || ch === ')' || ch === '`') {
      endCommand();
    } else if (ch === '$' && command[i + 1] === '(') {
      endCommand();
      i += 1;
    } else if (/\s/.test(ch)) {
      endWord();
    } else {
      word += ch;
      hasWord = true;
    }
  }
  endCommand();
  return commands;
}

const GIT_GLOBAL_OPTIONS_WITH_VALUE = new Set(['-C', '-c', '--git-dir', '--work-tree', '--namespace', '--exec-path', '--config-env']);
const LIST_ONLY_BRANCH_OPTIONS = new Set([
  '-l', '--list', '-a', '--all', '-r', '--remotes', '-v', '-vv', '--verbose', '--show-current',
  '--contains', '--no-contains', '--merged', '--no-merged', '--points-at', '--format', '--sort',
  '--column', '--no-column', '--color', '--no-color', '-i', '--ignore-case', '--abbrev', '--no-abbrev',
]);

/** Returns { globals, sub, args } for a `git ...` word list, or null when it is not git. */
function parseGit(words) {
  let index = 0;
  while (index < words.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(words[index])) index += 1; // VAR=value prefixes
  if (['sudo', 'env', 'command', 'exec', 'nohup', 'time'].includes(words[index])) index += 1;
  const program = words[index];
  if (!program || program.split('/').pop() !== 'git') return null;
  const globals = [];
  index += 1;
  while (index < words.length && words[index].startsWith('-')) {
    const option = words[index];
    globals.push(option);
    if (GIT_GLOBAL_OPTIONS_WITH_VALUE.has(option)) {
      globals.push(words[index + 1] ?? '');
      index += 1;
    }
    index += 1;
  }
  return { globals, sub: words[index] ?? '', args: words.slice(index + 1) };
}

function hasOption(args, ...names) {
  return args.some((arg) => names.some((name) => arg === name || (name.startsWith('--') && arg.startsWith(`${name}=`))));
}

/** Short-option clusters such as `-fb` count as their letters. */
function hasShortFlag(args, letter) {
  return args.some((arg) => /^-[A-Za-z]+$/.test(arg) && arg.slice(1).includes(letter));
}

/**
 * Name of the branch a checkout/switch would create: undefined when it creates
 * none, null when the name cannot be determined (treated as forbidden).
 * `--track <remote>/<name>` without an explicit name creates <name>.
 */
function createdBranch(args, valueFlags, clusterLetters) {
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    const inline = valueFlags.find((flag) => flag.startsWith('--') && arg.startsWith(`${flag}=`));
    if (inline) return arg.slice(inline.length + 1) || null;
    if (valueFlags.includes(arg)) return args[i + 1] ?? null;
    if (/^-[A-Za-z]{2,}$/.test(arg) && clusterLetters.some((letter) => arg.includes(letter))) return null;
  }
  const trackIndex = args.findIndex((arg) => arg === '--track' || arg === '-t' || arg.startsWith('--track='));
  if (trackIndex !== -1) {
    const upstream = args.slice(trackIndex + 1).find((arg) => !arg.startsWith('-'));
    return upstream ? upstream.split('/').slice(1).join('/') || null : null;
  }
  return undefined;
}

function isDevRef(name) {
  return name === ALLOWED_BRANCH || name === ALLOWED_REF;
}

function checkGitInvocation({ globals, sub, args }, currentBranch) {
  const violations = [];
  const refuse = (message) => violations.push(`${message} Policy: work only on "${ALLOWED_BRANCH}", push only to ${ALLOWED_REMOTE}/${ALLOWED_BRANCH} (docs/engineering/git-safety.md).`);

  for (let i = 0; i < globals.length; i += 1) {
    if (globals[i] === '-c' && /^core\.hookspath=/i.test(globals[i + 1] ?? '')) refuse('Overriding core.hooksPath disables the branch guard.');
  }

  switch (sub) {
    case 'checkout': {
      const created = createdBranch(args, ['-b', '-B', '--orphan'], ['b', 'B']);
      if (created !== undefined && created !== ALLOWED_BRANCH) refuse(`Creating branch "${created ?? '?'}" with git checkout is forbidden.`);
      break;
    }
    case 'switch': {
      const created = createdBranch(args, ['-c', '-C', '--create', '--force-create', '--orphan'], ['c', 'C']);
      if (created !== undefined) {
        if (created !== ALLOWED_BRANCH) refuse(`Creating branch "${created ?? '?'}" with git switch is forbidden.`);
        break;
      }
      const detached = hasOption(args, '--detach') || hasShortFlag(args, 'd');
      const target = args.find((arg) => !arg.startsWith('-'));
      if (!detached && target && target !== ALLOWED_BRANCH && target !== '-') refuse(`Switching to branch "${target}" is forbidden.`);
      break;
    }
    case 'branch': {
      if (hasOption(args, '--delete') || hasShortFlag(args, 'd') || hasShortFlag(args, 'D')) {
        if (args.some((arg) => isDevRef(arg))) refuse(`Deleting "${ALLOWED_BRANCH}" is forbidden.`);
        break;
      }
      if (hasOption(args, '--move', '--copy') || ['m', 'M', 'c', 'C'].some((letter) => hasShortFlag(args, letter))) {
        refuse('Renaming or copying branches is forbidden.');
        break;
      }
      if (hasOption(args, '--set-upstream-to', '--unset-upstream', '--edit-description') || hasShortFlag(args, 'u')) {
        const named = args.filter((arg) => !arg.startsWith('-') && !arg.includes('/'));
        if (named.some((name) => name !== ALLOWED_BRANCH)) refuse('Configuring a branch other than dev is forbidden.');
        break;
      }
      if (args.some((arg) => LIST_ONLY_BRANCH_OPTIONS.has(arg.split('=')[0]))) break;
      const positional = args.filter((arg) => !arg.startsWith('-'));
      if (positional.length && positional[0] !== ALLOWED_BRANCH) refuse(`Creating branch "${positional[0]}" is forbidden.`);
      break;
    }
    case 'worktree':
      if (args[0] === 'add' && !(hasOption(args, '--detach') || hasShortFlag(args.slice(1), 'd'))) {
        refuse('git worktree add creates a branch unless it is run with --detach.');
      }
      break;
    case 'update-ref': {
      const ref = args.find((arg) => !arg.startsWith('-'));
      if (ref && ref.startsWith('refs/heads/') && ref !== ALLOWED_REF && !hasShortFlag(args, 'd')) refuse(`Writing "${ref}" is forbidden.`);
      break;
    }
    case 'config': {
      const readOnly = hasOption(args, '--get', '--get-all', '--get-regexp', '--list') || hasShortFlag(args, 'l');
      if (!readOnly && args.some((arg) => /^core\.hookspath$/i.test(arg)) && !args.includes(HOOKS_PATH)) refuse('core.hooksPath must stay ".githooks".');
      break;
    }
    case 'commit':
    case 'merge':
    case 'cherry-pick':
    case 'revert':
    case 'am':
      if (hasOption(args, '--no-verify') || (sub === 'commit' && hasShortFlag(args, 'n'))) refuse('Skipping the git hooks (--no-verify) is forbidden.');
      if (sub === 'commit' && currentBranch && currentBranch !== ALLOWED_BRANCH) refuse(`Committing on "${currentBranch}" is forbidden.`);
      break;
    case 'push':
      violations.push(...checkPushCommand(args, currentBranch).map((message) => `${message} Policy: push only ${ALLOWED_BRANCH} to ${ALLOWED_REMOTE}/${ALLOWED_BRANCH} (docs/engineering/git-safety.md).`));
      break;
    default:
      break;
  }
  return violations;
}

const PUSH_OPTIONS_WITH_VALUE = new Set(['--repo', '--receive-pack', '--exec', '-o', '--push-option']);

function checkPushCommand(args, currentBranch) {
  const violations = [];
  if (hasOption(args, '--all', '--mirror', '--tags', '--follow-tags', '--branches')) violations.push('Pushing all branches/tags is forbidden.');
  if (hasOption(args, '--force', '--force-with-lease', '--force-if-includes') || hasShortFlag(args, 'f')) violations.push('Force pushes are forbidden.');
  if (hasOption(args, '--no-verify')) violations.push('Skipping the pre-push hook (--no-verify) is forbidden.');
  const deleting = hasOption(args, '--delete') || hasShortFlag(args, 'd');
  const positional = [];
  for (let i = 0; i < args.length; i += 1) {
    if (PUSH_OPTIONS_WITH_VALUE.has(args[i])) {
      i += 1;
    } else if (!args[i].startsWith('-')) {
      positional.push(args[i]);
    }
  }
  const [remote, ...refspecs] = positional;
  if (remote && remote !== ALLOWED_REMOTE) violations.push(`Pushing to "${remote}" is forbidden.`);
  if (deleting) {
    if (refspecs.some((spec) => isDevRef(spec.replace(/^:/, '')))) violations.push(`Deleting ${ALLOWED_REMOTE}/${ALLOWED_BRANCH} is forbidden.`);
    return violations;
  }
  if (!refspecs.length && currentBranch && currentBranch !== ALLOWED_BRANCH) {
    violations.push(`Pushing the current branch "${currentBranch}" is forbidden.`);
  }
  for (const spec of refspecs) {
    if (spec.startsWith('+')) {
      violations.push(`Forced refspec "${spec}" is forbidden.`);
      continue;
    }
    if (spec.startsWith(':')) {
      if (isDevRef(spec.slice(1))) violations.push(`Deleting ${ALLOWED_REMOTE}/${ALLOWED_BRANCH} is forbidden.`);
      continue;
    }
    const [source, destination] = spec.includes(':') ? spec.split(':') : [spec, null];
    const sourceIsDev = isDevRef(source) || (source === 'HEAD' && (!currentBranch || currentBranch === ALLOWED_BRANCH));
    const destinationIsDev = destination === null ? sourceIsDev : isDevRef(destination);
    if (!sourceIsDev || !destinationIsDev) violations.push(`Refspec "${spec}" is not ${ALLOWED_BRANCH} -> ${ALLOWED_REMOTE}/${ALLOWED_BRANCH}.`);
  }
  return violations;
}

const GH_WRITE_FIELD_OPTIONS = new Set(['-f', '-F', '--field', '--raw-field', '--input']);

/** `gh` (GitHub CLI) invocations that create or move branches on GitHub, bypassing git and its hooks. */
function checkGhInvocation(words) {
  const [sub, action] = words.slice(1).filter((word) => !word.startsWith('-'));
  const refuse = (message) => [`${message} Policy: "${ALLOWED_BRANCH}" is the only branch (docs/engineering/git-safety.md).`];
  if (sub === 'pr' && ['create', 'checkout'].includes(action)) return refuse(`gh pr ${action} needs a branch other than "${ALLOWED_BRANCH}".`);
  if (sub !== 'api') return [];
  const endpoint = words.slice(2).find((word) => !word.startsWith('-') && /(^|\/)(repos|git)\//.test(word)) ?? '';
  const methodIndex = words.findIndex((word) => word === '-X' || word === '--method');
  const inlineMethod = words.find((word) => word.startsWith('--method='))?.slice('--method='.length);
  const method = (inlineMethod ?? (methodIndex !== -1 ? words[methodIndex + 1] : null) ?? (words.some((word) => GH_WRITE_FIELD_OPTIONS.has(word)) ? 'POST' : 'GET')).toUpperCase();
  if (method === 'GET') return [];
  if (/\/branches\/[^/]+\/rename/.test(endpoint)) return refuse('Renaming a GitHub branch is forbidden.');
  if (/\/git\/refs/.test(endpoint)) {
    if (method === 'DELETE' && !/\/git\/refs\/heads\/dev$/.test(endpoint)) return [];
    return refuse(`gh api ${method} ${endpoint} writes a Git ref on GitHub.`);
  }
  return [];
}

/** Guard for a Bash command about to run. `currentBranch` is the short name, or null when unknown/detached. */
export function checkShellCommand(command, currentBranch = null, depth = 0) {
  const violations = [];
  for (const words of shellCommands(command)) {
    const git = parseGit(words);
    if (git) violations.push(...checkGitInvocation(git, currentBranch));
    const program = (words[0] ?? '').split('/').pop();
    if (program === 'gh') violations.push(...checkGhInvocation(words));
    // bash -c "git ..." / eval "git ...": inspect the nested command line too.
    let nested = null;
    if (['sh', 'bash', 'zsh', 'dash'].includes(program) && words.includes('-c')) nested = words[words.indexOf('-c') + 1];
    else if (program === 'eval') nested = words.slice(1).join(' ');
    if (nested && depth < 3) violations.push(...checkShellCommand(nested, currentBranch, depth + 1));
  }
  return violations;
}

/**
 * Claude Code PreToolUse payload ({ tool_name, tool_input }). Blocks the tools
 * that create branches on their own: git/gh commands, worktree isolation,
 * remote sessions that would push to a session-derived branch and GitHub API
 * tools that create branches or pull requests or write to a branch other than dev.
 */
export function checkToolUse(payload, currentBranch = null) {
  const tool = payload?.tool_name ?? '';
  const input = payload?.tool_input ?? {};
  if (tool === 'Bash') return checkShellCommand(String(input.command ?? ''), currentBranch);
  if (tool === 'EnterWorktree') return ['EnterWorktree creates a temporary branch/worktree; forbidden by the dev-only branch policy.'];
  if (tool === 'Agent' || tool === 'Task') {
    if (input.isolation === 'worktree' || input.isolation === 'remote') {
      return [`Agent isolation "${input.isolation}" creates a temporary branch; forbidden by the dev-only branch policy (run the agent without isolation).`];
    }
    return [];
  }
  if (/(^|__)create_session$/.test(tool) && input.outcome_branch !== ALLOWED_BRANCH) {
    return [`A remote session pushes to a session-derived branch unless outcome_branch is "${ALLOWED_BRANCH}"; forbidden by the dev-only branch policy.`];
  }
  // GitHub API tools (e.g. the GitHub MCP server) write branches on GitHub without git or its hooks.
  if (/^mcp__/.test(tool)) {
    if (/__(create_pull_request|update_pull_request_branch)$/.test(tool)) {
      return [`${tool} needs a branch other than "${ALLOWED_BRANCH}"; forbidden by the dev-only branch policy.`];
    }
    if (/__create_branch$/.test(tool) && input.branch !== ALLOWED_BRANCH) {
      return [`${tool} would create branch "${input.branch ?? '?'}"; "${ALLOWED_BRANCH}" is the only branch allowed.`];
    }
    if (/__(push_files|create_or_update_file|delete_file)$/.test(tool) && input.branch !== ALLOWED_BRANCH) {
      return [`${tool} writes to branch "${input.branch ?? '(default)'}"; only "${ALLOWED_BRANCH}" may be written.`];
    }
  }
  return [];
}
