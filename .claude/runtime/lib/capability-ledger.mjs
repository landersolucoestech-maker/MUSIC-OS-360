// Capability-mobilization ledger for STRICT_MULTI_AGENT missions (state.executionMode,
// see lib/state-store.mjs). Cross-references the pack's real, discovered agent/skill
// registry (registry.mjs) against `task` records whose assignedAgent names a capability
// -- turns "did every registered agent/skill get a real disposition" from a narrative
// claim into a computed, evidence-backed answer. Backs gate-engine.mjs's
// "full-mobilization-when-strict" check and ops.mjs's "mobilization status" command.
//
// A capability's ledger status is derived, never asserted: DISCOVERED (registry has it,
// no task record references it yet) up through whatever the LATEST matching task record's
// `status` says (PLANNED/DISPATCHED/RUNNING/COMPLETED/DONE/NOT_APPLICABLE_WITH_EVIDENCE/
// FAILED/BLOCKED). NOT_APPLICABLE_WITH_EVIDENCE additionally requires a non-empty
// `notApplicableReason` on that task record -- one without it is NOT trusted as applicable
// evidence and is reported back as its underlying status instead (fail-closed, matching
// the "unknown applicability is investigated, not assumed" policy).
import { buildRegistry } from "../registry.mjs";
import { listRecords } from "./record-store.mjs";

const TERMINAL_OK = new Set(["DONE", "COMPLETED"]);

function latestTaskFor(tasks, capabilityName) {
  const matches = tasks.filter((t) => t.assignedAgent === capabilityName);
  if (matches.length === 0) return null;
  // createdAt is ISO and monotonic per addRecord; last-written wins.
  return matches.reduce((a, b) => (a.createdAt > b.createdAt ? a : b));
}

/**
 * @returns {{
 *   capabilities: Array<{name:string, type:'agent'|'skill', status:string, taskId:string|null, notApplicableReason:string|null}>,
 *   summary: {total:number, completed:number, notApplicable:number, undispatched:number, failed:number, blocked:number},
 * }}
 */
export function computeCapabilityLedger(cwd = process.cwd()) {
  const { agents, skills } = buildRegistry(cwd);
  const tasks = listRecords(cwd, "task");

  const named = [
    ...agents.filter((a) => a.valid).map((a) => ({ name: a.name, type: "agent" })),
    ...skills.filter((s) => s.valid).map((s) => ({ name: s.name, type: "skill" })),
  ];

  const capabilities = named.map(({ name, type }) => {
    const task = latestTaskFor(tasks, name);
    if (!task) return { name, type, status: "DISCOVERED", taskId: null, notApplicableReason: null };

    if (task.status === "NOT_APPLICABLE_WITH_EVIDENCE" && !task.notApplicableReason) {
      // Fail-closed: an unjustified N/A is treated as still-undispatched, not trusted.
      return { name, type, status: "DISCOVERED", taskId: task.id, notApplicableReason: null };
    }
    return { name, type, status: task.status, taskId: task.id, notApplicableReason: task.notApplicableReason || null };
  });

  const summary = {
    total: capabilities.length,
    completed: capabilities.filter((c) => TERMINAL_OK.has(c.status)).length,
    notApplicable: capabilities.filter((c) => c.status === "NOT_APPLICABLE_WITH_EVIDENCE").length,
    failed: capabilities.filter((c) => c.status === "FAILED").length,
    blocked: capabilities.filter((c) => c.status === "BLOCKED").length,
    undispatched: capabilities.filter((c) => !TERMINAL_OK.has(c.status) && c.status !== "NOT_APPLICABLE_WITH_EVIDENCE").length,
  };

  return { capabilities, summary };
}

/** Capabilities that block STRICT_MULTI_AGENT completion: not COMPLETED/DONE and not a
 * justified NOT_APPLICABLE_WITH_EVIDENCE. FAILED/BLOCKED are included deliberately --
 * a failure is not a silent omission, but it still isn't done. */
export function outstandingCapabilities(cwd = process.cwd()) {
  const { capabilities } = computeCapabilityLedger(cwd);
  return capabilities.filter((c) => !TERMINAL_OK.has(c.status) && c.status !== "NOT_APPLICABLE_WITH_EVIDENCE");
}
