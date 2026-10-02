---
name: create-operational-task
description: Creates an operational task with an owner and a due date. Use when an operational task created for a problem is needed to continue the operation.
---
# create-operational-task

## Classification
- kind: operation
- domain: operations
- batch: 18
- approval: none
- mutates: yes
- capability-unavailable: no

## Purpose
Creates an operational task with an owner and a due date.

## Invocation conditions
- An operational task created for a problem is needed to continue the operation.
- The previous step produced a validated result that this step builds on.

## Required inputs
- The data: the event or finding.
- The validation results of the previous steps, bound to the data version.

## Procedure
1. Check no open task already covers the same problem.
2. Create one task with the problem, the evidence and the due date.
3. Record the creation and the trigger in the audit trail.

## Expected outputs
- An operational task with evidence attached.

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
- Revert by cancelling the task through the guarded service using the recorded creation entry.

## Human approval
- Low-impact change inside the normal permissions of the requester: no separate human approval is needed; the guarded service and its audit trail apply.
