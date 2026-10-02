---
name: link-project-assets
description: Links assets to a Project without duplicating files. Use when assets linked to their Project is needed to continue the operation.
---
# link-project-assets

## Classification
- kind: operation
- domain: operations
- batch: 18
- approval: none
- mutates: yes
- capability-unavailable: no

## Purpose
Links assets to a Project without duplicating files.

## Invocation conditions
- Assets linked to their Project is needed to continue the operation.
- The previous step produced a validated result that this step builds on.

## Required inputs
- The data: the assets and the Project.
- The validation results of the previous steps, bound to the data version.

## Procedure
1. List the assets to link and the Project they belong to.
2. Verify each asset hash and that it is not already linked to another Project.
3. Link the assets through the guarded service by reference.
4. Record the links in the audit trail.

## Expected outputs
- Assets linked to the Project by reference.

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
- Revert by removing the links through the guarded service using the recorded link entries; the files themselves are untouched.

## Human approval
- Low-impact change inside the normal permissions of the requester: no separate human approval is needed; the guarded service and its audit trail apply.
