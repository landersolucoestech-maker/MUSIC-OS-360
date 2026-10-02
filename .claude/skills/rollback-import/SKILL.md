---
name: rollback-import
description: Reverts an import from its recorded before state. Use when an applied import must be undone because it was wrong.
---
# rollback-import

## Classification
- kind: high-impact-operation
- domain: operations
- batch: 18
- approval: bulk-data-change
- mutates: yes
- capability-unavailable: no

## Purpose
Reverts an import from its recorded before state.

## Invocation conditions
- An applied import must be undone because it was wrong.

## Required inputs
- The import result record and its rollback information.

## Procedure
1. Read the rollback information and check later changes to the same records.
2. Create the approval request describing what will be restored and what later edits would be lost, and stop.
3. After the recorded approval restore the records through the guarded service.
4. Verify the restored state equals the recorded pre-import state for the untouched records.

## Expected outputs
- An approval request and, after approval, restored records with a verification result.

## Validation
- Restored records equal their pre-import state unless a later edit was explicitly kept.

## Evidence
- The approval record and the verification comparison.

## Failure behavior
- If later edits conflict with the restore, stop and ask for a decision per record.

## Rollback and recovery
- Re-apply the original import from its approved preview if the rollback itself was wrong.

## Human approval
- Restoring live data can discard later edits: a named human approver must approve the exact restore set.
