---
name: cross-layer-impact
description: Given a proposed change at one layer, determines every other layer it actually touches (database, backend, API, frontend, async, analytics, docs, tests) before implementation starts, so a fix is never applied to only part of the chain. Use before implementation-engineer starts any change that isn't obviously confined to a single file.
---

# Cross-Layer Impact Analysis

The chain: `database -> persistence -> backend service -> API/contract -> frontend client -> types
-> UI component -> tests -> analytics/observability -> docs`. A change rarely stays in one link.

## Method

1. Start from the concrete change (a field rename, a rule change, a new state). List which link in
   the chain it originates at.
2. Walk outward from that link using `contract-tracing` for any shared contract crossed, and plain
   grep/read for same-layer callers.
3. For each layer touched, name the specific files/symbols that must change, not just the layer's
   name in the abstract.
4. Check for a business-rule duplicate at a layer you weren't planning to touch (e.g. the same
   validation re-implemented in the frontend) — if found, that layer is now in scope too, or the
   duplication itself becomes a tracked finding if fixing it isn't warranted right now.
5. Produce the final bounded file list and hand it to `music-os-360-orchestrator`/`implementation-engineer` as one
   batch. If the list is large enough to need multiple writers, split by disjoint path ownership
   per `.claude/rules/agent-orchestration.md`, never by layer alone (a half-updated contract is
   worse than a slower serial batch).

## Output

The bounded producer/consumer/test/doc file list for the batch, plus any newly-discovered
duplicate-rule finding.
