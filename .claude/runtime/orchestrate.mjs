#!/usr/bin/env node
// ORCHESTRATION DRIVER of the MUSIC OS 360 pack. The routers (route-task.mjs), the workflow graphs
// (graph-engine.mjs), the delegation packages (context-engine.mjs), the evidence store and the gates were
// separate parts; nothing connected them into a loop that keeps going. This driver is that loop:
//
//   order -> workflow discovery+matching -> workflow instance (phases) -> task graph (persisted) -> next READY tasks -> delegation package + prompt for the
//   specialist agent -> done/fail/block with evidence -> next tasks -> ... -> completion gate
//
// and two hooks that make it autonomous: `stop-check` (Stop hook) refuses to let a session end while
// actionable tasks remain, and `prompt-hook` (UserPromptSubmit) injects the routing of a long order and the
// state of the active plan. It never grants an approval and never marks a task done without evidence.
//
//   node .claude/runtime/orchestrate.mjs plan --order "<text>" [--workflow <name>] [--intent <id>]
//        [--capabilities a,b] [--tasks-file extra.json (tasks carry a phase)] [--adopt-file adopt.json] [--title <t>]
//        [--unbound-reason "<why>"]   (the only way around workflow matching; recorded)
//   node .claude/runtime/orchestrate.mjs workflow-status [--plan <id>]
//   node .claude/runtime/orchestrate.mjs add-task --id .. --agent .. --phase <phase> [--reopen true] ...
//   node .claude/runtime/orchestrate.mjs next [--plan <id>] [--limit N]
//   node .claude/runtime/orchestrate.mjs done --task <id> --evidence <evid-..,..> --summary "<text>" [--plan <id>]
//   node .claude/runtime/orchestrate.mjs fail --task <id> --reason "<text>" [--plan <id>]
//   node .claude/runtime/orchestrate.mjs block-external --task <id> --capability .. --cause .. --missing ..
//        --contract .. --current .. --fallback .. --impact .. --unblock ..
//   node .claude/runtime/orchestrate.mjs reassign --task <id> --agent <name>   (executor that can really write)
//   node .claude/runtime/orchestrate.mjs sync-approvals | status | show | check | abandon --reason "<>=12 letters/digits>" [--confirm-incomplete] [--plan <id>]
//   node .claude/runtime/orchestrate.mjs stop-check | prompt-hook          (hooks, JSON on stdin)
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { addRecord, getRecord, listRecords, updateRecord } from "./lib/record-store.mjs";
import { routeTask, classifyIntent } from "./route-task.mjs";
import { loadWorkflow, SAFE_NAME } from "./graph-engine.mjs";
import { matchOrder, recordMatch, MATCH_THRESHOLD } from "./workflow-match.mjs";
import { openWorkflowTasks } from "./lib/workflow-completion.mjs";
import { loadState } from "./lib/state-store.mjs";
import { open as openDelegation, close as closeDelegation } from "./context-engine.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DEFAULT = join(__dirname, "..", "..");
const TERMINAL_OK = new Set(["COMPLETED"]);
const NON_ACTIONABLE_REST = new Set(["WAITING_APPROVAL", "BLOCKED_EXTERNAL"]);
const MAX_ATTEMPTS = 3;
const MIN_REASON_LETTERS = 12;
const MAX_STOP_BLOCKS = 3;
const now = () => new Date().toISOString();
const readJson = (p, fb) => (existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : fb);

function registry(cwd) {
  return readJson(join(cwd, ".claude", "registry", "pack-registry.json"), readJson(join(ROOT_DEFAULT, ".claude", "registry", "pack-registry.json"), { agents: [], skills: [], capabilities: [] }));
}

function agentExists(cwd, name) {
  return existsSync(join(cwd, ".claude", "agents", `${name}.md`)) || existsSync(join(ROOT_DEFAULT, ".claude", "agents", `${name}.md`)) || registry(cwd).agents.some((a) => a.name === name);
}

function skillExists(cwd, name) {
  return existsSync(join(cwd, ".claude", "skills", name, "SKILL.md")) || existsSync(join(ROOT_DEFAULT, ".claude", "skills", name, "SKILL.md")) || registry(cwd).skills.some((s) => s.name === name);
}

function mkTask(t) {
  return {
    id: t.id, title: t.title || t.id, objective: t.objective || t.title || t.id, agent: t.agent, skills: t.skills || [],
    filesInScope: t.filesInScope || [], dependsOn: t.dependsOn || [], acceptance: t.acceptance || [], gates: t.gates || [],
    approvalClass: t.approvalClass || null, status: "PENDING", attempts: 0, delegationId: null, approvalId: null,
    evidenceRefs: [], result: null, failureReason: null, recoveryOf: t.recoveryOf || null, blockedExternal: null,
  };
}

// ------------------------------------------------------------------ graph building
function tasksFromWorkflow(workflowName, cwd) {
  const wf = loadWorkflow(workflowName, cwd);
  return wf.phases.map((p) => {
    const agents = p.requiredAgents && p.requiredAgents.length ? p.requiredAgents : ["task-orchestrator"];
    return mkTask({
      id: p.id, title: p.id, agent: agents[0],
      objective: `Phase "${p.id}" of workflow ${wf.name}: ${wf.description || ""}${agents.length > 1 ? ` Work together with: ${agents.slice(1).join(", ")}.` : ""}`,
      skills: p.requiredSkills || [], dependsOn: p.dependsOn || [], gates: p.gates || [],
      acceptance: (p.requiredEvidence || []).map((e) => `evidence recorded: ${e}`).concat(p.approvalRequired ? ["a recorded human approval of this phase"] : []),
      approvalClass: p.approvalRequired ? "human-approval" : null,
    });
  });
}

