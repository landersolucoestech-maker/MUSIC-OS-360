# MUSIC OS 360 pack

The pack is the Engineering OS, AI Engineering OS and Operational AI OS of this repository: **374 agents**,
**321 skills**, a capability registry, a routing table, **24 workflows**, contracts, policies, gates and an ownership
registry. The markdown files under `.claude/agents` and `.claude/skills` are the single source of truth; every
registry and every map below is derived from them.

## Maps (generated, never edited by hand)

Regenerate with `node .claude/runtime/build-pack-docs.mjs`; `--check` fails when a document is stale.

| Map | Content |
|---|---|
| [agents-map.md](./agents-map.md) | every agent by domain: kind, tools, write scope, capabilities, approval |
| [skills-map.md](./skills-map.md) | every skill by domain: kind, mutation, approval class, consuming agents |
| [capabilities-map.md](./capabilities-map.md) | every capability with executors, skills, validation and evidence |
| [routing-map.md](./routing-map.md) | intents, keywords, capabilities and high-impact signals |
| [workflows-map.md](./workflows-map.md) | every workflow phase with agents, skills, gates and approval phases |
| [ownership-map.md](./ownership-map.md) | which agent may write which paths |
| [contracts-policies-gates.md](./contracts-policies-gates.md) | contracts, policies, gates and approval action classes |

## Concepts (written by hand, limited to what is implemented)

| Document | Content |
|---|---|
| [orchestration.md](./orchestration.md) | how a mission is routed, delegated, verified and closed |
| [ai-runtime.md](./ai-runtime.md) | the AI engineering side: trust boundaries, tools, output validation |
| [operational-ai.md](./operational-ai.md) | the operational agents and skills and what they never do |
| [approval-model.md](./approval-model.md) | human approval classes, binding, deciders and the gate |
| [evidence-model.md](./evidence-model.md) | evidence records, freshness and the completion gate |
| [recovery-model.md](./recovery-model.md) | failure, retry, recovery and rollback |

## Pack tooling

| Command | Purpose |
|---|---|
| `node .claude/runtime/build-pack-registry.mjs --sync-policy` | derive `pack-registry.json`, tool ceilings and ownership from the markdown |
| `node .claude/runtime/validate-pack-contracts.mjs` | validate every agent, skill, capability, workflow, registry entry and approval class |
| `node .claude/runtime/route-task.mjs --task "<text>"` | route a task to capabilities, agents, skills, tools, validation and evidence |
| `node .claude/runtime/gate-engine.mjs pack-integrity` | the same validation as an executable gate |
| `node .claude/runtime/build-pack-docs.mjs --check` | fail when the generated maps are stale |

## Current limits, stated plainly

- No transcription provider, distributor provider or payout provider is configured. The skills that need them
  (`transcribe-audio`, `submit-distribution`, `sync-distribution-status`) return `CAPABILITY_UNAVAILABLE` with the
  expected contract and a safe fallback; payment execution is likewise unavailable.
- Operational agents are read-only in the repository. They analyze and prepare proposals; execution of a change
  happens only through the guarded product services and, for high-impact actions, after a recorded human approval.
