---
name: schedule-followup
description: Schedules a follow-up with a recorded reason. Use when a follow-up scheduled for a waiting item is needed to continue the operation.
---
# schedule-followup

## Classification
- kind: operation
- domain: operations
- batch: 18
- approval: none
- mutates: yes
- capability-unavailable: no

## Purpose
Schedules a follow-up with a recorded reason.

## Invocation conditions
- A follow-up scheduled for a waiting item is needed to continue the operation.
- The previous step produced a validated result that this step builds on.

## Required inputs
- The data: the waiting item.
- The validation results of the previous steps, bound to the data version.

## Procedure
1. Register what is awaited, from whom and since when.
2. Choose the next check date from the expected response time.
3. Create the follow-up through the guarded service.

## Expected outputs
- A follow-up with a next check date.

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
- Revert by cancelling the follow-up through the guarded service using the recorded entry.

## Human approval
- Low-impact change inside the normal permissions of the requester: no separate human approval is needed; the guarded service and its audit trail apply.