function tasksFromRoutes(routes) {
  return routes.map((r, i) => mkTask({
    id: `t${i + 1}-${r.capability.replace(/[^a-z0-9]+/g, "-")}`, title: r.capability, agent: r.agent, skills: r.skills,
    objective: `Capability ${r.capability} (${r.intent}). Validation: ${(r.validation || []).join("; ")}. Evidence: ${(r.evidence || []).join("; ")}.`,
    acceptance: [...(r.validation || []), ...(r.evidence || []).map((e) => `evidence: ${e}`)],
    approvalClass: r.approvalRequired ? r.approvalClass || "human-approval" : null,
  }));
}

function withClosure(tasks) {
  const ids = tasks.map((t) => t.id);
  if (!tasks.some((t) => t.id === "completion-gate")) {
    tasks.push(mkTask({
      id: "completion-gate", title: "completion gate", agent: "completion-controller", skills: ["definition-of-done"],
      objective: "Decide completion only from a PASS completion gate, closed criteria and fresh evidence for the current workspace fingerprint.",
      dependsOn: ids, gates: ["completion"], acceptance: ["node .claude/runtime/completion-gate.mjs reports PASS", "no open criterion, finding or blocker"],
    }));
  }
  return tasks;
}

export function validatePlanTasks(tasks, cwd) {
  const problems = [];
  const ids = new Set(tasks.map((t) => t.id));
  if (ids.size !== tasks.length) problems.push("duplicate task ids");
  const safe = (v) => typeof v === "string" && SAFE_NAME.test(v) && !v.includes("..");
  for (const t of tasks) {
    if (!safe(t.id)) problems.push(`task id ${JSON.stringify(t.id)} is not a safe name`);
    if (!safe(t.agent)) { problems.push(`task ${t.id}: agent name ${JSON.stringify(t.agent)} is not a safe name`); continue; }
    for (const s of t.skills) if (!safe(s)) problems.push(`task ${t.id}: skill name ${JSON.stringify(s)} is not a safe name`);
    if (t.skills.some((s) => !safe(s))) continue;
    if (!agentExists(cwd, t.agent)) problems.push(`task ${t.id}: unknown agent "${t.agent}"`);
    for (const s of t.skills) if (!skillExists(cwd, s)) problems.push(`task ${t.id}: unknown skill "${s}"`);
    for (const d of t.dependsOn) if (!ids.has(d)) problems.push(`task ${t.id}: unknown dependency "${d}"`);
  }
  // cycle detection
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const state = new Map();
  const visit = (id) => {
    if (state.get(id) === 2) return false;
    if (state.get(id) === 1) return true;
    state.set(id, 1);
    for (const d of byId.get(id)?.dependsOn || []) if (byId.has(d) && visit(d)) return true;
    state.set(id, 2);
    return false;
  };
  for (const t of tasks) if (visit(t.id)) { problems.push(`dependency cycle through ${t.id}`); break; }
  return problems;
}

function refresh(plan) {
  const byId = new Map(plan.tasks.map((t) => [t.id, t]));
  for (const t of plan.tasks) {
    if (t.status === "PENDING" && t.dependsOn.every((d) => byId.get(d)?.status === "COMPLETED")) t.status = "READY";
  }
  if (plan.tasks.every((t) => t.status === "COMPLETED")) plan.status = "COMPLETED";
  return plan;
}

function save(cwd, plan, progress = true) {
  refresh(plan);
  if (progress) { plan.stopBlocks = 0; plan.lastProgressAt = now(); }
  const { id, createdAt, ...rest } = plan;
  const saved = updateRecord(cwd, "orchestration", id, rest);
  syncInstance(cwd, saved);
  return saved;
}

// A workflow instance is COMPLETED exactly when every phase task, every task attached to a phase and the
// completion-gate task of its plan are COMPLETED with evidence (lib/workflow-completion.mjs, shared with the gate).
function syncInstance(cwd, p) {
  if (!p.workflowInstanceId) return;
  const inst = getRecord(cwd, "workflow-instance", p.workflowInstanceId);
  if (!inst) return;
  const status = openWorkflowTasks(p, inst).length === 0 ? "COMPLETED" : "ACTIVE";
  const taskIdsByPhase = new Map(inst.steps.map((st) => [st.phase, p.tasks.filter((t) => t.phase === st.phase).map((t) => t.id)]));
  const steps = inst.steps.map((st) => ({ ...st, taskIds: taskIdsByPhase.get(st.phase) }));
  if (status !== inst.status || JSON.stringify(steps) !== JSON.stringify(inst.steps)) {
    const { id, createdAt, ...rest } = inst;
    updateRecord(cwd, "workflow-instance", id, { ...rest, status, steps });
  }
}

function loadPlan(cwd, id) {
  const plans = listRecords(cwd, "orchestration");
  if (id) {
    const p = plans.find((x) => x.id === id);
    if (!p) throw new Error(`UNKNOWN_PLAN: ${id}`);
    return p;
  }
  const active = plans.filter((p) => p.status === "ACTIVE").sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  if (!active.length) throw new Error("NO_ACTIVE_PLAN: run orchestrate.mjs plan first");
  return active[0];
}

