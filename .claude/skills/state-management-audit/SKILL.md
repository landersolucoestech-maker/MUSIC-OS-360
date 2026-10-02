---
name: state-management-audit
description: Audits state sources for duplication and stale data. Use when a change touches query cache usage, context providers and component state.
---
# state-management-audit

## Classification
- kind: audit
- domain: frontend
- batch: 16
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Audits state sources for duplication and stale data.

## Invocation conditions
- A change touches query cache usage, context providers and component state.
- A reviewer, gate or owner asks for the audit of state sources for duplication and stale data.
- Before a release that includes changes to this area.

## Required inputs
- The diff or the area to audit: query cache usage, context providers and component state.
- The architecture and security documents of the repository that state the rules for this area.

## Procedure
1. Read the scope: query cache usage, context providers and component state, and list every item to inspect.
2. List where each piece of data is stored: cache, context, component state or URL.
3. Find data stored in two places that can drift.
4. Check invalidation after mutations covers every query that shows the changed data.
5. Classify each finding as a duplicated source, a stale read or a missing invalidation with severity, file, line and the concrete failure scenario.
6. Record the items that passed as well as the findings.

## Expected outputs
- An audit record of state sources for duplication and stale data with per-item results and ranked findings.

## Validation
- Every item of the scope has a recorded pass or finding.
- Each finding has file, line, severity and a failure scenario that can be reproduced or argued from the code.

## Evidence
- The audit record for state sources for duplication and stale data.
- The searches and commands used with their output.

## Failure behavior
- If any part of the scope cannot be read, report BLOCKED, never PASS.
- If the scope contains no query cache usage, say so explicitly instead of returning an empty clean result.

## Rollback and recovery
- Read-only: nothing is changed, so there is nothing to roll back; rerun with the corrected scope if the scope was wrong.

## Human approval
- Read-only analysis: it reports and changes nothing, so no human approval is needed.
