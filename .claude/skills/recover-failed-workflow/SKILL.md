---
name: recover-failed-workflow
description: Recovers a failed workflow by resume, rollback or compensation. Use when a failed workflow recovered is needed to continue the operation.
---
# recover-failed-workflow

## Classification
- kind: operation
- domain: operations
- batch: 18
- approval: none
- mutates: yes
- capability-unavailable: no

## Purpose
Recovers a failed workflow by resume, rollback or compensation.

## Invocation conditions
- A failed workflow recovered is needed to continue the operation.
- The previous step produced a validated result that this step builds on.

## Required inputs
- The data: the failed run and its checkpoints.
- The validation results of the previous steps, bound to the data version.

## Procedure
1. Find the last good checkpoint and the failed step and its cause.
2. Choose resume, retry or rollback for the step and record why.
3. Apply the choice through the guarded service and verify the resulting state.

## Expected outputs
- A recovered workflow state with the verification result.

## Validation
- The produced record equals what the steps describe and references only existing entities.
- The change was made through the guarded product service, never by writing to the database directly and is visible in the audit trail.

## Evidence
- The audit trail entry of the change and the produced record.
- The validation results it was based on.

## Failure behavior
- If a validation result is missing or stale, stop and request it instead of continuing.
- If the guarded service rejects the change, report the rejection reason and change nothing else.

## Rollback and recovery
- Revert by restoring the pre-recovery checkpoint state recorded before the recovery began.

## Human approval
- Low-impact change inside the normal permissions of the requester: no separate human approval is needed; the guarded service and its audit trail apply.
