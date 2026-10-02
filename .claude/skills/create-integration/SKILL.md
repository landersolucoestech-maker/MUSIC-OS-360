---
name: create-integration
description: Creates a provider integration with contract, secrets handling and failure modes. Use when a planned task requires a provider integration for a provider the repository already supports.
---
# create-integration

## Classification
- kind: implementation
- domain: integrations
- batch: 16
- approval: none
- mutates: yes
- capability-unavailable: no

## Purpose
Creates a provider integration with contract, secrets handling and failure modes.

## Invocation conditions
- A planned task requires a provider integration for a provider the repository already supports.
- The requirement and the scope of writes are already fixed.

## Required inputs
- The task specification with its acceptance criteria and the locked write scope.
- The neighboring code that shows the existing pattern for a provider integration for a provider the repository already supports.

## Procedure
1. Read the shared integration base, the failure classification and an existing integration.
2. Source credentials from the validated environment schema.
3. Use the resilient fetch with timeout and breaker and classify provider errors.
4. Test with a mocked provider including throttling, timeout and malformed responses.

## Expected outputs
- The code for a provider integration for a provider the repository already supports inside apps/api/src/modules/integrations.
- The tests: integration tests with a mocked provider for each failure class.

## Validation
- The tests pass: integration tests with a mocked provider for each failure class.
- Constraints hold: no new provider, secrets from configuration, classified failures.
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
