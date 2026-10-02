---
name: implement-circuit-breaker
description: Adds a circuit breaker with a safe degraded mode. Use when a planned task requires a circuit breaker with a safe degraded mode.
---
# implement-circuit-breaker

## Classification
- kind: implementation
- domain: backend
- batch: 16
- approval: none
- mutates: yes
- capability-unavailable: no

## Purpose
Adds a circuit breaker with a safe degraded mode.

## Invocation conditions
- A planned task requires a circuit breaker with a safe degraded mode.
- The requirement and the scope of writes are already fixed.

## Required inputs
- The task specification with its acceptance criteria and the locked write scope.
- The neighboring code that shows the existing pattern for a circuit breaker with a safe degraded mode.

## Procedure
1. Use the shared breaker registry and scope the breaker per dependency.
2. Set the failure threshold, reset time and half-open probe limits.
3. Define the degraded response so it never fabricates data and is visible to the user.
4. Test open, half-open and close transitions.

## Expected outputs
- The code for a circuit breaker with a safe degraded mode inside apps/api/src/core/resilience.
- The tests: tests for open, half-open and close transitions.

## Validation
- The tests pass: tests for open, half-open and close transitions.
- Constraints hold: per-dependency scope, honest degraded mode, visible state.
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
