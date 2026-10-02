---
name: archive-signed-contract
description: Archives a contract only with signature evidence. Use when a signed contract archived is needed to continue the operation.
---
# archive-signed-contract

## Classification
- kind: operation
- domain: operations
- batch: 18
- approval: none
- mutates: yes
- capability-unavailable: no

## Purpose
Archives a contract only with signature evidence.

## Invocation conditions
- A signed contract archived is needed to continue the operation.
- The previous step produced a validated result that this step builds on.

## Required inputs
- The data: the provider completion event and the sent document record.
- The validation results of the previous steps, bound to the data version.

## Procedure
1. Fetch the signed document from the provider through the guarded path.
2. Verify it matches the document that was approved and sent by hash and by signer data.
3. Store it with provider evidence and link it to the contract and its parties.
4. Prepare proposals for the rights and shares the contract implies without applying them.

## Expected outputs
- An archived signed document with evidence and a list of proposals.

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
- Revert by removing the archive record through the guarded service; the provider copy remains the original.

## Human approval
- Low-impact change inside the normal permissions of the requester: no separate human approval is needed; the guarded service and its audit trail apply.