// ------------------------------------------------------------------ commands
export function plan({ order, workflow = null, intent = null, capabilities = null, tasksFile = null, title = null, adopt = [], unboundReason = null }, cwd = ROOT_DEFAULT) {
  if (!order) throw new Error('USAGE: plan --order "<text>"');
  if (unboundReason !== null && unboundReason !== undefined && (typeof unboundReason !== "string" || (unboundReason.match(/[\p{L}\p{N}]/gu) || []).length < MIN_REASON_LETTERS)) {
    return { status: "INVALID_UNBOUND_REASON", message: `--unbound-reason must state the justification: a string with at least ${MIN_REASON_LETTERS} letters or digits (punctuation, whitespace and zero-width characters do not count)` };
  }
  if (!Array.isArray(adopt)) return { status: "INVALID_ADOPTION", problems: ["the adoption list must be a JSON array of {phase, fromPlan, tasks, complete?} objects"] };
  const currentMission = loadState(cwd)?.missionId ?? null;
  let tasks;
  let chosenIntent = intent;
  let routes = [];
  // WORKFLOW DISCOVERY AND MATCHING comes first, always. Every candidate is persisted for audit.
  const m = matchOrder({ order, intent, cwd });
  const matchRec = recordMatch(m, cwd);
  let bound = null;
  if (workflow) {
    loadWorkflow(workflow, cwd); // validates the name and the manifest
    bound = workflow;
  } else if (m.status === "MATCHED") {
    bound = m.selected;
  } else if (!unboundReason) {
    return {
      status: "NO_WORKFLOW_MATCH", matchStatus: m.status, matchId: matchRec.id,
      message: "no workflow was selected for this order. This is a gap in the pack (add or fix a workflow and its match metadata), not a reason to skip the workflow layer. Pass an explicit --workflow, or --unbound-reason \"<why>\" to record a justified exception.",
      candidates: m.candidates.slice(0, 5).map((c) => ({ workflow: c.workflow, score: c.score, reasons: c.reasons })),
    };
  }
  let extra = [];
  if (tasksFile) {
    const raw = JSON.parse(readFileSync(tasksFile, "utf8"));
    extra = (raw.tasks || raw).map((t) => ({ ...mkTask(t), phase: t.phase || null }));
  }
  if (bound) {
    tasks = tasksFromWorkflow(bound, cwd);
    for (const t of extra) {
      if (!t.phase) return { status: "INVALID_PLAN", problems: [`task ${t.id}: with a workflow bound every extra task needs a "phase" of ${bound}`] };
      const phaseTask = tasks.find((x) => x.id === t.phase);
      if (!phaseTask) return { status: "INVALID_PLAN", problems: [`task ${t.id}: phase "${t.phase}" is not a phase of ${bound}`] };
      phaseTask.dependsOn = [...phaseTask.dependsOn, t.id];
      tasks.push(t);
    }
  } else if (tasksFile) {
    tasks = extra;
  } else if (capabilities) {
    const reg = registry(cwd);
    routes = String(capabilities).split(",").filter(Boolean).map((cid) => {
      const c = reg.capabilities.find((x) => x.id === cid);
      if (!c) throw new Error(`UNKNOWN_CAPABILITY: ${cid}`);
      return { capability: cid, intent: "explicit", agent: c.executors[0], skills: c.skills, validation: c.validation, evidence: c.evidence, approvalRequired: c.approval && c.approval !== "none", approvalClass: c.approval };
    });
    tasks = tasksFromRoutes(routes);
  } else {
    const res = routeTask({ task: order, intent, root: cwd });
    if (res.status === "NEEDS_CLASSIFICATION" || res.status === "UNKNOWN_INTENT") {
      return { status: res.status, message: "the order could not be classified; pass --intent, --capabilities, --workflow or --tasks-file", candidates: res.candidates };
    }
    if (res.status === "CAPABILITY_UNAVAILABLE") return { status: res.status, unavailable: res.unavailable };
    chosenIntent = res.intent;
    tasks = tasksFromRoutes(res.routes);
  }
  for (const t of tasks) if (bound && !t.phase) t.phase = t.id;
  tasks = withClosure(tasks);
  const problems = validatePlanTasks(tasks, cwd);
  if (problems.length) return { status: "INVALID_PLAN", problems };
  const adoptedFrom = [];
  for (const a of adopt) {
    if (a === null || typeof a !== "object" || Array.isArray(a)) return { status: "INVALID_ADOPTION", problems: [`adoption entry ${JSON.stringify(a)} is not an object {phase, fromPlan, tasks}`] };
    if (typeof a.fromPlan !== "string" || !a.fromPlan) return { status: "INVALID_ADOPTION", problems: [`adoption of phase "${a.phase}" must name its source plan (fromPlan)`] };
    const phaseTask = tasks.find((t) => t.id === a.phase);
    if (!bound || !phaseTask) return { status: "INVALID_ADOPTION", problems: [`phase "${a.phase}" is not a phase of ${bound}`] };
    if (!Array.isArray(a.tasks) || !a.tasks.length) return { status: "INVALID_ADOPTION", problems: [`adoption of phase "${a.phase}" lists no tasks: adopting a phase requires at least one COMPLETED task with evidence`] };
    const old = loadPlan(cwd, a.fromPlan);
    if (!currentMission || old.missionId !== currentMission) return { status: "INVALID_ADOPTION", problems: [`plan ${a.fromPlan} belongs to mission ${old.missionId || "none"}, not the current mission ${currentMission || "none"}: only same-mission work can be adopted`] };
    if (old.status === "ABANDONED") return { status: "INVALID_ADOPTION", problems: [`plan ${a.fromPlan} is ABANDONED: its tasks cannot be adopted`] };
    const refs = [];
    for (const tid of a.tasks) {
      const ot = old.tasks.find((x) => x.id === tid);
      if (!ot || ot.status !== "COMPLETED") return { status: "INVALID_ADOPTION", problems: [`task ${tid} of ${a.fromPlan} is not COMPLETED`] };
      const missing = (ot.evidenceRefs || []).filter((e) => getRecord(cwd, "evidence", e)?.status !== "PASS");
      if (!(ot.evidenceRefs || []).length || missing.length) return { status: "INVALID_ADOPTION", problems: [`task ${tid} of ${a.fromPlan} has no existing PASS evidence (${missing.join(", ") || "none recorded"})`] };
      refs.push({ plan: a.fromPlan, task: tid, evidenceRefs: ot.evidenceRefs });
    }
    phaseTask.adopted = [...(phaseTask.adopted || []), ...refs];
    if (!adoptedFrom.includes(a.fromPlan)) adoptedFrom.push(a.fromPlan);
    if (a.complete) {
      phaseTask.status = "COMPLETED";
      phaseTask.evidenceRefs = [...new Set(refs.flatMap((r) => r.evidenceRefs))];
      phaseTask.result = `adopted from ${a.fromPlan}: ${refs.map((r) => r.task).join(", ")}`;
    }
  }
  const rec = addRecord(cwd, "orchestration", {
    order, title: title || order.slice(0, 80), workflow: bound, intent: chosenIntent, status: "ACTIVE", stopBlocks: 0, lastProgressAt: now(), tasks, missionId: loadState(cwd)?.missionId ?? null,
    requireWorkflow: !unboundReason, ...(unboundReason ? { unboundReason } : {}),
  });
  let instanceId = null;
  if (bound) {
    const wf = loadWorkflow(bound, cwd);
    const inst = addRecord(cwd, "workflow-instance", {
      workflow: bound, planId: rec.id, matchId: matchRec.id, status: "ACTIVE", adoptedFrom,
      steps: wf.phases.map((ph) => ({ phase: ph.id, taskIds: tasks.filter((t) => t.phase === ph.id).map((t) => t.id), adopted: (tasks.find((t) => t.id === ph.id)?.adopted || []).map((x) => `${x.plan}:${x.task}`) })),
    });
    instanceId = inst.id;
    updateRecord(cwd, "orchestration", rec.id, { workflowInstanceId: inst.id });
    rec.workflowInstanceId = inst.id;
  }
  const saved = save(cwd, { ...rec, workflowInstanceId: instanceId });
  return { status: "OK", planId: saved.id, workflow: bound, matchId: matchRec.id, matchStatus: m.status, workflowInstanceId: instanceId, tasks: saved.tasks.map((t) => ({ id: t.id, phase: t.phase || null, agent: t.agent, status: t.status, dependsOn: t.dependsOn })) };
}

