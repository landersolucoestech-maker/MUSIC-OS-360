#!/usr/bin/env node
// GATE ENGINE: executes the declarative GATE DEFINITION at .claude/gates/completion.json
// (or another gate-definition file) against live run-state + the git tree. Each
// check `type` in the definition maps to a function in CHECKS below — the
// definition controls WHAT runs and with WHAT parameters, this file controls HOW.
// completion-gate.mjs is now a thin CLI wrapper around evaluateGateFile("completion").
import { existsSync, readFileSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { run } from "./lib/exec.mjs";
import { workspaceFingerprint, pathsChangedSince } from "./lib/hash.mjs";
import { loadState } from "./lib/state-store.mjs";
import { getRecord, listRecords } from "./lib/record-store.mjs";
import { recordEvent } from "./lib/telemetry.mjs";
import { computeCoverage } from "./lib/coverage-ledger.mjs";
import { outstandingCapabilities } from "./lib/capability-ledger.mjs";
import { diffContractFiles, findVersionedSchemaPairs } from "./lib/contract-drift.mjs";
import { detectAll } from "./lib/tool-capability.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadJsonWithFallback(cwd, relDir, filename) {
  const candidates = [join(cwd, relDir, filename), join(__dirname, "..", relDir.replace(/^\.claude\//, ""), filename)];
  for (const p of candidates) if (existsSync(p)) return JSON.parse(readFileSync(p, "utf8"));
  return null;
}

function loadPackageScripts(cwd) {
  const p = join(cwd, "package.json");
  if (!existsSync(p)) return {};
  try {
    return JSON.parse(readFileSync(p, "utf8")).scripts || {};
  } catch {
    return {};
  }
}

const CHECKS = {
  "state-exists": (ctx) => (ctx.state ? {} : { reasons: ["NO_MISSION_STATE: run ops.mjs init first"] }),

  "fingerprint-available": (ctx) => (ctx.fp.ok ? {} : { reasons: [`WORKSPACE_FINGERPRINT_UNAVAILABLE: ${ctx.fp.reason}`] }),

  "no-open-blockers": (ctx) => {
    const open = ctx.state.blockers.filter((b) => !b.resolved);
    return open.length ? { reasons: [`${open.length} open blocker(s): ${open.map((b) => b.id).join(", ")}`] } : {};
  },

  "no-undisposed-findings": (ctx, params) => {
    const severities = params.severities || [];
    const bad = ctx.state.findings.filter((f) => !f.disposition && severities.includes(f.severity));
    return bad.length
      ? { reasons: [`${bad.length} finding(s) with severity in [${severities.join(",")}] have no disposition: ${bad.map((f) => f.id).join(", ")}`] }
      : {};
  },

  // Freshness has two modes. Default (no relevantPaths declared on the
  // criterion): exact whole-workspace fingerprint equality, unchanged from
  // before -- an unrelated commit anywhere invalidates evidence, same as
  // always, so nothing that hasn't opted in is weakened. Scoped (criterion
  // declares relevantPaths via `ops.mjs criterion set-paths`): evidence with
  // a recorded `head` is fresh if none of those paths changed between that
  // head and now (lib/hash.mjs pathsChangedSince) -- an unrelated commit no
  // longer stales it, but an actual change to the criterion's own files
  // still does. Exact fingerprint equality is always also accepted (it's a
  // strict subset of "unchanged" and needs no git calls).
  "criteria-fresh-evidence": (ctx) => {
    const reasons = [];
    const allCriteria = ctx.state.requirements.flatMap((r) => r.acceptanceCriteria.map((c) => ({ ...c, requirementId: r.id })));
    for (const crit of allCriteria) {
      const evs = crit.evidenceIds.map((id) => getRecord(ctx.cwd, "evidence", id)).filter(Boolean);
      if (evs.length === 0) {
        reasons.push(`requirement ${crit.requirementId} criterion ${crit.id} has NO evidence`);
        continue;
      }
      const relevantPaths = Array.isArray(crit.relevantPaths) && crit.relevantPaths.length > 0 ? crit.relevantPaths : null;
      // verifiedSinceHead (set via `criterion set-paths --verified-since`) is an
      // explicit, reasoned override of each evidence's own recorded `head` --
      // required when that literal value isn't the right anchor (see cmdCriterionSetPaths).
      const anchorHead = crit.verifiedSinceHead || null;
      const freshPass = evs.filter((e) => {
        if (e.status !== "PASS") return false;
        if (e.workspaceFingerprint === ctx.fp.fingerprint) return true;
        const sinceHead = anchorHead || e.head;
        if (relevantPaths && sinceHead) {
          const scoped = pathsChangedSince(ctx.cwd, sinceHead, relevantPaths);
          return scoped.ok && !scoped.changed;
        }
        return false;
      });
      if (freshPass.length === 0) {
        reasons.push(`requirement ${crit.requirementId} criterion ${crit.id} has evidence but none is a fresh PASS bound to the current workspace fingerprint (stale or failing)`);
      }
    }
    return { reasons };
  },

  "scope-traceability-warning": (ctx) => {
    const status = run("git", ["status", "--porcelain=v1"], { cwd: ctx.cwd });
    if (!status.ok) return {};
    const dirtyFiles = status.stdout.split("\n").map((l) => l.slice(3).trim()).filter(Boolean);
    if (dirtyFiles.length && ctx.state.requirements.length === 0) {
      return { warnings: [`${dirtyFiles.length} dirty file(s) in working tree but no requirements recorded — scope not traceable`] };
    }
    return {};
  },

  "impact-scoped-package-scripts": (ctx) => {
    const matrix = loadJsonWithFallback(ctx.cwd, ".claude/policies", "gate-matrix.json");
    const level = ctx.state.impact?.effective;
    if (!matrix || !level) {
      return { warnings: ["cannot run impact-scoped gates: missing gate-matrix.json or state.impact.effective (run impact.mjs first)"] };
    }
    const required = matrix.requiredGatesByLevel[level] || [];
    const scripts = loadPackageScripts(ctx.cwd);
    const SAFE_SCRIPT_NAME = /^[a-zA-Z0-9_:-]+$/;
    const reasons = [];
    for (const gate of required) {
      const candidates = matrix.defaultScriptNames[gate] || [gate];
      const scriptName = candidates.find((n) => scripts[n]);
      if (!scriptName) {
        reasons.push(`required gate "${gate}" for ${level} has no matching package.json script (tried: ${candidates.join(", ")})`);
        continue;
      }
      if (!SAFE_SCRIPT_NAME.test(scriptName)) {
        reasons.push(`gate "${gate}" script name "${scriptName}" contains unexpected characters; refusing to run with a shell`);
        continue;
      }
      const pm = existsSync(join(ctx.cwd, "pnpm-lock.yaml")) ? "pnpm" : existsSync(join(ctx.cwd, "yarn.lock")) ? "yarn" : "npm";
      const result = run(pm, ["run", scriptName], { cwd: ctx.cwd, timeout: 600_000, shell: true });
      if (!result.ok) reasons.push(`gate "${gate}" (${pm} run ${scriptName}) FAILED: ${result.stderr.slice(-500)}`);
    }
    return { reasons };
  },

  "coverage-threshold": (ctx, params) => {
    const threshold = params.minPercentage ?? 100;
    const coverage = computeCoverage(ctx.cwd);
    if (coverage.percentage < threshold) {
      const shown = coverage.unaudited.slice(0, 20);
      const more = coverage.unaudited.length > shown.length ? ` (+${coverage.unaudited.length - shown.length} more)` : "";
      return {
        reasons: [
          `audit coverage ${coverage.percentage}% is below the required ${threshold}% — ${coverage.unaudited.length} unaudited file(s): ${shown.join(", ")}${more}`,
        ],
      };
    }
    return {};
  },

  "no-open-conflicts": (ctx) => {
    const conflicts = listRecords(ctx.cwd, "conflict").filter((c) => c.status === "OPEN");
    return conflicts.length
      ? { reasons: [`${conflicts.length} open conflict(s) unresolved: ${conflicts.map((c) => c.id).join(", ")}`] }
      : {};
  },

  "no-open-critical-assumptions": (ctx) => {
    const assumptions = listRecords(ctx.cwd, "assumption").filter((a) => a.status === "OPEN");
    return assumptions.length
      ? { warnings: [`${assumptions.length} assumption(s) still OPEN (unconfirmed/unretracted): ${assumptions.map((a) => a.id).join(", ")}`] }
      : {};
  },

  "no-unreconciled-destructive-effects": (ctx) => {
    const unreconciled = listRecords(ctx.cwd, "effect").filter(
      (e) => !e.reconciled && ["DESTRUCTIVE", "IRREVERSIBLE", "EXTERNAL_WRITE", "PRODUCTION_WRITE"].includes(e.classification)
    );
    return unreconciled.length
      ? { reasons: [`${unreconciled.length} unreconciled destructive/external/production side effect(s): ${unreconciled.map((e) => e.id).join(", ")}`] }
      : {};
  },

  // Finds versioned contract pairs (name.v1.schema.json -> name.v2.schema.json,
  // by convention — see lib/contract-drift.mjs findVersionedSchemaPairs) and
  // BLOCKS on a breaking change UNLESS a decision-record with the exact topic
  // "contract-drift:<before>-><after>" already acknowledges it — i.e. a
  // breaking contract change is fine once someone has explicitly decided it's
  // fine, not silently fine by default. Zero pairs (the common case for a
  // project that doesn't version its schemas this way) trivially passes.
  "no-breaking-contract-drift": (ctx) => {
    const pairs = findVersionedSchemaPairs(ctx.cwd);
    const decisions = listRecords(ctx.cwd, "decision");
    const reasons = [];
    for (const [before, after] of pairs) {
      const drift = diffContractFiles(before.path, after.path);
      if (!drift.breaking) continue;
      const relBefore = relative(ctx.cwd, before.path).replace(/\\/g, "/");
      const relAfter = relative(ctx.cwd, after.path).replace(/\\/g, "/");
      const topic = `contract-drift:${relBefore}->${relAfter}`;
      const acknowledged = decisions.some((d) => d.topic === topic);
      if (!acknowledged) {
        reasons.push(
          `unacknowledged breaking contract drift ${relBefore} -> ${relAfter} (removed: ${drift.removed.join(", ") || "none"}; type-changed: ${drift.typeChanged.map((t) => t.field).join(", ") || "none"}) — record a decision with topic "${topic}" once this is reviewed and accepted`
        );
      }
    }
    return { reasons };
  },

  // Section 14/25 of the tool-integration mission: a capability the operator
  // marked REQUIRED (via `params.requiredCapabilities`, e.g. ["codeql"] for
  // a project whose security policy mandates it) must be AVAILABLE, or this
  // BLOCKS. No capability is required by default — an empty/absent params
  // list trivially passes, so this is opt-in per gate definition, not a new
  // default requirement on every mission.
  "required-capability-available": (ctx, params) => {
    const required = params.requiredCapabilities || [];
    if (required.length === 0) return {};
    const capabilities = detectAll(ctx.cwd);
    const reasons = [];
    for (const name of required) {
      const cap = capabilities[name];
      if (!cap || cap.availability !== "AVAILABLE") {
        reasons.push(`required capability "${name}" is ${cap?.availability || "UNKNOWN"} (${cap?.reason || "not detected"})`);
      }
    }
    return { reasons };
  },

  // No-op in DEFAULT mode (the vast majority of missions) -- only enforces anything
  // when the mission explicitly opted into STRICT_MULTI_AGENT (ops.mjs init --mode /
  // ops.mjs mode set). See lib/capability-ledger.mjs and .claude/rules/agent-orchestration.md.
  "full-mobilization-when-strict": (ctx) => {
    if (ctx.state.executionMode !== "STRICT_MULTI_AGENT") return {};
    const outstanding = outstandingCapabilities(ctx.cwd);
    if (outstanding.length === 0) return {};
    const shown = outstanding.slice(0, 15).map((c) => `${c.name}(${c.status})`);
    const more = outstanding.length > shown.length ? ` (+${outstanding.length - shown.length} more)` : "";
    return {
      reasons: [
        `STRICT_MULTI_AGENT: ${outstanding.length} discovered capability(ies) have no terminal disposition (COMPLETED/DONE or a justified NOT_APPLICABLE_WITH_EVIDENCE): ${shown.join(", ")}${more} -- run \`ops.mjs mobilization status\` for the full ledger`,
      ],
    };
  },

  "no-failed-gate-results": (ctx) => {
    const failed = listRecords(ctx.cwd, "gate-result").filter((g) => g.status !== "PASS");
    return failed.length
      ? { reasons: [`${failed.length} recorded gate-result(s) not PASS: ${failed.map((g) => `${g.gate}(${g.status})`).join(", ")}`] }
      : {};
  },
};

export function evaluateGateFile(gateFileName, { cwd = process.cwd(), flags = {} } = {}) {
  const startedAt = Date.now();
  const result = evaluateGateFileInner(gateFileName, { cwd, flags });
  recordEvent(cwd, "gate-run", { gate: gateFileName, status: result.status, durationMs: Date.now() - startedAt, reasonCount: result.reasons.length });
  return result;
}

function evaluateGateFileInner(gateFileName, { cwd = process.cwd(), flags = {} } = {}) {
  const definition = loadJsonWithFallback(cwd, ".claude/gates", `${gateFileName}.json`);
  if (!definition) return { status: "BLOCKED", reasons: [`GATE_DEFINITION_NOT_FOUND: ${gateFileName}.json`], warnings: [] };

  const state = loadState(cwd);
  const fp = workspaceFingerprint(cwd);
  const ctx = { cwd, state, fp };
  const reasons = [];
  const warnings = [];

  const activeChecks = [
    ...definition.checks,
    ...(definition.optionalChecks || []).filter((c) => flags[c.flag]),
  ];

  for (const check of activeChecks) {
    const impl = CHECKS[check.type];
    if (!impl) {
      reasons.push(`GATE_ENGINE: no implementation registered for check type "${check.type}" (id: ${check.id})`);
      continue;
    }
    // state-exists/fingerprint-available must run first and short-circuit the rest,
    // since every other check assumes state/fp are present.
    if ((check.type === "state-exists" && !state) || (check.type === "fingerprint-available" && !fp.ok)) {
      const result = impl(ctx, check);
      return { status: "BLOCKED", reasons: [...(result.reasons || [])], warnings };
    }
    const result = impl(ctx, check) || {};
    reasons.push(...(result.reasons || []));
    warnings.push(...(result.warnings || []));
  }

  return {
    status: reasons.length === 0 ? "PASS" : "BLOCKED",
    reasons,
    warnings,
    workspaceFingerprint: fp.ok ? fp.fingerprint : null,
    missionId: state?.missionId,
  };
}

function main() {
  const [gateName, ...rest] = process.argv.slice(2);
  const flags = { runGates: rest.includes("--run-gates") };
  const result = evaluateGateFile(gateName || "completion", { flags });
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.status === "PASS" ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
