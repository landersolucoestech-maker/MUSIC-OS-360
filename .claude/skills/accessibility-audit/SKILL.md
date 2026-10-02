---
name: accessibility-audit
description: Audits keyboard, focus, semantics, contrast and labels. Use when a change modifies screens and components.
---
# accessibility-audit

## Classification
- kind: audit
- domain: frontend
- batch: 16
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Audits keyboard, focus, semantics, contrast and labels.

## Invocation conditions
- A change modifies screens and components.
- A reviewer, gate or owner asks for the audit of keyboard, focus, semantics, contrast and labels.
- Before a release that includes changes to this area.

## Required inputs
- The diff or the area to audit: the changed screens and components.
- The architecture and security documents of the repository that state the rules for this area.

## Procedure
1. Read the scope: the changed screens and components, and list every item to inspect.
2. Operate each screen with the keyboard only and record focus order and traps.
3. Check every control has an accessible name, role and state and every input a label.
4. Check text and control contrast against the guidelines and run the automated checks.
5. Classify each finding as a keyboard failure, a missing name or label, or a contrast failure with severity, file, line and the concrete failure scenario.
6. Record the items that passed as well as the findings.

## Expected outputs
- An audit record of keyboard, focus, semantics, contrast and labels with per-item results and ranked findings.

## Validation
- Every item of the scope has a recorded pass or finding.
- Each finding has file, line, severity and a failure scenario that can be reproduced or argued from the code.

## Evidence
- The audit record for keyboard, focus, semantics, contrast and labels.
- The searches and commands used with their output.

## Failure behavior
- If any part of the scope cannot be read, report BLOCKED, never PASS.
- If the scope contains no the changed screens and components, say so explicitly instead of returning an empty clean result.

## Rollback and recovery
- Read-only: nothing is changed, so there is nothing to roll back; rerun with the corrected scope if the scope was wrong.

## Human approval
- Read-only analysis: it reports and changes nothing, so no human approval is needed.
