---
name: ai-model-routing-audit
description: Audits which model serves which task and why. Use when a change touches routing configuration, fallbacks and the evaluation results behind them.
---
# ai-model-routing-audit

## Classification
- kind: audit
- domain: ai-engineering
- batch: 17
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Audits which model serves which task and why.

## Invocation conditions
- A change touches routing configuration, fallbacks and the evaluation results behind them.
- A reviewer, gate or owner asks for the audit of model routing.
- Before a release that includes changes to this area.

## Required inputs
- The diff or the area to audit: routing configuration, fallbacks and the evaluation results behind them.
- The architecture and security documents of the repository that state the rules for this area.

## Procedure
1. Read the scope: routing configuration, fallbacks and the evaluation results behind them, and list every item to inspect.
2. List each task and the model that serves it.
3. Check each choice has an evaluation result or a stated constraint.
4. Check fallbacks are recorded in telemetry and produce acceptable results.
5. Classify each finding as a routing choice without evidence or an unrecorded fallback with severity, file, line and the concrete failure scenario.
6. Record the items that passed as well as the findings.

## Expected outputs
- An audit record of model routing with per-item results and ranked findings.

## Validation
- Every item of the scope has a recorded pass or finding.
- Each finding has file, line, severity and a failure scenario that can be reproduced or argued from the code.

## Evidence
- The audit record for model routing.
- The searches and commands used with their output.

## Failure behavior
- If any part of the scope cannot be read, report BLOCKED, never PASS.
- If the scope contains no routing configuration, say so explicitly instead of returning an empty clean result.

## Rollback and recovery
- Read-only: nothing is changed, so there is nothing to roll back; rerun with the corrected scope if the scope was wrong.

## Human approval
- Read-only analysis: it reports and changes nothing, so no human approval is needed.
