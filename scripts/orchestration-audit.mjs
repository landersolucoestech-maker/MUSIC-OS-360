#!/usr/bin/env node
/**
 * scripts/orchestration-audit.mjs: audit of how the Engineering Pack was used by a plan.
 *
 *   node scripts/orchestration-audit.mjs --plan <orch-id> [--since <ISO>] [--out docs/engineering/pack/ORCHESTRATION_AUDIT]
 *
 * Reads only runtime records (`.claude/ops/records/{orchestration,delegation,evidence,task}`), the agent and skill
 * catalogs (`.claude/agents/*.md`, `.claude/skills/*\/SKILL.md`) and the applicability declarations in
 * `docs/engineering/pack/orchestration-applicability.json`. Produces:
 *   - the chain matrix  TASK | WORKFLOW | PHASE | AGENT | SKILLS | IMPLEMENTER | REVIEWER | TESTER | GATE | EVIDENCE | STATUS
 *   - AGENT/SKILL | PURPOSE | APPLICABLE | USED | TASKS | EVIDENCE | REASON IF NOT USED
 *   - the counters ORCHESTRATION_COVERAGE_GAPS, APPLICABLE_AGENTS_WITHOUT_JUSTIFICATION,
 *     APPLICABLE_SKILLS_WITHOUT_JUSTIFICATION, UNREVIEWED_CROSS_LAYER_CHANGES, UNVALIDATED_IMPLEMENTATIONS.
 * A task whose implementer was the orchestrator itself while a specialist existed is an ORCHESTRATION_BYPASS; it is
 * accepted only when a specialist task of the same plan re-derived it AND an independent reviewer task validated it,
 * both COMPLETED with PASS evidence recorded after the dispatch.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, "..");
const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const rec = (kind, id) => { const f = path.join(ROOT, ".claude/ops/records", kind, `${id}.json`); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : null; };
// evidence records live in .claude/ops/evidence, every other record kind in .claude/ops/records/<kind>
const list = (kind) => { const d = kind === "evidence" ? path.join(ROOT, ".claude/ops/evidence") : path.join(ROOT, ".claude/ops/records", kind); return fs.existsSync(d) ? fs.readdirSync(d).filter((f) => f.endsWith(".json")).map((f) => JSON.parse(fs.readFileSync(path.join(d, f), "utf8"))) : []; };

export function frontmatter(text) {
  const m = /^---\n([\s\S]*?)\n---/.exec(text);
  const out = {};
  if (m) for (const line of m[1].split("\n")) { const k = /^(\w[\w-]*):\s*(.*)$/.exec(line); if (k) out[k[1]] = k[2]; }
  return out;
}

export function catalog() {
  const agents = fs.readdirSync(path.join(ROOT, ".claude/agents")).filter((f) => f.endsWith(".md")).map((f) => {
    const t = fs.readFileSync(path.join(ROOT, ".claude/agents", f), "utf8");
    const fm = frontmatter(t);
    const g = (k) => (new RegExp(`^- ${k}: (.*)$`, "m").exec(t) || [])[1] || "";
    return { name: fm.name || f.slice(0, -3), purpose: fm.description || "", kind: g("kind"), domain: g("domain"), tools: fm.tools || "" };
  });
  const skills = fs.readdirSync(path.join(ROOT, ".claude/skills")).filter((d) => fs.existsSync(path.join(ROOT, ".claude/skills", d, "SKILL.md"))).map((d) => {
    const fm = frontmatter(fs.readFileSync(path.join(ROOT, ".claude/skills", d, "SKILL.md"), "utf8"));
    return { name: fm.name || d, purpose: fm.description || "" };
  });
  return { agents, skills };
}

/** First matching group rule of a name (rules are [regex, reason]); null when none matches. */
export function groupReason(name, rules) {
  for (const [re, reason] of rules) if (new RegExp(re).test(name)) return reason;
  return null;
}

