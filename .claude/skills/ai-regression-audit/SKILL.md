---
name: ai-regression-audit
description: Compares AI behavior before and after a change. Use when a change touches evaluation runs for the changed prompt, model or context.
---
# ai-regression-audit

## Classification
- kind: audit
- domain: ai-engineering
- batch: 17
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Compares AI behavior before and after a change.

## Invocation conditions
- A change touches evaluation runs for the changed prompt, model or context.
- A reviewer, gate or owner asks for the audit of AI regressions.
- Before a release that includes changes to this area.

## Required inputs
- The diff or the area to audit: evaluation runs for the changed prompt, model or context.
- The architecture and security documents of the repository that state the rules for this area.

## Procedure
1. Read the scope: evaluation runs for the changed prompt, model or context, and list every item to inspect.
2. Find the baseline and the new run for the same evaluation set.
3. Compare scores overall and per case category.
4. Identify which change explains each drop.
5. Classify each finding as a score drop with the change that caused it with severity, file, line and the concrete failure scenario.
6. Record the items that passed as well as the findings.

## Expected outputs
- An audit record of AI regressions with per-item results and ranked findings.

## Validation
- Every item of the scope has a recorded pass or finding.
- Each finding has file, line, severity and a failure scenario that can be reproduced or argued from the code.

## Evidence
- The audit record for AI regressions.
- The searches and commands used with their output.

## Failure behavior
- If any part of the scope cannot be read, report BLOCKED, never PASS.
- If the scope contains no evaluation runs for the changed prompt, say so explicitly instead of returning an empty clean result.

## Rollback and recovery
- Read-only: nothing is changed, so there is nothing to roll back; rerun with the corrected scope if the scope was wrong.

## Human approval
- Read-only analysis: it reports and changes nothing, so no human approval is needed.
