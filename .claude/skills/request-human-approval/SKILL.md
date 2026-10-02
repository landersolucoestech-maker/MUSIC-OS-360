---
name: request-human-approval
description: Creates a complete approval request for a human. Use when a human approval request is needed to continue the operation.
---
# request-human-approval

## Classification
- kind: operation
- domain: operations
- batch: 18
- approval: none
- mutates: yes
- capability-unavailable: no

## Purpose
Creates a complete approval request for a human.

## Invocation conditions
- A human approval request is needed to continue the operation.
- The previous step produced a validated result that this step builds on.

## Required inputs
- The data: the proposed action and its evaluation.
- The validation results of the previous steps, bound to the data version.

## Procedure
1. Describe the action, its impact and its rollback information in plain language.
2. Include the exact payload and its hash and the required approval class.
3. Create the request through the approval service addressed to the right approver and stop the automation.

## Expected outputs
- An approval request awaiting a decision.

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
- Revert by withdrawing the request through the approval service; nothing was executed.

## Human approval
- Low-impact change inside the normal permissions of the requester: no separate human approval is needed; the guarded service and its audit trail apply.
