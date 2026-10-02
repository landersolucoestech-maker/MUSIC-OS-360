---
name: create-use-case
description: Creates one use case with explicit inputs, rules and outputs. Use when a planned task requires one use case with explicit inputs, rules and outputs.
---
# create-use-case

## Classification
- kind: implementation
- domain: backend
- batch: 16
- approval: none
- mutates: yes
- capability-unavailable: no

## Purpose
Creates one use case with explicit inputs, rules and outputs.

## Invocation conditions
- A planned task requires one use case with explicit inputs, rules and outputs.
- The requirement and the scope of writes are already fixed.

## Required inputs
- The task specification with its acceptance criteria and the locked write scope.
- The neighboring code that shows the existing pattern for one use case with explicit inputs, rules and outputs.

## Procedure
1. Name the use case by the business action and define its input and output types.
2. Write the rules in order: authorization, validation, state checks, effect.
3. Return a typed result and typed errors instead of throwing generic errors.
4. Test each rule branch including the denied and invalid cases.

## Expected outputs
- The code for one use case with explicit inputs, rules and outputs inside apps/api/src/modules.
- The tests: unit tests per rule branch.

## Validation
- The tests pass: unit tests per rule branch.
- Constraints hold: single responsibility, typed result, no framework types inside the rules.
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
