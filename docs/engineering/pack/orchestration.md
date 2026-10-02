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
