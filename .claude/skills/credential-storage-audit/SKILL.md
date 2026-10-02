---
name: credential-storage-audit
description: Audits how credentials and tokens are stored and encrypted. Use when a change touches entities, serializers and storage code for credentials.
---
# credential-storage-audit

## Classification
- kind: audit
- domain: security
- batch: 16
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Audits how credentials and tokens are stored and encrypted.

## Invocation conditions
- A change touches entities, serializers and storage code for credentials.
- A reviewer, gate or owner asks for the audit of how credentials and tokens are stored and encrypted.
- Before a release that includes changes to this area.

## Required inputs
- The diff or the area to audit: entities, serializers and storage code for credentials.
- The architecture and security documents of the repository that state the rules for this area.

## Procedure
1. Read the scope: entities, serializers and storage code for credentials, and list every item to inspect.
2. Check passwords use a slow hash and never reversible encryption.
3. Check provider tokens are encrypted at rest and decrypted only where used.
4. Check serializers, logs and exports never include credential fields.
5. Classify each finding as a recoverable credential or an exposure path, without values with severity, file, line and the concrete failure scenario.
6. Record the items that passed as well as the findings.

## Expected outputs
- An audit record of how credentials and tokens are stored and encrypted with per-item results and ranked findings.

## Validation
- Every item of the scope has a recorded pass or finding.
- Each finding has file, line, severity and a failure scenario that can be reproduced or argued from the code.

## Evidence
- The audit record for how credentials and tokens are stored and encrypted.
- The searches and commands used with their output.

## Failure behavior
- If any part of the scope cannot be read, report BLOCKED, never PASS.
- If the scope contains no entities, say so explicitly instead of returning an empty clean result.

## Rollback and recovery
- Read-only: nothing is changed, so there is nothing to roll back; rerun with the corrected scope if the scope was wrong.

## Human approval
- Read-only analysis: it reports and changes nothing, so no human approval is needed.
