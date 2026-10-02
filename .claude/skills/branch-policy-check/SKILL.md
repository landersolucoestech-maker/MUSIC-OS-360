---
name: branch-policy-check
description: Checks the current branch and push target against the repository branch policy. Use when the branch and push target must be verified before the next action.
---
# branch-policy-check

## Classification
- kind: check
- domain: repository
- batch: 16
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Checks the current branch and push target against the repository branch policy.

## Invocation conditions
- The branch and push target must be verified before the next action.
- A guard or gate requires the result of this check.

## Required inputs
- The planned action or the current repository state.
- The policy or rule that the check enforces.

## Procedure
1. Read the branch policy document of the repository.
2. Read the current branch, the upstream and the list of local and remote branches.
3. Compare each with the policy and list violations.
4. Report the command that would resolve a violation without running it.

## Expected outputs
- A branch policy result listing compliant and violating items.

## Validation
- The check answers a single question: does the current branch and push target comply with the branch policy?
- The result is derived from commands run now, not from memory or earlier output.

## Evidence
- Branch and upstream listing output.

## Failure behavior
- If the policy document cannot be read, report BLOCKED rather than assuming a default.

## Rollback and recovery
- Read-only: nothing is changed, so there is nothing to roll back; rerun with the corrected scope if the scope was wrong.

## Human approval
- Read-only analysis: it reports and changes nothing, so no human approval is needed.
