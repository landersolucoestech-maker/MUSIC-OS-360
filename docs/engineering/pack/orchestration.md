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
| `done` | requires existing PASS evidence records; releases dependents |
| `fail` | plans a root-cause recovery task and a retry; the third failure escalates and keeps blocking |
| `block-external` | accepts only a complete contract: capability, cause, missing dependency, expected contract, current behavior, fallback, impact, unblock condition |
| `sync-approvals` | completes an approval task only from a GRANTED record decided by someone else; DENIED fails it terminally |
| `check` | `ACTIONABLE_TASKS_REMAIN`, `ONLY_EXTERNAL_OR_APPROVAL_WAITS` or `COMPLETE` |
| `stop-check`, `prompt-hook` | the Stop and UserPromptSubmit hooks in `.claude/settings.json` |

Task states: `PENDING`, `READY`, `RUNNING`, `WAITING_APPROVAL`, `BLOCKED_EXTERNAL`, `BLOCKED_INTERNAL`, `FAILED`, `COMPLETED`.
`BLOCKED_INTERNAL` and `FAILED` are never resting states. The Stop hook is bounded: after three consecutive blocks
without progress a stop is allowed, so a hung task cannot trap a session. Regression test:
`.claude/runtime/tests/orchestrate.regression.mjs`.
