---
name: create-component
description: Creates a UI component following the design system and its tests. Use when a planned task requires a UI component that follows the design system.
---
# create-component

## Classification
- kind: implementation
- domain: frontend
- batch: 16
- approval: none
- mutates: yes
- capability-unavailable: no

## Purpose
Creates a UI component following the design system and its tests.

## Invocation conditions
- A planned task requires a UI component that follows the design system.
- The requirement and the scope of writes are already fixed.

## Required inputs
- The task specification with its acceptance criteria and the locked write scope.
- The neighboring code that shows the existing pattern for a UI component that follows the design system.

## Procedure
1. Read the nearest existing component and the shared primitives and reuse them.
2. Define typed props and every state: default, hover, focus, disabled, loading, empty and error where they apply.
3. Use tokens for color, spacing and type and no literal values.
4. Write the component test for each state and for keyboard operation.

## Expected outputs
- The code for a UI component that follows the design system inside apps/web/src.
- The tests: component tests for states and keyboard operation.

## Validation
- The tests pass: component tests for states and keyboard operation.
- Constraints hold: tokens only, accessible name and role, no business rules inside.
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
