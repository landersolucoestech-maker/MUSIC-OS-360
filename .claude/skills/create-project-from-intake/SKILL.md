---
name: create-project-from-intake
description: Creates a Project from an intake form without registering any Work or Phonogram. Use when a Project created from an intake record is needed to continue the operation.
---
# create-project-from-intake

## Classification
- kind: operation
- domain: operations
- batch: 18
- approval: none
- mutates: yes
- capability-unavailable: no

## Purpose
Creates a Project from an intake form without registering any Work or Phonogram.

## Invocation conditions
- A Project created from an intake record is needed to continue the operation.
- The previous step produced a validated result that this step builds on.

## Required inputs
- The data: the intake record.
- The validation results of the previous steps, bound to the data version.

## Procedure
1. Read the intake fields and list which mandatory Project fields they cover.
2. Create the Project proposal with only the fields the intake provides and leave the missing mandatory fields visibly empty.
3. Create the Project through the guarded service as a draft in the first workflow stage.
4. Link the intake record to the Project and record the creation in the audit trail.

## Expected outputs
- A draft Project in the first workflow stage linked to its intake record.

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
- Revert by deleting the draft Project through the guarded service using the recorded creation entry; the intake record is untouched.

## Human approval
- Low-impact change inside the normal permissions of the requester: no separate human approval is needed; the guarded service and its audit trail apply.
