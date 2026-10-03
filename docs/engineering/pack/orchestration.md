# Orchestration

`music-os-360-orchestrator` is the entry point. It does not do the work itself: it classifies, routes, delegates,
collects evidence and closes only after the Definition of Done.

```text
task -> intent -> capabilities -> agent -> skills -> tools -> validation -> evidence -> completion
```

| Step | Agent | Mechanism |
|---|---|---|
| classify the task | `task-router` | `.claude/registry/routing.json`, `route-task.mjs` classifies the intent; ties and no match ask for classification instead of guessing |
| resolve capabilities | `capability-router` | `.claude/registry/capabilities.json` |
| pick the executor | `agent-router` | domain match, tool ceiling from `.claude/policies/capabilities.json`, write scope from `.claude/ownership.json`, fallbacks |
| pick skills | `skill-router` | skills of the capability, in order |
| pick tools | `tool-router` | within the agent ceiling; external or destructive tools need approval |
| pick validation | `validation-router` | impact level and changed boundaries |
| decide approval | `approval-router` | action classes of `.claude/policies/authority.json` |
| order and delegate | `workflow-orchestrator`, `parallel-work-orchestrator`, `dependency-coordinator` | workflows under `.claude/workflows`, disjoint write scopes for parallel writers |
| verify and close | `validation-orchestrator`, `verification-controller`, `completion-controller` | gates, evidence bound to the workspace fingerprint, completion gate |

Failure path: `failure -> retry-orchestrator -> root-cause-investigator -> recovery-orchestrator -> verification-controller`.
Conflict path: `conflict -> escalation-router`, resolved by explicit quorum and never by majority.

`route-task.mjs` returns `CAPABILITY_UNAVAILABLE` when a capability has no executor, `NEEDS_APPROVAL` when the text
or a capability carries a high-impact signal, and `NEEDS_CLASSIFICATION` when the intent is not clear. Every
emitted routing decision validates against `routing-decision.schema.json`.

## The driver that makes it autonomous

The routers above are deterministic only up to the routing decision; what connects them into a loop that keeps going
is `node .claude/runtime/orchestrate.mjs` (contract `orchestration-plan.schema.json`, record kind `orchestration`).
Before it existed the pack had routing, graphs, delegation packages, evidence and gates as separate parts, no
instruction in `CLAUDE.md` to use them and nothing that persisted a task graph, dispatched the next task or
refused to stop while work remained.

| Command | What it does |
|---|---|
| `plan --order` | routes the order (or takes `--workflow`, `--capabilities`, `--tasks-file`), validates agents, skills, dependencies and cycles, persists the task graph and appends the completion-gate task |
| `next` | marks READY tasks RUNNING, opens a delegation record and returns the prompt for the `subagent_type`; approval tasks become `WAITING_APPROVAL` with a PENDING approval record |
| `done` | requires every `dependsOn` task COMPLETED, existing PASS evidence records bound to the plan's mission (`missionId`, stamped by `ops.mjs evidence run/review`), and an existing delegation record for delegated tasks; releases dependents. A task is closed only after `next` dispatched it (status `RUNNING` with its delegation record; otherwise `TASK_NOT_DISPATCHED`), and every evidence record must have been created at or after the dispatch time, i.e. the delegation's `createdAt` (older evidence is `EVIDENCE_BEFORE_DISPATCH`); evidence recorded after a dispatch that happened earlier is valid. Tasks adopted through `plan --adopt-file` keep their own validation (existing PASS evidence of the source plan) and need no dispatch |
| `fail` | plans a root-cause recovery task and a retry; the third failure escalates and keeps blocking |
| `block-external` | accepts only a complete contract: capability, cause, missing dependency, expected contract, current behavior, fallback, impact, unblock condition |
| `sync-approvals` | completes an approval task only from a GRANTED record decided by someone else; DENIED fails it terminally |
| `add-task --reopen true` | reopening a COMPLETED phase also resets every COMPLETED/READY task downstream of it (phases, `completion-gate`) to `PENDING` with its evidence refs cleared, re-activates a COMPLETED plan and re-syncs the instance; a completed plan needs an explicit `--plan` |
| `check` | `ACTIONABLE_TASKS_REMAIN`, `ONLY_EXTERNAL_OR_APPROVAL_WAITS` or `COMPLETE` |
| `stop-check`, `prompt-hook` | the Stop and UserPromptSubmit hooks in `.claude/settings.json` |

