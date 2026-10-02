---
name: reject-unsafe-automation
description: Stops an automation that would break a safety rule. Use when an unsafe automation stopped is needed to continue the operation.
---
# reject-unsafe-automation

## Classification
- kind: operation
- domain: operations
- batch: 18
- approval: none
- mutates: yes
- capability-unavailable: no

## Purpose
Stops an automation that would break a safety rule.

## Invocation conditions
- An unsafe automation stopped is needed to continue the operation.
- The previous step produced a validated result that this step builds on.

## Required inputs
- The data: the automation run and the rule violated.
- The validation results of the previous steps, bound to the data version.

## Procedure
1. Identify the rule the automation would break: missing approval, unknown target or unverified data.
2. Stop the automation at its checkpoint and mark it rejected with the rule.
3. Route the case to the exception owner with the evidence.

## Expected outputs
- A stopped automation with the rule and the evidence.

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
- Revert by resuming the automation from its checkpoint through the resume skill after the cause is resolved.

## Human approval
- Low-impact change inside the normal permissions of the requester: no separate human approval is needed; the guarded service and its audit trail apply.
