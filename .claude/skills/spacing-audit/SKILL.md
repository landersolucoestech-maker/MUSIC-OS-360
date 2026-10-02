---
name: spacing-audit
description: Audits spacing against the token scale. Use when a change touches the changed layouts and components.
---
# spacing-audit

## Classification
- kind: audit
- domain: frontend
- batch: 16
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Audits spacing against the token scale.

## Invocation conditions
- A change touches the changed layouts and components.
- A reviewer, gate or owner asks for the audit of spacing against the token scale.
- Before a release that includes changes to this area.

## Required inputs
- The diff or the area to audit: the changed layouts and components.
- The architecture and security documents of the repository that state the rules for this area.

## Procedure
1. Read the scope: the changed layouts and components, and list every item to inspect.
2. Search for literal spacing values and compare them with the scale.
3. Check consistent rhythm between related elements.
4. Check spacing at the supported widths.
5. Classify each finding as an off-scale value or an inconsistent rhythm with severity, file, line and the concrete failure scenario.
6. Record the items that passed as well as the findings.

## Expected outputs
- An audit record of spacing against the token scale with per-item results and ranked findings.

## Validation
- Every item of the scope has a recorded pass or finding.
- Each finding has file, line, severity and a failure scenario that can be reproduced or argued from the code.

## Evidence
- The audit record for spacing against the token scale.
- The searches and commands used with their output.

## Failure behavior
- If any part of the scope cannot be read, report BLOCKED, never PASS.
- If the scope contains no the changed layouts and components, say so explicitly instead of returning an empty clean result.

## Rollback and recovery
- Read-only: nothing is changed, so there is nothing to roll back; rerun with the corrected scope if the scope was wrong.

## Human approval
- Read-only analysis: it reports and changes nothing, so no human approval is needed.