/** Per-phase view of a workflow instance, derived from the plan's tasks (never stored twice). */
export function workflowStatus({ planId = null } = {}, cwd = ROOT_DEFAULT) {
  // default: the active plan; once the plan itself is COMPLETED, the most recent one (a finished instance stays inspectable)
  const latest = () => listRecords(cwd, "orchestration").sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))[0];
  const p = planId || listRecords(cwd, "orchestration").some((x) => x.status === "ACTIVE") ? loadPlan(cwd, planId) : latest();
  if (!p) throw new Error("NO_ACTIVE_PLAN: run orchestrate.mjs plan first");
  if (!p.workflowInstanceId) return { status: "NO_WORKFLOW_INSTANCE", planId: p.id };
  const inst = getRecord(cwd, "workflow-instance", p.workflowInstanceId);
  const steps = inst.steps.map((st) => {
    const phaseTask = p.tasks.find((t) => t.id === st.phase);
    const attached = p.tasks.filter((t) => t.phase === st.phase && t.id !== st.phase);
    return { phase: st.phase, status: phaseTask ? phaseTask.status : "MISSING", tasks: attached.map((t) => ({ id: t.id, status: t.status })), adopted: st.adopted || [] };
  });
  const complete = openWorkflowTasks(p, inst).length === 0;
  return { status: complete ? "COMPLETED" : "ACTIVE", instance: inst.id, workflow: inst.workflow, matchId: inst.matchId, planId: p.id, steps };
}

function depResults(plan, t) {
  return t.dependsOn.map((d) => plan.tasks.find((x) => x.id === d)).filter(Boolean).map((d) => `- ${d.id} (${d.agent}): ${d.result || "completed"}${d.evidenceRefs.length ? ` [evidence: ${d.evidenceRefs.join(", ")}]` : ""}`);
}

