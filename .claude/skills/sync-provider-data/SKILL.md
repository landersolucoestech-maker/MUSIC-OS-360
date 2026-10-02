---
name: sync-provider-data
description: Pulls provider data through the configured connector. Use when provider data synchronized and stored apart from internal data is needed to continue the operation.
---
# sync-provider-data

## Classification
- kind: operation
- domain: operations
- batch: 18
- approval: none
- mutates: yes
- capability-unavailable: no

## Purpose
Pulls provider data through the configured connector.

## Invocation conditions
- Provider data synchronized and stored apart from internal data is needed to continue the operation.
- The previous step produced a validated result that this step builds on.

## Required inputs
- The data: the provider configuration and the cursor.
- The validation results of the previous steps, bound to the data version.

## Procedure
1. Read the stored cursor and fetch changes since it through the guarded integration path.
2. Store each item as provider-reported with its source and time, apart from internal authoritative values.
3. Advance the cursor only after the batch is stored.
4. Record counts and any item that failed validation.

## Expected outputs
- Provider-reported records, an updated cursor and a batch record.

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
- Revert by restoring the previous cursor and removing the batch records through the guarded service using the batch identifier.

## Human approval
- Low-impact change inside the normal permissions of the requester: no separate human approval is needed; the guarded service and its audit trail apply.
