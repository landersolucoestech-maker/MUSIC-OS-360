---
name: protected-file-check
description: Blocks edits to protected files without explicit authorization. Use when edits to protected files must be verified before the next action.
---
# protected-file-check

## Classification
- kind: check
- domain: repository
- batch: 16
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Blocks edits to protected files without explicit authorization.

## Invocation conditions
- Edits to protected files must be verified before the next action.
- A guard or gate requires the result of this check.

## Required inputs
- The planned action or the current repository state.
- The policy or rule that the check enforces.

## Procedure
1. Read the protected file patterns of the project rules.
2. List changed and untracked files and match them against the patterns.
3. Look for authorization records for each match.
4. Report matches without an authorization record and never print file contents of secret-bearing files.

## Expected outputs
- A protected file result with each match and its authorization status.

## Validation
- The check answers a single question: was any protected file modified without authorization?
- The result is derived from commands run now, not from memory or earlier output.

## Evidence
- Matched file names and authorization record references.

## Failure behavior
- If the pattern list cannot be read, report BLOCKED.

## Rollback and recovery
- Read-only: nothing is changed, so there is nothing to roll back; rerun with the corrected scope if the scope was wrong.

## Human approval
- Read-only analysis: it reports and changes nothing, so no human approval is needed.
