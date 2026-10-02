---
name: empty-state-audit
description: Audits empty states for guidance and calls to action. Use when a change modifies lists, tables and dashboards.
---
# empty-state-audit

## Classification
- kind: audit
- domain: frontend
- batch: 16
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Audits empty states for guidance and calls to action.

## Invocation conditions
- A change modifies lists, tables and dashboards.
- A reviewer, gate or owner asks for the audit of empty states for guidance and calls to action.
- Before a release that includes changes to this area.

## Required inputs
- The diff or the area to audit: the changed lists, tables and dashboards.
- The architecture and security documents of the repository that state the rules for this area.

## Procedure
1. Read the scope: the changed lists, tables and dashboards, and list every item to inspect.
2. List every collection view and its empty state.
3. Check the empty state explains why it is empty and what to do.
4. Check filtered empty results differ from no data at all.
5. Classify each finding as a missing, silent or misleading empty state with severity, file, line and the concrete failure scenario.
6. Record the items that passed as well as the findings.

## Expected outputs
- An audit record of empty states for guidance and calls to action with per-item results and ranked findings.

## Validation
- Every item of the scope has a recorded pass or finding.
- Each finding has file, line, severity and a failure scenario that can be reproduced or argued from the code.

## Evidence
- The audit record for empty states for guidance and calls to action.
- The searches and commands used with their output.

## Failure behavior
- If any part of the scope cannot be read, report BLOCKED, never PASS.
- If the scope contains no the changed lists, say so explicitly instead of returning an empty clean result.

## Rollback and recovery
- Read-only: nothing is changed, so there is nothing to roll back; rerun with the corrected scope if the scope was wrong.

## Human approval
- Read-only analysis: it reports and changes nothing, so no human approval is needed.
