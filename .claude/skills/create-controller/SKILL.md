---
name: create-controller
description: Creates a controller with DTOs, guards and documented responses. Use when a planned task requires a controller with DTOs, guards and documented responses.
---
# create-controller

## Classification
- kind: implementation
- domain: backend
- batch: 16
- approval: none
- mutates: yes
- capability-unavailable: no

## Purpose
Creates a controller with DTOs, guards and documented responses.

## Invocation conditions
- A planned task requires a controller with DTOs, guards and documented responses.
- The requirement and the scope of writes are already fixed.

## Required inputs
- The task specification with its acceptance criteria and the locked write scope.
- The neighboring code that shows the existing pattern for a controller with DTOs, guards and documented responses.

## Procedure
1. Define request and response DTOs with whitelist validation.
2. Apply authentication, permission and tenant guards per route.
3. Keep the controller thin: call one service method and map the result.
4. Write request-level tests for success, validation errors and denial.

## Expected outputs
- The code for a controller with DTOs, guards and documented responses inside apps/api/src/modules.
- The tests: request tests for success, invalid input and denial.

## Validation
- The tests pass: request tests for success, invalid input and denial.
- Constraints hold: thin controller, guards on every route, documented responses.
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
