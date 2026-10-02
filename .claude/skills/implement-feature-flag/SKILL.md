---
name: implement-feature-flag
description: Adds a feature flag with a default, an owner and a removal condition. Use when a planned task requires a feature flag with a default, an owner and a removal condition.
---
# implement-feature-flag

## Classification
- kind: implementation
- domain: quality
- batch: 16
- approval: none
- mutates: yes
- capability-unavailable: no

## Purpose
Adds a feature flag with a default, an owner and a removal condition.

## Invocation conditions
- A planned task requires a feature flag with a default, an owner and a removal condition.
- The requirement and the scope of writes are already fixed.

## Required inputs
- The task specification with its acceptance criteria and the locked write scope.
- The neighboring code that shows the existing pattern for a feature flag with a default, an owner and a removal condition.

## Procedure
1. Define the flag in configuration with a safe default.
2. Name the owner and the removal condition in the flag documentation.
3. Keep the flagged branches small and covered by tests for both values.
4. Add the flag to the flag inventory.

## Expected outputs
- The code for a feature flag with a default, an owner and a removal condition inside apps/api/src/core/config and the consuming module.
- The tests: tests for both flag values.

## Validation
- The tests pass: tests for both flag values.
- Constraints hold: default safe, owner and removal condition recorded.
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
