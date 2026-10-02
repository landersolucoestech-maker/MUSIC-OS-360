---
name: select-contract-template
description: Chooses the template for a Work, Phonogram or Distribution contract. Use when the contract template for a request must be checked before the next operational step.
---
# select-contract-template

## Classification
- kind: selection
- domain: operations
- batch: 18
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Chooses the template for a Work, Phonogram or Distribution contract.

## Invocation conditions
- The contract template for a request must be checked before the next operational step.
- The record was created, edited, imported or delivered by a provider.

## Required inputs
- The current data: the request and the template catalog.
- The validation rules in the domain documents of the project.

## Procedure
1. Load the data and the related records by reference; never rely on a remembered copy.
2. Determine the contract type from the request and the parties.
3. Select the template that matches type, language and jurisdiction wording the project provides.
4. Report when no template fits instead of choosing the closest one.
5. Return one outcome per rule with the values that were inspected; mark unknown or missing data as unknown.

## Expected outputs
- A result for the contract template for a request with one outcome per rule and the values inspected.

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
