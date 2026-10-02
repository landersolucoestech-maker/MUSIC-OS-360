---
name: generate-csv-export
description: Generates a delimited export only where a documented compatibility path requires it. Use when a CSV export generated is needed to continue the operation.
---
# generate-csv-export

## Classification
- kind: operation
- domain: operations
- batch: 18
- approval: none
- mutates: yes
- capability-unavailable: no

## Purpose
Generates a delimited export only where a documented compatibility path requires it.

## Invocation conditions
- A CSV export generated is needed to continue the operation.
- XLSX is the standard exchange format: use CSV only where a documented compatibility path requires it.

## Required inputs
- The data: the export request and the requester permissions.
- The validation results of the previous steps, bound to the data version.

## Procedure
1. Scope the query to the tenant and the permissions of the requester.
2. Select only permitted fields and use humanized column labels.
3. Escape quotes and neutralize cells that start with formula characters and bound the size.
4. Store the file with an audit entry of who exported what.

## Expected outputs
- A CSV file reference and its audit entry.

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
- Revert by deleting the generated file through the guarded service; the source data is untouched.

## Human approval
- Low-impact change inside the normal permissions of the requester: no separate human approval is needed; the guarded service and its audit trail apply.
