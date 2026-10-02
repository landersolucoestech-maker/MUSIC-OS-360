---
name: validate-import
description: Validates an import file against the target schema. Use when a staged import batch must be checked before the next operational step.
---
# validate-import

## Classification
- kind: validation
- domain: operations
- batch: 18
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Validates an import file against the target schema.

## Invocation conditions
- A staged import batch must be checked before the next operational step.
- The record was created, edited, imported or delivered by a provider.

## Required inputs
- The current data: the staging batch and the target entity rules.
- The validation rules in the domain documents of the project.

## Procedure
1. Load the data and the related records by reference; never rely on a remembered copy.
2. Validate every row against the target entity rules before anything is written.
3. Report row-level errors in the product language with the row number and the field.
4. Count valid, invalid and duplicate rows.
5. Return one outcome per rule with the values that were inspected; mark unknown or missing data as unknown.

## Expected outputs
- A result for a staged import batch with one outcome per rule and the values inspected.

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
