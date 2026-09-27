// Tracks, per real repository file, whether a mission actually looked at it —
// the mechanism behind mission Section 59's "every relevant repository file was
// investigated" completion criterion made checkable instead of asserted. Backs
// gate-engine.mjs's "coverage-threshold" check.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { validate } from "./schema-validate.mjs";
import { run } from "./exec.mjs";

const SCHEMA_PATH = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "contracts", "coverage-ledger-entry.schema.json");

function ledgerPath(cwd) {
  return join(cwd, ".claude", "ops", "coverage", "ledger.json");
}

function loadLedger(cwd) {
  const path = ledgerPath(cwd);
  return existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : {};
}

function saveLedger(cwd, ledger) {
  const path = ledgerPath(cwd);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(ledger, null, 2) + "\n", "utf8");
}

export function markAudited(cwd, file, { by, findingIds = [] } = {}) {
  if (!by) throw new Error("USAGE: markAudited(cwd, file, { by }) — 'by' (the agent/reviewer) is required");
  const entry = { file, auditedAt: new Date().toISOString(), by, findingIds };
  const result = validate(SCHEMA_PATH, entry);
  if (!result.valid) throw new Error(`SCHEMA_VALIDATION_FAILED (coverage-ledger-entry): ${result.errors.join("; ")}`);
  const ledger = loadLedger(cwd);
  ledger[file] = entry;
  saveLedger(cwd, ledger);
  return entry;
}

/** The repository's real, current tracked file list — via git, so it reflects
 * what's actually versioned, not a stale cached list. */
export function listRepositoryFiles(cwd) {
  const result = run("git", ["ls-files"], { cwd });
  if (!result.ok) return [];
  return result.stdout.split("\n").filter(Boolean);
}

export function computeCoverage(cwd, { files } = {}) {
  const allFiles = files || listRepositoryFiles(cwd);
  const ledger = loadLedger(cwd);
  const audited = allFiles.filter((f) => ledger[f]);
  const unaudited = allFiles.filter((f) => !ledger[f]);
  return {
    totalFiles: allFiles.length,
    auditedFiles: audited.length,
    percentage: allFiles.length === 0 ? 100 : Math.round((audited.length / allFiles.length) * 10000) / 100,
    unaudited,
  };
}