export function buildPrompt(plan, t) {
  const deps = depResults(plan, t);
  return [
    `You are ${t.agent}, working inside the MUSIC OS 360 orchestration ${plan.id}, task ${t.id}.`,
    `ORDER: ${plan.order}`,
    `OBJECTIVE: ${t.objective}`,
    t.filesInScope.length ? `SCOPE (touch nothing else): ${t.filesInScope.join(", ")}` : "SCOPE: derive it from the objective and state it before editing; stay inside it.",
    t.skills.length ? `SKILLS to apply (read each .claude/skills/<name>/SKILL.md): ${t.skills.join(", ")}` : "",
    deps.length ? `RESULTS OF YOUR DEPENDENCIES:\n${deps.join("\n")}` : "",
    `ACCEPTANCE CRITERIA:\n${(t.acceptance.length ? t.acceptance : ["the objective is met and verified by executed commands"]).map((a) => `- ${a}`).join("\n")}`,
    t.gates.length ? `GATES that apply to this task: ${t.gates.join(", ")}` : "",
    "RULES: evidence-first (run real commands; never report PASS without output), no new branches (dev only), no secrets in output, no skipped or weakened tests, high-impact actions need a recorded human approval and are never self-approved.",
    "REPORT BACK: a short summary, the files changed, the exact commands run with exit codes, and anything blocked. The orchestrator records evidence with `node .claude/runtime/ops.mjs evidence run --cmd \"<command>\"` and closes the task.",
  ].filter(Boolean).join("\n\n");
}

export function next({ planId = null, limit = 5 } = {}, cwd = ROOT_DEFAULT) {
  const p = loadPlan(cwd, planId);
  refresh(p);
  const dispatched = [];
  for (const t of p.tasks) {
    if (dispatched.length >= limit) break;
    if (t.status !== "READY") continue;
    if (t.approvalClass) {
      const appr = addRecord(cwd, "approval", { action: t.approvalClass, requestedBy: t.agent, status: "PENDING", grantedBy: null, resolvedAt: null });
      t.approvalId = appr.id;
      t.status = "WAITING_APPROVAL";
      dispatched.push({ taskId: t.id, kind: "approval", approvalId: appr.id, message: `Human approval ${appr.id} (${t.approvalClass}) is PENDING for ${t.id}; only a human can grant it. Continue every independent task meanwhile.` });
      continue;
    }
    const d = openDelegation({ agent: t.agent, objective: t.objective, filesInScope: t.filesInScope }, cwd);
    t.delegationId = d.id;
    t.status = "RUNNING";
    dispatched.push({ taskId: t.id, kind: "delegate", subagent_type: t.agent, delegationId: d.id, skills: t.skills, prompt: buildPrompt(p, t) });
  }
  save(cwd, p, dispatched.length > 0);
  return { status: dispatched.length ? "DISPATCHED" : "NOTHING_READY", planId: p.id, dispatched, summary: summary(p) };
}

export function done({ planId = null, task, evidence = "", summary: text = "" }, cwd = ROOT_DEFAULT) {
  const p = loadPlan(cwd, planId);
  const t = p.tasks.find((x) => x.id === task);
  if (!t) throw new Error(`UNKNOWN_TASK: ${task}`);
  if (t.status === "COMPLETED") return { status: "ALREADY_COMPLETED", task };
  if (t.status === "WAITING_APPROVAL") throw new Error("TASK_WAITING_APPROVAL: only a recorded GRANTED approval completes it (sync-approvals)");
  const refs = String(evidence).split(",").map((x) => x.trim()).filter(Boolean);
  if (!refs.length) throw new Error("EVIDENCE_REQUIRED: a task is never COMPLETED without evidence records (ops.mjs evidence run/review)");
  const open = t.dependsOn.filter((d) => p.tasks.find((x) => x.id === d)?.status !== "COMPLETED");
  if (open.length) throw new Error(`DEPENDENCIES_NOT_COMPLETED: ${t.id} waits for ${open.join(", ")}; a task is closed only after everything it depends on`);
  const missionId = p.missionId || loadState(cwd)?.missionId;
  if (!missionId) throw new Error("MISSION_REQUIRED: no mission id to bind evidence to (ops.mjs init)");
  const bad = [];
  for (const r of refs) {
    const e = getRecord(cwd, "evidence", r);
    if (!e) bad.push(`UNKNOWN_EVIDENCE: ${r}`);
    else if (e.status !== "PASS") bad.push(`EVIDENCE_NOT_PASS: ${r}=${e.status}; a failing check is fixed, not recorded as completion`);
    else if (e.missionId !== missionId) bad.push(`EVIDENCE_WRONG_MISSION: ${r} is bound to ${e.missionId || "no mission"}, not ${missionId}`);
  }
  if (bad.length) throw new Error(bad.join("; "));
  const delegation = t.delegationId ? getRecord(cwd, "delegation", t.delegationId) : null;
  if (t.delegationId && !delegation) throw new Error(`UNKNOWN_DELEGATION: ${t.delegationId} of task ${t.id} does not exist`);
  // A task with an agent is closed only after `next` dispatched it, and only by evidence produced at or after
  // that dispatch (a delegation's createdAt is the dispatch time). Adopted tasks keep their own validation.
  if (!(t.adopted && t.adopted.length)) {
    if (t.status !== "RUNNING" || !delegation) throw new Error(`TASK_NOT_DISPATCHED: ${t.id} is ${t.status}${delegation ? "" : " with no delegation record"}; a task is closed only after \`next\` dispatched it`);
    const stale = refs.filter((r) => String(getRecord(cwd, "evidence", r).createdAt) < String(delegation.createdAt));
    if (stale.length) throw new Error(`EVIDENCE_BEFORE_DISPATCH: ${stale.join(", ")} predate the dispatch of ${t.id} (${delegation.createdAt}); record fresh evidence after dispatch`);
  }
  t.status = "COMPLETED";
  t.evidenceRefs = refs;
  t.result = text || "completed";
  if (t.delegationId) closeDelegation(t.delegationId, cwd);
  save(cwd, p);
  return { status: "OK", task, summary: summary(p) };
}

