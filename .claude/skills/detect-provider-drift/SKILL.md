---
name: detect-provider-drift
description: Detects provider data that changed since the last sync. Use when drift between a provider and the internal data over time must be checked before the next operational step.
---
# detect-provider-drift

## Classification
- kind: detection
- domain: operations
- batch: 18
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Detects provider data that changed since the last sync.

## Invocation conditions
- Drift between a provider and the internal data over time must be checked before the next operational step.
- The record was created, edited, imported or delivered by a provider.

## Required inputs
- The current data: the provider snapshots and the internal records.
- The validation rules in the domain documents of the project.

## Procedure
1. Load the data and the related records by reference; never rely on a remembered copy.
2. Compare the latest provider snapshot with the previous one and with internal values.
3. List fields that changed at the provider without an internal change.
4. Report the size and age of each drift.
5. Return one outcome per rule with the values that were inspected; mark unknown or missing data as unknown.

## Expected outputs
- A result for drift between a provider and the internal data over time with one outcome per rule and the values inspected.

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
