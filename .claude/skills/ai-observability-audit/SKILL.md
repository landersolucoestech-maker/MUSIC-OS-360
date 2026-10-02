---
name: ai-observability-audit
description: Audits tracing, logging and redaction of AI calls. Use when a change touches AI telemetry, traces and stored prompts and outputs.
---
# ai-observability-audit

## Classification
- kind: audit
- domain: ai-engineering
- batch: 17
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Audits tracing, logging and redaction of AI calls.

## Invocation conditions
- A change touches AI telemetry, traces and stored prompts and outputs.
- A reviewer, gate or owner asks for the audit of AI observability.
- Before a release that includes changes to this area.

## Required inputs
- The diff or the area to audit: AI telemetry, traces and stored prompts and outputs.
- The architecture and security documents of the repository that state the rules for this area.

## Procedure
1. Read the scope: AI telemetry, traces and stored prompts and outputs, and list every item to inspect.
2. Check each run records feature, tenant, model, tokens, latency, cost and outcome.
3. Check stored prompts and outputs are redacted and have a retention limit.
4. Check correlation crosses queue jobs and tool calls.
5. Classify each finding as a missing attribution field, an unredacted store or a broken trace with severity, file, line and the concrete failure scenario.
6. Record the items that passed as well as the findings.

## Expected outputs
- An audit record of AI observability with per-item results and ranked findings.

## Validation
- Every item of the scope has a recorded pass or finding.
- Each finding has file, line, severity and a failure scenario that can be reproduced or argued from the code.

## Evidence
- The audit record for AI observability.
- The searches and commands used with their output.

## Failure behavior
- If any part of the scope cannot be read, report BLOCKED, never PASS.
- If the scope contains no AI telemetry, say so explicitly instead of returning an empty clean result.

## Rollback and recovery
- Read-only: nothing is changed, so there is nothing to roll back; rerun with the corrected scope if the scope was wrong.

## Human approval
- Read-only analysis: it reports and changes nothing, so no human approval is needed.
