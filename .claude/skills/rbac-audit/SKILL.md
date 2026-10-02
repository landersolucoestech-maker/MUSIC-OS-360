---
name: rbac-audit
description: Audits roles and permissions for escalation paths. Use when a change touches role definitions, the permission matrix and the guards.
---
# rbac-audit

## Classification
- kind: audit
- domain: security
- batch: 16
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Audits roles and permissions for escalation paths.

## Invocation conditions
- A change touches role definitions, the permission matrix and the guards.
- A reviewer, gate or owner asks for the audit of roles and permissions for escalation paths.
- Before a release that includes changes to this area.

## Required inputs
- The diff or the area to audit: role definitions, the permission matrix and the guards.
- The architecture and security documents of the repository that state the rules for this area.

## Procedure
1. Read the scope: role definitions, the permission matrix and the guards, and list every item to inspect.
2. Compare each role with the least access its work needs.
3. Check a role cannot grant itself or others a higher role.
4. Check server and client permission lists share one source.
5. Classify each finding as an over-broad role or an escalation path with severity, file, line and the concrete failure scenario.
6. Record the items that passed as well as the findings.

## Expected outputs
- An audit record of roles and permissions for escalation paths with per-item results and ranked findings.

## Validation
- Every item of the scope has a recorded pass or finding.
- Each finding has file, line, severity and a failure scenario that can be reproduced or argued from the code.

## Evidence
- The audit record for roles and permissions for escalation paths.
- The searches and commands used with their output.

## Failure behavior
- If any part of the scope cannot be read, report BLOCKED, never PASS.
- If the scope contains no role definitions, say so explicitly instead of returning an empty clean result.

## Rollback and recovery
- Read-only: nothing is changed, so there is nothing to roll back; rerun with the corrected scope if the scope was wrong.

## Human approval
- Read-only analysis: it reports and changes nothing, so no human approval is needed.
