---
name: route-phonogram-to-registration
description: Queues a Phonogram as pending registration in its own module. Use when a validated Phonogram routed to registration is needed to continue the operation.
---
# route-phonogram-to-registration

## Classification
- kind: operation
- domain: operations
- batch: 18
- approval: none
- mutates: yes
- capability-unavailable: no

## Purpose
Queues a Phonogram as pending registration in its own module.

## Invocation conditions
- A validated Phonogram routed to registration is needed to continue the operation.
- The previous step produced a validated result that this step builds on.

## Required inputs
- The data: the Phonogram and its validation results.
- The validation results of the previous steps, bound to the data version.

## Procedure
1. Confirm validations of metadata, participants, rights and shares are all pass for this data version.
2. Create the registration task for the registration owner with the validation results attached.
3. Mark the Phonogram as pending registration through the guarded service.
4. Record the routing in the audit trail.

## Expected outputs
- A registration task and the Phonogram in the pending registration state.

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
- Revert by cancelling the registration task and restoring the previous Phonogram state using the recorded routing entry.

## Human approval
- Low-impact change inside the normal permissions of the requester: no separate human approval is needed; the guarded service and its audit trail apply.
