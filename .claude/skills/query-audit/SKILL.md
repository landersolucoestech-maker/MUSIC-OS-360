---
name: query-audit
description: Audits queries for correctness, scoping and cost. Use when a change modifies queries and their callers.
---
# query-audit

## Classification
- kind: audit
- domain: database
- batch: 16
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Audits queries for correctness, scoping and cost.

## Invocation conditions
- A change modifies queries and their callers.
- A reviewer, gate or owner asks for the audit of queries for correctness, scoping and cost.
- Before a release that includes changes to this area.

## Required inputs
- The diff or the area to audit: the changed queries and their callers.
- The architecture and security documents of the repository that state the rules for this area.

## Procedure
1. Read the scope: the changed queries and their callers, and list every item to inspect.
2. Check results are correct for empty, single and many rows and for another tenant.
3. Check parameterization and scoping.
4. Check plans and call counts for N+1 and unbounded scans.
5. Classify each finding as a wrong result, a scoping gap or a measured cost with severity, file, line and the concrete failure scenario.
6. Record the items that passed as well as the findings.

## Expected outputs
- An audit record of queries for correctness, scoping and cost with per-item results and ranked findings.

## Validation
- Every item of the scope has a recorded pass or finding.
- Each finding has file, line, severity and a failure scenario that can be reproduced or argued from the code.

## Evidence
- The audit record for queries for correctness, scoping and cost.
- The searches and commands used with their output.

## Failure behavior
- If any part of the scope cannot be read, report BLOCKED, never PASS.
- If the scope contains no the changed queries and their callers, say so explicitly instead of returning an empty clean result.

## Rollback and recovery
- Read-only: nothing is changed, so there is nothing to roll back; rerun with the corrected scope if the scope was wrong.

## Human approval
- Read-only analysis: it reports and changes nothing, so no human approval is needed.
