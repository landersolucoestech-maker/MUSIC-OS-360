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
// that far. It reads shell text conservatively (git/gh/shells are found at any
// position of a simple command; anything it cannot parse is refused when it
// mentions git or gh). It is not a sandbox; the installed git hooks and,
// server-side, the GitHub ruleset are the boundaries.

const SHELLS = new Set(['sh', 'bash', 'zsh', 'dash', 'ksh']);
// Programs that run text they read from stdin/heredocs/files as shell commands.
const SCRIPT_RUNNERS = new Set([...SHELLS, 'source', '.']);
const HEREDOC_DELIMITER = /^[A-Za-z_][A-Za-z0-9_.-]*$/;
const SUBSHELL_OPEN = '\u0000(';
const SUBSHELL_CLOSE = '\u0000)';
const MENTIONS_GIT = /(^|[^A-Za-z0-9_.-])(git|gh)([^A-Za-z0-9_.]|$)/;
const RESERVED = new Set(['if', 'then', 'elif', 'else', 'fi', 'do', 'done', 'while', 'until', 'for', 'in', 'case', 'esac', '!', '{', '}', '[[', ']]', 'time', 'function', 'select', 'coproc']);
const ENV_ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/;
// A program name or `-c` text that is wholly an expansion (`$g`, `${G:-git}`, `$(echo git)`, an empty
// backtick substitution): its value is the command, which the tokenizer cannot see.
const DYNAMIC_COMMAND_WORD = /^(\$\{[^}]*\}|\$[A-Za-z_@*][A-Za-z0-9_]*|\$\(.*\)|)$/s;
const DYNAMIC_COMMAND_TEXT = /^\s*\$[({A-Za-z_]/;

function shellQuote(word) {
  return `'${String(word).replace(/'/g, `'\\''`)}'`;
}

function basename(word) {
  return (word ?? '').split('/').pop();
}

/**
 * Tokenizes shell text into simple commands (arrays of words) plus subshell
 * markers. Quotes are honoured without expansion; `$( … )`, backticks and
 * process substitutions are tokenized recursively (heredocs inside them
 * included) and emitted as nested commands; redirections are dropped (a
 * here-string or heredoc read by a shell is tokenized as commands; other
 * heredoc bodies are data); `#` comments and arithmetic are skipped. `mode`
 * is 'top', 'subst' (ends at the matching `)`) or 'backtick'.
 * Returns { commands, end, incomplete } — `incomplete` when a quote,
 * substitution or heredoc is never closed.
 */
function tokenize(text, start = 0, mode = 'top', depth = 0) {
  const commands = [];
  let words = [];
  let word = '';
  let hasWord = false;
  let wordQuoted = false; // any quoting in the word: a quoted heredoc delimiter keeps its body literal
  let quote = null;
  let redirectTarget = null;
  let incomplete = false;
  let parens = 0;
  const heredocs = [];
  const program = () => basename(words.find((w) => !ENV_ASSIGNMENT.test(w) && !RESERVED.has(w)));
  const nestedIn = (source, from, innerMode) => {
    if (depth >= 6) {
      incomplete = true;
      return source.length;
    }
    const inner = tokenize(source, from, innerMode, depth + 1);
    commands.push([SUBSHELL_OPEN], ...inner.commands, [SUBSHELL_CLOSE]);
    if (inner.incomplete || inner.end === -1) incomplete = true;
    return inner.end === -1 ? source.length : inner.end;
  };
  const nestedAt = (from, innerMode) => nestedIn(text, from, innerMode);
  // An unquoted heredoc body is expanded by the shell: its quotes are literal, but
  // `$(…)` and backticks run (a backslash escapes the next character).
  const substitutionsIn = (body) => {
    for (let k = 0; k < body.length; k += 1) {
      const c = body[k];
      const arithmeticEnd = c === '$' && body[k + 1] === '(' && body[k + 2] === '(' ? body.indexOf('))', k) : -1; // only at `$((`: linear scan
      if (c === '\\') {
        k += 1;
      } else if (arithmeticEnd !== -1 && !MENTIONS_GIT.test(body.slice(k, arithmeticEnd))) {
        k = arithmeticEnd + 1;
      } else if (c === '$' && body[k + 1] === '(') {
        k = nestedIn(body, k + 2, 'subst');
      } else if (c === '`') {
        k = nestedIn(body, k + 1, 'backtick');
      }
    }
  };
  const nestedText = (body) => {
    if (depth >= 6) {
      incomplete = true;
      return;
    }
    const inner = tokenize(body, 0, 'top', depth + 1);
    commands.push([SUBSHELL_OPEN], ...inner.commands, [SUBSHELL_CLOSE]);
    if (inner.incomplete) incomplete = true;
  };
  const endWord = () => {
    if (hasWord) {
      if (redirectTarget === '<<' || redirectTarget === '<<-') {
        if (HEREDOC_DELIMITER.test(word)) {
          heredocs.push({ delimiter: word, stripTabs: redirectTarget === '<<-', shell: SCRIPT_RUNNERS.has(program()), expands: !wordQuoted });
          words.readsHeredoc = true;
        } else {
          incomplete = true;
        }
      } else if (redirectTarget === '<<<' && SCRIPT_RUNNERS.has(program())) {
        nestedText(word); // bash <<< 'git …'
        words.readsHeredoc = true;
      } else if (redirectTarget && redirectTarget.includes('>') && !(redirectTarget.endsWith('&') && /^(\d+|-)$/.test(word))) {
        (words.writesTo ??= []).push(word); // file written by >, >>, >|, &>, <>, >&file
      }
      if (redirectTarget) redirectTarget = null;
      else words.push(word);
    }
    word = '';
    hasWord = false;
    wordQuoted = false;
  };
  const endCommand = () => {
    endWord();
    redirectTarget = null;
    if (words.length || words.writesTo) commands.push(words);
    words = [];
  };
  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];
    if (quote === "'") {
      if (ch === "'") quote = null;
      else word += ch;
      continue;
    }
    if (quote === '"') {
      if (ch === '"') {
        quote = null;
      } else if (ch === '\\' && i + 1 < text.length) {
        word += text[++i];
      } else if (ch === '$' && text[i + 1] === '(' && text[i + 2] !== '(') {
        const end = nestedAt(i + 2, 'subst');
        word += text.slice(i, end + 1);
        i = end;
      } else if (ch === '`') {
        i = nestedAt(i + 1, 'backtick');
      } else {
        word += ch;
      }
      continue;
    }
    if (mode === 'backtick' && ch === '`') {
      endCommand();
      return { commands, end: i, incomplete };
    }
    if (ch === '$' && text[i + 1] === "'") {
      // ANSI-C quoting: `\'` is an escaped quote inside it (unlike plain single quotes).
      let k = i + 2;
      while (k < text.length && text[k] !== "'") k += text[k] === '\\' ? 2 : 1;
      if (k >= text.length) {
        incomplete = true;
        word += text.slice(i + 2);
        i = text.length;
      } else {
        word += text.slice(i + 2, k);
        i = k;
      }
      hasWord = true;
      wordQuoted = true;
    } else if (ch === "'" || ch === '"') {
      quote = ch;
      hasWord = true;
      wordQuoted = true;
    } else if (ch === '\\' && i + 1 < text.length) {
      if (text[i + 1] !== '\n') {
        word += text[i + 1];
        hasWord = true;
        wordQuoted = true;
      }
      i += 1;
    } else if (ch === '#' && !hasWord) {
      while (i + 1 < text.length && text[i + 1] !== '\n') i += 1; // comment
    } else if (((ch === '$' && text[i + 1] === '(' && text[i + 2] === '(') || (ch === '(' && text[i + 1] === '(' && !hasWord))
      && text.indexOf('))', i) !== -1 && !MENTIONS_GIT.test(text.slice(i, text.indexOf('))', i)))) {
      i = text.indexOf('))', i) + 1; // arithmetic, never a command (a `((` hiding git is parsed as subshells)
    } else if (ch === '$' && text[i + 1] === '(') {
      const end = nestedAt(i + 2, 'subst');
      word += text.slice(i, end + 1);
      hasWord = true;
      i = end;
    } else if (ch === '`') {
      i = nestedAt(i + 1, 'backtick');
      hasWord = true;
    } else if ((ch === '<' || ch === '>') && text[i + 1] === '(') {
      endWord();
      i = nestedAt(i + 2, 'subst'); // process substitution
    } else if (ch === '<' || ch === '>' || (ch === '&' && text[i + 1] === '>')) {
      if (hasWord && /^\d+$/.test(word)) {
        word = ''; // file descriptor number of `2>`
        hasWord = false;
      } else {
        endWord();
      }
      let operator = ch;
      while ('<>|'.includes(text[i + 1] ?? '\0') && operator.length < 3) operator += text[++i];
      if (text[i + 1] === '&' || (operator === '<<' && text[i + 1] === '-')) operator += text[++i];
      redirectTarget = operator;
    } else if (ch === '\n') {
      const line = text.slice(text.lastIndexOf('\n', i - 1) + 1, i);
      const pipesIntoShell = /\|\s*(\S*\/)?(sudo\s+|env\s+)?(\S*\/)?(ba|z|da|k)?sh\b/.test(line); // cat <<EOF | bash
      endCommand(); // also registers a heredoc whose delimiter ends this line
      if (!heredocs.length) continue;
      let position = i + 1;
      for (const { delimiter, stripTabs, shell, expands } of heredocs) {
        const body = [];
        let closed = false;
        while (position < text.length) {
          const next = text.indexOf('\n', position);
          const end = next === -1 ? text.length : next;
          const bodyLine = stripTabs ? text.slice(position, end).replace(/^\t+/, '') : text.slice(position, end);
          position = end + 1;
          if (bodyLine === delimiter) {
            closed = true;
            break;
          }
          body.push(bodyLine);
        }
        if (!closed) incomplete = true;
        if (shell || pipesIntoShell) nestedText(body.join('\n')); // a shell runs the body
        else if (expands) substitutionsIn(body.join('\n')); // `$(…)`/backticks of an unquoted body run
      }
      heredocs.length = 0;
      i = position - 1;
    } else if (ch === '(') {
      endCommand();
      parens += 1;
      commands.push([SUBSHELL_OPEN]);
    } else if (ch === ')') {
      endCommand();
      if (parens > 0) {
        parens -= 1;
        commands.push([SUBSHELL_CLOSE]);
      } else if (mode === 'subst') {
        return { commands, end: i, incomplete };
      } else {
        commands.push([SUBSHELL_CLOSE]); // e.g. a case pattern
      }
    } else if (ch === ';' || ch === '|' || ch === '&') {
      endCommand();
    } else if (/\s/.test(ch)) {
      endWord();
    } else {
      word += ch;
      hasWord = true;
    }
  }
  endCommand();
  if (quote || heredocs.length) incomplete = true;
  if (mode !== 'top') return { commands, end: -1, incomplete: true };
  return { commands, end: text.length, incomplete };
}

/**
 * Splits a shell command line into simple commands and words (quotes honoured,
 * no expansion). Redirections are not words; heredoc bodies are data unless a
 * shell reads them; substitutions are tokenized as commands (emitted before
 * the command that uses them); `#` comments and arithmetic are skipped.
 */
export function shellCommands(command) {
  return tokenize(command).commands.filter((words) => words.length && words[0] !== SUBSHELL_OPEN && words[0] !== SUBSHELL_CLOSE).map((words) => [...words]);
}

const HOOK_BYPASS_ENV = /^(GIT_CONFIG(_(COUNT|KEY_\d+|VALUE_\d+|PARAMETERS|GLOBAL|SYSTEM|NOSYSTEM))?|GIT_EXEC_PATH)=/;
// HOME / XDG_CONFIG_HOME relocate the global git config (hooksPath=/dev/null); only suspicious next to git/gh.
const CONFIG_HOME_ENV = /^(HOME|XDG_CONFIG_HOME)=/;
// Environment variables and `-c` keys whose value is a command git runs (checked as shell text).
const COMMAND_ENV = /^(GIT_(PAGER|EDITOR|SEQUENCE_EDITOR|SSH|SSH_COMMAND|EXTERNAL_DIFF|ASKPASS|PROXY_COMMAND)|SSH_ASKPASS|PAGER|EDITOR|VISUAL)=/;
const COMMAND_CONFIG_KEY = /^(core\.(pager|editor|sshcommand|fsmonitor|askpass|gitproxy)|sequence\.editor|credential\..*helper|diff\..*(external|textconv)|filter\..*|gpg\..*program|sendemail\.smtpserver|uploadpack\..*|receive\..*|merge\..*\.driver|mergetool\..*cmd|difftool\..*cmd)$/i;
const COMMAND_OPTION = /^--(upload-pack|receive-pack|exec|extcmd|open-files-in-pager|exec-path)(=|$)/;
const POSITIONAL_FORWARD = /\$(\{?[@*0-9]|\{[@*0-9])/;
const GIT_GLOBAL_OPTIONS_WITH_VALUE = new Set(['-C', '-c', '--git-dir', '--work-tree', '--namespace', '--exec-path', '--config-env', '--super-prefix', '--attr-source', '--list-cmds']);
const GIT_PLUMBING_PROGRAM = /^git-(send-pack|receive-pack|http-push|remote-[a-z0-9]+)$/;
const PLUMBING_PUSH = /^(send-pack|receive-pack|http-push|remote-[a-z0-9]+)$/;
const LIST_WITH_PATTERN_OPTIONS = ['--list', '--contains', '--no-contains', '--merged', '--no-merged', '--points-at', '--all', '--remotes'];
const LIST_ONLY_BRANCH_OPTIONS = [...LIST_WITH_PATTERN_OPTIONS, '--verbose', '--show-current', '--format', '--sort', '--column', '--no-column', '--color', '--no-color', '--ignore-case', '--abbrev', '--no-abbrev'];
const REF_WRITING_SUBCOMMANDS = new Set(['branch', 'checkout', 'switch', 'push', 'update-ref', 'symbolic-ref', 'worktree', 'fetch', 'replace', 'remote', 'config', 'stash', 'subtree']);
// Options whose value is a separate word (so `-m "-n flag"` is a message, not -n).
const VALUE_OPTIONS = {
  commit: { short: 'mFCct', long: ['--message', '--file', '--reuse-message', '--reedit-message', '--template', '--author', '--date', '--fixup', '--squash', '--trailer', '--cleanup', '--pathspec-from-file'] },
  push: { short: 'o', long: ['--push-option', '--repo', '--receive-pack', '--exec', '--recurse-submodules', '--signed'] },
  merge: { short: 'mFsX', long: ['--message', '--file', '--strategy', '--strategy-option', '--cleanup', '--into-name'] },
  rebase: { short: 'xsX', long: ['--exec', '--strategy', '--strategy-option', '--onto', '--whitespace'] },
};

const SAFE_PUSH_OVERRIDE = /^push\.default=(simple|current|upstream|tracking|nothing)$/i;
const CONFIG_VALUE_OPTIONS = new Set(['--file', '-f', '--blob', '--type', '--default', '--comment', '--value']);

/**
 * `git config` reads (`--get`, `--list`, `get`, a lone key) or writes (a key and a value,
 * `set`/`unset`/`--add`/`--unset`/section edits). Unknown shapes count as writes.
 */
function configMode(args) {
  if (hasOption(args, '--add', '--replace-all', '--unset', '--unset-all', '--rename-section', '--remove-section', '--edit') || hasShortFlag(args, 'e')) return 'write';
  if (hasOption(args, '--get', '--get-all', '--get-regexp', '--get-urlmatch', '--get-color', '--get-colorbool', '--list') || hasShortFlag(args, 'l')) return 'read';
  const positional = [];
  for (let i = 0; i < args.length; i += 1) {
    if (CONFIG_VALUE_OPTIONS.has(args[i])) i += 1;
    else if (!args[i].startsWith('-')) positional.push(args[i]);
  }
  if (['get', 'list'].includes(positional[0])) return 'read';
  if (['set', 'unset', 'rename-section', 'remove-section', 'edit'].includes(positional[0])) return 'write';
  return positional.length <= 1 ? 'read' : 'write';
}

/** Removes option values that are separate words (`-m msg`, `-amsg` stays, `--message msg`). */
function withoutOptionValues(sub, args) {
  const spec = VALUE_OPTIONS[sub];
  if (!spec) return args;
  const kept = [];
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    kept.push(arg);
    if (arg === '--') {
      kept.push(...args.slice(i + 1));
      break;
    }
    if (/^-[A-Za-z]+$/.test(arg)) {
      const letters = arg.slice(1);
      const valueAt = [...letters].findIndex((letter) => spec.short.includes(letter));
      if (valueAt === letters.length - 1) i += 1; // `-am msg`: the next word is the value
    } else if (spec.long.includes(arg)) {
      i += 1;
    }
  }
  return kept;
}

/** The git invocation starting at words[index] ({ env, viaXargs, globals, sub, args }). */
function parseGitAt(words, index) {
  const before = words.slice(0, index);
  const env = before.filter((word) => ENV_ASSIGNMENT.test(word));
  const viaXargs = before.some((word) => basename(word) === 'xargs');
  const program = basename(words[index]);
  if (program !== 'git') return { env, viaXargs, globals: [], sub: program.slice('git-'.length), args: words.slice(index + 1) };
  const globals = [];
  let dynamicWord = false; // subcommand or global option word that is itself an expansion
  let i = index + 1;
  while (i < words.length && words[i].startsWith('-')) {
    const option = words[i];
    if (/[$`]/.test(option) || option === '') dynamicWord = true;
    globals.push(option);
    if (GIT_GLOBAL_OPTIONS_WITH_VALUE.has(option)) {
      globals.push(words[i + 1] ?? '');
      // `-c $x` / `-c $x=y` hides the config key; values of -C/--git-dir etc. may be expansions.
      if (option === '-c' && /[$`]/.test((words[i + 1] ?? '').split('=')[0])) dynamicWord = true;
      i += 1;
    }
    i += 1;
  }
  const sub = words[i] ?? '';
  if (/[$`]/.test(sub) || words[i] === '') dynamicWord = true; // a backtick substitution is tokenized to an empty word
  return { env, viaXargs, globals, sub, args: words.slice(i + 1), dynamicWord };
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

function checkGitInvocation(invocation, context) {
  const { env, viaXargs, globals, sub } = invocation;
  const { currentBranch, resolveRevision, checkNested } = context;
  const args = withoutOptionValues(sub, invocation.args);
  const violations = [];
  const refuse = (message) => violations.push(`${message} Policy: work only on "${ALLOWED_BRANCH}", push only to ${ALLOWED_REMOTE}/${ALLOWED_BRANCH} (docs/engineering/git-safety.md).`);

  if (invocation.dynamicWord) refuse('A git subcommand or global option that comes from an expansion cannot be checked; write it literally.');
  if (env.some((word) => CONFIG_HOME_ENV.test(word))) refuse('HOME/XDG_CONFIG_HOME can redirect the git config that holds the branch guard.');
  if (globals.some((word) => /^--exec-path=/.test(word))) refuse('--exec-path replaces the git helper programs.');
  // Command-executing settings: the command text is checked like any other shell command.
  env.filter((word) => COMMAND_ENV.test(word)).forEach((word) => checkNested(word.slice(word.indexOf('=') + 1)));
  globals.forEach((word) => {
    const eq = word.indexOf('=');
    if (eq !== -1 && COMMAND_CONFIG_KEY.test(word.slice(0, eq))) checkNested(word.slice(eq + 1).replace(/^!/, ''));
  });
  {
    const raw = invocation.args;
    raw.forEach((arg, i) => {
      if (sub === 'filter-branch' && !arg.startsWith('-')) checkNested(arg);
      if (sub === 'filter-branch' && /^--[a-z-]+=/.test(arg)) checkNested(arg.slice(arg.indexOf('=') + 1));
      if (['fetch', 'pull', 'ls-remote', 'clone', 'archive', 'push', 'grep'].includes(sub)) {
        const m = COMMAND_OPTION.exec(arg);
        if (m) {
          if (m[1] === 'exec-path') refuse('--exec-path replaces the git helper programs.');
          else checkNested(arg.includes('=') ? arg.slice(arg.indexOf('=') + 1) : raw[i + 1] ?? '');
        } else if (sub !== 'archive' && /^-u./s.test(arg) && ['fetch', 'ls-remote', 'clone'].includes(sub)) checkNested(arg.slice(2));
        else if (sub === 'grep' && /^-O./s.test(arg)) checkNested(arg.slice(2));
        else if (sub === 'grep' && arg === '-O') checkNested(raw[i + 1] ?? '');
      }
    });
  }
  if (viaXargs && REF_WRITING_SUBCOMMANDS.has(sub)) refuse(`git ${sub} through xargs takes arguments that cannot be checked.`);

  // Anything that could switch the git hooks off, rewrite history invisibly or push around pre-push.
  const configReadOnly = sub === 'config' && configMode(args) === 'read';
  const pushConfig = /^(push\.default|remote\..+\.(push|mirror))$/i;
  if (env.some((word) => HOOK_BYPASS_ENV.test(word))) refuse('GIT_CONFIG_* overrides can disable the branch guard.');
  if (globals.some((word) => optionMatches(word, '--config-env'))) refuse('--config-env can disable the branch guard.');
  // A per-command `-c push.default=<single-branch mode>` changes nothing persistent and pushes at most the current branch.
  if (globals.some((word) => /^(alias|include|includeif)\./i.test(word) || (pushConfig.test(word.split('=')[0]) && !SAFE_PUSH_OVERRIDE.test(word)))) refuse('Defining git aliases, config includes or push refspecs on the command line is forbidden.');
  if ([...env, ...globals, ...(sub === 'config' && !configReadOnly ? args : [])].some((word) => /hookspath/i.test(word))) refuse('core.hooksPath is managed only by scripts/git-guard/cli.mjs install.');
  if (sub === 'config' && !configReadOnly) {
    if (args.some((word) => /^(alias|include|includeif)\./i.test(word) || pushConfig.test(word))) refuse('Defining git aliases, config includes or push refspecs is forbidden.');
    if (hasOption(args, '--remove-section', '--rename-section')) refuse('Removing or renaming git config sections can disable the branch guard.');
  }
  // Redirecting where origin pushes (exfiltration of dev): URL/pushurl rewrites and insteadOf rules.
  const urlConfig = /^(remote\.[^=]+\.(url|pushurl)|url\..+\.(insteadof|pushinsteadof))$/i;
  if (globals.some((word) => urlConfig.test(word.split('=')[0]))) refuse('Redirecting remotes (remote.*.url, pushurl, url.*.insteadOf) on the command line is forbidden.');
  if (sub === 'config' && !configReadOnly && args.some((word) => urlConfig.test(word.split('=')[0]))) refuse('Changing remote URLs or url.*.insteadOf rewrites is forbidden.');
  if (sub === 'remote' && ['set-url', 'seturl'].includes(args.find((arg) => !arg.startsWith('-')))) refuse('git remote set-url could redirect pushes away from origin.');
  if (sub === 'push') {
    invocation.args.forEach((arg, i, raw) => {
      if (optionMatches(arg, '--repo')) {
        const value = arg.includes('=') ? arg.slice(arg.indexOf('=') + 1) : raw[i + 1] ?? '';
        if (value !== ALLOWED_REMOTE) refuse(`git push --repo "${value}" pushes somewhere other than "${ALLOWED_REMOTE}".`);
      }
    });
  }
  if (PLUMBING_PUSH.test(sub)) refuse(`git ${sub} pushes without the pre-push hook.`);
  if (sub === 'init' && hasOption(args, '--separate-git-dir')) refuse('git init --separate-git-dir moves the git directory away from the installed guard.');
  if (sub === 'replace' && !(hasOption(args, '--list', '--delete') || hasShortFlag(args, 'l') || hasShortFlag(args, 'd'))) refuse('git replace rewrites history invisibly to the fast-forward check.');
  if (sub === 'stash' && args[0] === 'branch') refuse('git stash branch creates a branch.');
  if (sub === 'subtree' && (args[0] === 'push' || hasOption(args, '--branch') || hasShortFlag(args, 'b'))) refuse('git subtree push/--branch writes other branches.');
  if (sub === 'rebase') {
    const raw = invocation.args;
    raw.forEach((arg, i) => {
      if (arg === '-x' || arg === '--exec') checkNested(raw[i + 1] ?? '');
      else if (arg.startsWith('--exec=')) checkNested(arg.slice('--exec='.length));
      else {
        // `-x"cmd"`, `-xcmd`, `-ix cmd`: a short cluster ending in x takes the rest (or the next word) as the command.
        const cluster = /^-[A-Za-z]*?x(.*)$/s.exec(arg);
        if (cluster && !arg.startsWith('--')) checkNested(cluster[1] || raw[i + 1] || '');
      }
    });
  }
  // Commands git runs for the user: every word, the joined words and the shell-quoted join are checked as shell text.
  const checkCommandWords = (words) => {
    words.forEach((word) => checkNested(word));
    checkNested(words.join(' '));
    checkNested(words.map(shellQuote).join(' '));
  };
  const rawArgs = invocation.args;
  if (sub === 'bisect' && rawArgs[0] === 'run') checkCommandWords(rawArgs.slice(1));
  if (sub === 'submodule') {
    const at = rawArgs.indexOf('foreach');
    if (at !== -1) checkCommandWords(rawArgs.slice(at + 1).filter((word) => word !== '--recursive'));
  }
  if (sub === 'difftool' || sub === 'mergetool') {
    rawArgs.forEach((arg, i) => {
      if (arg === '-x' || optionMatches(arg, '--extcmd')) {
        if (arg.includes('=')) checkNested(arg.slice(arg.indexOf('=') + 1));
        else checkNested(rawArgs[i + 1] ?? '');
      } else if (/^-x./s.test(arg)) checkNested(arg.slice(2));
    });
  }

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
      if (hasOption(args, '--stdin')) {
        refuse('git update-ref --stdin writes refs that cannot be checked.');
        break;
      }
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

// Exact spellings only: any other substitution is an unknown refspec and fails closed.
const CURRENT_BRANCH_SUBSTITUTIONS = new Set(['$(git rev-parse --abbrev-ref HEAD)', '$(git branch --show-current)', '$(git symbolic-ref --short HEAD)']);

function checkPushCommand(args, currentBranch) {
  const violations = [];
  if (hasOption(args, '--all', '--mirror', '--tags', '--follow-tags', '--branches')) violations.push('Pushing all branches/tags is forbidden.');
  if (hasOption(args, '--force', '--force-with-lease', '--force-if-includes') || hasShortFlag(args, 'f', 'o')) violations.push('Force pushes are forbidden.');
  if (hasOption(args, '--no-verify')) violations.push('Skipping the pre-push hook (--no-verify) is forbidden.');
  if (hasOption(args, '--receive-pack', '--exec')) violations.push('Overriding the remote receive-pack is forbidden.');
  const deleting = hasOption(args, '--delete') || hasShortFlag(args, 'd', 'o');
  const positional = args.filter((arg, i) => !arg.startsWith('-') && !['-o', '--push-option', '--repo', '--receive-pack', '--exec'].includes(args[i - 1]));
  const [remote, ...refspecs] = positional;
  if (remote && remote !== ALLOWED_REMOTE) violations.push(`Pushing to "${remote}" is forbidden.`);
  if (deleting) {
    if (refspecs.some((spec) => isDevRef(spec.replace(/^:/, '')))) violations.push(`Deleting ${ALLOWED_REMOTE}/${ALLOWED_BRANCH} is forbidden.`);
    return violations;
  }
  if (!refspecs.length && currentBranch && currentBranch !== ALLOWED_BRANCH) {
    violations.push(`Pushing the current branch "${currentBranch}" is forbidden.`);
  }
  for (const word of refspecs) {
    const spec = CURRENT_BRANCH_SUBSTITUTIONS.has(word) && currentBranch === ALLOWED_BRANCH ? ALLOWED_BRANCH : word;
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
const COPILOT = /copilot/i;
const ISSUE_ENDPOINT = /(^|\/)repos\/[^/\s]+\/[^/\s]+\/issues(\/|\?|$)/;

/** `--assignee X`, `--assignee=X`, `--add-assignee=X`, `-a X`, `-a=X`, `-aX` naming Copilot (any case). */
function assignsCopilot(words) {
  return words.some((word, i) => {
    if (/^(-a|--assignee|--add-assignee)$/.test(words[i - 1] ?? '') && COPILOT.test(word)) return true;
    const inline = /^--(?:add-)?assignee=(.*)$/.exec(word) ?? /^-a=?(.+)$/.exec(word);
    return Boolean(inline) && COPILOT.test(inline[1]);
  });
}

/** Values given to `gh api` fields: `-f k=v`, `-F k=v`, `--field k=v`, `--raw-field=k=v`, `-fk=v`. */
function ghFieldValues(words) {
  const values = [];
  words.forEach((word, i) => {
    if (['-f', '-F', '--field', '--raw-field'].includes(words[i - 1] ?? '')) values.push(word);
    const inline = /^--(?:raw-)?field=(.*)$/.exec(word) ?? /^-[fF](.+)$/.exec(word);
    if (inline) values.push(inline[1]);
  });
  return values;
}

/** `gh` (GitHub CLI) invocations that create or move branches on GitHub, bypassing git and its hooks. */
function checkGhInvocation(words) {
  const [sub, action] = words.slice(1).filter((word) => !word.startsWith('-'));
  const refuse = (message) => [`${message} Policy: "${ALLOWED_BRANCH}" is the only branch (docs/engineering/git-safety.md).`];
  if (sub === 'pr' && ['create', 'checkout'].includes(action)) return refuse(`gh pr ${action} needs a branch other than "${ALLOWED_BRANCH}".`);
  if (sub === 'issue' && action === 'develop' && !words.some((word) => word === '--list' || word === '-l')) return refuse('gh issue develop creates a branch on GitHub.');
  if (['issue', 'pr'].includes(sub) && ['create', 'edit'].includes(action) && assignsCopilot(words)) return refuse('Assigning Copilot makes it create a copilot/* branch.');
  if (sub === 'agent-task' && action === 'create') return refuse('gh agent-task create makes Copilot create a branch.');
  if (sub === 'alias' && ['set', 'import'].includes(action)) return refuse('gh alias set/import can hide a forbidden gh command behind an innocent name.');
  if (sub === 'pr' && action === 'merge') return refuse('gh pr merge writes the base branch on GitHub.');
  if (sub === 'repo' && action === 'sync') return refuse('gh repo sync force-updates branches.');
  if (sub !== 'api') return [];
  if (action === 'graphql') {
    if (words.some((word) => /\b(createRef|updateRefs?|createLinkedBranch|createCommitOnBranch|addAssigneesToAssignable|replaceActorsForAssignable)\b/.test(word)
      || (/\bmutation\b/.test(word) && /\b(assigneeIds|actorIds)\b/.test(word)))) return refuse('GraphQL mutations that write branches or set assignees (Copilot) are forbidden.');
    if (words.some((word) => /^(query|mutation)=@/.test(word) || word === '--input')) return refuse('A GraphQL query read from a file cannot be checked.');
    return [];
  }
  const endpoint = words.slice(2).find((word) => !word.startsWith('-') && /(^|\/)(repos|git)\//.test(word)) ?? '';
  const methodIndex = words.findIndex((word) => word === '-X' || word === '--method');
  const inlineMethod = words.find((word) => word.startsWith('--method='))?.slice('--method='.length)
    ?? words.find((word) => /^-X.+/.test(word))?.slice(2).replace(/^=/, ''); // `-XPOST`, `-XDELETE`
  const method = (inlineMethod ?? (methodIndex !== -1 ? words[methodIndex + 1] : null) ?? (words.some((word) => GH_WRITE_FIELD_OPTIONS.has(word)) ? 'POST' : 'GET')).toUpperCase();
  if (method === 'GET') return [];
  if (/\/branches\/[^/]+\/rename/.test(endpoint) || /\/merge-upstream$/.test(endpoint)) return refuse('Renaming or syncing a GitHub branch is forbidden.');
  if (['POST', 'PATCH', 'PUT'].includes(method) && ISSUE_ENDPOINT.test(endpoint)) {
    if (words.some((word) => word === '--input' || word.startsWith('--input='))) return refuse('An issue mutation read from a file cannot be checked for a Copilot assignment; pass the fields with -f.');
    const assignment = ghFieldValues(words).filter((field) => /^assignees?(\[\d*\])?=/i.test(field));
    if (assignment.some((field) => COPILOT.test(field.slice(field.indexOf('=') + 1)))) return refuse('Assigning Copilot makes it create a copilot/* branch.');
  }
  // The server-side ruleset is the real boundary: never edit or delete it, nor branch protection.
  if (/\/(rulesets?|branches\/[^/]+\/protection)(\/|$)/.test(endpoint)) return refuse(`gh api ${method} ${endpoint} changes the repository's rulesets/branch protection.`);
  if (/\/merges$/.test(endpoint) && method === 'POST') return refuse('gh api POST merges writes a branch on GitHub.');
  if (/\/contents\//.test(endpoint) && ['PUT', 'POST', 'DELETE'].includes(method)) {
    const onDev = ghFieldValues(words).some((field) => field === `branch=${ALLOWED_BRANCH}`);
    if (!onDev) return refuse(`gh api ${method} ${endpoint} writes a file to a branch other than "${ALLOWED_BRANCH}" (pass -f branch=${ALLOWED_BRANCH}).`);
  }
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

// A path in a .git directory (config, hooks, refs, HEAD, packed-refs, grafts, the installed guard),
// at the start of a token or after "/" or "=" (`of=.git/HEAD`, `--target-directory=.git/refs`).
// .gitignore, .github/, .gitkeep and names merely containing ".git" do not match.
const GIT_DIR_PATH = /(^|[/=])\.git(\/|$)/;

/** A glob component (`.gi*`, `.[g]it`, `.g?t`, `git-gua*`) as an anchored RegExp, or null when it has no glob character. */
function globComponent(component) {
  if (!/[*?[]/.test(component)) return null;
  let source = '';
  for (let i = 0; i < component.length; i += 1) {
    const ch = component[i];
    if (ch === '*') source += '.*';
    else if (ch === '?') source += '.';
    else if (ch === '[') {
      const close = component.indexOf(']', i + 2);
      if (close === -1) source += '\\[';
      else {
        source += `[${component.slice(i + 1, close).replace(/^!/, '^').replace(/\\/g, '\\\\')}]`;
        i = close;
      }
    } else source += ch.replace(/[.+^${}()|\\\]]/g, '\\$&');
  }
  try {
    return new RegExp(`^${source}$`);
  } catch {
    return /^[\s\S]*$/; // an unparsable glob: assume it could match
  }
}

const GIT_DIR_SUBSTITUTION = /(--(absolute-)?git(-common)?-dir|\$\{?GIT_(COMMON_)?DIR\b)/;

/** Whether a path word names the .git directory (also through globs or $(git rev-parse --git-common-dir)) or the installed guard. */
function namesGitDirOrGuard(word) {
  const value = word.startsWith('-') && word.includes('=') ? word.slice(word.indexOf('=') + 1) : word;
  if (GIT_DIR_PATH.test(value)) return true;
  if (/\$|`/.test(value) && GIT_DIR_SUBSTITUTION.test(value)) return true;
  const parts = value.split('/');
  return parts.some((part, i) => {
    if (part === 'git-guard') return parts[i - 1] !== 'scripts'; // the installed guard dir; scripts/git-guard is the source tree
    const glob = globComponent(part);
    if (!glob) return false;
    if (glob.test('.git')) return true;
    return glob.test('git-guard') && i > 0 && (parts[i - 1] === '.git' || globComponent(parts[i - 1])?.test('.git') === true);
  });
}

/** Whether `p` (a resolved directory) is inside a .git directory. */
function insideGitDir(p) {
  return typeof p === 'string' && p.split(/[\\/]/).includes('.git');
}
// Programs that never write the files named in their arguments. Anything else naming a .git path is
// refused (fail closed); git/gh have their own rules; interpreters are a declared limit.
const READ_ONLY_PROGRAMS = new Set([
  'cat', 'less', 'more', 'head', 'tail', 'ls', 'stat', 'file', 'wc', 'grep', 'egrep', 'fgrep', 'rg', 'ag', 'ack', 'diff', 'cmp', 'comm',
  'sha1sum', 'sha224sum', 'sha256sum', 'sha384sum', 'sha512sum', 'md5sum', 'b2sum', 'cksum', 'sum', 'od', 'xxd', 'hexdump', 'strings',
  'readlink', 'realpath', 'basename', 'dirname', 'tree', 'du', 'test', '[', 'echo', 'printf', 'jq', 'true', 'false', 'type', 'which',
  'export', 'declare', 'typeset', 'local', 'readonly', 'unset', 'node', 'python', 'python3',
]);

/** The program a simple command runs: the first word in command position that is not a wrapper, option or number. */
function programIndex(words) {
  return words.findIndex((word, index) => inCommandPosition(words, index) && !WRAPPERS.has(basename(word)) && !RESERVED.has(word)
    && !ENV_ASSIGNMENT.test(word) && !word.startsWith('-') && !/^\d+(\.\d+)?[smhd]?$/.test(word));
}

const FILTER_OPTION = /^--(exclude|exclude-dir|exclude-from|ignore|ignore-dir)(=|$)/; // a pattern to leave out, not a target
// Programs that write files named in their arguments. After a wrapper, whose option values can hide the
// real program (`env -u cat tee .git/HEAD`, `flock cat tee …`), any of them in the command counts.
const WRITING_PROGRAMS = new Set(['rm', 'mv', 'cp', 'sed', 'perl', 'tee', 'truncate', 'ln', 'chmod', 'install', 'rsync', 'dd', 'unlink', 'shred', 'touch', 'mkdir', 'awk', 'gawk', 'tar', 'unzip', 'wget', 'curl']);
// A redirection into .git inside script text (`awk '{print > ".git/HEAD"}'`, `node -e "…('echo x > .git/HEAD')"`).
const SCRIPT_REDIRECT_INTO_GIT_DIR = /(>>?|>\||&>)\s*["']?(?:[^\s"'>&]*\/)?\.git(\/|["'\s;|&)]|$)/;
// Read-only programs whose arguments can still be script text run elsewhere (`echo '…' | sh`, `node -e`).
const SCRIPT_TEXT_READERS = new Set(['echo', 'printf', 'node', 'python', 'python3']);

/** Whether a simple command writes into a .git directory through its arguments or redirections. */
function writesIntoGitDir(words, inGitDir = false) {
  if ((words.writesTo ?? []).some((target) => namesGitDirOrGuard(target) || inGitDir)) return true;
  const index = programIndex(words);
  if (index === -1) return false;
  const program = basename(words[index]);
  // `--exclude=.git`, `--exclude-dir .git`, `--ignore=.git` filter .git out; they do not name a target.
  const args = [];
  for (let i = index + 1; i < words.length; i += 1) {
    const filter = FILTER_OPTION.exec(words[i]);
    if (!filter) args.push(words[i]);
    else if (filter[2] !== '=') i += 1; // `--exclude .git`: the next word is the pattern
  }
  // git/gh have their own rules; a shell's or eval's command text is tokenized as commands.
  if (program === 'git' || program === 'gh' || GIT_PLUMBING_PROGRAM.test(program) || SHELLS.has(program) || program === 'eval') return false;
  const scriptText = !READ_ONLY_PROGRAMS.has(program) || SCRIPT_TEXT_READERS.has(program);
  if (scriptText && args.some((arg) => SCRIPT_REDIRECT_INTO_GIT_DIR.test(arg))) return true;
  // After `cd .git` every relative argument is inside the git directory: name it explicitly.
  if (inGitDir) args.push('.git/');
  if (!args.some((arg) => namesGitDirOrGuard(arg))) return false;
  const wrapped = words.slice(0, index).some((word) => WRAPPERS.has(basename(word)));
  if (wrapped && args.some((arg) => WRITING_PROGRAMS.has(basename(arg)))) return true;
  if (program === 'sed') return args.some((arg) => /^-[A-Za-z]*i|^--in-place/.test(arg));
  if (program === 'find') {
    // -delete/-exec act on the starting points (`-not -path './.git/*'` is a filter); the command run by
    // -exec/-ok and the file written by -fprint/-fls are targets of their own.
    const first = args.findIndex((arg) => /^[-(!]/.test(arg));
    const startingPoints = first > 0 ? args.slice(0, first) : args;
    if ((inGitDir || startingPoints.some((arg) => namesGitDirOrGuard(arg))) && args.some((arg) => /^-(delete|exec|execdir|ok|okdir)$/.test(arg))) return true;
    const execCommand = (i) => {
      const rest = args.slice(i + 1);
      const end = rest.findIndex((word) => word === ';' || word === '+');
      return end === -1 ? rest : rest.slice(0, end);
    };
    return args.some((arg, i) => (/^-(fprint0?|fprintf|fls)$/.test(arg) && GIT_DIR_PATH.test(args[i + 1] ?? ''))
      || (EXEC_OPTIONS.has(arg) && writesIntoGitDir(execCommand(i), inGitDir)));
  }
  return !READ_ONLY_PROGRAMS.has(program);
}

const WRAPPERS = new Set(['sudo', 'env', 'command', 'exec', 'nohup', 'time', 'timeout', 'nice', 'ionice', 'xargs', 'stdbuf', 'setsid', 'chronic', 'unbuffer', 'builtin', 'doas', 'flock', 'watch', 'parallel', 'strace', 'ltrace', 'busybox', 'fakeroot', 'taskset', 'numactl', 'chroot', 'unshare', 'nsenter', 'runuser', 'setpriv', 'prlimit', 'systemd-run', 'xvfb-run', 'ssh-agent', 'dbus-run-session', 'proxychains', 'proxychains4', 'torsocks', 'firejail', 'bwrap', 'cpulimit', 'chpst']);
const EXEC_OPTIONS = new Set(['-exec', '-execdir', '-ok', '-okdir']); // find … -exec git …

/**
 * words[index] is a program being run: only reserved words (if/then/do/!/{…),
 * VAR=value assignments and wrappers (with their own options and values)
 * precede it, or it follows find's -exec.
 */
function inCommandPosition(words, index) {
  if (EXEC_OPTIONS.has(words[index - 1])) return true;
  let wrapped = false;
  let skipName = false; // `function name { … }`: the name is not a command
  for (const word of words.slice(0, index)) {
    if (skipName) skipName = false;
    else if (word === 'function') skipName = true;
    else if (WRAPPERS.has(basename(word))) wrapped = true;
    else if (!(RESERVED.has(word) || ENV_ASSIGNMENT.test(word) || wrapped)) return false;
  }
  return !skipName;
}

/** First word that is the command itself (after reserved words and VAR=value assignments). */
function leadingWord(words) {
  return words.find((word) => !RESERVED.has(word) && !ENV_ASSIGNMENT.test(word));
}

/**
 * Guard for a Bash command about to run. Options: `cwd` (directory the command
 * starts in); `isProjectDir(dir)` (false only for a directory known to belong to
 * another repository whose remotes are not this project's — git commands there
 * are not this policy's business); `resolveRevision(name, dir)` ('branch' |
 * 'commit' | 'path' | null, to tell `git checkout <file|tag>` from a branch);
 * `isProjectUrl(url)` (this project's origin or location, which another
 * repository may not push to or adopt as a remote).
 */
export function checkShellCommand(command, currentBranch = null, options = {}, depth = 0) {
  const { cwd = null, isProjectDir = () => true, resolveRevision = () => null } = options;
  const isProjectUrl = options.isProjectUrl ?? ((url) => (options.projectUrls ?? []).includes(url));
  const violations = [];
  const refuse = (message) => violations.push(`${message} Policy: "${ALLOWED_BRANCH}" is the only branch (docs/engineering/git-safety.md).`);
  const { commands, incomplete } = tokenize(command);
  if (incomplete && MENTIONS_GIT.test(command)) refuse('This command has an unterminated quote, substitution or heredoc, so its git/gh commands cannot be checked; split or fix it.');
  const dirs = [];
  let dir = cwd;
  let inGitDir = insideGitDir(cwd); // after `cd .git` (or through a glob / $(git rev-parse --git-common-dir)): relative writes land in the git directory
  let exportedGitDir = null; // null: none, undefined: exported with an unknown value
  const checkNested = (text, nestedDir) => {
    if (depth < 4) violations.push(...checkShellCommand(text, currentBranch, { ...options, cwd: nestedDir }, depth + 1));
    else refuse('Nested commands are too deep to check.');
  };
  for (const words of commands) {
    if (words[0] === SUBSHELL_OPEN) {
      dirs.push([dir, inGitDir]);
      continue;
    }
    if (words[0] === SUBSHELL_CLOSE) {
      if (dirs.length) [dir, inGitDir] = dirs.pop();
      continue;
    }
    const lead = basename(leadingWord(words));
    if (lead === 'cd' || lead === 'pushd') {
      const target = words[words.indexOf(leadingWord(words)) + 1];
      const previous = dir;
      dir = !target || /[$~`]/.test(target) || target === '-' ? null : path.isAbsolute(target) ? path.normalize(target) : dir === null ? null : path.resolve(dir, target);
      inGitDir = dir !== null ? insideGitDir(dir) : (namesGitDirOrGuard(target ?? '') || (inGitDir && previous === null && !path.isAbsolute(target ?? '')));
      continue;
    }
    if (words.some((word) => HOOK_BYPASS_ENV.test(word))) refuse('GIT_CONFIG_* overrides can disable the branch guard.');
    if (MENTIONS_GIT.test(command) && words.some((word) => CONFIG_HOME_ENV.test(word))) refuse('HOME/XDG_CONFIG_HOME can redirect the git config that holds the branch guard.');
    words.filter((word) => COMMAND_ENV.test(word)).forEach((word) => checkNested(word.slice(word.indexOf('=') + 1), dir));
    if (lead === 'alias' && words.slice(1).some((word) => MENTIONS_GIT.test(word.slice(word.indexOf('=') + 1)))) refuse('An alias whose body runs git/gh hides the command from the checks; run git/gh directly.');
    const gitDirAssignment = words.find((word) => /^GIT_(DIR|COMMON_DIR|WORK_TREE)=/.test(word));
    if (gitDirAssignment && (['export', 'declare', 'typeset'].includes(lead) || words.every((word) => ENV_ASSIGNMENT.test(word)))) {
      exportedGitDir = /[$~`]/.test(gitDirAssignment) ? undefined : gitDirAssignment.slice(gitDirAssignment.indexOf('=') + 1);
    }
    if (writesIntoGitDir(words, inGitDir)) refuse('Writing into the git directory can disable the branch guard.');
    words.forEach((word, index) => {
      const name = basename(word);
      if (!inCommandPosition(words, index)) return;
      if (index === programIndex(words) && DYNAMIC_COMMAND_WORD.test(word) && /git|gh/.test(command)) {
        refuse('A command whose program name comes from an expansion cannot be checked; write git/gh literally.');
      }
      if (name === 'git' || GIT_PLUMBING_PROGRAM.test(name)) {
        const git = parseGitAt(words, index);
        const target = gitTargetDir(git, dir, exportedGitDir);
        const pushesToProject = git.sub === 'push' && git.args.some((arg) => isProjectUrl(arg));
        if (target === null || isProjectDir(target) || pushesToProject) {
          violations.push(...checkGitInvocation(git, {
            currentBranch,
            resolveRevision: (revision) => resolveRevision(revision, target),
            checkNested: (text) => checkNested(text, target),
          }));
        } else if (git.sub === 'remote' && ['add', 'set-url'].includes(git.args[0])) {
          const url = git.args.filter((arg) => !arg.startsWith('-'))[2];
          if (!url || /[$`]/.test(url) || isProjectUrl(url)) refuse('Another repository may not adopt this project\'s origin as a remote.');
        }
      } else if (name === 'gh') {
        violations.push(...checkGhInvocation(words.slice(index)));
      } else if (SHELLS.has(name)) {
        const rest = words.slice(index + 1);
        const flag = rest.findIndex((arg) => /^-[A-Za-z]*c[A-Za-z]*$/.test(arg));
        // Option words after -c (`bash -c -l 'cmd'`, `bash -c -o pipefail 'cmd'`, `sh -c -- 'cmd'`) come before the command text.
        let commandAt = flag + 1;
        while (flag !== -1 && commandAt < rest.length && /^[-+]/.test(rest[commandAt])) {
          const option = rest[commandAt];
          commandAt += 1;
          if (option === '--') break;
          if (/^[-+][A-Za-z]*[oO]$/.test(option)) commandAt += 1; // `-o name` / `-O shopt` take a value
        }
        if (flag !== -1) {
          if (DYNAMIC_COMMAND_TEXT.test(rest[commandAt] ?? '') && MENTIONS_GIT.test(command)) refuse(`${name} -c with an expansion as its command cannot be checked; run the git/gh commands directly.`);
          const text = rest[commandAt] ?? '';
          if (POSITIONAL_FORWARD.test(text) && MENTIONS_GIT.test(text) && rest.length > commandAt + 1) refuse(`${name} -c forwarding positional parameters to git/gh cannot be checked; run the git/gh commands directly.`);
          checkNested(text, dir);
        }
        else if (!words.readsHeredoc && !rest.some((arg) => !arg.startsWith('-')) && MENTIONS_GIT.test(command)) {
          refuse(`${name} reading commands from its input cannot be checked; run the git/gh commands directly.`);
        }
      } else if (name === 'eval') {
        const text = words.slice(index + 1).join(' ');
        if (DYNAMIC_COMMAND_TEXT.test(text) && MENTIONS_GIT.test(command)) refuse('eval of an expansion cannot be checked; run the git/gh commands directly.');
        checkNested(text, dir);
      } else if (name === 'trap') {
        const action = words.slice(index + 1).find((arg) => !arg.startsWith('-'));
        if (action) checkNested(action, dir); // runs later, on the signal/exit
      } else if (name === 'env') {
        // `env -S 'git push …'` splits and runs its string.
        words.slice(index + 1).forEach((arg, k, rest) => {
          const split = /^-[A-Za-z]*S/.exec(arg);
          if (split) checkNested(arg.slice(split[0].length) || rest[k + 1] || '', dir);
          else if (arg.startsWith('--split-string')) checkNested(arg.includes('=') ? arg.slice(arg.indexOf('=') + 1) : rest[k + 1] ?? '', dir);
        });
      } else if (name === 'su' || name === 'script') {
        words.slice(index + 1).forEach((arg, k, rest) => {
          if (/^-[A-Za-z]*c$/.test(arg) || arg === '--command') checkNested(rest[k + 1] ?? '', dir);
          else if (arg.startsWith('--command=')) checkNested(arg.slice('--command='.length), dir);
        });
      } else if (name === 'source' || name === '.') {
        const files = words.slice(index + 1).filter((arg) => !arg.startsWith('-'));
        const fromInput = !files.length || files.some((arg) => /^(\/dev\/(stdin|fd\/|tty)|\/proc\/self\/fd\/)/.test(arg));
        if (fromInput && !words.readsHeredoc && MENTIONS_GIT.test(command)) refuse(`${name} reading commands from its input cannot be checked; run the git/gh commands directly.`);
      }
    });
  }
  return [...new Set(violations)];
}

/**
 * Claude Code PreToolUse payload ({ tool_name, tool_input }). Blocks the tools
 * that create branches on their own: git/gh commands, worktree isolation,
 * remote sessions that would push to a session-derived branch, GitHub API
 * tools that create branches or pull requests (or delegate to Copilot) or write
 * to a branch other than dev, and file edits inside the git directory
 * (`isGitDirPath(path)`).
 */
export function checkToolUse(payload, currentBranch = null, options = {}) {
  const tool = payload?.tool_name ?? '';
  const input = payload?.tool_input ?? {};
  const { isGitDirPath = () => false } = options;
  if (tool === 'Bash' || tool === 'PowerShell' || tool === 'Monitor') return checkShellCommand(String(input.command ?? ''), currentBranch, options);
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
    if (/__(issue_write|create_issue|update_issue|add_issue_assignees?)$/.test(tool) && COPILOT.test(JSON.stringify(input.assignees ?? input.assignee ?? ''))) {
      return [`${tool} assigns Copilot, which creates a copilot/* branch; forbidden by the dev-only branch policy.`];
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
