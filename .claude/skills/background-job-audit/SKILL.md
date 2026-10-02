---
name: background-job-audit
description: Audits background jobs for status, recovery and duplicates. Use when a change touches job creation code, processors and status records.
---
# background-job-audit

## Classification
- kind: audit
- domain: backend
- batch: 16
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Audits background jobs for status, recovery and duplicates.

## Invocation conditions
- A change touches job creation code, processors and status records.
- A reviewer, gate or owner asks for the audit of background jobs for status, recovery and duplicates.
- Before a release that includes changes to this area.

## Required inputs
- The diff or the area to audit: job creation code, processors and status records.
- The architecture and security documents of the repository that state the rules for this area.

## Procedure
1. Read the scope: job creation code, processors and status records, and list every item to inspect.
2. Check each job has a unique key and cannot be enqueued twice for the same work.
3. Check status is recorded and a failure leaves a visible state.
4. Check a failed job can be retried safely.
5. Classify each finding as a duplicate, a silent failure or an unrecoverable job with severity, file, line and the concrete failure scenario.
6. Record the items that passed as well as the findings.

## Expected outputs
- An audit record of background jobs for status, recovery and duplicates with per-item results and ranked findings.

## Validation
- Every item of the scope has a recorded pass or finding.
- Each finding has file, line, severity and a failure scenario that can be reproduced or argued from the code.

## Evidence
- The audit record for background jobs for status, recovery and duplicates.
- The searches and commands used with their output.

## Failure behavior
- If any part of the scope cannot be read, report BLOCKED, never PASS.
- If the scope contains no job creation code, say so explicitly instead of returning an empty clean result.

## Rollback and recovery
- Read-only: nothing is changed, so there is nothing to roll back; rerun with the corrected scope if the scope was wrong.

## Human approval
- Read-only analysis: it reports and changes nothing, so no human approval is needed.
