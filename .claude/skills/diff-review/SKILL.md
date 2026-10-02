---
name: diff-review
description: Reviews a diff against its stated scope and the repository conventions. Use when a diff must be verified before the next action.
---
# diff-review

## Classification
- kind: check
- domain: repository
- batch: 16
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Reviews a diff against its stated scope and the repository conventions.

## Invocation conditions
- A diff must be verified before the next action.
- A guard or gate requires the result of this check.

## Required inputs
- The planned action or the current repository state.
- The policy or rule that the check enforces.

## Procedure
1. Read the whole diff.
2. Map each hunk to a requirement or mark it unexplained.
3. Check leftover debug code, temporary files and unrelated formatting.
4. Check generated files changed only through their generators.

## Expected outputs
- A diff review with unexplained hunks listed.

## Validation
- The check answers a single question: does every hunk match the stated scope and the repository conventions?
- The result is derived from commands run now, not from memory or earlier output.

## Evidence
- Hunk references with their mapped requirement.

## Failure behavior
- If the diff is empty, report that explicitly.

## Rollback and recovery
- Read-only: nothing is changed, so there is nothing to roll back; rerun with the corrected scope if the scope was wrong.

## Human approval
- Read-only analysis: it reports and changes nothing, so no human approval is needed.
