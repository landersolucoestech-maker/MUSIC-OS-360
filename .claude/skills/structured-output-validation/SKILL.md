---
name: structured-output-validation
description: Validates a model output against its schema before use. Use when model output structure must be verified before the next action.
---
# structured-output-validation

## Classification
- kind: check
- domain: ai-engineering
- batch: 17
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Validates a model output against its schema before use.

## Invocation conditions
- Model output structure must be verified before the next action.
- A guard or gate requires the result of this check.

## Required inputs
- The planned action or the current repository state.
- The policy or rule that the check enforces.

## Procedure
1. List the places where model output becomes data or action.
2. Check each validates structure, enums, ranges and referenced ids against the schema.
3. Check rejection produces a visible failure and never a silent default.
4. Check legal and financial values are recomputed by deterministic code.

## Expected outputs
- A validation result per output path.

## Validation
- The check answers a single question: does every model output pass its schema before it is stored or acted on?
- The result is derived from commands run now, not from memory or earlier output.

## Evidence
- Output path references with the schema used.

## Failure behavior
- If an output path has no schema, report it as trusting blindly.

## Rollback and recovery
- Read-only: nothing is changed, so there is nothing to roll back; rerun with the corrected scope if the scope was wrong.

## Human approval
- Read-only analysis: it reports and changes nothing, so no human approval is needed.
