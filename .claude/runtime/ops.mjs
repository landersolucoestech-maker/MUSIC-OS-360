#!/usr/bin/env node
// Mission-state CLI: init, requirement/criterion tracking, evidence capture
// (by actually running commands), findings, blockers, checkpoints and
// continuous-improvement candidates. This is the single writer of
// .claude/ops/state.json — agents and skills should shell out to this
// rather than hand-editing the JSON, so the schema stays valid.
import { pathToFileURL } from "node:url";
import { run } from "./lib/exec.mjs";
import { workspaceFingerprint } from "./lib/hash.mjs";
import { addRecord, listRecords } from "./lib/record-store.mjs";
import { recordKindNames } from "./lib/record-kinds.mjs";
import { markAudited, computeCoverage } from "./lib/coverage-ledger.mjs";
import { castVote, resolveByQuorum } from "./lib/quorum.mjs";
import { computeCapabilityLedger } from "./lib/capability-ledger.mjs";
import {
  defaultState,
  loadState,
  saveState,
  requireState,
  shortId,
  loadImprovements,
  saveImprovements,
  EXECUTION_MODES,
} from "./lib/state-store.mjs";

function parseFlags(argv) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const eq = a.indexOf("=");
      if (eq !== -1) flags[a.slice(2, eq)] = a.slice(eq + 1);
      else flags[a.slice(2)] = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
    } else {
      positional.push(a);
    }
  }
  return { flags, positional };
}

function out(obj) {
  console.log(JSON.stringify(obj, null, 2));
}

export function cmdInit({ flags, cwd }) {
  const existing = loadState(cwd);
  if (existing && !flags.force) {
    return { status: "EXISTS", missionId: existing.missionId, note: "state already initialized; pass --force to reset" };
  }
  if (flags.mode && !EXECUTION_MODES.includes(flags.mode)) {
    throw new Error(`INVALID_MODE: ${flags.mode}. Use one of ${EXECUTION_MODES.join(", ")}`);
  }
  const state = defaultState(flags.mission || flags.name);
  if (flags.mode) state.executionMode = flags.mode;
  saveState(state, cwd);
  return { status: "CREATED", missionId: state.missionId, executionMode: state.executionMode };
}

export function cmdModeSet({ flags, cwd }) {
  const state = requireState(cwd);
  if (!flags.mode || !EXECUTION_MODES.includes(flags.mode)) {
    throw new Error(`USAGE: mode set --mode <${EXECUTION_MODES.join("|")}>`);
  }
  state.executionMode = flags.mode;
  saveState(state, cwd);
  return { status: "OK", executionMode: state.executionMode };
}

export function cmdRequirementAdd({ flags, cwd }) {
  const state = requireState(cwd);
  if (!flags.text) throw new Error("USAGE: requirement add --text \"...\" [--non-requirement \"...\"]");
  const req = {
    id: shortId("req"),
    text: flags.text,
    nonRequirements: flags["non-requirement"] ? [].concat(flags["non-requirement"]) : [],
    acceptanceCriteria: [],
    createdAt: new Date().toISOString(),
  };
  state.requirements.push(req);
  saveState(state, cwd);
  return { status: "OK", requirement: req };
}

export function cmdCriterionAdd({ flags, cwd }) {
  const state = requireState(cwd);
  if (!flags.requirement || !flags.text) throw new Error("USAGE: criterion add --requirement <id> --text \"...\"");
  const req = state.requirements.find((r) => r.id === flags.requirement);
  if (!req) throw new Error(`UNKNOWN_REQUIREMENT: ${flags.requirement}`);
  const crit = { id: shortId("ac"), text: flags.text, evidenceIds: [], status: "open" };
  req.acceptanceCriteria.push(crit);
  saveState(state, cwd);
  return { status: "OK", criterion: crit };
}

function linkEvidenceToCriterion(state, criterionId, evidence) {
  if (!criterionId) return;
  const crit = state.requirements.flatMap((r) => r.acceptanceCriteria).find((c) => c.id === criterionId);
  if (!crit) throw new Error(`UNKNOWN_CRITERION: ${criterionId}`);
  crit.evidenceIds.push(evidence.id);
  if (evidence.status === "PASS") crit.status = "closed";
}

