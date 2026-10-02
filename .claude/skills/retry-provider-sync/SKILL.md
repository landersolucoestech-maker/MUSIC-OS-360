---
name: retry-provider-sync
description: Retries a provider sync with bounded backoff. Use when a provider sync retried safely is needed to continue the operation.
---
# retry-provider-sync

## Classification
- kind: operation
- domain: operations
- batch: 18
- approval: none
- mutates: yes
- capability-unavailable: no

## Purpose
Retries a provider sync with bounded backoff.

## Invocation conditions
- A provider sync retried safely is needed to continue the operation.
- The previous step produced a validated result that this step builds on.

## Required inputs
- The data: the failed sync record.
- The validation results of the previous steps, bound to the data version.

## Procedure
1. Confirm the failure class allows a retry and the sync is idempotent for the cursor.
2. Apply bounded attempts with backoff and jitter.
3. Stop and escalate after the limit and record each attempt.

## Expected outputs
- A retried sync with its attempts recorded or an escalation.

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
- Revert by restoring the cursor to its value before the first attempt and removing records of the failed batch.

## Human approval
- Low-impact change inside the normal permissions of the requester: no separate human approval is needed; the guarded service and its audit trail apply.
