---
name: validate-phonogram-metadata
description: Checks the Phonogram metadata is complete and consistent. Use when the metadata of a Phonogram must be checked before the next operational step.
---
# validate-phonogram-metadata

## Classification
- kind: validation
- domain: operations
- batch: 18
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Checks the Phonogram metadata is complete and consistent.

## Invocation conditions
- The metadata of a Phonogram must be checked before the next operational step.
- The record was created, edited, imported or delivered by a provider.

## Required inputs
- The current data: the Phonogram record.
- The validation rules in the domain documents of the project.

## Procedure
1. Load the data and the related records by reference; never rely on a remembered copy.
2. Check title, version, duration and recording date are present and plausible.
3. Check the ISRC has a valid format and check digit and is not used by another Phonogram.
4. Check the link to the Work exists and that no composition data is stored on the Phonogram.
5. Return one outcome per rule with the values that were inspected; mark unknown or missing data as unknown.

## Expected outputs
- A result for the metadata of a Phonogram with one outcome per rule and the values inspected.

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