export function fail({ planId = null, task, reason }, cwd = ROOT_DEFAULT) {
  if (!reason) throw new Error("USAGE: fail --task <id> --reason \"...\"");
  const p = loadPlan(cwd, planId);
  const t = p.tasks.find((x) => x.id === task);
  if (!t) throw new Error(`UNKNOWN_TASK: ${task}`);
  t.attempts += 1;
  t.failureReason = reason;
  if (t.delegationId) closeDelegation(t.delegationId, cwd);
  if (t.attempts >= MAX_ATTEMPTS) {
    t.status = "FAILED";
    save(cwd, p);
    return { status: "ESCALATE", task, message: `${t.id} failed ${t.attempts} times: change the root-cause strategy; it stays FAILED and blocks completion until resolved`, summary: summary(p) };
  }
  // retry through a recovery task: root cause first, then the original task again
  const recId = `${t.id}-recovery-${t.attempts}`;
  p.tasks.push(mkTask({
    id: recId, title: `recover ${t.id}`, agent: "root-cause-investigator", skills: ["root-cause-analysis"], recoveryOf: t.id,
    objective: `Find the root cause of the failure of task ${t.id} ("${t.objective}"): ${reason}. Do not retry the same approach.`,
    acceptance: ["the proximate and systemic cause are stated with evidence", "a changed approach for the retry is proposed"],
  }));
  t.status = "PENDING";
  t.dependsOn = [...t.dependsOn, recId];
  t.delegationId = null;
  save(cwd, p);
  return { status: "RETRY_PLANNED", task, recoveryTask: recId, attempts: t.attempts, summary: summary(p) };
}

export function blockExternal({ planId = null, task, capability, cause, missing, contract, current, fallback, impact, unblock }, cwd = ROOT_DEFAULT) {
  const fields = { capability, cause, missingDependency: missing, expectedContract: contract, currentBehavior: current, fallback, impact, unblockCondition: unblock };
  const absent = Object.entries(fields).filter(([, v]) => !v || String(v).trim().length < 8).map(([k]) => k);
  if (absent.length) throw new Error(`BLOCKED_EXTERNAL_INCOMPLETE: ${absent.join(", ")} must be stated concretely; an internal problem is never an external block`);
  const p = loadPlan(cwd, planId);
  const t = p.tasks.find((x) => x.id === task);
  if (!t) throw new Error(`UNKNOWN_TASK: ${task}`);
  t.status = "BLOCKED_EXTERNAL";
  t.blockedExternal = fields;
  if (t.delegationId) closeDelegation(t.delegationId, cwd);
  save(cwd, p);
  return { status: "OK", task, summary: summary(p) };
}

export function reassign({ planId = null, task, agent }, cwd = ROOT_DEFAULT) {
  const p = loadPlan(cwd, planId);
  const t = p.tasks.find((x) => x.id === task);
  if (!t) throw new Error(`UNKNOWN_TASK: ${task}`);
  if (!agentExists(cwd, agent)) throw new Error(`UNKNOWN_AGENT: ${agent}`);
  if (t.status === "COMPLETED") throw new Error("TASK_ALREADY_COMPLETED");
  if (t.status === "RUNNING" || t.status === "WAITING_APPROVAL") throw new Error(`TASK_IN_FLIGHT: ${task} is ${t.status}; fail it (orchestrate.mjs fail) and re-dispatch instead of reassigning`);
  t.agent = agent;
  save(cwd, p);
  return { status: "OK", task, agent };
}

export function abandon({ planId = null, reason, confirmIncomplete = false }, cwd = ROOT_DEFAULT) {
  const letters = typeof reason === "string" ? (reason.match(/[\p{L}\p{N}]/gu) || []).length : 0;
  if (letters < 12) throw new Error("INVALID_ABANDON_REASON: --reason must contain at least 12 letters or digits");
  const p = loadPlan(cwd, planId);
  const incomplete = p.tasks.filter((t) => t.status !== "COMPLETED");
  if (incomplete.length && !confirmIncomplete) {
    throw new Error(`ABANDON_INCOMPLETE: plan ${p.id} has ${incomplete.length} non-completed task(s) (${incomplete.map((t) => `${t.id}:${t.status}`).slice(0, 8).join(", ")}); pass --confirm-incomplete to abandon anyway`);
  }
  updateRecord(cwd, "orchestration", p.id, { status: "ABANDONED", abandonedReason: reason, abandonedAt: now(), abandonedIncompleteTasks: incomplete.length });
  return { status: "OK", planId: p.id, abandonedIncompleteTasks: incomplete.length };
}

