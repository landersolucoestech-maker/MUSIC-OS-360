---
name: detect-share-conflict
description: Finds conflicting share declarations. Use when conflicts between shares and their sources must be checked before the next operational step.
---
# detect-share-conflict

## Classification
- kind: detection
- domain: operations
- batch: 18
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Finds conflicting share declarations.

## Invocation conditions
- Conflicts between shares and their sources must be checked before the next operational step.
- The record was created, edited, imported or delivered by a provider.

## Required inputs
- The current data: the shares, contracts and participants.
- The validation rules in the domain documents of the project.

## Procedure
1. Load the data and the related records by reference; never rely on a remembered copy.
2. Compare shares with the contracts and assignments that define them.
3. Find shares for participants that are merged, missing or not part of the entity.
4. Find two different share sets claiming the same right.
5. Return one outcome per rule with the values that were inspected; mark unknown or missing data as unknown.

## Expected outputs
- A result for conflicts between shares and their sources with one outcome per rule and the values inspected.

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
