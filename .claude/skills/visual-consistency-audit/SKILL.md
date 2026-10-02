---
name: visual-consistency-audit
description: Audits UI against tokens, spacing and component conventions. Use when a change touches the changed screens compared with their neighbors.
---
# visual-consistency-audit

## Classification
- kind: audit
- domain: frontend
- batch: 16
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Audits UI against tokens, spacing and component conventions.

## Invocation conditions
- A change touches the changed screens compared with their neighbors.
- A reviewer, gate or owner asks for the audit of UI consistency with tokens, spacing and component conventions.
- Before a release that includes changes to this area.

## Required inputs
- The diff or the area to audit: the changed screens compared with their neighbors.
- The architecture and security documents of the repository that state the rules for this area.

## Procedure
1. Read the scope: the changed screens compared with their neighbors, and list every item to inspect.
2. Compare the screen with sibling screens for layout, controls and wording.
3. Check tokens, spacing and component usage are shared.
4. Report visual differences that have no reason.
5. Classify each finding as an unexplained visual difference with severity, file, line and the concrete failure scenario.
6. Record the items that passed as well as the findings.

## Expected outputs
- An audit record of UI consistency with tokens, spacing and component conventions with per-item results and ranked findings.

## Validation
- Every item of the scope has a recorded pass or finding.
- Each finding has file, line, severity and a failure scenario that can be reproduced or argued from the code.

## Evidence
- The audit record for UI consistency with tokens, spacing and component conventions.
- The searches and commands used with their output.

## Failure behavior
- If any part of the scope cannot be read, report BLOCKED, never PASS.
- If the scope contains no the changed screens compared with their neighbors, say so explicitly instead of returning an empty clean result.

## Rollback and recovery
- Read-only: nothing is changed, so there is nothing to roll back; rerun with the corrected scope if the scope was wrong.

## Human approval
- Read-only analysis: it reports and changes nothing, so no human approval is needed.
