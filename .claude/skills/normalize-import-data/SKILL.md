---
name: normalize-import-data
description: Normalizes imported values to their canonical forms. Use when staged import data normalized is needed to continue the operation.
---
# normalize-import-data

## Classification
- kind: operation
- domain: operations
- batch: 18
- approval: none
- mutates: yes
- capability-unavailable: no

## Purpose
Normalizes imported values to their canonical forms.

## Invocation conditions
- Staged import data normalized is needed to continue the operation.
- The previous step produced a validated result that this step builds on.

## Required inputs
- The data: the staging batch.
- The validation results of the previous steps, bound to the data version.

## Procedure
1. Normalize formats of dates, numbers, identifiers and names according to the rules.
2. Keep the original value next to the normalized value.
3. Record every changed cell.

## Expected outputs
- A staging batch with normalized values and the original kept.

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
- Revert by restoring the original values in the staging batch from the kept originals.

## Human approval
- Low-impact change inside the normal permissions of the requester: no separate human approval is needed; the guarded service and its audit trail apply.