export function addTask({ planId = null, id, agent, skills = [], deps = [], blocks = [], objective, acceptance = [], files = [], phase = null, reopen = false }, cwd = ROOT_DEFAULT) {
  const p = loadPlan(cwd, planId);
  if (p.workflowInstanceId && !phase) throw new Error(`PHASE_REQUIRED: plan ${p.id} is bound to a workflow instance; attach the task to one of its phases (--phase)`);
  const t = mkTask({ id, title: id, agent, skills, dependsOn: deps, objective, acceptance, filesInScope: files });
  let reopened = null;
  if (phase) {
    const phaseTask = p.tasks.find((x) => x.id === phase && (x.phase || x.id) === phase);
    if (!phaseTask) throw new Error(`UNKNOWN_PHASE: ${phase}`);
    t.phase = phase;
    if (!blocks.includes(phase)) blocks = [...blocks, phase];
    if (phaseTask.status === "COMPLETED" && reopen) { reopened = phaseTask; phaseTask.status = "PENDING"; phaseTask.result = `reopened by new task ${id}`; }
  }
  const next = [...p.tasks, t];
  for (const b of blocks) {
    const blocked = next.find((x) => x.id === b);
    if (!blocked) throw new Error(`UNKNOWN_TASK: ${b}`);
    if (blocked.status === "COMPLETED") throw new Error(`TASK_ALREADY_COMPLETED: ${b} cannot wait for a new task`);
    blocked.dependsOn = [...blocked.dependsOn, id];
    if (blocked.status === "READY") blocked.status = "PENDING";
  }
  const problems = validatePlanTasks(next, cwd);
  if (problems.length) throw new Error(`INVALID_PLAN: ${problems.join("; ")}`);
  if (reopened) {
    // everything downstream of the reopened phase was closed on the premise that it was complete: invalidate it
    const stale = new Set([reopened.id]);
    for (let grew = true; grew;) {
      grew = false;
      for (const x of next) if (!stale.has(x.id) && x.dependsOn.some((d) => stale.has(d))) { stale.add(x.id); grew = true; }
    }
    stale.delete(reopened.id);
    for (const x of next) {
      if (!stale.has(x.id) || !["COMPLETED", "READY"].includes(x.status)) continue;
      x.status = "PENDING";
      x.evidenceRefs = [];
      x.result = `invalidated: upstream phase ${reopened.id} was reopened by new task ${id}`;
      x.delegationId = null;
    }
  }
  p.tasks = next;
  if (reopened && p.status === "COMPLETED") p.status = "ACTIVE"; // a plan with reopened work is active again
  save(cwd, p);
  return { status: "OK", task: id, summary: summary(p) };
}

export function syncApprovals({ planId = null } = {}, cwd = ROOT_DEFAULT) {
  const p = loadPlan(cwd, planId);
  const changes = [];
  for (const t of p.tasks.filter((x) => x.status === "WAITING_APPROVAL")) {
    const a = getRecord(cwd, "approval", t.approvalId);
    if (!a) continue;
    if (a.status === "GRANTED" && a.grantedBy && a.grantedBy !== t.agent) {
      t.status = "COMPLETED";
      t.evidenceRefs = [a.id];
      t.result = `approval ${a.id} granted by ${a.grantedBy}`;
      changes.push({ task: t.id, now: "COMPLETED" });
    } else if (a.status === "DENIED") {
      t.status = "FAILED";
      t.attempts = MAX_ATTEMPTS;
      t.failureReason = `APPROVAL_DENIED by ${a.grantedBy || "a human"}; the same payload is not retried`;
      changes.push({ task: t.id, now: "FAILED" });
    }
  }
  save(cwd, p, changes.length > 0);
  return { status: "OK", changes, summary: summary(p) };
}

export function summary(p) {
  const c = {};
  for (const t of p.tasks) c[t.status] = (c[t.status] || 0) + 1;
  return { planId: p.id, status: p.status, counts: c };
}

// A task is actionable when something can still be done about it without a human or an external party.
export function actionable(p) {
  const byId = new Map(p.tasks.map((t) => [t.id, t]));
  const blockedAncestor = (t, seen = new Set()) => t.dependsOn.some((d) => {
    const x = byId.get(d);
    if (!x || seen.has(d)) return false;
    seen.add(d);
    return NON_ACTIONABLE_REST.has(x.status) || blockedAncestor(x, seen);
  });
  return p.tasks.filter((t) => {
    if (TERMINAL_OK.has(t.status) || NON_ACTIONABLE_REST.has(t.status)) return false;
    if (t.status === "PENDING") return !blockedAncestor(t);
    return true; // READY, RUNNING, FAILED, BLOCKED_INTERNAL
  });
}

export function check({ planId = null } = {}, cwd = ROOT_DEFAULT) {
  const p = loadPlan(cwd, planId);
  refresh(p);
  const open = actionable(p);
  return {
    status: open.length ? "ACTIONABLE_TASKS_REMAIN" : (p.tasks.some((t) => NON_ACTIONABLE_REST.has(t.status)) ? "ONLY_EXTERNAL_OR_APPROVAL_WAITS" : "COMPLETE"),
    open: open.map((t) => ({ id: t.id, status: t.status, agent: t.agent })),
    waiting: p.tasks.filter((t) => NON_ACTIONABLE_REST.has(t.status)).map((t) => ({ id: t.id, status: t.status, approvalId: t.approvalId, blockedExternal: t.blockedExternal && t.blockedExternal.capability })),
    summary: summary(p),
  };
}

// Stop hook: refuse to stop while actionable work remains. Bounded: after MAX_STOP_BLOCKS consecutive
// blocks without progress the stop is allowed, so a hung task can never trap a session forever.
export function stopCheck(cwd = ROOT_DEFAULT) {
  const plans = listRecords(cwd, "orchestration").filter((p) => p.status === "ACTIVE");
  if (!plans.length) return null;
  const p = plans.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))[0];
  refresh(p);
  const open = actionable(p);
  if (!open.length) return null;
  if ((p.stopBlocks || 0) >= MAX_STOP_BLOCKS) {
    updateRecord(cwd, "orchestration", p.id, { stopBlocks: 0 });
    return null;
  }
  updateRecord(cwd, "orchestration", p.id, { stopBlocks: (p.stopBlocks || 0) + 1 });
  const ready = open.filter((t) => t.status === "READY").map((t) => t.id);
  return {
    decision: "block",
    reason: `Orchestration ${p.id} still has ${open.length} actionable task(s): ${open.map((t) => `${t.id}[${t.status}]`).join(", ")}. ` +
      `Continue: run \`node .claude/runtime/orchestrate.mjs next\` and delegate ${ready.length ? `the READY tasks (${ready.join(", ")})` : "the running tasks' results"} to the named subagents, record evidence with ops.mjs, then \`orchestrate.mjs done|fail|block-external\`. ` +
      `Only a real human approval or a documented external dependency may stop a task.`,
  };
}

