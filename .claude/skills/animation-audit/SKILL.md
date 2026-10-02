---
name: animation-audit
description: Audits motion for purpose, duration and reduced-motion support. Use when a change modifies animations and transitions.
---
# animation-audit

## Classification
- kind: audit
- domain: frontend
- batch: 16
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Audits motion for purpose, duration and reduced-motion support.

## Invocation conditions
- A change modifies animations and transitions.
- A reviewer, gate or owner asks for the audit of motion for purpose, duration and reduced-motion support.
- Before a release that includes changes to this area.

## Required inputs
- The diff or the area to audit: the changed animations and transitions.
- The architecture and security documents of the repository that state the rules for this area.

## Procedure
1. Read the scope: the changed animations and transitions, and list every item to inspect.
2. List each animation and its purpose.
3. Check durations and easing stay within the design conventions.
4. Check the reduced-motion preference disables or simplifies each animation.
5. Classify each finding as a purposeless animation, an overlong one or a missing reduced-motion path with severity, file, line and the concrete failure scenario.
6. Record the items that passed as well as the findings.

## Expected outputs
- An audit record of motion for purpose, duration and reduced-motion support with per-item results and ranked findings.

## Validation
- Every item of the scope has a recorded pass or finding.
- Each finding has file, line, severity and a failure scenario that can be reproduced or argued from the code.

## Evidence
- The audit record for motion for purpose, duration and reduced-motion support.
- The searches and commands used with their output.

## Failure behavior
- If any part of the scope cannot be read, report BLOCKED, never PASS.
- If the scope contains no the changed animations and transitions, say so explicitly instead of returning an empty clean result.

## Rollback and recovery
- Read-only: nothing is changed, so there is nothing to roll back; rerun with the corrected scope if the scope was wrong.

## Human approval
- Read-only analysis: it reports and changes nothing, so no human approval is needed.
