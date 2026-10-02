---
name: implement-form
description: Implements a form with validation, error states and optimistic concurrency. Use when a planned task requires a form with validation, error states and optimistic concurrency.
---
# implement-form

## Classification
- kind: implementation
- domain: frontend
- batch: 16
- approval: none
- mutates: yes
- capability-unavailable: no

## Purpose
Implements a form with validation, error states and optimistic concurrency.

## Invocation conditions
- A planned task requires a form with validation, error states and optimistic concurrency.
- The requirement and the scope of writes are already fixed.

## Required inputs
- The task specification with its acceptance criteria and the locked write scope.
- The neighboring code that shows the existing pattern for a form with validation, error states and optimistic concurrency.

## Procedure
1. Define the schema once and share it between validation and types.
2. Show per-field errors from client validation and from the server response in the product language.
3. Guard double submit, handle the dirty state and carry the version for edit forms.
4. Test invalid input, server errors and a version conflict.

## Expected outputs
- The code for a form with validation, error states and optimistic concurrency inside apps/web/src/modules.
- The tests: form tests with invalid input, server errors and conflict.

## Validation
- The tests pass: form tests with invalid input, server errors and conflict.
- Constraints hold: schema mirrors the server rules, humanized messages, no raw codes.
- No file outside the locked scope changed.

## Evidence
- Test output and the change-set record.
- The diff limited to the write scope.

## Failure behavior
- If a constraint cannot be satisfied inside the scope, stop and report to the orchestrator instead of widening the scope.
- If a test fails twice with the same cause, stop and change the root cause analysis instead of retrying.

## Rollback and recovery
- Revert the changed files with the version control history of the change; the change produced no data or external effects.

## Human approval
- Local code change inside the locked scope: no human approval is needed to write it; review and the normal approval policy apply before anything is merged or deployed.
