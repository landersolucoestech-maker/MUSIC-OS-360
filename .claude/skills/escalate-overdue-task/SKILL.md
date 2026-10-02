---
name: escalate-overdue-task
description: Escalates overdue tasks along the configured chain. Use when an overdue task escalated is needed to continue the operation.
---
# escalate-overdue-task

## Classification
- kind: operation
- domain: operations
- batch: 18
- approval: none
- mutates: yes
- capability-unavailable: no

## Purpose
Escalates overdue tasks along the configured chain.

## Invocation conditions
- An overdue task escalated is needed to continue the operation.
- The previous step produced a validated result that this step builds on.

## Required inputs
- The data: the overdue task.
- The validation results of the previous steps, bound to the data version.

## Procedure
1. Check the escalation cooldown to avoid repeats.
2. Escalate to the next level with age, impact and history.
3. Record the escalation and notify the next level.

## Expected outputs
- An escalation recorded and delivered to the next level.

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
- Revert by withdrawing the escalation record through the guarded service; a sent notice is followed by a correction notice.

## Human approval
- Low-impact change inside the normal permissions of the requester: no separate human approval is needed; the guarded service and its audit trail apply.
