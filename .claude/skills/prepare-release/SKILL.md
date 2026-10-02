---
name: prepare-release
description: Prepares the release record from validated Project data. Use when a Release package and checklist prepared is needed to continue the operation.
---
# prepare-release

## Classification
- kind: operation
- domain: operations
- batch: 18
- approval: none
- mutates: yes
- capability-unavailable: no

## Purpose
Prepares the release record from validated Project data.

## Invocation conditions
- A Release package and checklist prepared is needed to continue the operation.
- The previous step produced a validated result that this step builds on.

## Required inputs
- The data: the Release record and its Phonograms.
- The validation results of the previous steps, bound to the data version.

## Procedure
1. Collect the Phonograms, artwork and metadata by reference.
2. Run the release readiness validation and list failing items with owners.
3. Create the checklist and the package proposal without delivering anything.
4. Record the preparation in the audit trail.

## Expected outputs
- A release package proposal and checklist.

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
- Revert by deleting the proposal through the guarded service; nothing was delivered.

## Human approval
- Low-impact change inside the normal permissions of the requester: no separate human approval is needed; the guarded service and its audit trail apply.
