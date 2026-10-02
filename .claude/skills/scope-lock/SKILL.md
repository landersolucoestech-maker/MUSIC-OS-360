---
name: scope-lock
description: Freezes the set of paths a change may touch and flags anything outside it. Use when the scope lock of a change must be verified before the next action.
---
# scope-lock

## Classification
- kind: check
- domain: repository
- batch: 16
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Freezes the set of paths a change may touch and flags anything outside it.

## Invocation conditions
- The scope lock of a change must be verified before the next action.
- A guard or gate requires the result of this check.

## Required inputs
- The planned action or the current repository state.
- The policy or rule that the check enforces.

## Procedure
1. Read the locked path set from the task specification.
2. List the files changed since the baseline.
3. Compare each changed file with the locked set and with the pre-existing dirty files.
4. Report files outside the set with their writer.

## Expected outputs
- A scope lock result with files in scope, pre-existing and outside scope.

## Validation
- The check answers a single question: is every touched path inside the locked scope?
- The result is derived from commands run now, not from memory or earlier output.

## Evidence
- The changed file list and the locked set.

## Failure behavior
- If the baseline is missing, report BLOCKED because pre-existing changes cannot be told apart.

## Rollback and recovery
- Read-only: nothing is changed, so there is nothing to roll back; rerun with the corrected scope if the scope was wrong.

## Human approval
- Read-only analysis: it reports and changes nothing, so no human approval is needed.