export function cmdEvidenceRun({ flags, cwd }) {
  const state = requireState(cwd);
  if (!flags.cmd) throw new Error("USAGE: evidence run --cmd \"npm test\" [--criterion <id>] [--label x]");
  const fp = workspaceFingerprint(cwd);
  const [cmd, ...args] = flags.cmd.split(" ");
  const started = Date.now();
  const result = run(cmd, args, { cwd, timeout: Number(flags.timeout) || 300_000 });
  const evidence = addRecord(cwd, "evidence", {
    type: "COMMAND",
    label: flags.label || flags.cmd,
    command: flags.cmd,
    status: result.ok ? "PASS" : "FAIL",
    exitCode: result.code,
    stdoutTail: result.stdout.slice(-4000),
    stderrTail: result.stderr.slice(-4000),
    workspaceFingerprint: fp.ok ? fp.fingerprint : null,
    fingerprintStatus: fp.ok ? "BOUND" : fp.reason,
    durationMs: Date.now() - started,
  });
  state.evidenceIds.push(evidence.id);
  linkEvidenceToCriterion(state, flags.criterion, evidence);
  saveState(state, cwd);
  return { status: "OK", evidence: { ...evidence, stdoutTail: undefined, stderrTail: undefined } };
}

export function cmdEvidenceReview({ flags, cwd }) {
  const state = requireState(cwd);
  for (const r of ["reviewer", "verdict", "summary"]) {
    if (!flags[r]) throw new Error(`USAGE: evidence review --reviewer <agent> --verdict PASS|FAIL --summary "..." [--criterion <id>]`);
  }
  if (!["PASS", "FAIL"].includes(flags.verdict)) throw new Error("--verdict must be PASS or FAIL");
  const fp = workspaceFingerprint(cwd);
  const evidence = addRecord(cwd, "evidence", {
    type: "REVIEW",
    reviewer: flags.reviewer,
    verdict: flags.verdict,
    status: flags.verdict,
    summary: flags.summary,
    workspaceFingerprint: fp.ok ? fp.fingerprint : null,
    fingerprintStatus: fp.ok ? "BOUND" : fp.reason,
  });
  state.evidenceIds.push(evidence.id);
  linkEvidenceToCriterion(state, flags.criterion, evidence);
  saveState(state, cwd);
  return { status: "OK", evidence };
}

const SEVERITIES = ["CRITICO", "CRITICAL", "ALTO", "HIGH", "MEDIO", "MEDIUM", "BAIXO", "LOW", "INFORMATIVO", "INFO"];
const DISPOSITIONS = [
  "CORRIGIDA",
  "LEGITIMA",
  "CONTRATO_EXTERNO",
  "HISTORICO_MIGRATION",
  "DADO_HISTORICO",
  "GENERATED",
  "DOCUMENTACAO_HISTORICA",
  "ARTEFATO_DESCARTAVEL",
  "FALSO_POSITIVO",
  "DIVIDA_ACEITA",
];

export function cmdFindingAdd({ flags, cwd }) {
  const state = requireState(cwd);
  for (const r of ["category", "severity", "file", "summary"]) {
    if (!flags[r]) throw new Error(`USAGE: finding add --category <A..R> --severity <sev> --file <path> --summary "..." [--line n]`);
  }
  const severity = String(flags.severity).toUpperCase();
  if (!SEVERITIES.includes(severity)) throw new Error(`INVALID_SEVERITY: ${flags.severity}. Use one of ${SEVERITIES.join(", ")}`);
  const finding = {
    id: shortId("find"),
    category: flags.category,
    severity,
    file: flags.file,
    line: flags.line ? Number(flags.line) : null,
    summary: flags.summary,
    rootCause: flags["root-cause"] || null,
    disposition: null,
    evidenceIds: [],
    createdAt: new Date().toISOString(),
  };
  state.findings.push(finding);
  saveState(state, cwd);
  return { status: "OK", finding };
}

export function cmdFindingDisposition({ flags, cwd }) {
  const state = requireState(cwd);
  if (!flags.id || !flags.disposition) throw new Error("USAGE: finding disposition --id <id> --disposition <DESTINO> [--justification \"...\"]");
  const disposition = String(flags.disposition).toUpperCase();
  if (!DISPOSITIONS.includes(disposition)) throw new Error(`INVALID_DISPOSITION: ${flags.disposition}. Use one of ${DISPOSITIONS.join(", ")}`);
  const finding = state.findings.find((f) => f.id === flags.id);
  if (!finding) throw new Error(`UNKNOWN_FINDING: ${flags.id}`);
  if (disposition === "DIVIDA_ACEITA" && !flags.justification) {
    throw new Error("DIVIDA_ACEITA requires --justification");
  }
  finding.disposition = disposition;
  finding.justification = flags.justification || null;
  finding.resolvedAt = new Date().toISOString();
  saveState(state, cwd);
  return { status: "OK", finding };
}

