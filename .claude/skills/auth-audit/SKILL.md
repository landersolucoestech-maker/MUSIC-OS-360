---
name: auth-audit
description: Audits authentication flows and token handling. Use when a change touches the auth module, token and session code.
---
# auth-audit

## Classification
- kind: audit
- domain: security
- batch: 16
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Audits authentication flows and token handling.

## Invocation conditions
- A change touches the auth module, token and session code.
- A reviewer, gate or owner asks for the audit of authentication flows and token handling.
- Before a release that includes changes to this area.

## Required inputs
- The diff or the area to audit: the auth module, token and session code.
- The architecture and security documents of the repository that state the rules for this area.

## Procedure
1. Read the scope: the auth module, token and session code, and list every item to inspect.
2. Check credentials are verified with approved hashing and constant-time comparison.
3. Check token lifetime, rotation and revocation.
4. Check responses and timing do not reveal whether an account exists and that the development bypass cannot activate in production.
5. Classify each finding as a login without proof, an enumeration path or a lingering session with severity, file, line and the concrete failure scenario.
6. Record the items that passed as well as the findings.

## Expected outputs
- An audit record of authentication flows and token handling with per-item results and ranked findings.

## Validation
- Every item of the scope has a recorded pass or finding.
- Each finding has file, line, severity and a failure scenario that can be reproduced or argued from the code.

## Evidence
- The audit record for authentication flows and token handling.
- The searches and commands used with their output.

## Failure behavior
- If any part of the scope cannot be read, report BLOCKED, never PASS.
- If the scope contains no the auth module, say so explicitly instead of returning an empty clean result.

## Rollback and recovery
- Read-only: nothing is changed, so there is nothing to roll back; rerun with the corrected scope if the scope was wrong.

## Human approval
- Read-only analysis: it reports and changes nothing, so no human approval is needed.
