---
name: create-webhook
description: Creates a webhook endpoint with signature check, dedup and replay safety. Use when a planned task requires a webhook endpoint with signature check, dedup and replay safety.
---
# create-webhook

## Classification
- kind: implementation
- domain: backend
- batch: 16
- approval: none
- mutates: yes
- capability-unavailable: no

## Purpose
Creates a webhook endpoint with signature check, dedup and replay safety.

## Invocation conditions
- A planned task requires a webhook endpoint with signature check, dedup and replay safety.
- The requirement and the scope of writes are already fixed.

## Required inputs
- The task specification with its acceptance criteria and the locked write scope.
- The neighboring code that shows the existing pattern for a webhook endpoint with signature check, dedup and replay safety.

## Procedure
1. Receive the raw body and verify the signature with constant-time comparison before parsing.
2. Reject old timestamps and deduplicate on the provider event id.
3. Resolve the tenant by a proven link and defer heavy work to a queue.
4. Test forged, replayed and duplicate requests.

## Expected outputs
- The code for a webhook endpoint with signature check, dedup and replay safety inside apps/api/src/modules.
- The tests: tests for forged, replayed and duplicate requests.

## Validation
- The tests pass: tests for forged, replayed and duplicate requests.
- Constraints hold: raw-body signature, replay window, idempotency, proven tenant.
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
