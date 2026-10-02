---
name: implement-auth
description: Implements authentication flows with the repository auth mechanism. Use when a planned task requires an authentication flow with the repository auth mechanism.
---
# implement-auth

## Classification
- kind: implementation
- domain: security
- batch: 16
- approval: none
- mutates: yes
- capability-unavailable: no

## Purpose
Implements authentication flows with the repository auth mechanism.

## Invocation conditions
- A planned task requires an authentication flow with the repository auth mechanism.
- The requirement and the scope of writes are already fixed.

## Required inputs
- The task specification with its acceptance criteria and the locked write scope.
- The neighboring code that shows the existing pattern for an authentication flow with the repository auth mechanism.

## Procedure
1. Read the existing auth service and the session design.
2. Verify credentials with the password service and constant-time comparison.
3. Keep token lifetime, rotation and revocation consistent and return the same response for unknown users and wrong passwords.
4. Test invalid, expired and replayed credentials and the failed-attempt limits.

## Expected outputs
- The code for an authentication flow with the repository auth mechanism inside apps/api/src/modules/auth.
- The tests: tests for invalid, expired and replayed credentials.

## Validation
- The tests pass: tests for invalid, expired and replayed credentials.
- Constraints hold: no enumeration, development bypass untouched and development-only.
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
