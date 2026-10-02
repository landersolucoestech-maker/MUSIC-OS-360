---
name: implement-accessibility
description: Adds keyboard, focus, labels and contrast fixes. Use when a planned task requires keyboard, focus, label and contrast fixes.
---
# implement-accessibility

## Classification
- kind: implementation
- domain: frontend
- batch: 16
- approval: none
- mutates: yes
- capability-unavailable: no

## Purpose
Adds keyboard, focus, labels and contrast fixes.

## Invocation conditions
- A planned task requires keyboard, focus, label and contrast fixes.
- The requirement and the scope of writes are already fixed.

## Required inputs
- The task specification with its acceptance criteria and the locked write scope.
- The neighboring code that shows the existing pattern for keyboard, focus, label and contrast fixes.

## Procedure
1. Reproduce each defect with the keyboard or the automated check.
2. Fix with semantic elements first and with attributes only where semantics cannot do it.
3. Verify focus order, accessible names and contrast after the fix.
4. Add or extend an accessibility test for each fixed defect.

## Expected outputs
- The code for keyboard, focus, label and contrast fixes inside apps/web/src.
- The tests: accessibility tests that fail before and pass after.

## Validation
- The tests pass: accessibility tests that fail before and pass after.
- Constraints hold: semantics before attributes, no removal of focus outlines, contrast met.
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