export function cmdBlockerAdd({ flags, cwd }) {
  const state = requireState(cwd);
  if (!flags.text) throw new Error('USAGE: blocker add --text "..."');
  const blocker = { id: shortId("blk"), text: flags.text, createdAt: new Date().toISOString(), resolved: false };
  state.blockers.push(blocker);
  state.status = "blocked";
  saveState(state, cwd);
  return { status: "OK", blocker };
}

export function cmdBlockerResolve({ flags, cwd }) {
  const state = requireState(cwd);
  if (!flags.id) throw new Error("USAGE: blocker resolve --id <id>");
  const blocker = state.blockers.find((b) => b.id === flags.id);
  if (!blocker) throw new Error(`UNKNOWN_BLOCKER: ${flags.id}`);
  blocker.resolved = true;
  blocker.resolvedAt = new Date().toISOString();
  if (state.blockers.every((b) => b.resolved)) state.status = "active";
  saveState(state, cwd);
  return { status: "OK", blocker };
}

export function cmdCheckpoint({ flags, cwd }) {
  const state = requireState(cwd);
  const fp = workspaceFingerprint(cwd);
  const checkpoint = addRecord(cwd, "checkpoint", {
    label: flags.label || "checkpoint",
    workspaceFingerprint: fp.ok ? fp.fingerprint : null,
    head: fp.ok ? fp.head : null,
  });
  state.checkpointIds.push(checkpoint.id);
  saveState(state, cwd);
  return { status: "OK", checkpoint };
}

export function cmdBaselineRecord({ flags, cwd }) {
  requireState(cwd);
  const fp = workspaceFingerprint(cwd);
  const status = run("git", ["status", "--porcelain=v1"], { cwd });
  return {
    status: "OK",
    baseline: addRecord(cwd, "baseline", {
      label: flags.label || "baseline",
      gitStatusPorcelain: status.ok ? status.stdout : "",
      workspaceFingerprint: fp.ok ? fp.fingerprint : null,
    }),
  };
}

export function cmdEffectLog({ flags, cwd }) {
  requireState(cwd);
  if (!flags.classification || !flags.description) {
    throw new Error('USAGE: effect log --classification <READ_ONLY|LOCAL_WRITE|REPOSITORY_WRITE|EXTERNAL_WRITE|INFRASTRUCTURE_WRITE|PRODUCTION_WRITE|DESTRUCTIVE|IRREVERSIBLE> --description "..."');
  }
  return {
    status: "OK",
    effect: addRecord(cwd, "effect", {
      classification: flags.classification,
      description: flags.description,
      recoveryPlanId: flags["recovery-plan"] || null,
      reconciled: Boolean(flags.reconciled),
    }),
  };
}

// Generic path for every other record kind (approval, assumption, changeset,
// conflict, decision, deployment, recovery-plan, release, run, task,
// production-validation, failure, gate-result) — one mechanism instead of a
// bespoke command per kind. --data takes a JSON blob for full field fidelity.
export function cmdRecordAdd({ flags, cwd }) {
  requireState(cwd);
  if (!flags.kind) throw new Error(`USAGE: record add --kind <${recordKindNames().join("|")}> --data '{"field":"value"}'`);
  const fields = flags.data ? JSON.parse(flags.data) : {};
  return { status: "OK", record: addRecord(cwd, flags.kind, fields) };
}

export function cmdRecordList({ flags, cwd }) {
  requireState(cwd);
  if (!flags.kind) throw new Error(`USAGE: record list --kind <${recordKindNames().join("|")}>`);
  return { status: "OK", records: listRecords(cwd, flags.kind) };
}

export function cmdImprove({ flags, cwd }) {
  if (!flags.text) throw new Error('USAGE: improve --text "..." [--scope rules|agents|skills|runtime]');
  const list = loadImprovements(cwd);
  const entry = {
    id: shortId("imp"),
    text: flags.text,
    scope: flags.scope || "unspecified",
    createdAt: new Date().toISOString(),
    appliedAt: null,
  };
  list.push(entry);
  saveImprovements(list, cwd);
  return { status: "OK", note: "recorded as a candidate; apply only during /improve maintenance", entry };
}

