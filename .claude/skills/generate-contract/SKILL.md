---
name: generate-contract
description: Produces a contract document from a selected template and prepared data. Use when a contract draft generated for review is needed to continue the operation.
---
# generate-contract

## Classification
- kind: operation
- domain: operations
- batch: 18
- approval: none
- mutates: yes
- capability-unavailable: no

## Purpose
Produces a contract document from a selected template and prepared data.

## Invocation conditions
- A contract draft generated for review is needed to continue the operation.
- The previous step produced a validated result that this step builds on.

## Required inputs
- The data: the contract request, the template and validated party data.
- The validation results of the previous steps, bound to the data version.

## Procedure
1. Select the template for the contract type and language.
2. Populate the variables from validated records and leave missing values visibly blank.
3. Mark the document as a draft requiring human and legal review.
4. Store the draft with the map of each variable to its source.

## Expected outputs
- A contract draft with a variable source map, marked for review.

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
- Revert by deleting the generated draft through the guarded service; nothing was sent or signed.

## Human approval
- Low-impact change inside the normal permissions of the requester: no separate human approval is needed; the guarded service and its audit trail apply.
