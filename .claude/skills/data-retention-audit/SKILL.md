---
name: data-retention-audit
description: Audits retention, archival and erasure of stored data. Use when a change touches stores of personal and financial data, logs and backfill side tables.
---
# data-retention-audit

## Classification
- kind: audit
- domain: database
- batch: 16
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Audits retention, archival and erasure of stored data.

## Invocation conditions
- A change touches stores of personal and financial data, logs and backfill side tables.
- A reviewer, gate or owner asks for the audit of retention, archival and erasure of stored data.
- Before a release that includes changes to this area.

## Required inputs
- The diff or the area to audit: stores of personal and financial data, logs and backfill side tables.
- The architecture and security documents of the repository that state the rules for this area.

## Procedure
1. Read the scope: stores of personal and financial data, logs and backfill side tables, and list every item to inspect.
2. List the data stores and the retention rule the project documents for each.
3. Check purge jobs are guarded and reversible until approved.
4. Check backfill side tables and logs are on the retention list.
5. Classify each finding as a store without a rule, an unsafe purge or an unmanaged side table with severity, file, line and the concrete failure scenario.
6. Record the items that passed as well as the findings.

## Expected outputs
- An audit record of retention, archival and erasure of stored data with per-item results and ranked findings.

## Validation
- Every item of the scope has a recorded pass or finding.
- Each finding has file, line, severity and a failure scenario that can be reproduced or argued from the code.

## Evidence
- The audit record for retention, archival and erasure of stored data.
- The searches and commands used with their output.

## Failure behavior
- If any part of the scope cannot be read, report BLOCKED, never PASS.
- If the scope contains no stores of personal and financial data, say so explicitly instead of returning an empty clean result.

## Rollback and recovery
- Read-only: nothing is changed, so there is nothing to roll back; rerun with the corrected scope if the scope was wrong.

## Human approval
- Read-only analysis: it reports and changes nothing, so no human approval is needed.
