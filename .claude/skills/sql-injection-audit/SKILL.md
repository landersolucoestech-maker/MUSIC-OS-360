---
name: sql-injection-audit
description: Audits queries for string-built SQL. Use when a change touches raw queries, dynamic identifiers and ordering built from input.
---
# sql-injection-audit

## Classification
- kind: audit
- domain: security
- batch: 16
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Audits queries for string-built SQL.

## Invocation conditions
- A change touches raw queries, dynamic identifiers and ordering built from input.
- A reviewer, gate or owner asks for the audit of queries for string-built SQL.
- Before a release that includes changes to this area.

## Required inputs
- The diff or the area to audit: raw queries, dynamic identifiers and ordering built from input.
- The architecture and security documents of the repository that state the rules for this area.

## Procedure
1. Read the scope: raw queries, dynamic identifiers and ordering built from input, and list every item to inspect.
2. Find raw queries and string-built fragments including column and order parameters.
3. Check values are bound and identifiers come from an allowlist.
4. Prove each finding with an input that changes the statement.
5. Classify each finding as a call site where input changes the statement structure with severity, file, line and the concrete failure scenario.
6. Record the items that passed as well as the findings.

## Expected outputs
- An audit record of queries for string-built SQL with per-item results and ranked findings.

## Validation
- Every item of the scope has a recorded pass or finding.
- Each finding has file, line, severity and a failure scenario that can be reproduced or argued from the code.

## Evidence
- The audit record for queries for string-built SQL.
- The searches and commands used with their output.

## Failure behavior
- If any part of the scope cannot be read, report BLOCKED, never PASS.
- If the scope contains no raw queries, say so explicitly instead of returning an empty clean result.

## Rollback and recovery
- Read-only: nothing is changed, so there is nothing to roll back; rerun with the corrected scope if the scope was wrong.

## Human approval
- Read-only analysis: it reports and changes nothing, so no human approval is needed.
