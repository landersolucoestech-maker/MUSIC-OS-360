---
name: execute-approved-import
description: Executes an import only after the preview was approved. Use when a preview was approved by a human and the import must be applied.
---
# execute-approved-import

## Classification
- kind: high-impact-operation
- domain: operations
- batch: 18
- approval: bulk-data-change
- mutates: yes
- capability-unavailable: no

## Purpose
Executes an import only after the preview was approved.

## Invocation conditions
- A preview was approved by a human and the import must be applied.

## Required inputs
- The approved preview with its hash and the approval record.
- The staging batch.

## Procedure
1. Verify the approval is recorded and its hash equals the current preview hash.
2. Apply only the changes of the approved preview through the guarded service in a transaction per batch.
3. Record the rollback information of every changed record.
4. Verify the counts after the run equal the preview and record the result.

## Expected outputs
- The applied changes, a rollback information set and a result record.

## Validation
- The applied counts equal the approved preview.
- Nothing outside the preview was written.

## Evidence
- The approval record, the preview hash, the counts and the rollback information reference.

## Failure behavior
- If the hash differs or the data changed since the preview, stop and request a new preview and approval.
- If a batch fails, roll back that batch and report.

## Rollback and recovery
- Run the import rollback skill with the recorded rollback information to restore every changed record.

## Human approval
- A bulk change to live data needs a named human approver who approved this exact preview hash.
