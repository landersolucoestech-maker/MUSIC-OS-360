---
name: external-action-check
description: Detects actions that reach outside the repository and requires approval. Use when actions that reach outside the repository must be verified before the next action.
---
# external-action-check

## Classification
- kind: check
- domain: repository
- batch: 16
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Detects actions that reach outside the repository and requires approval.

## Invocation conditions
- Actions that reach outside the repository must be verified before the next action.
- A guard or gate requires the result of this check.

## Required inputs
- The planned action or the current repository state.
- The policy or rule that the check enforces.

## Procedure
1. List steps that call external services, send messages, publish artifacts or change infrastructure.
2. Classify each by the action classes of the authority policy.
3. Check each requiring approval has a recorded one bound to the exact action.
4. Block unapproved external actions.

## Expected outputs
- An external action result per step with its class and approval status.

## Validation
- The check answers a single question: will any step send, publish or call something external?
- The result is derived from commands run now, not from memory or earlier output.

## Evidence
- The step list with approval record references.

## Failure behavior
- If a step reaches an unknown target, treat it as external and require approval.

## Rollback and recovery
- Read-only: nothing is changed, so there is nothing to roll back; rerun with the corrected scope if the scope was wrong.

## Human approval
- Read-only analysis: it reports and changes nothing, so no human approval is needed.
