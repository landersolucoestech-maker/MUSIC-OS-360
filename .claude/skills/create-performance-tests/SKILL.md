---
name: create-performance-tests
description: Writes timing and throughput tests with a baseline. Use when code or behavior was added or changed and needs performance tests.
---
# create-performance-tests

## Classification
- kind: test-authoring
- domain: testing
- batch: 16
- approval: none
- mutates: yes
- capability-unavailable: no

## Purpose
Writes timing and throughput tests with a baseline.

## Invocation conditions
- Code or behavior was added or changed and needs performance tests.
- A reviewer reports missing coverage of the changed path.

## Required inputs
- The code under test and its requirement.
- The existing test harness: the performance test folder.

## Procedure
1. Read the code under test and the closest existing performance tests to copy the harness.
2. List the cases to cover: the stated budget, repeated runs and the recorded baseline.
3. Write the tests so that each fails if the behavior it protects is broken.
4. Run them, then break the behavior on purpose in a scratch copy to confirm they fail, and restore it.
5. Record the run output.

## Expected outputs
- The performance tests.
- A run record showing the tests pass and a negative check showing they can fail.

## Validation
- Each listed case has at least one test: the stated budget, repeated runs and the recorded baseline.
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
