---
name: assemble-distribution-package
description: Assembles the distribution package from linked assets and metadata. Use when a distribution package assembled is needed to continue the operation.
---
# assemble-distribution-package

## Classification
- kind: operation
- domain: operations
- batch: 18
- approval: none
- mutates: yes
- capability-unavailable: no

## Purpose
Assembles the distribution package from linked assets and metadata.

## Invocation conditions
- A distribution package assembled is needed to continue the operation.
- The previous step produced a validated result that this step builds on.

## Required inputs
- The data: the validated Release.
- The validation results of the previous steps, bound to the data version.

## Procedure
1. Read the validated Release and the distributor requirements.
2. Assemble metadata and asset references in the package structure and compute the package hash.
3. Verify the distribution readiness result is current for this exact package.
4. Store the package proposal; do not send it.

## Expected outputs
- A package proposal with its hash and readiness result.

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
- Revert by deleting the package proposal through the guarded service; nothing was sent.

## Human approval
- Low-impact change inside the normal permissions of the requester: no separate human approval is needed; the guarded service and its audit trail apply.
