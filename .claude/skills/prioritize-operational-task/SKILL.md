---
name: prioritize-operational-task
description: Orders tasks by deadline and impact. Use when an operational task prioritized is needed to continue the operation.
---
# prioritize-operational-task

## Classification
- kind: operation
- domain: operations
- batch: 18
- approval: none
- mutates: yes
- capability-unavailable: no

## Purpose
Orders tasks by deadline and impact.

## Invocation conditions
- An operational task prioritized is needed to continue the operation.
- The previous step produced a validated result that this step builds on.

## Required inputs
- The data: the task, its impact and its deadline.
- The validation results of the previous steps, bound to the data version.

## Procedure
1. Read the impact and deadline of the task.
2. Compute the priority with the documented rule and record the reason.
3. Update the task priority through the guarded service.

## Expected outputs
- The task with a priority and the recorded reason.

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
- Revert by restoring the previous priority through the guarded service using the recorded entry.

## Human approval
- Low-impact change inside the normal permissions of the requester: no separate human approval is needed; the guarded service and its audit trail apply.
