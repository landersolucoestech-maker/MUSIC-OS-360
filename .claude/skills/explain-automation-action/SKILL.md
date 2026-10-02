---
name: explain-automation-action
description: Explains an automation action in plain language with its evidence. Use when a plain-language explanation of an automation action must be checked before the next operational step.
---
# explain-automation-action

## Classification
- kind: explanation
- domain: operations
- batch: 18
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Explains an automation action in plain language with its evidence.

## Invocation conditions
- A plain-language explanation of an automation action must be checked before the next operational step.
- The record was created, edited, imported or delivered by a provider.

## Required inputs
- The current data: the action record.
- The validation rules in the domain documents of the project.

## Procedure
1. Load the data and the related records by reference; never rely on a remembered copy.
2. Read the action, its inputs and its outcome.
3. Explain in the product language what happened and why, without internal identifiers.
4. State what is unknown instead of filling the gap.
5. Return one outcome per rule with the values that were inspected; mark unknown or missing data as unknown.

## Expected outputs
- A result for a plain-language explanation of an automation action with one outcome per rule and the values inspected.

## Validation
- Every rule has a recorded outcome: pass, fail or unknown.
- Unknown or missing data produces unknown, never pass.

## Evidence
- Per-rule outcomes with the field values inspected and the data version.

## Failure behavior
- If a required record cannot be read, return BLOCKED with the missing record and never PASS.
- Report violations as they are; repairs belong to a separate approved skill.

## Rollback and recovery
- Read-only: nothing is changed, so there is nothing to roll back; rerun with the corrected scope if the scope was wrong.

## Human approval
- Read-only analysis: it reports and changes nothing, so no human approval is needed.
