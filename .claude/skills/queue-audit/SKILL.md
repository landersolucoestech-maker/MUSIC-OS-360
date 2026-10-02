---
name: queue-audit
description: Audits queues for retries, dead letters and idempotency. Use when a change touches the queue definitions, producers and processors.
---
# queue-audit

## Classification
- kind: audit
- domain: backend
- batch: 16
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Audits queues for retries, dead letters and idempotency.

## Invocation conditions
- A change touches the queue definitions, producers and processors.
- A reviewer, gate or owner asks for the audit of queues for retries, dead letters and idempotency.
- Before a release that includes changes to this area.

## Required inputs
- The diff or the area to audit: the queue definitions, producers and processors.
- The architecture and security documents of the repository that state the rules for this area.

## Procedure
1. Read the scope: the queue definitions, producers and processors, and list every item to inspect.
2. Check attempts, backoff and removal policy are set deliberately per job.
3. Check processors are idempotent and failed jobs end in a visible state.
4. Check queue depth and per-tenant fairness are controlled.
5. Classify each finding as a lost job, a duplicate effect or an unbounded backlog with severity, file, line and the concrete failure scenario.
6. Record the items that passed as well as the findings.

## Expected outputs
- An audit record of queues for retries, dead letters and idempotency with per-item results and ranked findings.

## Validation
- Every item of the scope has a recorded pass or finding.
- Each finding has file, line, severity and a failure scenario that can be reproduced or argued from the code.

## Evidence
- The audit record for queues for retries, dead letters and idempotency.
- The searches and commands used with their output.

## Failure behavior
- If any part of the scope cannot be read, report BLOCKED, never PASS.
- If the scope contains no the queue definitions, say so explicitly instead of returning an empty clean result.

## Rollback and recovery
- Read-only: nothing is changed, so there is nothing to roll back; rerun with the corrected scope if the scope was wrong.

## Human approval
- Read-only analysis: it reports and changes nothing, so no human approval is needed.
