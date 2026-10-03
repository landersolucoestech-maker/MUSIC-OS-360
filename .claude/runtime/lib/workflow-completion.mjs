// Single authority for "is this workflow instance complete?", shared by orchestrate.mjs (instance status)
// and gate-engine.mjs (workflow-instance-complete). An instance is complete only when EVERY task of its
// plan that belongs to a phase (the phase task itself and every task attached to it) and the plan's
// completion-gate task (when present) is COMPLETED with at least one evidence reference.
const closed = (t) => !!t && t.status === "COMPLETED" && Array.isArray(t.evidenceRefs) && t.evidenceRefs.length > 0;

export function openWorkflowTasks(plan, inst) {
  const phases = new Set(inst.steps.map((st) => st.phase));
  const open = [];
  for (const ph of phases) if (!closed(plan.tasks.find((t) => t.id === ph))) open.push(ph);
  for (const t of plan.tasks) {
    if (open.includes(t.id)) continue;
    const inPhase = t.phase && phases.has(t.phase);
    if ((inPhase || t.id === "completion-gate") && !closed(t)) open.push(t.id);
  }
  return open;
}
