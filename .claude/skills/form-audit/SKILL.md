---
name: form-audit
description: Audits forms for validation, errors, defaults and concurrency. Use when a change touches the changed forms, their schemas and submit handlers.
---
# form-audit

## Classification
- kind: audit
- domain: frontend
- batch: 16
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Audits forms for validation, errors, defaults and concurrency.

## Invocation conditions
- A change touches the changed forms, their schemas and submit handlers.
- A reviewer, gate or owner asks for the audit of forms for validation, errors, defaults and concurrency.
- Before a release that includes changes to this area.

## Required inputs
- The diff or the area to audit: the changed forms, their schemas and submit handlers.
- The architecture and security documents of the repository that state the rules for this area.

## Procedure
1. Read the scope: the changed forms, their schemas and submit handlers, and list every item to inspect.
2. Check client validation mirrors the server rules and server errors are shown per field.
3. Check defaults, reset and dirty-state behavior, and double submit protection.
4. Check edit forms carry the version they read and handle conflicts.
5. Classify each finding as a validation gap, a lost server error or a concurrency gap with severity, file, line and the concrete failure scenario.
6. Record the items that passed as well as the findings.

## Expected outputs
- An audit record of forms for validation, errors, defaults and concurrency with per-item results and ranked findings.

## Validation
- Every item of the scope has a recorded pass or finding.
- Each finding has file, line, severity and a failure scenario that can be reproduced or argued from the code.

## Evidence
- The audit record for forms for validation, errors, defaults and concurrency.
- The searches and commands used with their output.

## Failure behavior
- If any part of the scope cannot be read, report BLOCKED, never PASS.
- If the scope contains no the changed forms, say so explicitly instead of returning an empty clean result.

## Rollback and recovery
- Read-only: nothing is changed, so there is nothing to roll back; rerun with the corrected scope if the scope was wrong.

## Human approval
- Read-only analysis: it reports and changes nothing, so no human approval is needed.
