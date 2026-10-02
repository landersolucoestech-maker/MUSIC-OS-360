---
name: create-phonogram-draft
description: Creates a Phonogram draft with the recording data provided. Use when a Phonogram draft, the recording is needed to continue the operation.
---
# create-phonogram-draft

## Classification
- kind: operation
- domain: operations
- batch: 18
- approval: none
- mutates: yes
- capability-unavailable: no

## Purpose
Creates a Phonogram draft with the recording data provided.

## Invocation conditions
- A Phonogram draft, the recording is needed to continue the operation.
- The previous step produced a validated result that this step builds on.

## Required inputs
- The data: the source material and the Work reference.
- The validation results of the previous steps, bound to the data version.

## Procedure
1. Collect the recording fields from the source: title, version, duration, recording date and performers.
2. Create the Phonogram draft through the guarded service and link it to its Work by reference without copying composition data.
3. Link performers and producers with recording roles only.
4. Record the creation and the source in the audit trail.

## Expected outputs
- A Phonogram draft linked to its Work and carrying recording data only.

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
- Revert by removing the Phonogram draft through the guarded service using the recorded creation entry.

## Human approval
- Low-impact change inside the normal permissions of the requester: no separate human approval is needed; the guarded service and its audit trail apply.
