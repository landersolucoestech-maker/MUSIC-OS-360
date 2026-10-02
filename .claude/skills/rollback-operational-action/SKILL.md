---
name: rollback-operational-action
description: Rolls back an action from its recorded before state. Use when an applied operational action must be undone.
---
# rollback-operational-action

## Classification
- kind: high-impact-operation
- domain: operations
- batch: 18
- approval: production-write
- mutates: yes
- capability-unavailable: no

## Purpose
Rolls back an action from its recorded before state.

## Invocation conditions
- An applied operational action must be undone.

## Required inputs
- The action record with its recorded rollback information.

## Procedure
1. Read the rollback information and compare it with the current state.
2. Create the approval request with the exact records affected and the compensating action for external effects, and stop.
3. After the recorded approval restore the records through the guarded service.
4. Verify the restored state and record the evidence.

## Expected outputs
- An approval request and, after approval, restored state with evidence.

## Validation
- Restored state equals the recorded earlier state for the affected records.

## Evidence
- The approval record and the verification comparison.

## Failure behavior
- If later changes conflict, stop and ask for a decision per record.

## Rollback and recovery
- Re-apply the original action from its record if the rollback itself was wrong.

## Human approval
- A rollback changes live data and may need external compensation: a named human approver must approve it first.
