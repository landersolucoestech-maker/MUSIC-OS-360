import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { randomBytes } from "node:crypto";

export const STATE_DIR = ".claude/ops";
export const STATE_FILE = "state.json";
export const IMPROVEMENTS_FILE = "improvements.json";

export function statePath(cwd = process.cwd()) {
  return join(cwd, STATE_DIR, STATE_FILE);
}

export function improvementsPath(cwd = process.cwd()) {
  return join(cwd, STATE_DIR, IMPROVEMENTS_FILE);
}

export function shortId(prefix) {
  return `${prefix}-${randomBytes(4).toString("hex")}`;
}

// version 2: evidence and checkpoints moved to file-per-record storage under
// .claude/ops/evidence/ and .claude/ops/checkpoints/ (see lib/record-store.mjs,
// run-state.schema.json). state.json keeps only the *pointers* (evidenceIds,
// checkpointIds) plus the small, always-together-queried requirements/findings.
export const EXECUTION_MODES = ["DEFAULT", "STRICT_MULTI_AGENT"];

// DEFAULT: proportional execution (.claude/rules/00-execution-protocol.md's "smallest
// dynamic execution graph") -- unchanged, always the default for a new mission.
// STRICT_MULTI_AGENT: opt-in per mission (ops.mjs init --mode / ops.mjs mode set) --
// mandatory full capability mobilization, enforced by gate-engine.mjs's
// "full-mobilization-when-strict" check. See lib/capability-ledger.mjs.
export function defaultState(missionName) {
  const now = new Date().toISOString();
  return {
    version: 2,
    missionId: shortId("mission"),
    missionName: missionName || "unnamed-mission",
    status: "active", // active | blocked | done
    executionMode: "DEFAULT",
    createdAt: now,
    updatedAt: now,
    impact: { operatorDeclared: null, runtimeDetected: null, effective: null },
    requirements: [],
    findings: [],
    evidenceIds: [],
    checkpointIds: [],
    touchedFiles: [],
    blockers: [],
  };
}

export function loadState(cwd = process.cwd()) {
  const p = statePath(cwd);
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, "utf8"));
}

export function saveState(state, cwd = process.cwd()) {
  const p = statePath(cwd);
  mkdirSync(dirname(p), { recursive: true });
  state.updatedAt = new Date().toISOString();
  writeFileSync(p, JSON.stringify(state, null, 2) + "\n", "utf8");
  return p;
}

export function requireState(cwd = process.cwd()) {
  const state = loadState(cwd);
  if (!state) {
    throw new Error(
      "NO_MISSION_STATE: run `node .claude/runtime/ops.mjs init` before recording requirements, evidence or findings."
    );
  }
  return state;
}

export function loadImprovements(cwd = process.cwd()) {
  const p = improvementsPath(cwd);
  if (!existsSync(p)) return [];
  return JSON.parse(readFileSync(p, "utf8"));
}

export function saveImprovements(list, cwd = process.cwd()) {
  const p = improvementsPath(cwd);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(list, null, 2) + "\n", "utf8");
  return p;
}

const IMPACT_RANK = { L0: 0, L1: 1, L2: 2, L3: 3, L4: 4, L5: 5 };

export function maxImpact(a, b) {
  if (!a) return b;
  if (!b) return a;
  return IMPACT_RANK[a] >= IMPACT_RANK[b] ? a : b;
}

export function impactRank(level) {
  return IMPACT_RANK[level] ?? -1;
}