export function evaluate({ plan, delegations, evidences, cat, applicability, since }) {
  const byId = new Map(plan.tasks.map((t) => [t.id, t]));
  const phaseOf = (t) => t.phase || t.id;
  const rows = [];
  const gaps = [];
  const isReviewer = (t) => /^r\d/.test(t.id);
  for (const t of plan.tasks) {
    const dels = t.delegationId ? [delegations.get(t.delegationId)].filter(Boolean) : [];
    const ev = (t.evidenceRefs ?? []).map((r) => evidences.get(r)).filter(Boolean);
    const impl = t.id.startsWith("w") ? "orchestrator (ORCHESTRATION_BYPASS) then specialist re-derivation" : isReviewer(t) ? "n/a (review task)" : "specialist";
    const reviewers = plan.tasks.filter((x) => isReviewer(x) && x.dependsOn.includes(t.id));
    const tester = ev.filter((e) => e.type === "COMMAND" || e.kind === "COMMAND").length ? "command evidence" : "-";
    const row = { task: t.id, workflow: plan.workflow, phase: phaseOf(t), agent: t.agent, skills: (t.skills ?? []).join(","), implementer: impl, reviewer: reviewers.map((r) => `${r.agent}(${r.id})`).join("; ") || (isReviewer(t) ? "-" : "none"), tester, gate: (t.gates ?? []).join(",") || "-", evidence: (t.evidenceRefs ?? []).join(","), status: t.status };
    rows.push(row);
    if (t.status === "COMPLETED") {
      if (!ev.length) gaps.push(`${t.id}: COMPLETED without evidence`);
      if (!(t.adopted && t.adopted.length) && !t.delegationId) gaps.push(`${t.id}: COMPLETED without a delegation`);
      if (t.id.startsWith("w") && !reviewers.some((r) => r.status === "COMPLETED")) gaps.push(`${t.id}: bypass task without a completed independent reviewer task`);
    } else if (t.id.startsWith("w") || isReviewer(t)) gaps.push(`${t.id}: ${t.status}`);
  }
  const usedAgents = new Map();
  for (const t of plan.tasks) if (t.status === "COMPLETED" && t.delegationId) usedAgents.set(t.agent, [...(usedAgents.get(t.agent) ?? []), t.id]);
  const usedSkills = new Map();
  for (const t of plan.tasks) if (t.status === "COMPLETED" && t.delegationId) for (const s of t.skills ?? []) usedSkills.set(s, [...(usedSkills.get(s) ?? []), t.id]);
  const agentRows = cat.agents.map((a) => {
    const decl = applicability.agents.applicable[a.name];
    const used = usedAgents.get(a.name);
    let applicable = "NO"; let reason = ""; let unjustified = false;
    if (decl) { applicable = "YES"; if (!used && !decl.notUsedReason) unjustified = true; reason = used ? "" : decl.notUsedReason ?? ""; }
    else { reason = groupReason(a.name, applicability.agents.notApplicable.byName) ?? groupReason(`${a.kind}/${a.domain}`, applicability.agents.notApplicable.byKindDomain); if (!reason) { reason = "UNCLASSIFIED"; unjustified = true; } }
    return { name: a.name, purpose: a.purpose, applicable, used: used ? "YES" : "NO", tasks: (used ?? []).join(","), evidence: (used ?? []).flatMap((id) => byId.get(id).evidenceRefs ?? []).join(","), reason, role: decl?.role ?? "", unjustified };
  });
  const skillRows = cat.skills.map((s) => {
    const decl = applicability.skills.applicable[s.name];
    const used = usedSkills.get(s.name);
    let applicable = "NO"; let reason = ""; let unjustified = false;
    if (decl) { applicable = "YES"; if (!used && !decl.notUsedReason) unjustified = true; reason = used ? "" : decl.notUsedReason ?? ""; }
    else { reason = groupReason(s.name, applicability.skills.notApplicable.byName); if (!reason) { reason = "UNCLASSIFIED"; unjustified = true; } }
    return { name: s.name, purpose: s.purpose, applicable, used: used ? "YES" : "NO", tasks: (used ?? []).join(","), evidence: (used ?? []).flatMap((id) => byId.get(id).evidenceRefs ?? []).join(","), reason, unjustified };
  });
  // cross-layer and implementation coverage
  const crossLayer = ["w9-web-fixes", "w10-api-tests", "w11-ledger-gate", "w8-env-templates"];
  const unreviewedCross = crossLayer.filter((id) => !plan.tasks.some((r) => isReviewer(r) && r.dependsOn.includes(id) && r.status === "COMPLETED"));
  const impls = plan.tasks.filter((t) => t.id.startsWith("w"));
  const unvalidated = impls.filter((t) => t.status !== "COMPLETED" || !plan.tasks.some((r) => isReviewer(r) && r.dependsOn.includes(t.id) && r.status === "COMPLETED"));
  return {
    rows, agentRows, skillRows, gaps,
    counters: {
      ORCHESTRATION_COVERAGE_GAPS: gaps.length,
      APPLICABLE_AGENTS_WITHOUT_JUSTIFICATION: agentRows.filter((r) => r.unjustified).length,
      APPLICABLE_SKILLS_WITHOUT_JUSTIFICATION: skillRows.filter((r) => r.unjustified).length,
      UNREVIEWED_CROSS_LAYER_CHANGES: unreviewedCross.length,
      UNVALIDATED_IMPLEMENTATIONS: unvalidated.length,
    },
  };
}

