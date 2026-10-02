---
name: reconcile-external-identifiers
description: Reconciles internal and provider identifiers and reports conflicts. Use when the identifier sets of two sources must be checked before the next operational step.
---
# reconcile-external-identifiers

## Classification
- kind: comparison
- domain: operations
- batch: 18
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Reconciles internal and provider identifiers and reports conflicts.

## Invocation conditions
- The identifier sets of two sources must be checked before the next operational step.
- The record was created, edited, imported or delivered by a provider.

## Required inputs
- The current data: the identifier sets of both sources.
- The validation rules in the domain documents of the project.

## Procedure
1. Load the data and the related records by reference; never rely on a remembered copy.
2. Load the identifier sets of both sources for the same entities.
3. List identifiers present in one and missing or different in the other.
4. Classify each difference as stale, conflicting or unknown with evidence.
5. Return one outcome per rule with the values that were inspected; mark unknown or missing data as unknown.

## Expected outputs
- A result for the identifier sets of two sources with one outcome per rule and the values inspected.

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
