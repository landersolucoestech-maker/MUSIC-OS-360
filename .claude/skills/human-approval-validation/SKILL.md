---
name: human-approval-validation
description: Validates that every high-impact action has a granted approval. Use when human approval gates must be verified before the next action.
---
# human-approval-validation

## Classification
- kind: check
- domain: ai-engineering
- batch: 17
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Validates that every high-impact action has a granted approval.

## Invocation conditions
- Human approval gates must be verified before the next action.
- A guard or gate requires the result of this check.

## Required inputs
- The planned action or the current repository state.
- The policy or rule that the check enforces.

## Procedure
1. List the actions the AI can trigger and classify their impact.
2. Check each high-impact action requires an approval request and a named approver.
3. Search for alternate paths such as retries, jobs and direct calls that skip the gate.
4. Check an approval is bound to the payload hash and cannot be reused.

## Expected outputs
- A gate coverage result per action with bypass attempts.

## Validation
- The check answers a single question: does every high-impact AI action require a recorded human decision bound to its exact payload?
- The result is derived from commands run now, not from memory or earlier output.

## Evidence
- Action and gate references with the bypass search results.

## Failure behavior
- If a path to a high-impact action has no gate, report it as a blocking finding.

## Rollback and recovery
- Read-only: nothing is changed, so there is nothing to roll back; rerun with the corrected scope if the scope was wrong.

## Human approval
- Read-only analysis: it reports and changes nothing, so no human approval is needed.
