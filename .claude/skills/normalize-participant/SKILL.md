---
name: normalize-participant
description: Normalizes participant names without merging identities. Use when a normalized participant proposal is needed to continue the operation.
---
# normalize-participant

## Classification
- kind: operation
- domain: operations
- batch: 18
- approval: none
- mutates: yes
- capability-unavailable: no

## Purpose
Normalizes participant names without merging identities.

## Invocation conditions
- A normalized participant proposal is needed to continue the operation.
- The previous step produced a validated result that this step builds on.

## Required inputs
- The data: the participant record.
- The validation results of the previous steps, bound to the data version.

## Procedure
1. Normalize spelling, casing and identifier formatting of the participant.
2. Keep the original values as aliases with their sources.
3. Propose the normalized record and never overwrite a human entered value without approval.

## Expected outputs
- A normalized participant proposal with originals kept as aliases.

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
- Revert by restoring the previous values and removing the aliases through the guarded service using the recorded entry.

## Human approval
- Low-impact change inside the normal permissions of the requester: no separate human approval is needed; the guarded service and its audit trail apply.
