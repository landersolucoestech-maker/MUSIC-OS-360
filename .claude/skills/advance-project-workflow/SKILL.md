---
name: advance-project-workflow
description: Moves a Project through planning, in progress, completed or cancelled. Use when a Project moved to its next workflow stage is needed to continue the operation.
---
# advance-project-workflow

## Classification
- kind: operation
- domain: operations
- batch: 18
- approval: none
- mutates: yes
- capability-unavailable: no

## Purpose
Moves a Project through planning, in progress, completed or cancelled.

## Invocation conditions
- A Project moved to its next workflow stage is needed to continue the operation.
- The previous step produced a validated result that this step builds on.

## Required inputs
- The data: the Project and its readiness result.
- The validation results of the previous steps, bound to the data version.

## Procedure
1. Read the current stage and the entry conditions of the next stage.
2. Confirm a readiness result for exactly this data version says ready.
3. Move the Project to the next stage through the guarded service and record the conditions that were checked.
4. Notify the stage owner through the notification skill when the stage defines it.

## Expected outputs
- The Project in the next stage with the checked conditions recorded.

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
- Revert by moving the Project back to the previous stage through the guarded service using the recorded transition entry.

## Human approval
- Low-impact change inside the normal permissions of the requester: no separate human approval is needed; the guarded service and its audit trail apply.
