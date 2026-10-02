---
name: run-visual-regression
description: Runs visual comparisons against baselines. Use when fresh evidence of visual comparisons is needed for the current workspace.
---
# run-visual-regression

## Classification
- kind: test-run
- domain: testing
- batch: 16
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Runs visual comparisons against baselines.

## Invocation conditions
- Fresh evidence of visual comparisons is needed for the current workspace.
- A gate or the completion check requires this run.

## Required inputs
- The workspace as it is now.
- The repository scripts for this run, read from the package configuration and never invented.

## Procedure
1. Read the package scripts and configuration to find the real command for visual comparisons.
2. Run it on the current workspace: the visual test scripts against approved baselines.
3. Capture the real exit code and the list of differing screens.
4. Bind the result to the current workspace fingerprint through the evidence command.
5. Report failures with their output instead of retrying until green.

## Expected outputs
- A run result with exit code, the list of differing screens and the workspace fingerprint.

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
