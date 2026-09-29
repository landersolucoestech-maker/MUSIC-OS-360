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
 * it installs under <git-common-dir>/git-guard/ and to the Claude Code hooks in
 * .claude/settings.json. Every check returns a list of violations (empty = allowed).
 */
import path from 'node:path';

export const ALLOWED_BRANCH = 'dev';
export const ALLOWED_REMOTE = 'origin';

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
 * "<old-value> <new-value> <ref-name>". Any write of a new value to a branch
 * other than dev (git branch, checkout -b, switch -c, worktree add, fetch x:y,
 * update-ref, a commit on such a branch) aborts the transaction. Deletions stay
 * allowed so a forbidden branch can always be removed; a line whose ref already
 * holds that value (pack-refs/gc repacking an existing ref) is not a write.
 * git 2.43 does not report `git branch -m/-c` or `git symbolic-ref` here: those
 * are refused by the Claude guard and reported by `cli.mjs verify`.
 * `currentValue(ref)` returns the exact ref's current object id (never a
 * DWIM lookup, which a decoy such as refs/tags/refs/heads/x would satisfy), or null.
 */
export function checkRefTransaction(lines, currentValue = () => null) {
  const violations = [];
  for (const line of lines) {
    const [, newValue, refName] = line.trim().split(/\s+/);
    if (!refName || !refName.startsWith('refs/heads/')) continue;
    if (refName === ALLOWED_REF || isDeletion(newValue ?? '')) continue;
    if (currentValue(refName) === newValue) continue;
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
// Defence in depth for agents: refuses branch-creating commands and tools
// before they run, so an agent following a harness/tool instruction never gets
// that far. It is a best-effort command reader, not a sandbox; the installed
// git hooks and, server-side, the GitHub ruleset are the boundaries.

const SHELLS = new Set(['sh', 'bash', 'zsh', 'dash', 'ksh']);
const HEREDOC_DELIMITER = /^[A-Za-z_][A-Za-z0-9_.-]*$/;
const SUBSHELL_OPEN = '\u0000(';
const SUBSHELL_CLOSE = '\u0000)';

function basename(word) {
  return (word ?? '').split('/').pop();
}

/** Index of the `))` closing an arithmetic `$((`/`((` opened at `start`, or the end of the text. */
function arithmeticEnd(text, start) {
  const end = text.indexOf('))', start);
  return end === -1 ? text.length - 1 : end + 1;
}

/** Index of the `)` closing a `$(` whose content starts at `start` (quotes skipped), or -1. */
function substitutionEnd(text, start) {
  let depth = 1;
  let quote = null;
  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];
    if (quote) {
      if (ch === quote) quote = null;
      else if (ch === '\\' && quote === '"') i += 1;
    } else if (ch === "'" || ch === '"') {
      quote = ch;
    } else if (ch === '(') {
      depth += 1;
    } else if (ch === ')' && --depth === 0) {
      return i;
    }
  }
  return -1;
}

