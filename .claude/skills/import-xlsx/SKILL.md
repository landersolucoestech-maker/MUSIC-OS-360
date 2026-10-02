---
name: import-xlsx
description: Imports an XLSX workbook through validation and preview. Use when an XLSX file parsed into staging is needed to continue the operation.
---
# import-xlsx

## Classification
- kind: operation
- domain: operations
- batch: 18
- approval: none
- mutates: yes
- capability-unavailable: no

## Purpose
Imports an XLSX workbook through validation and preview.

## Invocation conditions
- An XLSX file parsed into staging is needed to continue the operation.
- The previous step produced a validated result that this step builds on.

## Required inputs
- The data: the uploaded XLSX file.
- The validation results of the previous steps, bound to the data version.

## Procedure
1. Validate the workbook structure: sheet names, headers and types before reading rows.
2. Read rows into a staging area with their row numbers and never into live tables.
3. Reject macros and neutralize formula cells.
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
