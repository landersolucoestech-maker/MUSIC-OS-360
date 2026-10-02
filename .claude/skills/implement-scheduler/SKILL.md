---
name: implement-scheduler
description: Adds a scheduled task guarded against concurrent runs. Use when a planned task requires a scheduled task guarded against concurrent runs.
---
# implement-scheduler

## Classification
- kind: implementation
- domain: backend
- batch: 16
- approval: none
- mutates: yes
- capability-unavailable: no

## Purpose
Adds a scheduled task guarded against concurrent runs.

## Invocation conditions
- A planned task requires a scheduled task guarded against concurrent runs.
- The requirement and the scope of writes are already fixed.

## Required inputs
- The task specification with its acceptance criteria and the locked write scope.
- The neighboring code that shows the existing pattern for a scheduled task guarded against concurrent runs.

## Procedure
1. Define the schedule with an explicit time zone.
2. Guard against overlap with a lock or a unique job key across instances.
3. Define missed-run behavior after downtime and a failure alert.
4. Test overlap and failure.

## Expected outputs
- The code for a scheduled task guarded against concurrent runs inside apps/api/src/modules and apps/api/src/queues.
- The tests: tests for overlap and failure.

## Validation
- The tests pass: tests for overlap and failure.
- Constraints hold: single run at a time, time zone explicit.
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
