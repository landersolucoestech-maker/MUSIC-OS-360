---
name: create-security-tests
description: Writes abuse-path tests for a security boundary. Use when code or behavior was added or changed and needs abuse-path tests.
---
# create-security-tests

## Classification
- kind: test-authoring
- domain: testing
- batch: 16
- approval: none
- mutates: yes
- capability-unavailable: no

## Purpose
Writes abuse-path tests for a security boundary.

## Invocation conditions
- Code or behavior was added or changed and needs abuse-path tests.
- A reviewer reports missing coverage of the changed path.

## Required inputs
- The code under test and its requirement.
- The existing test harness: the security test folder and the API harness.

## Procedure
1. Read the code under test and the closest existing abuse-path tests to copy the harness.
2. List the cases to cover: cross-tenant, wrong-role, hostile payload and replay attempts.
3. Write the tests so that each fails if the behavior it protects is broken.
4. Run them, then break the behavior on purpose in a scratch copy to confirm they fail, and restore it.
5. Record the run output.

## Expected outputs
- The abuse-path tests.
- A run record showing the tests pass and a negative check showing they can fail.

## Validation
- Each listed case has at least one test: cross-tenant, wrong-role, hostile payload and replay attempts.
- The tests fail when the protected behavior is broken.

## Evidence
- Test file list and the run output.
- The record of the deliberate break and the restored state.

## Failure behavior
- If the code under test cannot be exercised in the harness, report BLOCKED with the missing dependency.
- Never weaken, skip or delete a test to obtain green.

## Rollback and recovery
- Test files are new or isolated: revert by removing the added files; the product code is not touched.

## Human approval
- Local test code only: no human approval is needed.
