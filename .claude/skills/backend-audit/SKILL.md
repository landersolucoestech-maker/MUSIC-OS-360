---
name: backend-audit
description: Audits backend modules for validation, authorization and error handling. Use when a change touches the changed controllers, services and repositories.
---
# backend-audit

## Classification
- kind: audit
- domain: backend
- batch: 16
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Audits backend modules for validation, authorization and error handling.

## Invocation conditions
- A change touches the changed controllers, services and repositories.
- A reviewer, gate or owner asks for the audit of backend modules for validation, authorization and error handling.
- Before a release that includes changes to this area.

## Required inputs
- The diff or the area to audit: the changed controllers, services and repositories.
- The architecture and security documents of the repository that state the rules for this area.

## Procedure
1. Read the scope: the changed controllers, services and repositories, and list every item to inspect.
2. Check every entry point validates input with explicit rules before business logic.
3. Check authorization and tenant scoping are enforced server-side on every action.
4. Check errors are typed, mapped to stable responses and never expose internals.
5. Classify each finding as a validation gap, an authorization gap or an error leak with severity, file, line and the concrete failure scenario.
6. Record the items that passed as well as the findings.

## Expected outputs
- An audit record of backend modules for validation, authorization and error handling with per-item results and ranked findings.

## Validation
- Every item of the scope has a recorded pass or finding.
- Each finding has file, line, severity and a failure scenario that can be reproduced or argued from the code.

## Evidence
- The audit record for backend modules for validation, authorization and error handling.
- The searches and commands used with their output.

## Failure behavior
- If any part of the scope cannot be read, report BLOCKED, never PASS.
- If the scope contains no the changed controllers, say so explicitly instead of returning an empty clean result.

## Rollback and recovery
- Read-only: nothing is changed, so there is nothing to roll back; rerun with the corrected scope if the scope was wrong.

## Human approval
- Read-only analysis: it reports and changes nothing, so no human approval is needed.
