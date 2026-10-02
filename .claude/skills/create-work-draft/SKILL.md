---
name: create-work-draft
description: Creates a Work draft with the composition data provided. Use when a Work draft, the composition is needed to continue the operation.
---
# create-work-draft

## Classification
- kind: operation
- domain: operations
- batch: 18
- approval: none
- mutates: yes
- capability-unavailable: no

## Purpose
Creates a Work draft with the composition data provided.

## Invocation conditions
- A Work draft, the composition is needed to continue the operation.
- The previous step produced a validated result that this step builds on.

## Required inputs
- The data: the source material.
- The validation results of the previous steps, bound to the data version.

## Procedure
1. Collect the composition fields from the source: title, language, authors and publishers.
2. Create the Work draft through the guarded service and keep recording fields out of it.
3. Link authors as participants with composition roles only.
4. Record the creation and the source in the audit trail.

## Expected outputs
- A Work draft with composition data only and its source recorded.

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
- Revert by removing the Work draft through the guarded service using the recorded creation entry.

## Human approval
- Low-impact change inside the normal permissions of the requester: no separate human approval is needed; the guarded service and its audit trail apply.
