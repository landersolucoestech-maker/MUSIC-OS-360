---
name: interaction-audit
description: Audits hover, focus, disabled and loading interactions. Use when a change modifies interactive components.
---
# interaction-audit

## Classification
- kind: audit
- domain: frontend
- batch: 16
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Audits hover, focus, disabled and loading interactions.

## Invocation conditions
- A change modifies interactive components.
- A reviewer, gate or owner asks for the audit of hover, focus, disabled and loading interactions.
- Before a release that includes changes to this area.

## Required inputs
- The diff or the area to audit: the changed interactive components.
- The architecture and security documents of the repository that state the rules for this area.

## Procedure
1. Read the scope: the changed interactive components, and list every item to inspect.
2. Check every control has hover, focus, active, disabled and loading states.
3. Check a loading control cannot be triggered twice.
4. Check disabled controls explain why when the reason is not obvious.
5. Classify each finding as a missing state or a double trigger with severity, file, line and the concrete failure scenario.
6. Record the items that passed as well as the findings.

## Expected outputs
- An audit record of hover, focus, disabled and loading interactions with per-item results and ranked findings.

## Validation
- Every item of the scope has a recorded pass or finding.
- Each finding has file, line, severity and a failure scenario that can be reproduced or argued from the code.

## Evidence
- The audit record for hover, focus, disabled and loading interactions.
- The searches and commands used with their output.

## Failure behavior
- If any part of the scope cannot be read, report BLOCKED, never PASS.
- If the scope contains no the changed interactive components, say so explicitly instead of returning an empty clean result.

## Rollback and recovery
- Read-only: nothing is changed, so there is nothing to roll back; rerun with the corrected scope if the scope was wrong.

## Human approval
- Read-only analysis: it reports and changes nothing, so no human approval is needed.