export function promptHook(prompt, cwd = ROOT_DEFAULT) {
  const plans = listRecords(cwd, "orchestration").filter((p) => p.status === "ACTIVE");
  const parts = [];
  if (plans.length) {
    const p = plans[plans.length - 1];
    const c = check({ planId: p.id }, cwd);
    parts.push(`Active orchestration ${p.id}: ${JSON.stringify(c.summary.counts)}. ${c.open.length ? `Actionable: ${c.open.map((t) => t.id).join(", ")}. Continue with \`node .claude/runtime/orchestrate.mjs next\`.` : "Nothing actionable remains."}`);
  } else if (prompt && prompt.length >= 300) {
    const routing = readJson(join(cwd, ".claude", "registry", "routing.json"), { intents: [] });
    const cls = classifyIntent(prompt, routing, null);
    parts.push(`This looks like a work order. Pack entry point: the music-os-360-orchestrator. Build the task graph with \`node .claude/runtime/orchestrate.mjs plan --order "<order>"\` (${cls.status === "OK" ? `routing suggests intent ${cls.intent.intent}` : "routing needs --intent, --capabilities, --workflow or --tasks-file"}), then loop \`next\` -> delegate to the named subagents -> \`done|fail|block-external\` until \`check\` reports COMPLETE.`);
  }
  return parts.length ? { hookSpecificOutput: { hookEventName: "UserPromptSubmit", additionalContext: parts.join(" ") } } : null;
}

// ------------------------------------------------------------------ CLI
function parseArgs(argv) {
  const f = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) f[a.slice(2)] = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
    else f._.push(a);
  }
  return f;
}

function readStdin() {
  try { return readFileSync(0, "utf8"); } catch { return ""; }
}

function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const f = parseArgs(rest);
  const cwd = existsSync(join(process.cwd(), ".claude")) ? process.cwd() : ROOT_DEFAULT;
  const out = (o) => console.log(JSON.stringify(o, null, 2));
  try {
    switch (cmd) {
      case "plan": return out(plan({ order: f.order, workflow: f.workflow || null, intent: f.intent || null, capabilities: f.capabilities || null, tasksFile: f["tasks-file"] || null, title: f.title || null, adopt: f["adopt-file"] ? JSON.parse(readFileSync(f["adopt-file"], "utf8")) : [], unboundReason: f["unbound-reason"] ?? null }, cwd));
      case "workflow-status": return out(workflowStatus({ planId: f.plan || null }, cwd));
      case "next": return out(next({ planId: f.plan || null, limit: Number(f.limit || 5) }, cwd));
      case "done": return out(done({ planId: f.plan || null, task: f.task, evidence: f.evidence, summary: f.summary }, cwd));
      case "fail": return out(fail({ planId: f.plan || null, task: f.task, reason: f.reason }, cwd));
      case "block-external": return out(blockExternal({ planId: f.plan || null, task: f.task, capability: f.capability, cause: f.cause, missing: f.missing, contract: f.contract, current: f.current, fallback: f.fallback, impact: f.impact, unblock: f.unblock }, cwd));
      case "add-task": return out(addTask({ planId: f.plan || null, id: f.id, agent: f.agent, skills: String(f.skills || "").split(",").filter(Boolean), deps: String(f.deps || "").split(",").filter(Boolean), blocks: String(f.blocks || "").split(",").filter(Boolean), objective: f.objective, acceptance: String(f.acceptance || "").split("|").filter(Boolean), files: String(f.files || "").split(",").filter(Boolean), phase: f.phase || null, reopen: f.reopen === "true" }, cwd));
      case "reassign": return out(reassign({ planId: f.plan || null, task: f.task, agent: f.agent }, cwd));
      case "sync-approvals": return out(syncApprovals({ planId: f.plan || null }, cwd));
      case "status": return out(summary(loadPlan(cwd, f.plan || null)));
      case "show": return out(loadPlan(cwd, f.plan || null));
      case "abandon": return out(abandon({ planId: f.plan || null, reason: f.reason, confirmIncomplete: Boolean(f["confirm-incomplete"]) }, cwd));
      case "check": {
        const r = check({ planId: f.plan || null }, cwd);
        out(r);
        if (r.status === "ACTIONABLE_TASKS_REMAIN") process.exitCode = 1;
        return;
      }
      case "stop-check": { readStdin(); const r = stopCheck(cwd); if (r) console.log(JSON.stringify(r)); return; }
      case "prompt-hook": {
        let prompt = "";
        try { prompt = JSON.parse(readStdin() || "{}").prompt || ""; } catch { prompt = ""; }
        const r = promptHook(prompt, cwd);
        if (r) console.log(JSON.stringify(r));
        return;
      }
      default:
        console.error("USAGE: orchestrate.mjs plan|workflow-status|next|done|fail|block-external|sync-approvals|status|show|check|abandon|stop-check|prompt-hook");
        process.exitCode = 2;
    }
  } catch (e) {
    console.log(JSON.stringify({ status: "ERROR", message: e.message }, null, 2));
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
