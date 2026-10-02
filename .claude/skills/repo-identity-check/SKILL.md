---
name: repo-identity-check
description: Confirms repository identity, remote and branch before any write. Use when the repository identity must be verified before the next action.
---
# repo-identity-check

## Classification
- kind: check
- domain: repository
- batch: 16
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Confirms repository identity, remote and branch before any write.

## Invocation conditions
- The repository identity must be verified before the next action.
- A guard or gate requires the result of this check.

## Required inputs
- The planned action or the current repository state.
- The policy or rule that the check enforces.

## Procedure
1. Read the remote URL and compare it with the declared repository.
2. Read the root manifest name and the workspace layout and compare them with the declared project.
3. Read the current branch and compare it with the branch policy.
4. Report any mismatch and stop; do not continue to writes.

## Expected outputs
- An identity result with remote, manifest name and branch compared with the declaration.

## Validation
- The check answers a single question: is this the intended repository, remote and branch?
- The result is derived from commands run now, not from memory or earlier output.

## Evidence
- The command output for remote, manifest name and branch.

## Failure behavior
- If identity is ambiguous, report BLOCKED and ask for the declaration, never assume.

## Rollback and recovery
- Read-only: nothing is changed, so there is nothing to roll back; rerun with the corrected scope if the scope was wrong.

## Human approval
- Read-only analysis: it reports and changes nothing, so no human approval is needed.
