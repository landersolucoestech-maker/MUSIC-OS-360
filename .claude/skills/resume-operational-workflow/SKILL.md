---
name: resume-operational-workflow
description: Resumes a workflow from its last good checkpoint. Use when a workflow resumed from a checkpoint is needed to continue the operation.
---
# resume-operational-workflow

## Classification
- kind: operation
- domain: operations
- batch: 18
- approval: none
- mutates: yes
- capability-unavailable: no

## Purpose
Resumes a workflow from its last good checkpoint.

## Invocation conditions
- A workflow resumed from a checkpoint is needed to continue the operation.
- The previous step produced a validated result that this step builds on.

## Required inputs
- The data: the checkpoint and the workflow definition.
- The validation results of the previous steps, bound to the data version.

## Procedure
1. Read the last checkpoint and verify the data version still matches.
2. Resume at the first step not yet completed, keeping completed steps untouched.
3. Record the resume.

## Expected outputs
- A workflow resumed at the right step.

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
- Revert by stopping the workflow at the next checkpoint and restoring the earlier checkpoint state.

## Human approval
- Low-impact change inside the normal permissions of the requester: no separate human approval is needed; the guarded service and its audit trail apply.
