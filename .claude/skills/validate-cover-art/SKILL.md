---
name: validate-cover-art
description: Checks cover art against the distribution requirements. Use when the cover art of a Release must be checked before the next operational step.
---
# validate-cover-art

## Classification
- kind: validation
- domain: operations
- batch: 18
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Checks cover art against the distribution requirements.

## Invocation conditions
- The cover art of a Release must be checked before the next operational step.
- The record was created, edited, imported or delivered by a provider.

## Required inputs
- The current data: the cover art file and the specification.
- The validation rules in the domain documents of the project.

## Procedure
1. Load the data and the related records by reference; never rely on a remembered copy.
2. Check dimensions, aspect ratio, color mode and file type against the specification.
3. Check resolution is sufficient and the file is not upscaled.
4. Check the file hash matches the registered asset.
5. Return one outcome per rule with the values that were inspected; mark unknown or missing data as unknown.

## Expected outputs
- A result for the cover art of a Release with one outcome per rule and the values inspected.

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
