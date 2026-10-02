---
name: retry-audit
description: Audits retry policies for storms and non-idempotent retries. Use when a change touches every retry configuration across client, server and queue layers.
---
# retry-audit

## Classification
- kind: audit
- domain: backend
- batch: 16
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Audits retry policies for storms and non-idempotent retries.

## Invocation conditions
- A change touches every retry configuration across client, server and queue layers.
- A reviewer, gate or owner asks for the audit of retry policies for storms and non-idempotent retries.
- Before a release that includes changes to this area.

## Required inputs
- The diff or the area to audit: every retry configuration across client, server and queue layers.
- The architecture and security documents of the repository that state the rules for this area.

## Procedure
1. Read the scope: every retry configuration across client, server and queue layers, and list every item to inspect.
2. List every layer that retries the same operation and compute the worst-case attempts.
3. Check retried writes are idempotent.
4. Check backoff, jitter and that permanent errors are not retried.
5. Classify each finding as a retry storm or a duplicate effect with severity, file, line and the concrete failure scenario.
6. Record the items that passed as well as the findings.

## Expected outputs
- An audit record of retry policies for storms and non-idempotent retries with per-item results and ranked findings.

## Validation
- Every item of the scope has a recorded pass or finding.
- Each finding has file, line, severity and a failure scenario that can be reproduced or argued from the code.

## Evidence
- The audit record for retry policies for storms and non-idempotent retries.
- The searches and commands used with their output.

## Failure behavior
- If any part of the scope cannot be read, report BLOCKED, never PASS.
- If the scope contains no every retry configuration across client, say so explicitly instead of returning an empty clean result.

## Rollback and recovery
- Read-only: nothing is changed, so there is nothing to roll back; rerun with the corrected scope if the scope was wrong.

## Human approval
- Read-only analysis: it reports and changes nothing, so no human approval is needed.
