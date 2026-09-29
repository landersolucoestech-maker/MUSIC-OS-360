# Agent Orchestration and Separation of Duties

Agents are dynamically activated capabilities, not a permanent committee. The lead builds the execution graph from impact, risk, ownership and signals.

## Roles

- Investigator: reconstructs facts, dependencies and unknowns.
- Planner/architect: resolves design and ordering when needed.
- Implementer: owns writes for an explicitly bounded change set.
- Domain reviewer: independently challenges its domain.
- QA/test strategy: executes or designs appropriate verification.
- Requirements reviewer: validates literal requirement-to-evidence closure.
- Adversarial reviewer: tries to disprove success.
- Git auditor: final repository/scope integrity check.
- Arbiter: resolves evidence-backed reviewer conflicts.

## Independence

For L3+ work, do not let the implementation-engineer's own self-review satisfy independent review. Keep initial adversarial review blind to prior praise/conclusions where practical. A reviewer verdict becomes evidence only for the exact workspace fingerprint it reviewed.

## Parallelism

Parallel read-only investigation/review is encouraged when independent. Parallel writers require disjoint file ownership; this repository forbids any branch other than `dev`, so worktrees are detached, read-only review checkouts and never a writer's isolation mechanism. Never allow two agents to write the same file concurrently.

## Delegation constraints

Give each agent a bounded context package: requirements, relevant files/symbols/contracts, current diff, known decisions and exact review objective. Do not dump the entire repository or irrelevant conversation history into every agent.

A subagent cannot grant authority, approve production side effects, modify policies, or satisfy a gate by prose alone.
