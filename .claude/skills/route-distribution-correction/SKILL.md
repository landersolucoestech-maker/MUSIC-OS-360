---
name: route-distribution-correction
description: Routes the required correction to its owner. Use when a correction task routed after a rejection is needed to continue the operation.
---
# route-distribution-correction

## Classification
- kind: operation
- domain: operations
- batch: 18
- approval: none
- mutates: yes
- capability-unavailable: no

## Purpose
Routes the required correction to its owner.

## Invocation conditions
- A correction task routed after a rejection is needed to continue the operation.
- The previous step produced a validated result that this step builds on.

## Required inputs
- The data: the classified rejection.
- The validation results of the previous steps, bound to the data version.

## Procedure
1. Take the classified reasons and the mapped fields.
2. Create one correction task per reason for the owner of that data.
3. Schedule the readiness recheck after the correction.
4. Record the routing in the audit trail.

## Expected outputs
- Correction tasks with owners and a scheduled recheck.

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
- Revert by cancelling the created tasks through the guarded service using the recorded creation entries.

## Human approval
- Low-impact change inside the normal permissions of the requester: no separate human approval is needed; the guarded service and its audit trail apply.
