---
name: verify
description: Verifies a claim by executing the check that would falsify it. Use when a claim must be verified before the next action.
---
# verify

## Classification
- kind: check
- domain: governance
- batch: 16
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Verifies a claim by executing the check that would falsify it.

## Invocation conditions
- A claim must be verified before the next action.
- A guard or gate requires the result of this check.

## Required inputs
- The planned action or the current repository state.
- The policy or rule that the check enforces.

## Procedure
1. State the claim precisely.
2. Choose the check that would fail if the claim were false.
3. Run the check now and capture the output.
4. Report the claim as verified, falsified or unverifiable with the output.

## Expected outputs
- A verification result for the claim.

## Validation
- The check answers a single question: does the check that would falsify the claim pass?
- The result is derived from commands run now, not from memory or earlier output.

## Evidence
- The check command and its captured output.

## Failure behavior
- If no falsifying check exists, report the claim as unverifiable, never as verified.

## Rollback and recovery
- Read-only: nothing is changed, so there is nothing to roll back; rerun with the corrected scope if the scope was wrong.

## Human approval
- Read-only analysis: it reports and changes nothing, so no human approval is needed.
