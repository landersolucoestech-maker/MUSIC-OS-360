---
name: generate-distribution-report
description: Generates a distribution report from real statuses. Use when a distribution report generated is needed to continue the operation.
---
# generate-distribution-report

## Classification
- kind: operation
- domain: operations
- batch: 18
- approval: none
- mutates: yes
- capability-unavailable: no

## Purpose
Generates a distribution report from real statuses.

## Invocation conditions
- A distribution report generated is needed to continue the operation.
- The previous step produced a validated result that this step builds on.

## Required inputs
- The data: the submission records.
- The validation results of the previous steps, bound to the data version.

## Procedure
1. Read submissions and their recorded statuses and record the data version.
2. Report counts by status with the provider source and time of each status.
3. State clearly when statuses are unavailable because no provider is configured.

## Expected outputs
- A distribution report with scope, data version and the status sources.

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