/** Simple commands plus subshell markers, so a `cd` inside `( … )` / `$( … )` does not leak out. */
function shellTokens(command, depth = 0) {
  const commands = [];
  let words = [];
  let word = '';
  let hasWord = false;
  let quote = null;
  let redirectTarget = null; // null, or the redirection operator whose target word comes next
  let lineStart = 0;
  const heredocs = []; // bodies start after the next unquoted newline
  const nested = (text) => {
    if (depth >= 4) return;
    commands.push([SUBSHELL_OPEN], ...shellTokens(text, depth + 1), [SUBSHELL_CLOSE]);
  };
  const endWord = () => {
    if (hasWord) {
      if ((redirectTarget === '<<' || redirectTarget === '<<-') && HEREDOC_DELIMITER.test(word)) {
        const program = basename(words.find((w) => !/^[A-Za-z_][A-Za-z0-9_]*=/.test(w)));
        heredocs.push({ delimiter: word, stripTabs: redirectTarget === '<<-', shell: SHELLS.has(program) });
      }
      if (redirectTarget) redirectTarget = null;
      else words.push(word);
    }
    word = '';
    hasWord = false;
  };
  const endCommand = () => {
    endWord();
    redirectTarget = null;
    if (words.length) commands.push(words);
    words = [];
  };
  for (let i = 0; i < command.length; i += 1) {
    const ch = command[i];
    if (quote) {
      if (ch === quote) {
        quote = null;
      } else if (quote === '"' && ch === '$' && command[i + 1] === '(' && command[i + 2] !== '(') {
        const end = substitutionEnd(command, i + 2);
        const stop = end === -1 ? command.length : end;
        nested(command.slice(i + 2, stop));
        word += command.slice(i, stop + 1);
        i = stop;
      } else if (quote === '"' && ch === '`') {
        const end = command.indexOf('`', i + 1);
        const stop = end === -1 ? command.length : end;
        nested(command.slice(i + 1, stop));
        i = stop;
      } else if (ch === '\\' && quote === '"' && i + 1 < command.length) {
        word += command[++i];
      } else {
        word += ch;
      }
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      hasWord = true;
    } else if (ch === '\\' && i + 1 < command.length) {
      if (command[i + 1] !== '\n') word += command[i + 1];
      hasWord = hasWord || command[i + 1] !== '\n';
      i += 1;
    } else if (ch === '#' && !hasWord) {
      while (i + 1 < command.length && command[i + 1] !== '\n') i += 1; // comment
    } else if ((ch === '$' && command[i + 1] === '(' && command[i + 2] === '(') || (ch === '(' && command[i + 1] === '(' && !hasWord)) {
      i = arithmeticEnd(command, i); // arithmetic, never a command
    } else if (ch === '$' && command[i + 1] === '(') {
      const end = substitutionEnd(command, i + 2);
      const stop = end === -1 ? command.length : end;
      nested(command.slice(i + 2, stop));
      word += command.slice(i, stop + 1);
      hasWord = true;
      i = stop;
    } else if ((ch === '<' || ch === '>') && command[i + 1] === '(') {
      const end = substitutionEnd(command, i + 2); // process substitution: its content is a command
      const stop = end === -1 ? command.length : end;
      endWord();
      nested(command.slice(i + 2, stop));
      i = stop;
    } else if (ch === '<' || ch === '>' || (ch === '&' && command[i + 1] === '>')) {
      if (hasWord && /^\d+$/.test(word)) {
        word = ''; // file descriptor number of `2>`
        hasWord = false;
      } else {
        endWord();
      }
      let operator = ch;
      while ('<>|'.includes(command[i + 1] ?? '\0') && operator.length < 3) operator += command[++i];
      if (command[i + 1] === '&' || (operator === '<<' && command[i + 1] === '-')) operator += command[++i];
      redirectTarget = operator;
    } else if (ch === '\n') {
      endCommand(); // also registers a heredoc whose delimiter ends this line
      const line = command.slice(lineStart, i);
      lineStart = i + 1;
      if (!heredocs.length) continue;
      const pipedToShell = /\|\s*(sudo\s+)?(\S*\/)?(ba|z|da|k)?sh\b/.test(line); // cat <<EOF | bash
      let position = i + 1;
      for (const { delimiter, stripTabs, shell } of heredocs) {
        const body = [];
        while (position < command.length) {
          const next = command.indexOf('\n', position);
          const end = next === -1 ? command.length : next;
          const bodyLine = stripTabs ? command.slice(position, end).replace(/^\t+/, '') : command.slice(position, end);
          position = end + 1;
          if (bodyLine === delimiter) break;
          body.push(bodyLine);
        }
        if (shell || pipedToShell) nested(body.join('\n')); // a shell runs the body
      }
      heredocs.length = 0;
      i = position - 1;
      lineStart = position;
    } else if (ch === '(') {
      endCommand();
      commands.push([SUBSHELL_OPEN]);
    } else if (ch === ')') {
      endCommand();
      commands.push([SUBSHELL_CLOSE]);
    } else if (ch === ';' || ch === '|' || ch === '&' || ch === '`') {
      endCommand();
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

/**
 * Splits a shell command line into simple commands and words (quotes honoured,
 * no expansion). Redirections (`2>&1`, `>/dev/null`, `&>f`, `<in`) are not
 * words; heredoc bodies are data unless a shell reads them; command
 * substitutions (also inside double quotes) and process substitutions are
 * parsed as commands; `#` comments and arithmetic `$((…))` are skipped.
 */
export function shellCommands(command) {
  return shellTokens(command).filter((words) => words[0] !== SUBSHELL_OPEN && words[0] !== SUBSHELL_CLOSE);
}

const ENV_ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/;
const HOOK_BYPASS_ENV = /^GIT_CONFIG_(COUNT|KEY_\d+|VALUE_\d+|PARAMETERS)=/;
const WRAPPERS = new Set(['sudo', 'env', 'command', 'exec', 'nohup', 'time', 'timeout', 'nice', 'ionice', 'xargs', 'stdbuf', 'setsid', 'chronic', 'unbuffer', 'builtin', 'doas', 'flock']);
const GIT_GLOBAL_OPTIONS_WITH_VALUE = new Set(['-C', '-c', '--git-dir', '--work-tree', '--namespace', '--exec-path', '--config-env', '--super-prefix', '--attr-source', '--list-cmds']);
const GIT_PLUMBING_PROGRAM = /^git-(send-pack|receive-pack|http-push|remote-[a-z0-9]+)$/;
const PLUMBING_PUSH = /^(send-pack|receive-pack|http-push|remote-[a-z0-9]+)$/;
const LIST_WITH_PATTERN_OPTIONS = ['--list', '--contains', '--no-contains', '--merged', '--no-merged', '--points-at', '--all', '--remotes'];
const LIST_ONLY_BRANCH_OPTIONS = [...LIST_WITH_PATTERN_OPTIONS, '--verbose', '--show-current', '--format', '--sort', '--column', '--no-column', '--color', '--no-color', '--ignore-case', '--abbrev', '--no-abbrev'];
const REF_WRITING_SUBCOMMANDS = new Set(['branch', 'checkout', 'switch', 'push', 'update-ref', 'symbolic-ref', 'worktree', 'fetch', 'replace', 'remote', 'config']);

/**
 * Returns { env, viaXargs, globals, sub, args } for a word list that runs git
 * (possibly behind VAR=value assignments and wrappers such as
 * env/sudo/timeout/nice/xargs, whose own options and values are skipped), or
 * null when it is not git.
 */
function parseGit(words) {
  const env = [];
  let viaXargs = false;
  let wrapped = false;
  let index = 0;
  for (; index < words.length; index += 1) {
    const current = words[index];
    const name = basename(current);
    if (name === 'git' || GIT_PLUMBING_PROGRAM.test(name)) break;
    if (WRAPPERS.has(name)) {
      wrapped = true;
      if (name === 'xargs') viaXargs = true;
    } else if (ENV_ASSIGNMENT.test(current)) {
      env.push(current);
    } else if (!wrapped) {
      return null; // not a wrapper chain: `echo git ...`, `grep git ...`
    }
  }
  if (index >= words.length) return null;
  const program = basename(words[index]);
  if (program !== 'git') return { env, viaXargs, globals: [], sub: program.slice('git-'.length), args: words.slice(index + 1) };
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
  return { env, viaXargs, globals, sub: words[index] ?? '', args: words.slice(index + 1) };
}

/** Git accepts any unambiguous prefix of a long option (`--no-veri` = `--no-verify`). */
function optionMatches(arg, name) {
  if (!name.startsWith('--') || !arg.startsWith('--')) return arg === name;
  const flag = arg.split('=')[0];
  return flag === name || (flag.length >= 3 && name.startsWith(flag));
}

function hasOption(args, ...names) {
  return args.some((arg) => names.some((name) => optionMatches(arg, name)));
}

/**
 * Short-option clusters such as `-fb` count as their letters; scanning a
 * cluster stops at a letter that takes a value (`-mRefactoring`, `-uno`).
 */
function hasShortFlag(args, letter, valueLetters = '') {
  return args.some((arg) => {
    if (!/^-[A-Za-z]/.test(arg)) return false;
    for (const ch of arg.slice(1)) {
      if (ch === letter) return true;
      if (valueLetters.includes(ch) || !/[A-Za-z]/.test(ch)) return false;
    }
    return false;
  });
}

/**
 * Name of the branch a checkout/switch would create: undefined when it creates
 * none, null when the name cannot be determined (treated as forbidden).
 * `--track <remote>/<name>` without an explicit name creates <name>.
 */
function createdBranch(args, valueFlags, clusterLetters) {
  const longFlags = valueFlags.filter((flag) => flag.startsWith('--'));
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--') break;
    if (arg.startsWith('--') && longFlags.some((flag) => optionMatches(arg, flag))) {
      return arg.includes('=') ? arg.slice(arg.indexOf('=') + 1) || null : args[i + 1] ?? null;
    }
    if (valueFlags.includes(arg)) return args[i + 1] ?? null;
    if (/^-[A-Za-z]{2,}$/.test(arg) && clusterLetters.some((letter) => arg.includes(letter))) return null;
  }
  const trackIndex = args.findIndex((arg) => arg === '-t' || optionMatches(arg, '--track'));
  if (trackIndex !== -1) {
    const upstream = args.slice(trackIndex + 1).find((arg) => !arg.startsWith('-'));
    return upstream ? upstream.split('/').slice(1).join('/') || null : null;
  }
  return undefined;
}

function isDevRef(name) {
  return name === ALLOWED_BRANCH || name === ALLOWED_REF;
}

/**
 * A revision that checks out a detached HEAD, never a branch: a commit id,
 * HEAD/@ with ~^ suffixes, a remote-tracking name or, per `resolveRevision`
 * (the caller's lookup: 'branch' | 'commit' | 'path' | null), any existing
 * non-branch commit (tag, stash@{0}, ORIG_HEAD, abc~1...).
 */
function isDetachingRevision(target, resolveRevision) {
  if (/^[0-9a-f]{7,40}([~^]\d*)*$/i.test(target) || /^(HEAD|@)([~^]\d*|@\{\d+\})*$/.test(target) || target.startsWith(`${ALLOWED_REMOTE}/`)) return true;
  return resolveRevision(target) === 'commit';
}

function checkGitInvocation({ env, viaXargs, globals, sub, args }, { currentBranch, resolveRevision }) {
  const violations = [];
  const refuse = (message) => violations.push(`${message} Policy: work only on "${ALLOWED_BRANCH}", push only to ${ALLOWED_REMOTE}/${ALLOWED_BRANCH} (docs/engineering/git-safety.md).`);

  if (viaXargs && REF_WRITING_SUBCOMMANDS.has(sub)) refuse(`git ${sub} through xargs takes arguments that cannot be checked.`);

  // Anything that could switch the git hooks off, rewrite history invisibly or push around pre-push.
  const configReadOnly = sub === 'config' && (hasOption(args, '--get', '--get-all', '--get-regexp', '--list', '--show-origin', '--show-scope') || hasShortFlag(args, 'l'));
  if (env.some((word) => HOOK_BYPASS_ENV.test(word))) refuse('GIT_CONFIG_* overrides can disable the branch guard.');
  if (globals.some((word) => optionMatches(word, '--config-env'))) refuse('--config-env can disable the branch guard.');
  if (globals.some((word) => /^(alias|include|includeif)\./i.test(word))) refuse('Defining git aliases or config includes on the command line is forbidden.');
  if ([...env, ...globals, ...(sub === 'config' && !configReadOnly ? args : [])].some((word) => /hookspath/i.test(word))) refuse('core.hooksPath is managed only by scripts/git-guard/cli.mjs install.');
  if (sub === 'config' && !configReadOnly) {
    if (args.some((word) => /^(alias|include|includeif)\./i.test(word))) refuse('Defining git aliases or config includes is forbidden.');
    if (hasOption(args, '--remove-section', '--rename-section')) refuse('Removing or renaming git config sections can disable the branch guard.');
  }
  if (PLUMBING_PUSH.test(sub)) refuse(`git ${sub} pushes without the pre-push hook.`);
  if (sub === 'init' && hasOption(args, '--separate-git-dir')) refuse('git init --separate-git-dir moves the git directory away from the installed guard.');
  if (sub === 'replace' && !(hasOption(args, '--list', '--delete') || hasShortFlag(args, 'l') || hasShortFlag(args, 'd'))) refuse('git replace rewrites history invisibly to the fast-forward check.');

  switch (sub) {
    case 'checkout': {
      const created = createdBranch(args, ['-b', '-B', '--orphan'], ['b', 'B']);
      if (created !== undefined) {
        if (created !== ALLOWED_BRANCH) refuse(`Creating branch "${created ?? '?'}" with git checkout is forbidden.`);
        break;
      }
      if (args.includes('--')) break; // `git checkout <tree-ish> -- <paths>` only restores files
      const target = args.find((arg) => !arg.startsWith('-'));
      if (!target || hasOption(args, '--detach') || target === ALLOWED_BRANCH || target === '.' || resolveRevision(target) === 'path') break;
      if (!isDetachingRevision(target, resolveRevision)) {
        refuse(`git checkout ${target} may create or switch to a branch other than "${ALLOWED_BRANCH}"; use git switch ${ALLOWED_BRANCH}, git switch --detach <commit> or git checkout <commit> -- <path>.`);
      }
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
      if (!detached && target && target !== ALLOWED_BRANCH) refuse(`Switching to branch "${target}" is forbidden.`);
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
      const positional = args.filter((arg) => !arg.startsWith('-'));
      const listing = hasOption(args, ...LIST_WITH_PATTERN_OPTIONS) || ['l', 'a', 'r'].some((letter) => hasShortFlag(args, letter))
        || (!positional.length && (hasOption(args, ...LIST_ONLY_BRANCH_OPTIONS) || ['v', 'i'].some((letter) => hasShortFlag(args, letter))));
      if (listing) break;
      if (positional.length && positional[0] !== ALLOWED_BRANCH) refuse(`Creating branch "${positional[0]}" is forbidden.`);
      break;
    }
    case 'worktree':
      if (args[0] === 'add' && !(hasOption(args, '--detach') || hasShortFlag(args.slice(1), 'd'))) {
        const [, commitish] = args.slice(1).filter((arg) => !arg.startsWith('-'));
        const creates = hasShortFlag(args.slice(1), 'b') || hasShortFlag(args.slice(1), 'B') || hasOption(args, '--orphan');
        if (creates || !commitish || !isDetachingRevision(commitish, resolveRevision)) {
          refuse('git worktree add creates or checks out a branch unless it is run with --detach (or on a commit).');
        }
      }
      break;
    case 'update-ref': {
      const ref = args.find((arg) => !arg.startsWith('-'));
      const deleting = hasShortFlag(args, 'd');
      if (ref && !deleting && ((ref.startsWith('refs/heads/') && ref !== ALLOWED_REF) || ref.startsWith('refs/replace/'))) refuse(`Writing "${ref}" is forbidden.`);
      break;
    }
    case 'symbolic-ref': {
      const positional = args.filter((arg) => !arg.startsWith('-'));
      const deleting = hasOption(args, '--delete') || hasShortFlag(args, 'd');
      if (!deleting && positional.length >= 2 && (positional[1] !== ALLOWED_REF || (positional[0].startsWith('refs/heads/') && positional[0] !== ALLOWED_REF))) {
        refuse(`git symbolic-ref ${positional[0]} ${positional[1]} points a branch/HEAD somewhere other than ${ALLOWED_REF}.`);
      }
      break;
    }
    case 'commit':
    case 'merge':
    case 'cherry-pick':
    case 'revert':
    case 'am':
    case 'rebase':
      if (hasOption(args, '--no-verify') || (sub === 'commit' && hasShortFlag(args, 'n', 'mFCcSut'))) refuse('Skipping the git hooks (--no-verify) is forbidden.');
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
  if (hasOption(args, '--force', '--force-with-lease', '--force-if-includes') || hasShortFlag(args, 'f', 'o')) violations.push('Force pushes are forbidden.');
  if (hasOption(args, '--no-verify')) violations.push('Skipping the pre-push hook (--no-verify) is forbidden.');
  if (hasOption(args, '--receive-pack', '--exec')) violations.push('Overriding the remote receive-pack is forbidden.');
  const deleting = hasOption(args, '--delete') || hasShortFlag(args, 'd', 'o');
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
    const sourceIsDev = isDevRef(source) || ((source === 'HEAD' || source === '@') && (!currentBranch || currentBranch === ALLOWED_BRANCH));
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
  if (sub === 'issue' && action === 'develop' && !words.some((word) => word === '--list' || word === '-l')) return refuse('gh issue develop creates a branch on GitHub.');
  if (sub === 'repo' && action === 'sync') return refuse('gh repo sync force-updates branches.');
  if (sub !== 'api') return [];
  if (action === 'graphql') {
    if (words.some((word) => /\b(createRef|updateRefs?|createLinkedBranch|createCommitOnBranch)\b/.test(word))) return refuse('GraphQL ref mutations write branches on GitHub.');
    if (words.some((word) => /^(query|mutation)=@/.test(word) || word === '--input')) return refuse('A GraphQL query read from a file cannot be checked.');
    return [];
  }
  const endpoint = words.slice(2).find((word) => !word.startsWith('-') && /(^|\/)(repos|git)\//.test(word)) ?? '';
  const methodIndex = words.findIndex((word) => word === '-X' || word === '--method');
  const inlineMethod = words.find((word) => word.startsWith('--method='))?.slice('--method='.length);
  const method = (inlineMethod ?? (methodIndex !== -1 ? words[methodIndex + 1] : null) ?? (words.some((word) => GH_WRITE_FIELD_OPTIONS.has(word)) ? 'POST' : 'GET')).toUpperCase();
  if (method === 'GET') return [];
  if (/\/branches\/[^/]+\/rename/.test(endpoint) || /\/merge-upstream$/.test(endpoint)) return refuse('Renaming or syncing a GitHub branch is forbidden.');
  if (/\/git\/refs/.test(endpoint)) {
    if (method === 'DELETE' && !/\/git\/refs\/heads\/dev$/.test(endpoint)) return [];
    return refuse(`gh api ${method} ${endpoint} writes a Git ref on GitHub.`);
  }
  return [];
}

/** Directory a git invocation operates on (after -C / --git-dir / GIT_DIR), or null when it cannot be known. */
function gitTargetDir({ env, globals }, cwd, exportedGitDir) {
  const resolve = (base, dir) => {
    if (!dir || /[$~`]/.test(dir)) return null;
    if (path.isAbsolute(dir)) return path.normalize(dir);
    return base === null ? null : path.resolve(base, dir);
  };
  let dir = cwd;
  for (let i = 0; i < globals.length; i += 1) {
    if (globals[i] === '-C') dir = resolve(dir, globals[i + 1]);
  }
  const gitDir = globals.find((word) => word.startsWith('--git-dir='))?.slice('--git-dir='.length)
    ?? (globals.includes('--git-dir') ? globals[globals.indexOf('--git-dir') + 1] : null)
    ?? env.find((word) => word.startsWith('GIT_DIR='))?.slice('GIT_DIR='.length)
    ?? exportedGitDir;
  if (gitDir === undefined) return null; // an exported GIT_DIR whose value is unknown
  return gitDir !== null ? resolve(dir, gitDir) : dir;
}

// Paths whose modification switches the guard off or rewrites history invisibly.
const PROTECTED_GIT_PATH = /(^|\/)\.git\/(config|git-guard|hooks|info\/grafts|commondir|worktrees\/[^/\s]+\/(config|commondir))\b/;
const WRITING_PROGRAMS = new Set(['rm', 'mv', 'cp', 'sed', 'perl', 'tee', 'truncate', 'ln', 'chmod', 'install', 'rsync', 'dd', 'unlink', 'shred']);

/**
 * Guard for a Bash command about to run. Options: `cwd` (directory the command
 * starts in); `isProjectDir(dir)` (false only for a directory known to belong to
 * another repository whose remotes are not this project's — git commands there
 * are not this policy's business); `resolveRevision(name, dir)` ('branch' |
 * 'commit' | 'path' | null, to tell `git checkout <file|tag>` from a branch);
 * `projectUrls` (this project's origin URL and paths, which another repository
 * may not adopt as a remote).
 */
export function checkShellCommand(command, currentBranch = null, options = {}) {
  const { cwd = null, isProjectDir = () => true, resolveRevision = () => null, projectUrls = [] } = options;
  const violations = [];
  const refuse = (message) => violations.push(`${message} Policy: "${ALLOWED_BRANCH}" is the only branch (docs/engineering/git-safety.md).`);
  if (/(>>?|>\|)\s*["']?\S*\.git\/(config|git-guard|hooks|info\/grafts|commondir)\b/.test(command)) refuse('Writing into the git directory can disable the branch guard.');
  const dirs = [];
  let dir = cwd;
  let exportedGitDir = null; // null: none, undefined: exported with an unknown value
  for (const words of shellTokens(command)) {
    if (words[0] === SUBSHELL_OPEN) {
      dirs.push(dir);
      continue;
    }
    if (words[0] === SUBSHELL_CLOSE) {
      if (dirs.length) dir = dirs.pop();
      continue;
    }
    const program = basename(words[0]);
    if (program === 'cd' || program === 'pushd') {
      const target = words[1];
      dir = !target || /[$~`]/.test(target) || target === '-' ? null : path.isAbsolute(target) ? path.normalize(target) : dir === null ? null : path.resolve(dir, target);
      continue;
    }
    if (['export', 'declare', 'typeset', 'set', 'env'].includes(program) || words.every((word) => ENV_ASSIGNMENT.test(word))) {
      if (words.some((word) => HOOK_BYPASS_ENV.test(word))) refuse('GIT_CONFIG_* overrides can disable the branch guard.');
      const gitDir = words.find((word) => /^GIT_(DIR|COMMON_DIR|WORK_TREE)=/.test(word));
      if (gitDir) exportedGitDir = /[$~`]/.test(gitDir) ? undefined : gitDir.slice(gitDir.indexOf('=') + 1);
    }
    if (WRITING_PROGRAMS.has(program) && words.slice(1).some((word) => PROTECTED_GIT_PATH.test(word))) refuse(`${program} on the git directory can disable the branch guard.`);
    const git = parseGit(words);
    if (git) {
      const target = gitTargetDir(git, dir, exportedGitDir);
      const pushesToProject = git.sub === 'push' && git.args.some((arg) => projectUrls.includes(arg));
      if (target === null || isProjectDir(target) || pushesToProject) {
        violations.push(...checkGitInvocation(git, { currentBranch, resolveRevision: (name) => resolveRevision(name, target) }));
      } else if (git.sub === 'remote' && ['add', 'set-url'].includes(git.args[0])) {
        const url = git.args.filter((arg) => !arg.startsWith('-'))[2];
        if (!url || /[$`]/.test(url) || projectUrls.includes(url)) refuse('Another repository may not adopt this project\'s origin as a remote.');
      }
    }
    if (program === 'gh') violations.push(...checkGhInvocation(words));
    // sh -c / bash -lc / eval: inspect the nested command line too.
    const shellFlag = SHELLS.has(program) ? words.findIndex((word, index) => index > 0 && /^-[A-Za-z]*c[A-Za-z]*$/.test(word)) : -1;
    const nested = shellFlag !== -1 ? words[shellFlag + 1] : program === 'eval' ? words.slice(1).join(' ') : null;
    if (nested) violations.push(...checkShellCommand(nested, currentBranch, { ...options, cwd: dir }));
  }
  return violations;
}

/**
 * Claude Code PreToolUse payload ({ tool_name, tool_input }). Blocks the tools
 * that create branches on their own: git/gh commands, worktree isolation,
 * remote sessions that would push to a session-derived branch, GitHub API
 * tools that create branches or pull requests or write to a branch other than
 * dev, and file edits inside the git directory (`isGitDirPath(path)`).
 */
export function checkToolUse(payload, currentBranch = null, options = {}) {
  const tool = payload?.tool_name ?? '';
  const input = payload?.tool_input ?? {};
  const { isGitDirPath = () => false } = options;
  if (tool === 'Bash') return checkShellCommand(String(input.command ?? ''), currentBranch, options);
  if (['Edit', 'Write', 'MultiEdit', 'NotebookEdit'].includes(tool)) {
    const file = input.file_path ?? input.notebook_path;
    return file && isGitDirPath(file) ? [`${tool} inside the git directory (${file}) can disable the branch guard; forbidden.`] : [];
  }
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
    if (/__(create_pull_request|update_pull_request_branch|assign_copilot_to_issue|create_pull_request_with_copilot)$/.test(tool)) {
      return [`${tool} creates or moves a branch other than "${ALLOWED_BRANCH}"; forbidden by the dev-only branch policy.`];
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
