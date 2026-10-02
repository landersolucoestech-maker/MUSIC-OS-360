---
name: assign-operational-task
description: Assigns a task by role and capacity. Use when an operational task assigned to an owner is needed to continue the operation.
---
# assign-operational-task

## Classification
- kind: operation
- domain: operations
- batch: 18
- approval: none
- mutates: yes
- capability-unavailable: no

## Purpose
Assigns a task by role and capacity.

## Invocation conditions
- An operational task assigned to an owner is needed to continue the operation.
- The previous step produced a validated result that this step builds on.

## Required inputs
- The data: the task and the assignment rules.
- The validation results of the previous steps, bound to the data version.

## Procedure
1. Read the task class and the assignment rules by role.
2. Choose the owner by role and current workload.
3. Assign through the guarded service and notify the owner.

## Expected outputs
- The task with one owner assigned.

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
- Revert by restoring the previous assignee through the guarded service using the recorded assignment entry.

## Human approval
- Low-impact change inside the normal permissions of the requester: no separate human approval is needed; the guarded service and its audit trail apply.
