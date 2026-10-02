---
name: close-completed-task
description: Closes a task only when its completion evidence exists. Use when a completed task closed on evidence is needed to continue the operation.
---
# close-completed-task

## Classification
- kind: operation
- domain: operations
- batch: 18
- approval: none
- mutates: yes
- capability-unavailable: no

## Purpose
Closes a task only when its completion evidence exists.

## Invocation conditions
- A completed task closed on evidence is needed to continue the operation.
- The previous step produced a validated result that this step builds on.

## Required inputs
- The data: the task and its completion evidence.
- The validation results of the previous steps, bound to the data version.

## Procedure
1. Find the completion evidence attached to the task.
2. Close the task only if the evidence exists and matches the task.
3. Record the closing evidence reference.

## Expected outputs
- A closed task with its evidence reference.

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
- Revert by reopening the task through the guarded service using the recorded closing entry.

## Human approval
- Low-impact change inside the normal permissions of the requester: no separate human approval is needed; the guarded service and its audit trail apply.