Task states: `PENDING`, `READY`, `RUNNING`, `WAITING_APPROVAL`, `BLOCKED_EXTERNAL`, `BLOCKED_INTERNAL`, `FAILED`, `COMPLETED`.
`BLOCKED_INTERNAL` and `FAILED` are never resting states. The Stop hook is bounded: after three consecutive blocks
without progress a stop is allowed, so a hung task cannot trap a session. Regression test:
`.claude/runtime/tests/orchestrate.regression.mjs`.


## Workflow layer (discovery, matching, instance)

`INTENT -> WORKFLOW DISCOVERY -> WORKFLOW MATCHING -> WORKFLOW INSTANCE -> STEPS -> TASK GRAPH -> AGENTS -> SKILLS -> EVIDENCE -> COMPLETION`.

- **Discovery** (`workflow-match.mjs discover`): reads every `.claude/workflows/*.json`, validates it against `workflow-manifest.schema.json`, and refuses unsafe names. Each manifest carries a `match` block (`keywords`, `examples`, optional `intents` and `excludes`).
- **Matching** (`matchOrder`): scores every workflow (keyword hits, intent, example similarity, exclusion penalty) and persists all candidates as a `workflow-match` record. A workflow is selected only at or above the threshold and when it beats the runner-up; otherwise the result is `NO_MATCH` or `AMBIGUOUS`.
- **Instance** (`plan` binds it): a `workflow-instance` record with one step per phase; the phase tasks live in the plan. `workflow-status` derives each step's state from the tasks. The instance is COMPLETED exactly when every phase task, every task attached to a phase and the plan's `completion-gate` task is COMPLETED with evidence (`lib/workflow-completion.mjs`, shared with the `workflow-instance-complete` gate).
- **Adoption** (`plan --adopt-file`): a phase can adopt COMPLETED tasks of an earlier plan, only with PASS evidence records that exist, and only from a source plan that names itself (`fromPlan`), belongs to the current mission and is not `ABANDONED`; a non-object entry (e.g. `null`) is `INVALID_ADOPTION`; an adoption must list at least one task (an empty one is `INVALID_ADOPTION`); nothing is copied or re-run.
- **Unbound escape hatch**: `--unbound-reason` must contain at least 12 letters or digits (Unicode-aware; whitespace, punctuation and zero-width characters do not count), otherwise `INVALID_UNBOUND_REASON`.
- **No match is a pack gap**: add or correct the workflow (this is how `naming-normalization` was added) and its match examples; `workflow-match.mjs --coverage` and the `workflow-runtime` gate prove every workflow is selected by its own examples and that a workflow was really instantiated and executed.

## Record integrity (who may create trust-carrying records)

- `lib/record-store.mjs` `addRecord` is the internal, non-CLI creation API: it always generates `id` and `createdAt`, rejects a caller-supplied `id` or `createdAt` (`RESERVED_FIELD`) and never overwrites an existing record file. Updates go through `updateRecord` only.
- `ops.mjs record add` refuses the kinds `evidence`, `approval`, `delegation`, `orchestration`, `workflow-match` and `workflow-instance` (`RECORD_KIND_FORBIDDEN`) and names the sanctioned producer: `ops.mjs evidence run|review`, `orchestrate.mjs plan|next`, and a human decision for approvals. Every other kind stays usable through `record add`.
- Regression test: `.claude/runtime/tests/workflow-hardening.regression.mjs`.
