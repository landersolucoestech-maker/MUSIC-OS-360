---
name: handle-provider-failure
description: Classifies a provider failure and picks the safe response. Use when a provider failure classified must be checked before the next operational step.
---
# handle-provider-failure

## Classification
- kind: classification
- domain: operations
- batch: 18
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Classifies a provider failure and picks the safe response.

## Invocation conditions
- A provider failure classified must be checked before the next operational step.
- The record was created, edited, imported or delivered by a provider.

## Required inputs
- The current data: the failed call record.
- The validation rules in the domain documents of the project.

## Procedure
1. Load the data and the related records by reference; never rely on a remembered copy.
2. Read the error, status and timing of the failed call.
3. Classify it as configuration, authentication, throttling, outage, data or unknown.
4. Recommend the next action for the class and say whether a retry is safe.
5. Return one outcome per rule with the values that were inspected; mark unknown or missing data as unknown.

## Expected outputs
- A result for a provider failure classified with one outcome per rule and the values inspected.

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
