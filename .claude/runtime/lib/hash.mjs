import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { git, isGitRepo } from "./exec.mjs";

export function sha256(text) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

export function sha256File(path) {
  if (!existsSync(path)) return null;
  return sha256(readFileSync(path, "utf8"));
}

/**
 * Workspace fingerprint: identity of the exact tree state evidence is bound to.
 * Combines HEAD commit + a hash of the full working-tree status/diff so that
 * both committed and uncommitted changes invalidate stale evidence.
 */
// .claude/ops holds the tool's own mutable bookkeeping (state.json, memory.json,
// evidence). Including it in the fingerprint would make every evidence write
// change the fingerprint it just recorded — exclude it so the fingerprint
// reflects the workspace under audit, not the audit trail itself.
const EXCLUDE_PATHSPEC = ":(exclude).claude/ops";

export function workspaceFingerprint(cwd = process.cwd()) {
  if (!isGitRepo(cwd)) {
    return { ok: false, reason: "NOT_A_GIT_REPO" };
  }
  const head = git(["rev-parse", "HEAD"], cwd);
  const status = git(["status", "--porcelain=v1", "--", ".", EXCLUDE_PATHSPEC], cwd);
  const diff = git(["diff", "HEAD", "--", ".", EXCLUDE_PATHSPEC], cwd);
  if (!head.ok) {
    // No commits yet (fresh repo) — fingerprint from status+diff only.
    const material = `NO_HEAD\n${status.stdout}\n${diff.stdout}`;
    return { ok: true, fingerprint: sha256(material), head: null };
  }
  const material = `${head.stdout}\n${status.stdout}\n${diff.stdout}`;
  return { ok: true, fingerprint: sha256(material), head: head.stdout };
}

/**
 * Scoped freshness: did the content of `paths` change between `sinceHead`
 * and the current tree (committed history AND uncommitted working-tree
 * changes)? This is what a criterion's own evidence should actually be
 * invalidated by — NOT an unrelated commit advancing HEAD for files outside
 * `paths`. workspaceFingerprint() answers "did anything anywhere change";
 * this answers "did *this* change", which is the correct question for a
 * single criterion's bound evidence.
 *
 * Fails closed (treated as CHANGED, i.e. stale) on any ambiguity — a
 * missing/invalid `sinceHead`, an empty `paths` list, or a git error never
 * produces a false "unchanged". Only a clean, positively-verified empty
 * diff across all three git calls counts as unchanged.
 */
export function pathsChangedSince(cwd, sinceHead, paths) {
  if (!isGitRepo(cwd)) return { ok: false, changed: true, reason: "NOT_A_GIT_REPO" };
  if (!sinceHead || typeof sinceHead !== "string") {
    return { ok: false, changed: true, reason: "NO_SINCE_HEAD" };
  }
  if (!Array.isArray(paths) || paths.length === 0) {
    return { ok: false, changed: true, reason: "NO_PATHS_SCOPED" };
  }
  const verifyHead = git(["cat-file", "-e", `${sinceHead}^{commit}`], cwd);
  if (!verifyHead.ok) return { ok: false, changed: true, reason: `UNKNOWN_SINCE_HEAD: ${sinceHead}` };

  const committed = git(["diff", "--name-only", `${sinceHead}..HEAD`, "--", ...paths], cwd);
  const uncommitted = git(["status", "--porcelain=v1", "--", ...paths], cwd);
  const workingDiff = git(["diff", "--name-only", "HEAD", "--", ...paths], cwd);
  if (!committed.ok || !uncommitted.ok || !workingDiff.ok) {
    return { ok: false, changed: true, reason: "GIT_DIFF_FAILED" };
  }
  const changedFiles = new Set(
    [committed.stdout, uncommitted.stdout, workingDiff.stdout]
      .flatMap((s) => s.split("\n"))
      .map((l) => l.replace(/^[ MADRCU?!]{0,2}\s*/, "").trim())
      .filter(Boolean),
  );
  return { ok: true, changed: changedFiles.size > 0, changedFiles: [...changedFiles] };
}
