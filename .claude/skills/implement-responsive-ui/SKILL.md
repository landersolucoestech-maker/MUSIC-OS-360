---
name: implement-responsive-ui
description: Makes a screen work across the supported viewport widths. Use when a planned task requires a screen that works across the supported viewport widths.
---
# implement-responsive-ui

## Classification
- kind: implementation
- domain: frontend
- batch: 16
- approval: none
- mutates: yes
- capability-unavailable: no

## Purpose
Makes a screen work across the supported viewport widths.

## Invocation conditions
- A planned task requires a screen that works across the supported viewport widths.
- The requirement and the scope of writes are already fixed.

## Required inputs
- The task specification with its acceptance criteria and the locked write scope.
- The neighboring code that shows the existing pattern for a screen that works across the supported viewport widths.

## Procedure
1. Render the screen at each supported width and list what breaks.
2. Use the existing breakpoints and layout utilities rather than new ones.
3. Make touch targets large enough and tables and dialogs usable on narrow screens.
4. Re-render at each width and record the result.

## Expected outputs
- The code for a screen that works across the supported viewport widths inside apps/web/src.
- The tests: rendering checks at each supported width.

## Validation
- The tests pass: rendering checks at each supported width.
- Constraints hold: existing breakpoints only, no horizontal page scroll, usable touch targets.
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
