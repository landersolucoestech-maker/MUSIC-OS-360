---
name: resolve-external-id
description: Resolves a provider identifier without confusing namespaces. Use when which internal entity an external identifier belongs to must be checked before the next operational step.
---
# resolve-external-id

## Classification
- kind: resolution
- domain: operations
- batch: 18
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Resolves a provider identifier without confusing namespaces.

## Invocation conditions
- Which internal entity an external identifier belongs to must be checked before the next operational step.
- The record was created, edited, imported or delivered by a provider.

## Required inputs
- The current data: the identifier and the candidate entities.
- The validation rules in the domain documents of the project.

## Procedure
1. Load the data and the related records by reference; never rely on a remembered copy.
2. Validate the identifier format before any lookup.
3. Find candidate entities holding the same identifier and require proof of ownership for the link.
4. Return the single proven entity, or ambiguity with the candidates, and never link by name similarity.
5. Return one outcome per rule with the values that were inspected; mark unknown or missing data as unknown.

## Expected outputs
- A result for which internal entity an external identifier belongs to with one outcome per rule and the values inspected.

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
