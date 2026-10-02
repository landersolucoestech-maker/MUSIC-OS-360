---
name: tool-policy-validation
description: Validates that an agent only uses tools its policy allows. Use when the tool policy of an agent must be verified before the next action.
---
# tool-policy-validation

## Classification
- kind: check
- domain: ai-engineering
- batch: 17
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Validates that an agent only uses tools its policy allows.

## Invocation conditions
- The tool policy of an agent must be verified before the next action.
- A guard or gate requires the result of this check.

## Required inputs
- The planned action or the current repository state.
- The policy or rule that the check enforces.

## Procedure
1. List the tools the agent can call.
2. Find the policy entry and the enforcement point in code for each tool.
3. Check argument constraints, rate limits and approval classes.
4. Check unknown tools are denied.

## Expected outputs
- A policy coverage result per tool.

## Validation
- The check answers a single question: is every tool of the agent covered by an enforced policy?
- The result is derived from commands run now, not from memory or earlier output.

## Evidence
- Policy entry and enforcement references per tool.

## Failure behavior
- If an enforcement point cannot be found, report the tool as unprotected.

## Rollback and recovery
- Read-only: nothing is changed, so there is nothing to roll back; rerun with the corrected scope if the scope was wrong.

## Human approval
- Read-only analysis: it reports and changes nothing, so no human approval is needed.
