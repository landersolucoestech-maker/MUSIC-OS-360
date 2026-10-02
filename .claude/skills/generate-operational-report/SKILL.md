---
name: generate-operational-report
description: Generates an operational report from stored data. Use when an operational report generated is needed to continue the operation.
---
# generate-operational-report

## Classification
- kind: operation
- domain: operations
- batch: 18
- approval: none
- mutates: yes
- capability-unavailable: no

## Purpose
Generates an operational report from stored data.

## Invocation conditions
- An operational report generated is needed to continue the operation.
- The previous step produced a validated result that this step builds on.

## Required inputs
- The data: the operational records.
- The validation results of the previous steps, bound to the data version.

## Procedure
1. Read current validated data and record the data version.
2. Compute counts and statuses of tasks, readiness and exceptions.
3. State scope, filters and generation time in the report header.
4. Show unknown and missing data as such.

## Expected outputs
- An operational report with scope, data version and time.

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
