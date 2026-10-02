---
name: error-state-audit
description: Audits error states for safe, humanized messages. Use when a change modifies error displays, toasts and boundaries.
---
# error-state-audit

## Classification
- kind: audit
- domain: frontend
- batch: 16
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Audits error states for safe, humanized messages.

## Invocation conditions
- A change modifies error displays, toasts and boundaries.
- A reviewer, gate or owner asks for the audit of error states for safe, humanized messages.
- Before a release that includes changes to this area.

## Required inputs
- The diff or the area to audit: the changed error displays, toasts and boundaries.
- The architecture and security documents of the repository that state the rules for this area.

## Procedure
1. Read the scope: the changed error displays, toasts and boundaries, and list every item to inspect.
2. Trigger or read each error path and record the text shown.
3. Check messages are humanized in the product language and never show codes, stack traces or raw provider text.
4. Check the user can retry or recover from the error state.
5. Classify each finding as a leaked internal detail, an unhelpful message or a dead end with severity, file, line and the concrete failure scenario.
6. Record the items that passed as well as the findings.

## Expected outputs
- An audit record of error states for safe, humanized messages with per-item results and ranked findings.

## Validation
- Every item of the scope has a recorded pass or finding.
- Each finding has file, line, severity and a failure scenario that can be reproduced or argued from the code.

## Evidence
- The audit record for error states for safe, humanized messages.
- The searches and commands used with their output.

## Failure behavior
- If any part of the scope cannot be read, report BLOCKED, never PASS.
- If the scope contains no the changed error displays, say so explicitly instead of returning an empty clean result.

## Rollback and recovery
- Read-only: nothing is changed, so there is nothing to roll back; rerun with the corrected scope if the scope was wrong.

## Human approval
- Read-only analysis: it reports and changes nothing, so no human approval is needed.
