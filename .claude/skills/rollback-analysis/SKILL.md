---
name: rollback-analysis
description: Determines how each part of a change can be undone. Use when the rollback of a change must be verified before the next action.
---
# rollback-analysis

## Classification
- kind: check
- domain: repository
- batch: 16
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Determines how each part of a change can be undone.

## Invocation conditions
- The rollback of a change must be verified before the next action.
- A guard or gate requires the result of this check.

## Required inputs
- The planned action or the current repository state.
- The policy or rule that the check enforces.

## Procedure
1. List the effects of the change by kind: code, schema, data, configuration, deployment and external.
2. Name the undo for each and who performs it.
3. Mark what a source revert cannot undo and name the compensating action.
4. Ask for restore evidence wherever data is involved.

## Expected outputs
- A rollback analysis per effect kind.

## Validation
- The check answers a single question: how can each part of the change be undone, and what cannot?
- The result is derived from commands run now, not from memory or earlier output.

## Evidence
- The effect list with undo references.

## Failure behavior
- If an effect has no undo, report it as irreversible and require approval.

## Rollback and recovery
- Read-only: nothing is changed, so there is nothing to roll back; rerun with the corrected scope if the scope was wrong.

## Human approval
- Read-only analysis: it reports and changes nothing, so no human approval is needed.
