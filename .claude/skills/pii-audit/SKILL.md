---
name: pii-audit
description: Audits personal data collection, storage, logging and export. Use when a change touches entities with personal fields, logging calls and exports.
---
# pii-audit

## Classification
- kind: audit
- domain: security
- batch: 16
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Audits personal data collection, storage, logging and export.

## Invocation conditions
- A change touches entities with personal fields, logging calls and exports.
- A reviewer, gate or owner asks for the audit of personal data collection, storage, logging and export.
- Before a release that includes changes to this area.

## Required inputs
- The diff or the area to audit: entities with personal fields, logging calls and exports.
- The architecture and security documents of the repository that state the rules for this area.

## Procedure
1. Read the scope: entities with personal fields, logging calls and exports, and list every item to inspect.
2. List personal fields and where each is stored, shown, logged and exported.
3. Check masking and role limits at display.
4. Check logs, errors, analytics and exports exclude personal values the role may not see.
5. Classify each finding as a personal data exposure path with severity, file, line and the concrete failure scenario.
6. Record the items that passed as well as the findings.

## Expected outputs
- An audit record of personal data collection, storage, logging and export with per-item results and ranked findings.

## Validation
- Every item of the scope has a recorded pass or finding.
- Each finding has file, line, severity and a failure scenario that can be reproduced or argued from the code.

## Evidence
- The audit record for personal data collection, storage, logging and export.
- The searches and commands used with their output.

## Failure behavior
- If any part of the scope cannot be read, report BLOCKED, never PASS.
- If the scope contains no entities with personal fields, say so explicitly instead of returning an empty clean result.

## Rollback and recovery
- Read-only: nothing is changed, so there is nothing to roll back; rerun with the corrected scope if the scope was wrong.

## Human approval
- Read-only analysis: it reports and changes nothing, so no human approval is needed.
