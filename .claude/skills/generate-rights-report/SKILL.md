---
name: generate-rights-report
description: Generates a rights report without altering rights data. Use when a rights report generated is needed to continue the operation.
---
# generate-rights-report

## Classification
- kind: operation
- domain: operations
- batch: 18
- approval: none
- mutates: yes
- capability-unavailable: no

## Purpose
Generates a rights report without altering rights data.

## Invocation conditions
- A rights report generated is needed to continue the operation.
- The previous step produced a validated result that this step builds on.

## Required inputs
- The data: the rights and shares records.
- The validation results of the previous steps, bound to the data version.

## Procedure
1. Read rights and shares per Work and Phonogram and record the data version.
2. Report totals, conflicts and missing origins separately for composition and master rights.
3. State scope, filters and generation time in the report header.

## Expected outputs
- A rights report with scope, data version and time.

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
- Revert by deleting the generated report through the guarded service.

## Human approval
- Low-impact change inside the normal permissions of the requester: no separate human approval is needed; the guarded service and its audit trail apply.
