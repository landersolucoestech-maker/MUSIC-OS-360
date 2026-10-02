---
name: retry-failed-operation
description: Retries a failed operation within its idempotency rules. Use when a failed operation retried safely is needed to continue the operation.
---
# retry-failed-operation

## Classification
- kind: operation
- domain: operations
- batch: 18
- approval: none
- mutates: yes
- capability-unavailable: no

## Purpose
Retries a failed operation within its idempotency rules.

## Invocation conditions
- A failed operation retried safely is needed to continue the operation.
- The previous step produced a validated result that this step builds on.

## Required inputs
- The data: the failed operation record.
- The validation results of the previous steps, bound to the data version.

## Procedure
1. Confirm the operation is idempotent or carries an idempotency key.
2. Retry with bounded attempts and backoff.
3. Stop after the limit, record each attempt and escalate.

## Expected outputs
- A retried operation with attempts recorded or an escalation.

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
- Revert by compensating the effect of the attempts recorded in the log, restoring the state before the first attempt.

## Human approval
- Low-impact change inside the normal permissions of the requester: no separate human approval is needed; the guarded service and its audit trail apply.
