---
name: data-provider-audit
description: Audits data providers and query keys for cache correctness. Use when a change touches query hooks, query key factories and mutation handlers.
---
# data-provider-audit

## Classification
- kind: audit
- domain: frontend
- batch: 16
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Audits data providers and query keys for cache correctness.

## Invocation conditions
- A change touches query hooks, query key factories and mutation handlers.
- A reviewer, gate or owner asks for the audit of data providers and query keys for cache correctness.
- Before a release that includes changes to this area.

## Required inputs
- The diff or the area to audit: query hooks, query key factories and mutation handlers.
- The architecture and security documents of the repository that state the rules for this area.

## Procedure
1. Read the scope: query hooks, query key factories and mutation handlers, and list every item to inspect.
2. Check query keys include every variable the request depends on, including the tenant.
3. Check mutations invalidate or update the keys they affect.
4. Find request storms: queries refetching on every render or in loops.
5. Classify each finding as a key that collides or omits a variable, a missing invalidation or a request storm with severity, file, line and the concrete failure scenario.
6. Record the items that passed as well as the findings.

## Expected outputs
- An audit record of data providers and query keys for cache correctness with per-item results and ranked findings.

## Validation
- Every item of the scope has a recorded pass or finding.
- Each finding has file, line, severity and a failure scenario that can be reproduced or argued from the code.

## Evidence
- The audit record for data providers and query keys for cache correctness.
- The searches and commands used with their output.

## Failure behavior
- If any part of the scope cannot be read, report BLOCKED, never PASS.
- If the scope contains no query hooks, say so explicitly instead of returning an empty clean result.

## Rollback and recovery
- Read-only: nothing is changed, so there is nothing to roll back; rerun with the corrected scope if the scope was wrong.

## Human approval
- Read-only analysis: it reports and changes nothing, so no human approval is needed.
