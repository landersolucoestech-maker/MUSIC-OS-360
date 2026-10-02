---
name: migration-audit
description: Audits migrations for safety, reversibility and ordering. Use when a change touches the migration files and their registration.
---
# migration-audit

## Classification
- kind: audit
- domain: database
- batch: 16
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Audits migrations for safety, reversibility and ordering.

## Invocation conditions
- A change touches the migration files and their registration.
- A reviewer, gate or owner asks for the audit of migrations for safety, reversibility and ordering.
- Before a release that includes changes to this area.

## Required inputs
- The diff or the area to audit: the migration files and their registration.
- The architecture and security documents of the repository that state the rules for this area.

## Procedure
1. Read the scope: the migration files and their registration, and list every item to inspect.
2. Check each migration has a working down path and is registered once in order.
3. Check lock time and batching for large tables.
4. Check backfills are reversible and the old application version still works.
5. Classify each finding as an irreversible step, a lock risk or an ordering problem with severity, file, line and the concrete failure scenario.
6. Record the items that passed as well as the findings.

## Expected outputs
- An audit record of migrations for safety, reversibility and ordering with per-item results and ranked findings.

## Validation
- Every item of the scope has a recorded pass or finding.
- Each finding has file, line, severity and a failure scenario that can be reproduced or argued from the code.

## Evidence
- The audit record for migrations for safety, reversibility and ordering.
- The searches and commands used with their output.

## Failure behavior
- If any part of the scope cannot be read, report BLOCKED, never PASS.
- If the scope contains no the migration files and their registration, say so explicitly instead of returning an empty clean result.

## Rollback and recovery
- Read-only: nothing is changed, so there is nothing to roll back; rerun with the corrected scope if the scope was wrong.

## Human approval
- Read-only analysis: it reports and changes nothing, so no human approval is needed.
