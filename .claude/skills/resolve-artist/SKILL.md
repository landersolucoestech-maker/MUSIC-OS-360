---
name: resolve-artist
description: Resolves an artist by artistic or civil name with a confidence level. Use when which existing artist an incoming name refers to must be checked before the next operational step.
---
# resolve-artist

## Classification
- kind: resolution
- domain: operations
- batch: 18
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Resolves an artist by artistic or civil name with a confidence level.

## Invocation conditions
- Which existing artist an incoming name refers to must be checked before the next operational step.
- The record was created, edited, imported or delivered by a provider.

## Required inputs
- The current data: the incoming name and the artist records.
- The validation rules in the domain documents of the project.

## Procedure
1. Load the data and the related records by reference; never rely on a remembered copy.
2. Match by external identifiers first and by normalized name only as a weak signal.
3. Return the single proven match or the list of candidates with evidence.
4. Return unresolved when evidence is insufficient instead of choosing.
5. Return one outcome per rule with the values that were inspected; mark unknown or missing data as unknown.

## Expected outputs
- A result for which existing artist an incoming name refers to with one outcome per rule and the values inspected.

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
