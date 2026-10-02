---
name: import-csv
description: Imports a delimited file only where a legacy fixture or compatibility path requires it. Use when a CSV file parsed into staging is needed to continue the operation.
---
# import-csv

## Classification
- kind: operation
- domain: operations
- batch: 18
- approval: none
- mutates: yes
- capability-unavailable: no

## Purpose
Imports a delimited file only where a legacy fixture or compatibility path requires it.

## Invocation conditions
- A CSV file parsed into staging is needed to continue the operation.
- XLSX is the standard exchange format: use CSV only where a documented compatibility path or legacy fixture requires it.

## Required inputs
- The data: the uploaded CSV file.
- The validation results of the previous steps, bound to the data version.

## Procedure
1. Detect or require the encoding and delimiter and fail clearly on a mismatch.
2. Validate the headers against the expected English machine names.
3. Read rows into a staging area with their row numbers and never into live tables.
4. Record the file hash, row counts and parse errors.

## Expected outputs
- A staging batch with row numbers and a parse report.

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
- Revert by deleting the staging batch through the guarded service using the batch identifier; live data was not touched.

## Human approval
- Low-impact change inside the normal permissions of the requester: no separate human approval is needed; the guarded service and its audit trail apply.
