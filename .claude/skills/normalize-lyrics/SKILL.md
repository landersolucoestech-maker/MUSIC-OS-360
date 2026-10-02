---
name: normalize-lyrics
description: Normalizes lyrics text without changing its content. Use when the normalized form of lyrics must be checked before the next operational step.
---
# normalize-lyrics

## Classification
- kind: extraction
- domain: operations
- batch: 18
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Normalizes lyrics text without changing its content.

## Invocation conditions
- The normalized form of lyrics must be checked before the next operational step.
- The record was created, edited, imported or delivered by a provider.

## Required inputs
- The current data: the original lyrics text.
- The validation rules in the domain documents of the project.

## Procedure
1. Load the data and the related records by reference; never rely on a remembered copy.
2. Normalize whitespace, line endings and trailing spaces only.
3. Keep every word and line break that carries structure, such as stanza gaps.
4. Return the normalized text next to the original and the list of changes made.
5. Return one outcome per rule with the values that were inspected; mark unknown or missing data as unknown.

## Expected outputs
- A result for the normalized form of lyrics with one outcome per rule and the values inspected.

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
