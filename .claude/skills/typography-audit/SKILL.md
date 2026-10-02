---
name: typography-audit
description: Audits type scale, weight and line length. Use when a change touches the changed screens and text styles.
---
# typography-audit

## Classification
- kind: audit
- domain: frontend
- batch: 16
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Audits type scale, weight and line length.

## Invocation conditions
- A change touches the changed screens and text styles.
- A reviewer, gate or owner asks for the audit of type scale, weight and line length.
- Before a release that includes changes to this area.

## Required inputs
- The diff or the area to audit: the changed screens and text styles.
- The architecture and security documents of the repository that state the rules for this area.

## Procedure
1. Read the scope: the changed screens and text styles, and list every item to inspect.
2. Check sizes and weights come from the type scale.
3. Check line length and line height for readability.
4. Check headings follow a logical hierarchy.
5. Classify each finding as an off-scale style or a readability problem with severity, file, line and the concrete failure scenario.
6. Record the items that passed as well as the findings.

## Expected outputs
- An audit record of type scale, weight and line length with per-item results and ranked findings.

## Validation
- Every item of the scope has a recorded pass or finding.
- Each finding has file, line, severity and a failure scenario that can be reproduced or argued from the code.

## Evidence
- The audit record for type scale, weight and line length.
- The searches and commands used with their output.

## Failure behavior
- If any part of the scope cannot be read, report BLOCKED, never PASS.
- If the scope contains no the changed screens and text styles, say so explicitly instead of returning an empty clean result.

## Rollback and recovery
- Read-only: nothing is changed, so there is nothing to roll back; rerun with the corrected scope if the scope was wrong.

## Human approval
- Read-only analysis: it reports and changes nothing, so no human approval is needed.
