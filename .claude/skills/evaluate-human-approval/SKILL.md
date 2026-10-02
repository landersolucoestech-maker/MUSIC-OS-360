---
name: evaluate-human-approval
description: Decides whether an action needs human approval and of which class. Use when whether an action needs human approval must be checked before the next operational step.
---
# evaluate-human-approval

## Classification
- kind: evaluation
- domain: operations
- batch: 18
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Decides whether an action needs human approval and of which class.

## Invocation conditions
- Whether an action needs human approval must be checked before the next operational step.
- The record was created, edited, imported or delivered by a provider.

## Required inputs
- The current data: the proposed action and the authority policy.
- The validation rules in the domain documents of the project.

## Procedure
1. Load the data and the related records by reference; never rely on a remembered copy.
2. Classify the action against the approval classes of the authority policy.
3. Decide whether approval is required and of which class.
4. Check an existing approval is bound to this exact payload and still valid.
5. Return one outcome per rule with the values that were inspected; mark unknown or missing data as unknown.

## Expected outputs
- A result for whether an action needs human approval with one outcome per rule and the values inspected.

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
