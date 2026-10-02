---
name: destructive-change-check
description: Detects destructive data or git operations before they run. Use when destructive operations must be verified before the next action.
---
# destructive-change-check

## Classification
- kind: check
- domain: repository
- batch: 16
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Detects destructive data or git operations before they run.

## Invocation conditions
- Destructive operations must be verified before the next action.
- A guard or gate requires the result of this check.

## Required inputs
- The planned action or the current repository state.
- The policy or rule that the check enforces.

## Procedure
1. List planned deletions, resets, drops, truncates and force operations in code, migrations and commands.
2. Classify each as reversible or irreversible and name the recovery path.
3. Check each has explicit authorization and a recovery plan.
4. Block operations without them.

## Expected outputs
- A destructive change result per operation with recovery path and authorization status.

## Validation
- The check answers a single question: does the planned work delete data, files or history?
- The result is derived from commands run now, not from memory or earlier output.

## Evidence
- The operation list with authorization record references.

## Failure behavior
- If an operation cannot be classified, treat it as destructive and report BLOCKED.

## Rollback and recovery
- Read-only: nothing is changed, so there is nothing to roll back; rerun with the corrected scope if the scope was wrong.

## Human approval
- Read-only analysis: it reports and changes nothing, so no human approval is needed.
