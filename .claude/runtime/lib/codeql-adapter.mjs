// Real CodeQL CLI adapter — NOT a reimplementation of CodeQL (section 19:
// "do NOT re-implement CodeQL"). Two independent capabilities, since both are
// legitimate real-world flows:
//   - runCodeQLAnalysis: actually invokes `codeql database create` +
//     `codeql database analyze` when policy authorizes it (SAFE_ACTIVE,
//     never automatic — see security-testing.json).
//   - ingestSarif: normalizes an ALREADY-PRODUCED SARIF file (e.g. from an
//     existing CI job's artifact) — the far more common real path, since a
//     full CodeQL database build is expensive and often already happened
//     elsewhere in a project's pipeline.
// Either path hands its output to lib/finding-correlation.mjs's
// normalizeSarif — this file owns detection/invocation/raw-evidence only.
import { existsSync, readFileSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { run } from "./exec.mjs";
import { normalizeSarif } from "./finding-correlation.mjs";

function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}

/** Reads a SARIF file already on disk (produced by CodeQL or any other SARIF
 * emitter) and normalizes it — preserving the raw content + hash as evidence
 * per section 19's rawArtifactPath/rawArtifactHash, so the original is never
 * lost behind the lossy normalized summary. */
export function ingestSarif(sarifPath, { tool = "codeql", toolVersion = null } = {}) {
  if (!existsSync(sarifPath)) {
    return { available: false, unavailableReason: `SARIF file not found: ${sarifPath}`, findings: [] };
  }
  const raw = readFileSync(sarifPath, "utf8");
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { available: false, unavailableReason: "SARIF file is not valid JSON", findings: [] };
  }
  const findings = normalizeSarif(parsed, { tool, toolVersion });
  return { available: true, findings, rawArtifactPath: sarifPath, rawArtifactHash: sha256(raw) };
}

/** Actually runs `codeql database create` + `codeql database analyze`
 * against `cwd`, for the given CodeQL query pack (e.g. "javascript-security-and-quality").
 * Requires explicit authorization: this function does NOT check policy
 * itself (that's security-verification-engine's job, which decides whether
 * to call this at all) — it only refuses to run if the executable isn't
 * resolvable, exactly like every other adapter in this pack. A full
 * database build is slow (minutes, language-dependent) — callers should
 * budget accordingly or prefer ingestSarif() against a pre-built artifact. */
export function runCodeQLAnalysis(cwd, { executablePath = "codeql", language, queryPack } = {}) {
  if (!language || !queryPack) {
    return { available: false, unavailableReason: "language and queryPack are required to run a real CodeQL analysis", findings: [] };
  }
  const check = run(process.platform === "win32" ? "where" : "which", [executablePath]);
  if (!check.ok && !existsSync(executablePath)) {
    return { available: false, unavailableReason: `${executablePath} not found`, findings: [] };
  }
  const workDir = mkdtempSync(join(tmpdir(), "eos-codeql-"));
  const dbPath = join(workDir, "db");
  const sarifPath = join(workDir, "results.sarif");
  try {
    const create = run(executablePath, ["database", "create", dbPath, "--language", language, "--source-root", cwd, "--overwrite"], { cwd, timeout: 600_000 });
    if (!create.ok) return { available: false, unavailableReason: `codeql database create failed: ${create.stderr.slice(-500)}`, findings: [] };
    const analyze = run(executablePath, ["database", "analyze", dbPath, queryPack, "--format", "sarifv2.1.0", "--output", sarifPath], { cwd, timeout: 600_000 });
    if (!analyze.ok) return { available: false, unavailableReason: `codeql database analyze failed: ${analyze.stderr.slice(-500)}`, findings: [] };
    return ingestSarif(sarifPath);
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
}
