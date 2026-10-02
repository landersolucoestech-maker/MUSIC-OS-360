---
name: ai-cost-audit
description: Audits token and call cost per task. Use when a change touches usage telemetry, loops, retries and quota settings.
---
# ai-cost-audit

## Classification
- kind: audit
- domain: ai-engineering
- batch: 17
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Audits token and call cost per task.

## Invocation conditions
- A change touches usage telemetry, loops, retries and quota settings.
- A reviewer, gate or owner asks for the audit of AI cost.
- Before a release that includes changes to this area.

## Required inputs
- The diff or the area to audit: usage telemetry, loops, retries and quota settings.
- The architecture and security documents of the repository that state the rules for this area.

## Procedure
1. Read the scope: usage telemetry, loops, retries and quota settings, and list every item to inspect.
2. Estimate tokens and calls per feature use from telemetry or tests.
3. Find loops, retries and fan-out without a budget.
4. Check per-tenant quotas and a kill switch exist.
5. Classify each finding as a cost driver without a bound with severity, file, line and the concrete failure scenario.
6. Record the items that passed as well as the findings.

## Expected outputs
- An audit record of AI cost with per-item results and ranked findings.

## Validation
- Every item of the scope has a recorded pass or finding.
- Each finding has file, line, severity and a failure scenario that can be reproduced or argued from the code.

## Evidence
- The audit record for AI cost.
- The searches and commands used with their output.

## Failure behavior
- If any part of the scope cannot be read, report BLOCKED, never PASS.
- If the scope contains no usage telemetry, say so explicitly instead of returning an empty clean result.

## Rollback and recovery
- Read-only: nothing is changed, so there is nothing to roll back; rerun with the corrected scope if the scope was wrong.

## Human approval
- Read-only analysis: it reports and changes nothing, so no human approval is needed.
