---
name: upload-security-audit
description: Audits file upload for type, size, storage and exposure. Use when a change touches upload controllers, storage code and download access rules.
---
# upload-security-audit

## Classification
- kind: audit
- domain: security
- batch: 16
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Audits file upload for type, size, storage and exposure.

## Invocation conditions
- A change touches upload controllers, storage code and download access rules.
- A reviewer, gate or owner asks for the audit of file upload for type, size, storage and exposure.
- Before a release that includes changes to this area.

## Required inputs
- The diff or the area to audit: upload controllers, storage code and download access rules.
- The architecture and security documents of the repository that state the rules for this area.

## Procedure
1. Read the scope: upload controllers, storage code and download access rules, and list every item to inspect.
2. Check type is verified by content and size and count are limited.
3. Check storage keys are generated server-side with the tenant.
4. Check downloads and signed URLs are authorized per file and expire.
5. Classify each finding as a dangerous content path, a traversal or a cross-tenant exposure with severity, file, line and the concrete failure scenario.
6. Record the items that passed as well as the findings.

## Expected outputs
- An audit record of file upload for type, size, storage and exposure with per-item results and ranked findings.

## Validation
- Every item of the scope has a recorded pass or finding.
- Each finding has file, line, severity and a failure scenario that can be reproduced or argued from the code.

## Evidence
- The audit record for file upload for type, size, storage and exposure.
- The searches and commands used with their output.

## Failure behavior
- If any part of the scope cannot be read, report BLOCKED, never PASS.
- If the scope contains no upload controllers, say so explicitly instead of returning an empty clean result.

## Rollback and recovery
- Read-only: nothing is changed, so there is nothing to roll back; rerun with the corrected scope if the scope was wrong.

## Human approval
- Read-only analysis: it reports and changes nothing, so no human approval is needed.
