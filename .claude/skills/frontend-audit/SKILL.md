---
name: frontend-audit
description: Audits the frontend for structure, data flow and defects. Use when a change touches the web source tree, its modules, hooks and shared components.
---
# frontend-audit

## Classification
- kind: audit
- domain: frontend
- batch: 16
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Audits the frontend for structure, data flow and defects.

## Invocation conditions
- A change touches the web source tree, its modules, hooks and shared components.
- A reviewer, gate or owner asks for the audit of the frontend structure, data flow and defects.
- Before a release that includes changes to this area.

## Required inputs
- The diff or the area to audit: the web source tree, its modules, hooks and shared components.
- The architecture and security documents of the repository that state the rules for this area.

## Procedure
1. Read the scope: the web source tree, its modules, hooks and shared components, and list every item to inspect.
2. Check files sit in the module layout and shared code in the shared folders.
3. Check server data lives in the query cache and is not copied into duplicate local state.
4. Check every async surface shows loading, empty and error states and that raw identifiers never reach the user.
5. Classify each finding as a defect, a convention break or an unverified area with severity, file, line and the concrete failure scenario.
6. Record the items that passed as well as the findings.

## Expected outputs
- An audit record of the frontend structure, data flow and defects with per-item results and ranked findings.

## Validation
- Every item of the scope has a recorded pass or finding.
- Each finding has file, line, severity and a failure scenario that can be reproduced or argued from the code.

## Evidence
- The audit record for the frontend structure, data flow and defects.
- The searches and commands used with their output.

## Failure behavior
- If any part of the scope cannot be read, report BLOCKED, never PASS.
- If the scope contains no the web source tree, say so explicitly instead of returning an empty clean result.

## Rollback and recovery
- Read-only: nothing is changed, so there is nothing to roll back; rerun with the corrected scope if the scope was wrong.

## Human approval
- Read-only analysis: it reports and changes nothing, so no human approval is needed.
