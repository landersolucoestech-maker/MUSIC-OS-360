---
name: process-distribution-rejection
description: Records the distributor rejection reason verbatim. Use when a distributor rejection classified must be checked before the next operational step.
---
# process-distribution-rejection

## Classification
- kind: classification
- domain: operations
- batch: 18
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Records the distributor rejection reason verbatim.

## Invocation conditions
- A distributor rejection classified must be checked before the next operational step.
- The record was created, edited, imported or delivered by a provider.

## Required inputs
- The current data: the rejection record and the submission.
- The validation rules in the domain documents of the project.

## Procedure
1. Load the data and the related records by reference; never rely on a remembered copy.
2. Read each stated reason of the rejection.
3. Classify each as metadata, asset, rights or identifier and map it to the field or file to correct.
4. List reasons that cannot be mapped for human review.
5. Return one outcome per rule with the values that were inspected; mark unknown or missing data as unknown.

## Expected outputs
- A result for a distributor rejection classified with one outcome per rule and the values inspected.

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
