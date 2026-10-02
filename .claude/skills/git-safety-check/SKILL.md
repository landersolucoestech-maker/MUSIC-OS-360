---
name: git-safety-check
description: Verifies no destructive or out-of-policy git operation is about to run. Use when the planned git operation must be verified before the next action.
---
# git-safety-check

## Classification
- kind: check
- domain: repository
- batch: 16
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Verifies no destructive or out-of-policy git operation is about to run.

## Invocation conditions
- The planned git operation must be verified before the next action.
- A guard or gate requires the result of this check.

## Required inputs
- The planned action or the current repository state.
- The policy or rule that the check enforces.

## Procedure
1. List the git operations planned in the next step.
2. Classify each as read, local write, history rewrite, force or publish.
3. Check the working tree for uncommitted work that the operation could discard.
4. Block and report operations that need explicit authorization that was not given.

## Expected outputs
- A git safety result per planned operation.

## Validation
- The check answers a single question: is any destructive or out-of-policy git operation about to run?
- The result is derived from commands run now, not from memory or earlier output.

## Evidence
- The planned commands and the status output used for the decision.

## Failure behavior
- If the operation set is unknown, report BLOCKED and do not run any git write.

## Rollback and recovery
- Read-only: nothing is changed, so there is nothing to roll back; rerun with the corrected scope if the scope was wrong.

## Human approval
- Read-only analysis: it reports and changes nothing, so no human approval is needed.
