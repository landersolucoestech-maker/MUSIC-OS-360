---
name: record-automation-evidence
description: Records structured evidence of an automation step. Use when evidence of an automation run recorded is needed to continue the operation.
---
# record-automation-evidence

## Classification
- kind: operation
- domain: operations
- batch: 18
- approval: none
- mutates: yes
- capability-unavailable: no

## Purpose
Records structured evidence of an automation step.

## Invocation conditions
- Evidence of an automation run recorded is needed to continue the operation.
- The previous step produced a validated result that this step builds on.

## Required inputs
- The data: the run record.
- The validation results of the previous steps, bound to the data version.

## Procedure
1. Collect inputs, outputs and decisions of the run.
2. Store them with the run identifier and the data version.
3. Exclude secrets and personal values that the evidence does not need.

## Expected outputs
- An evidence record linked to the run.

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
- Revert by removing the evidence record through the guarded service; the run itself is unchanged.

## Human approval
- Low-impact change inside the normal permissions of the requester: no separate human approval is needed; the guarded service and its audit trail apply.
