---
name: staged-diff-review
description: Reviews exactly what is staged before a commit. Use when the staged content must be verified before the next action.
---
# staged-diff-review

## Classification
- kind: check
- domain: repository
- batch: 16
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Reviews exactly what is staged before a commit.

## Invocation conditions
- The staged content must be verified before the next action.
- A guard or gate requires the result of this check.

## Required inputs
- The planned action or the current repository state.
- The policy or rule that the check enforces.

## Procedure
1. Read the staged diff, not the working diff.
2. Compare staged files with the validated change set.
3. Search staged content for secrets and environment files.
4. Report unrelated or unvalidated files.

## Expected outputs
- A staged diff result with each file classified.

## Validation
- The check answers a single question: is exactly the validated change staged and nothing else?
- The result is derived from commands run now, not from memory or earlier output.

## Evidence
- Staged file list and diff stat.

## Failure behavior
- If nothing is staged, report that explicitly.

## Rollback and recovery
- Read-only: nothing is changed, so there is nothing to roll back; rerun with the corrected scope if the scope was wrong.

## Human approval
- Read-only analysis: it reports and changes nothing, so no human approval is needed.
