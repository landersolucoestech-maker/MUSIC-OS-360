---
name: definition-of-done
description: Checks the completion criteria against fresh evidence. Use when the completion criteria must be verified before the next action.
---
# definition-of-done

## Classification
- kind: check
- domain: governance
- batch: 16
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Checks the completion criteria against fresh evidence.

## Invocation conditions
- The completion criteria must be verified before the next action.
- A guard or gate requires the result of this check.

## Required inputs
- The planned action or the current repository state.
- The policy or rule that the check enforces.

## Procedure
1. List the acceptance criteria of the mission.
2. Match each with evidence records and check each is bound to the current workspace fingerprint.
3. Check required reviews are recorded for the exact fingerprint.
4. List criteria with missing or stale evidence as blocking.

## Expected outputs
- A completion result listing each criterion with its evidence status.

## Validation
- The check answers a single question: does every acceptance criterion have fresh passing evidence?
- The result is derived from commands run now, not from memory or earlier output.

## Evidence
- The status output of the evidence runtime.

## Failure behavior
- If any criterion lacks fresh evidence, the result is NOT DONE with the list.

## Rollback and recovery
- Read-only: nothing is changed, so there is nothing to roll back; rerun with the corrected scope if the scope was wrong.

## Human approval
- Read-only analysis: it reports and changes nothing, so no human approval is needed.
