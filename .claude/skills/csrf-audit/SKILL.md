---
name: csrf-audit
description: Audits state-changing requests for CSRF protection. Use when a change touches the credential transport, CORS configuration and state-changing routes.
---
# csrf-audit

## Classification
- kind: audit
- domain: security
- batch: 16
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Audits state-changing requests for CSRF protection.

## Invocation conditions
- A change touches the credential transport, CORS configuration and state-changing routes.
- A reviewer, gate or owner asks for the audit of state-changing requests for CSRF protection.
- Before a release that includes changes to this area.

## Required inputs
- The diff or the area to audit: the credential transport, CORS configuration and state-changing routes.
- The architecture and security documents of the repository that state the rules for this area.

## Procedure
1. Read the scope: the credential transport, CORS configuration and state-changing routes, and list every item to inspect.
2. Establish how the browser attaches credentials.
3. If cookies are used, check same-site rules, tokens and origin checks.
4. Check safe methods never change state.
5. Classify each finding as a state-changing route a third-party page could trigger with severity, file, line and the concrete failure scenario.
6. Record the items that passed as well as the findings.

## Expected outputs
- An audit record of state-changing requests for CSRF protection with per-item results and ranked findings.

## Validation
- Every item of the scope has a recorded pass or finding.
- Each finding has file, line, severity and a failure scenario that can be reproduced or argued from the code.

## Evidence
- The audit record for state-changing requests for CSRF protection.
- The searches and commands used with their output.

## Failure behavior
- If any part of the scope cannot be read, report BLOCKED, never PASS.
- If the scope contains no the credential transport, say so explicitly instead of returning an empty clean result.

## Rollback and recovery
- Read-only: nothing is changed, so there is nothing to roll back; rerun with the corrected scope if the scope was wrong.

## Human approval
- Read-only analysis: it reports and changes nothing, so no human approval is needed.
