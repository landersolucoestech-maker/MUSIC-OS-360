---
name: modal-audit
description: Audits modals for focus trap, escape and destructive confirmation. Use when a change modifies dialogs and sheets.
---
# modal-audit

## Classification
- kind: audit
- domain: frontend
- batch: 16
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Audits modals for focus trap, escape and destructive confirmation.

## Invocation conditions
- A change modifies dialogs and sheets.
- A reviewer, gate or owner asks for the audit of modals for focus trap, escape and destructive confirmation.
- Before a release that includes changes to this area.

## Required inputs
- The diff or the area to audit: the changed dialogs and sheets.
- The architecture and security documents of the repository that state the rules for this area.

## Procedure
1. Read the scope: the changed dialogs and sheets, and list every item to inspect.
2. Check focus moves into the dialog, is trapped and returns on close.
3. Check Escape and the close control work and background scroll is locked.
4. Check destructive actions state what will be affected and need an explicit confirmation.
5. Classify each finding as a focus problem, a missing close path or an unconfirmed destructive action with severity, file, line and the concrete failure scenario.
6. Record the items that passed as well as the findings.

## Expected outputs
- An audit record of modals for focus trap, escape and destructive confirmation with per-item results and ranked findings.

## Validation
- Every item of the scope has a recorded pass or finding.
- Each finding has file, line, severity and a failure scenario that can be reproduced or argued from the code.

## Evidence
- The audit record for modals for focus trap, escape and destructive confirmation.
- The searches and commands used with their output.

## Failure behavior
- If any part of the scope cannot be read, report BLOCKED, never PASS.
- If the scope contains no the changed dialogs and sheets, say so explicitly instead of returning an empty clean result.

## Rollback and recovery
- Read-only: nothing is changed, so there is nothing to roll back; rerun with the corrected scope if the scope was wrong.

## Human approval
- Read-only analysis: it reports and changes nothing, so no human approval is needed.
