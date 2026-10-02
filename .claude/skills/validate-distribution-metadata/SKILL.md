---
name: validate-distribution-metadata
description: Checks metadata against the distributor requirements. Use when the metadata of a distribution package must be checked before the next operational step.
---
# validate-distribution-metadata

## Classification
- kind: validation
- domain: operations
- batch: 18
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Checks metadata against the distributor requirements.

## Invocation conditions
- The metadata of a distribution package must be checked before the next operational step.
- The record was created, edited, imported or delivered by a provider.

## Required inputs
- The current data: the package and the Release.
- The validation rules in the domain documents of the project.

## Procedure
1. Load the data and the related records by reference; never rely on a remembered copy.
2. Check titles, artists, labels, dates and territories against the Release.
3. Check ISRC and UPC format, check digits and uniqueness.
4. Check language and explicit content flags are set and consistent.
5. Return one outcome per rule with the values that were inspected; mark unknown or missing data as unknown.

## Expected outputs
- A result for the metadata of a distribution package with one outcome per rule and the values inspected.

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
