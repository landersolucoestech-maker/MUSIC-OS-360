---
name: populate-contract
description: Fills the template fields from validated data only. Use when a contract populated with validated data is needed to continue the operation.
---
# populate-contract

## Classification
- kind: operation
- domain: operations
- batch: 18
- approval: none
- mutates: yes
- capability-unavailable: no

## Purpose
Fills the template fields from validated data only.

## Invocation conditions
- A contract populated with validated data is needed to continue the operation.
- The previous step produced a validated result that this step builds on.

## Required inputs
- The data: the draft and the validated data.
- The validation results of the previous steps, bound to the data version.

## Procedure
1. Read the template variables and the validated data for each.
2. Check amounts, percentages and dates equal the source records exactly.
3. Write the values into the draft and leave unknown values blank and visible.
4. Record the source of each value.

## Expected outputs
- A populated draft whose every value has a recorded source.

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
- Revert by restoring the previous draft version kept by the guarded service.

## Human approval
- Low-impact change inside the normal permissions of the requester: no separate human approval is needed; the guarded service and its audit trail apply.
