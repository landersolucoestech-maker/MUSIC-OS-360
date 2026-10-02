---
name: create-operational-checkpoint
description: Records a resumable checkpoint of an automation run. Use when an operational checkpoint recorded is needed to continue the operation.
---
# create-operational-checkpoint

## Classification
- kind: operation
- domain: operations
- batch: 18
- approval: none
- mutates: yes
- capability-unavailable: no

## Purpose
Records a resumable checkpoint of an automation run.

## Invocation conditions
- An operational checkpoint recorded is needed to continue the operation.
- The previous step produced a validated result that this step builds on.

## Required inputs
- The data: the workflow run state.
- The validation results of the previous steps, bound to the data version.

## Procedure
1. Record the state of the workflow step, its inputs and the data version.
2. Store the checkpoint with a label and the time.
3. Link it to the run.

## Expected outputs
- A checkpoint linked to the run.

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
- Revert by removing the checkpoint record through the guarded service; no product data changed.

## Human approval
- Low-impact change inside the normal permissions of the requester: no separate human approval is needed; the guarded service and its audit trail apply.
