---
name: implement-observability
description: Adds logs, metrics and traces with correlation ids and no secrets. Use when a planned task requires logs, metrics and traces with correlation ids and no secrets.
---
# implement-observability

## Classification
- kind: implementation
- domain: reliability
- batch: 16
- approval: none
- mutates: yes
- capability-unavailable: no

## Purpose
Adds logs, metrics and traces with correlation ids and no secrets.

## Invocation conditions
- A planned task requires logs, metrics and traces with correlation ids and no secrets.
- The requirement and the scope of writes are already fixed.

## Required inputs
- The task specification with its acceptance criteria and the locked write scope.
- The neighboring code that shows the existing pattern for logs, metrics and traces with correlation ids and no secrets.

## Procedure
1. Use the existing logger, metrics service and correlation middleware.
2. Log structured events with correlation id, tenant and outcome.
3. Add rate, error and duration metrics for the critical operation with bounded labels.
4. Test that telemetry carries the fields and no secret or personal value.

## Expected outputs
- The code for logs, metrics and traces with correlation ids and no secrets inside apps/api/src/core/metrics, apps/api/src/core/middleware and the module.
- The tests: telemetry tests with sensitive value absence assertions.

## Validation
- The tests pass: telemetry tests with sensitive value absence assertions.
- Constraints hold: bounded labels, no secrets, correlation present.
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