export function cmdStatus({ cwd }) {
  const state = requireState(cwd);
  const openCriteria = state.requirements.flatMap((r) => r.acceptanceCriteria).filter((c) => c.status !== "closed");
  const openFindings = state.findings.filter((f) => !f.disposition);
  const openBlockers = state.blockers.filter((b) => !b.resolved);
  const critical = openFindings.filter((f) => ["CRITICO", "CRITICAL", "ALTO", "HIGH"].includes(f.severity));
  return {
    missionId: state.missionId,
    missionName: state.missionName,
    status: state.status,
    executionMode: state.executionMode || "DEFAULT",
    impact: state.impact,
    requirements: state.requirements.length,
    openCriteria: openCriteria.length,
    findings: state.findings.length,
    openFindings: openFindings.length,
    criticalOrHighOpenFindings: critical.length,
    openBlockers: openBlockers.length,
    evidence: state.evidenceIds.length,
    readyForCompletionGate: openBlockers.length === 0 && critical.length === 0 && openCriteria.length === 0,
  };
}

export function cmdCoverageMark({ flags, cwd }) {
  requireState(cwd);
  if (!flags.file || !flags.by) throw new Error('USAGE: coverage mark --file <path> --by <agent> [--finding <id>]');
  return { status: "OK", entry: markAudited(cwd, flags.file, { by: flags.by, findingIds: flags.finding ? [].concat(flags.finding) : [] }) };
}

export function cmdCoverageStatus({ cwd }) {
  requireState(cwd);
  return { status: "OK", coverage: computeCoverage(cwd) };
}

export function cmdMobilizationStatus({ cwd }) {
  const state = requireState(cwd);
  const ledger = computeCapabilityLedger(cwd);
  return {
    status: "OK",
    executionMode: state.executionMode,
    ...ledger,
    note: state.executionMode === "STRICT_MULTI_AGENT"
      ? "completion-gate.mjs blocks unless summary.undispatched === 0 and summary.failed === 0 and summary.blocked === 0"
      : "informational only in DEFAULT mode -- not a completion requirement",
  };
}

export function cmdQuorumVote({ flags, cwd }) {
  requireState(cwd);
  if (!flags.conflict || !flags.voter || !flags.choice) {
    throw new Error("USAGE: quorum vote --conflict <conflictId> --voter <agent> --choice <text>");
  }
  return { status: "OK", vote: castVote(cwd, flags.conflict, flags.voter, flags.choice) };
}

export function cmdQuorumResolve({ flags, cwd }) {
  requireState(cwd);
  if (!flags.conflict) throw new Error("USAGE: quorum resolve --conflict <conflictId> [--threshold 0.5]");
  return { status: "OK", ...resolveByQuorum(cwd, flags.conflict, { threshold: flags.threshold ? Number(flags.threshold) : 0.5 }) };
}

const COMMANDS = {
  init: cmdInit,
  "mode set": cmdModeSet,
  "mobilization status": cmdMobilizationStatus,
  "requirement add": cmdRequirementAdd,
  "criterion add": cmdCriterionAdd,
  "evidence run": cmdEvidenceRun,
  "evidence review": cmdEvidenceReview,
  "finding add": cmdFindingAdd,
  "finding disposition": cmdFindingDisposition,
  "blocker add": cmdBlockerAdd,
  "blocker resolve": cmdBlockerResolve,
  checkpoint: cmdCheckpoint,
  "baseline record": cmdBaselineRecord,
  "effect log": cmdEffectLog,
  "record add": cmdRecordAdd,
  "record list": cmdRecordList,
  "coverage mark": cmdCoverageMark,
  "coverage status": cmdCoverageStatus,
  "quorum vote": cmdQuorumVote,
  "quorum resolve": cmdQuorumResolve,
  improve: cmdImprove,
  status: cmdStatus,
};

export function dispatch(argv, cwd = process.cwd()) {
  const { flags, positional } = parseFlags(argv);
  // commands are 1 or 2 words (e.g. "init", "requirement add")
  const two = positional.slice(0, 2).join(" ");
  const one = positional[0];
  const key = COMMANDS[two] ? two : COMMANDS[one] ? one : null;
  if (!key) {
    throw new Error(`UNKNOWN_COMMAND: ${positional.join(" ")}. Available: ${Object.keys(COMMANDS).join(", ")}`);
  }
  return COMMANDS[key]({ flags, positional, cwd });
}

function main() {
  try {
    out(dispatch(process.argv.slice(2)));
  } catch (err) {
    out({ status: "ERROR", message: err.message });
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
