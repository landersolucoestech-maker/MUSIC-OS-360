---
name: run-accessibility-tests
description: Runs automated accessibility checks. Use when fresh evidence of automated accessibility checks is needed for the current workspace.
---
# run-accessibility-tests

## Classification
- kind: test-run
- domain: testing
- batch: 16
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Runs automated accessibility checks.

## Invocation conditions
- Fresh evidence of automated accessibility checks is needed for the current workspace.
- A gate or the completion check requires this run.

## Required inputs
- The workspace as it is now.
- The repository scripts for this run, read from the package configuration and never invented.

## Procedure
1. Read the package scripts and configuration to find the real command for automated accessibility checks.
2. Run it on the current workspace: the accessibility test scripts.
3. Capture the real exit code and the violations per screen.
4. Bind the result to the current workspace fingerprint through the evidence command.
5. Report failures with their output instead of retrying until green.

## Expected outputs
- A run result with exit code, the violations per screen and the workspace fingerprint.

## Validation
- The command exists in the repository scripts and was run on the current tree.
- The exit code is the real one.

## Evidence
- The evidence record created by the evidence command.
- The captured output.

## Failure behavior
- If the environment cannot run it, report BLOCKED with the missing requirement, never PASS.
- A failed run is evidence to investigate; never skip or weaken the check to obtain green.

## Rollback and recovery
- Read-only with respect to the product: it writes only the evidence record; remove a wrong record by superseding it with a correct run.

## Human approval
- Read-only analysis: it reports and changes nothing, so no human approval is needed.
