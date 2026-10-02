---
name: frontend-performance-audit
description: Audits bundle size, rendering and request storms. Use when a change touches the build output, heavy routes and data hooks.
---
# frontend-performance-audit

## Classification
- kind: audit
- domain: frontend
- batch: 16
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Audits bundle size, rendering and request storms.

## Invocation conditions
- A change touches the build output, heavy routes and data hooks.
- A reviewer, gate or owner asks for the audit of bundle size, rendering and request storms.
- Before a release that includes changes to this area.

## Required inputs
- The diff or the area to audit: the build output, heavy routes and data hooks.
- The architecture and security documents of the repository that state the rules for this area.

## Procedure
1. Read the scope: the build output, heavy routes and data hooks, and list every item to inspect.
2. Read the build output sizes and find the largest chunks.
3. Check routes are lazy where heavy and lists are bounded or virtualized.
4. Count requests per interaction to find storms and duplicates.
5. Classify each finding as a measured cost with the screen or chunk that causes it with severity, file, line and the concrete failure scenario.
6. Record the items that passed as well as the findings.

## Expected outputs
- An audit record of bundle size, rendering and request storms with per-item results and ranked findings.

## Validation
- Every item of the scope has a recorded pass or finding.
- Each finding has file, line, severity and a failure scenario that can be reproduced or argued from the code.

## Evidence
- The audit record for bundle size, rendering and request storms.
- The searches and commands used with their output.

## Failure behavior
- If any part of the scope cannot be read, report BLOCKED, never PASS.
- If the scope contains no the build output, say so explicitly instead of returning an empty clean result.

## Rollback and recovery
- Read-only: nothing is changed, so there is nothing to roll back; rerun with the corrected scope if the scope was wrong.

## Human approval
- Read-only analysis: it reports and changes nothing, so no human approval is needed.
