---
name: change-impact-check
description: Checks that the detected impact level matches the real change. Use when the declared impact level must be verified before the next action.
---
# change-impact-check

## Classification
- kind: check
- domain: governance
- batch: 16
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Checks that the detected impact level matches the real change.

## Invocation conditions
- The declared impact level must be verified before the next action.
- A guard or gate requires the result of this check.

## Required inputs
- The planned action or the current repository state.
- The policy or rule that the check enforces.

## Procedure
1. Run the impact detection on the current workspace.
2. Compare the detected level with the declared level.
3. Check security, data, contract and infrastructure signals in the diff.
4. Use the higher level and record the reason; never lower a detected level.

## Expected outputs
- An impact result with declared and detected levels and the signals.

## Validation
- The check answers a single question: does the declared impact level match the real change?
- The result is derived from commands run now, not from memory or earlier output.

## Evidence
- The impact runtime output.

## Failure behavior
- If detection fails, report BLOCKED and treat the change as the highest plausible level.

## Rollback and recovery
- Read-only: nothing is changed, so there is nothing to roll back; rerun with the corrected scope if the scope was wrong.

## Human approval
- Read-only analysis: it reports and changes nothing, so no human approval is needed.
