---
name: control-plane
description: Shows mission, agents, gates and approvals in one place. Use when a person or agent needs to see the state of a mission in one place.
---
# control-plane

## Classification
- kind: governance
- domain: governance
- batch: 16
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Shows mission, agents, gates and approvals in one place.

## Invocation conditions
- A person or agent needs to see the state of a mission in one place.
- An approval, gate or agent assignment is in doubt.

## Required inputs
- The mission state and the ops records of the repository.

## Procedure
1. Read the mission state, requirements and criteria from the ops runtime.
2. List agents assigned with their status and the gates with their results.
3. List pending approvals with their class and the exact action they bind.
4. Show evidence freshness against the current workspace fingerprint.
5. Report anything inconsistent between records and repository state.

## Expected outputs
- A single status view of mission, agents, gates, approvals and evidence freshness.

## Validation
- Every number shown is read from the runtime now and not from memory.
- Stale evidence is labeled stale.

## Evidence
- The runtime status output.

## Failure behavior
- If a record cannot be read, show it as unavailable, never as passing.

## Rollback and recovery
- Read-only: nothing to roll back.

## Human approval
- Read-only analysis: it reports and changes nothing, so no human approval is needed.