const cell = (s) => String(s ?? "").replace(/[\t\r\n|]+/g, " ").trim();

function main() {
  const planId = arg("--plan");
  if (!planId) throw new Error("usage: orchestration-audit.mjs --plan <orch-id>");
  const plan = rec("orchestration", planId);
  if (!plan) throw new Error(`plan ${planId} not found`);
  const delegations = new Map(list("delegation").map((d) => [d.id, d]));
  const evidences = new Map(list("evidence").map((e) => [e.id, e]));
  const applicability = JSON.parse(fs.readFileSync(path.join(ROOT, "docs/engineering/pack/orchestration-applicability.json"), "utf8"));
  const res = evaluate({ plan, delegations, evidences, cat: catalog(), applicability, since: arg("--since") });
  const out = path.resolve(ROOT, arg("--out") ?? "docs/engineering/pack/ORCHESTRATION_AUDIT");
  const head = "TASK\tWORKFLOW\tPHASE\tAGENT\tSKILLS\tIMPLEMENTER\tREVIEWER\tTESTER\tGATE\tEVIDENCE\tSTATUS";
  fs.writeFileSync(`${out}.chain.tsv`, [head, ...res.rows.map((r) => [r.task, r.workflow, r.phase, r.agent, r.skills, r.implementer, r.reviewer, r.tester, r.gate, r.evidence, r.status].map(cell).join("\t"))].join("\n") + "\n");
  fs.writeFileSync(`${out}.agents.tsv`, ["AGENT\tPURPOSE\tAPPLICABLE\tUSED\tTASKS\tEVIDENCE\tREASON IF NOT USED", ...res.agentRows.map((r) => [r.name, r.purpose, r.applicable, r.used, r.tasks, r.evidence, r.reason].map(cell).join("\t"))].join("\n") + "\n");
  fs.writeFileSync(`${out}.skills.tsv`, ["SKILL\tPURPOSE\tAPPLICABLE\tUSED\tTASKS\tEVIDENCE\tREASON IF NOT USED", ...res.skillRows.map((r) => [r.name, r.purpose, r.applicable, r.used, r.tasks, r.evidence, r.reason].map(cell).join("\t"))].join("\n") + "\n");
  fs.writeFileSync(`${out}.json`, JSON.stringify({ plan: planId, workflow: plan.workflow, counters: res.counters, gaps: res.gaps, applicableAgents: res.agentRows.filter((r) => r.applicable === "YES").map((r) => ({ name: r.name, used: r.used, tasks: r.tasks, reason: r.reason })), applicableSkills: res.skillRows.filter((r) => r.applicable === "YES").map((r) => ({ name: r.name, used: r.used, tasks: r.tasks, reason: r.reason })) }, null, 1) + "\n");
  console.log(JSON.stringify(res.counters, null, 1));
  for (const g of res.gaps.slice(0, 40)) console.log(`  GAP ${g}`);
  if (process.argv.includes("--check") && Object.values(res.counters).some((n) => n > 0)) process.exit(1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (err) { console.error(`orchestration-audit FAILED: ${err.message}`); process.exit(2); }
}
