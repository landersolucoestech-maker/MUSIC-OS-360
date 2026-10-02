---
name: detect-metadata-conflict
description: Finds conflicting metadata across entities. Use when conflicting metadata between sources must be checked before the next operational step.
---
# detect-metadata-conflict

## Classification
- kind: detection
- domain: operations
- batch: 18
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Finds conflicting metadata across entities.

## Invocation conditions
- Conflicting metadata between sources must be checked before the next operational step.
- The record was created, edited, imported or delivered by a provider.

## Required inputs
- The current data: the metadata of each source.
- The validation rules in the domain documents of the project.

## Procedure
1. Load the data and the related records by reference; never rely on a remembered copy.
2. Compare metadata values of the same entity across internal and provider sources.
3. Keep each conflicting value with its source and time.
4. Report the conflicts for review without choosing a value.
5. Return one outcome per rule with the values that were inspected; mark unknown or missing data as unknown.

## Expected outputs
- A result for conflicting metadata between sources with one outcome per rule and the values inspected.

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
