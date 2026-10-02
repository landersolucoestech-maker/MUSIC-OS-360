---
name: session-security-audit
description: Audits session lifetime, rotation and revocation. Use when a change touches session and token code on server and client.
---
# session-security-audit

## Classification
- kind: audit
- domain: security
- batch: 16
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Audits session lifetime, rotation and revocation.

## Invocation conditions
- A change touches session and token code on server and client.
- A reviewer, gate or owner asks for the audit of session lifetime, rotation and revocation.
- Before a release that includes changes to this area.

## Required inputs
- The diff or the area to audit: session and token code on server and client.
- The architecture and security documents of the repository that state the rules for this area.

## Procedure
1. Read the scope: session and token code on server and client, and list every item to inspect.
2. Check where the credential is stored and what can read it.
3. Check expiry, refresh and revocation including after password change and logout.
4. Check transport flags and fixation resistance.
5. Classify each finding as a stealable, persistent or fixable session with severity, file, line and the concrete failure scenario.
6. Record the items that passed as well as the findings.

## Expected outputs
- An audit record of session lifetime, rotation and revocation with per-item results and ranked findings.

## Validation
- Every item of the scope has a recorded pass or finding.
- Each finding has file, line, severity and a failure scenario that can be reproduced or argued from the code.

## Evidence
- The audit record for session lifetime, rotation and revocation.
- The searches and commands used with their output.

## Failure behavior
- If any part of the scope cannot be read, report BLOCKED, never PASS.
- If the scope contains no session and token code on server and client, say so explicitly instead of returning an empty clean result.

## Rollback and recovery
- Read-only: nothing is changed, so there is nothing to roll back; rerun with the corrected scope if the scope was wrong.

## Human approval
- Read-only analysis: it reports and changes nothing, so no human approval is needed.
