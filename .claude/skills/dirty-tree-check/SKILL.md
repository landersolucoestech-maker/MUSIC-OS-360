---
name: dirty-tree-check
description: Classifies preexisting uncommitted work before any write. Use when pre-existing uncommitted work must be verified before the next action.
---
# dirty-tree-check

## Classification
- kind: check
- domain: repository
- batch: 16
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Classifies preexisting uncommitted work before any write.

## Invocation conditions
- Pre-existing uncommitted work must be verified before the next action.
- A guard or gate requires the result of this check.

## Required inputs
- The planned action or the current repository state.
- The policy or rule that the check enforces.

## Procedure
1. Read git status including untracked files.
2. Save the content hash of each dirty file as the baseline.
3. Classify each as pre-existing or expected from the mission.
4. Report files that a planned command could discard.

## Expected outputs
- A baseline of dirty files with their hashes and classification.

## Validation
- The check answers a single question: which uncommitted changes exist before any write?
- The result is derived from commands run now, not from memory or earlier output.

## Evidence
- Status output and the baseline hash list.

## Failure behavior
- If status cannot be read, report BLOCKED and perform no write.

## Rollback and recovery
- Read-only: nothing is changed, so there is nothing to roll back; rerun with the corrected scope if the scope was wrong.

## Human approval
- Read-only analysis: it reports and changes nothing, so no human approval is needed.
