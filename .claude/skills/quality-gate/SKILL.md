---
name: quality-gate
description: Runs the repository quality gates for the impact level and reports each result. Use when the quality gates must be verified before the next action.
---
# quality-gate

## Classification
- kind: check
- domain: governance
- batch: 16
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Runs the repository quality gates for the impact level and reports each result.

## Invocation conditions
- The quality gates must be verified before the next action.
- A guard or gate requires the result of this check.

## Required inputs
- The planned action or the current repository state.
- The policy or rule that the check enforces.

## Procedure
1. Read the gate matrix for the declared and detected impact level.
2. Run each applicable gate through the gate engine.
3. Record each result with its exit code.
4. Report failing gates with their output; the change is not done until all pass.

## Expected outputs
- A gate result table with exit codes.

## Validation
- The check answers a single question: which repository quality gates apply to this impact level and what is each result?
- The result is derived from commands run now, not from memory or earlier output.

## Evidence
- The gate engine output.

## Failure behavior
- If a gate cannot run, report BLOCKED for it; never mark it passed.

## Rollback and recovery
- Read-only: nothing is changed, so there is nothing to roll back; rerun with the corrected scope if the scope was wrong.

## Human approval
- Read-only analysis: it reports and changes nothing, so no human approval is needed.
