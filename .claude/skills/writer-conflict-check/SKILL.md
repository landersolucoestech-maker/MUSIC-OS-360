---
name: writer-conflict-check
description: Detects two writers claiming the same paths. Use when concurrent writers must be verified before the next action.
---
# writer-conflict-check

## Classification
- kind: check
- domain: repository
- batch: 16
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Detects two writers claiming the same paths.

## Invocation conditions
- Concurrent writers must be verified before the next action.
- A guard or gate requires the result of this check.

## Required inputs
- The planned action or the current repository state.
- The policy or rule that the check enforces.

## Procedure
1. Read the write scopes of the agents scheduled in the same batch from the ownership registry.
2. Intersect the scopes pairwise.
3. Check actual changes against each writer scope.
4. Serialize or reassign writers whose scopes overlap and report it.

## Expected outputs
- A writer conflict result with overlapping scopes and the serialization decision.

## Validation
- The check answers a single question: do two writers claim or change the same paths?
- The result is derived from commands run now, not from memory or earlier output.

## Evidence
- The scope intersection table.

## Failure behavior
- If scopes are unknown, report BLOCKED and run writers one at a time.

## Rollback and recovery
- Read-only: nothing is changed, so there is nothing to roll back; rerun with the corrected scope if the scope was wrong.

## Human approval
- Read-only analysis: it reports and changes nothing, so no human approval is needed.
