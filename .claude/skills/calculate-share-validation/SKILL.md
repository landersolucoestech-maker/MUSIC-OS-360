---
name: calculate-share-validation
description: Computes share totals and reports inconsistencies without correcting them. Use when the arithmetic of a share set must be checked before the next operational step.
---
# calculate-share-validation

## Classification
- kind: calculation
- domain: operations
- batch: 18
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Computes share totals and reports inconsistencies without correcting them.

## Invocation conditions
- The arithmetic of a share set must be checked before the next operational step.
- The record was created, edited, imported or delivered by a provider.

## Required inputs
- The current data: the share rows.
- The validation rules in the domain documents of the project.

## Procedure
1. Load the data and the related records by reference; never rely on a remembered copy.
2. Read every share with its exact decimal value.
3. Sum with exact decimal arithmetic without floating point.
4. Report the total, the difference from one hundred percent and each row used.
5. Return one outcome per rule with the values that were inspected; mark unknown or missing data as unknown.

## Expected outputs
- A result for the arithmetic of a share set with one outcome per rule and the values inspected.

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
