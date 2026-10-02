---
name: validate-share-total
description: Checks that shares sum as the rule requires. Use when whether shares total one hundred percent per right type must be checked before the next operational step.
---
# validate-share-total

## Classification
- kind: validation
- domain: operations
- batch: 18
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Checks that shares sum as the rule requires.

## Invocation conditions
- Whether shares total one hundred percent per right type must be checked before the next operational step.
- The record was created, edited, imported or delivered by a provider.

## Required inputs
- The current data: the share rows of the Work or Phonogram.
- The validation rules in the domain documents of the project.

## Procedure
1. Load the data and the related records by reference; never rely on a remembered copy.
2. Group the shares by right type: composition and master separately.
3. Require each group to total exactly one hundred percent.
4. Report groups that do not, with the difference and the rows.
5. Return one outcome per rule with the values that were inspected; mark unknown or missing data as unknown.

## Expected outputs
- A result for whether shares total one hundred percent per right type with one outcome per rule and the values inspected.

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
