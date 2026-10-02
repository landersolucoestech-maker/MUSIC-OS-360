---
name: create-unit-tests
description: Writes unit tests for a bounded function or class. Use when code or behavior was added or changed and needs unit tests.
---
# create-unit-tests

## Classification
- kind: test-authoring
- domain: testing
- batch: 16
- approval: none
- mutates: yes
- capability-unavailable: no

## Purpose
Writes unit tests for a bounded function or class.

## Invocation conditions
- Code or behavior was added or changed and needs unit tests.
- A reviewer reports missing coverage of the changed path.

## Required inputs
- The code under test and its requirement.
- The existing test harness: the package unit test runner.

## Procedure
1. Read the code under test and the closest existing unit tests to copy the harness.
2. List the cases to cover: valid, boundary, invalid and error inputs.
3. Write the tests so that each fails if the behavior it protects is broken.
4. Run them, then break the behavior on purpose in a scratch copy to confirm they fail, and restore it.
5. Record the run output.

## Expected outputs
- The unit tests.
- A run record showing the tests pass and a negative check showing they can fail.

## Validation
- Each listed case has at least one test: valid, boundary, invalid and error inputs.
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
