// Git worktree isolation — a real, dependency-free git feature (no vendoring
// needed). In this repository worktrees are detached checkouts for isolated
// read-only work (reviews against an exact commit): the dev-only branch policy
// (docs/engineering/git-safety.md) forbids the extra branch a writable worktree
// would need, so concurrent writers are separated by disjoint file ownership
// (.claude/rules/agent-orchestration.md).
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { run } from "./exec.mjs";

export function worktreesDir(repoRoot) {
  return join(repoRoot, ".claude", "ops", "worktrees");
}

/** Creates a new worktree at .claude/ops/worktrees/<name> on a DETACHED HEAD
 * at the current commit. It never creates a branch: this repository allows no
 * branch other than dev (docs/engineering/git-safety.md; the reference-transaction
 * hook refuses any other refs/heads/*), and commits are allowed only on dev, so
 * a worktree is an isolated read-only/review checkout — parallel writers need
 * disjoint file ownership instead. Fails loudly (returns ok:false) rather than
 * silently if the name is already in use or git itself fails — never guesses a
 * fallback path. */
export function createWorktree(repoRoot, name) {
  const dir = join(worktreesDir(repoRoot), name);
  if (existsSync(dir)) return { ok: false, reason: "WORKTREE_ALREADY_EXISTS", dir };
  mkdirSync(worktreesDir(repoRoot), { recursive: true });
  const result = run("git", ["worktree", "add", "--detach", dir], { cwd: repoRoot });
  if (!result.ok) return { ok: false, reason: "GIT_WORKTREE_ADD_FAILED", detail: result.stderr, dir };
  return { ok: true, dir, branch: null };
}

export function listWorktrees(repoRoot) {
  const result = run("git", ["worktree", "list", "--porcelain"], { cwd: repoRoot });
  if (!result.ok) return [];
  const entries = [];
  let current = {};
  for (const line of result.stdout.split("\n")) {
    if (line.startsWith("worktree ")) {
      if (current.path) entries.push(current);
      current = { path: line.slice("worktree ".length) };
    } else if (line.startsWith("branch ")) {
      current.branch = line.slice("branch ".length);
    }
  }
  if (current.path) entries.push(current);
  return entries;
}

/** Removes a worktree created by createWorktree. `force` is required to remove
 * one with uncommitted changes — refusing by default mirrors git's own safety
 * behavior rather than silently discarding in-progress work. */
export function removeWorktree(repoRoot, name, { force = false } = {}) {
  const dir = join(worktreesDir(repoRoot), name);
  if (!existsSync(dir)) return { ok: false, reason: "WORKTREE_NOT_FOUND", dir };
  const args = ["worktree", "remove", dir];
  if (force) args.push("--force");
  const result = run("git", args, { cwd: repoRoot });
  if (!result.ok) return { ok: false, reason: "GIT_WORKTREE_REMOVE_FAILED", detail: result.stderr, dir };
  return { ok: true, dir };
}
