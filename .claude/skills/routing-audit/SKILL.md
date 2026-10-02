---
name: routing-audit
description: Audits client routing, guards and redirects. Use when a change touches the router definition, route guards and lazy boundaries.
---
# routing-audit

## Classification
- kind: audit
- domain: frontend
- batch: 16
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Audits client routing, guards and redirects.

## Invocation conditions
- A change touches the router definition, route guards and lazy boundaries.
- A reviewer, gate or owner asks for the audit of client routing, guards and redirects.
- Before a release that includes changes to this area.

## Required inputs
- The diff or the area to audit: the router definition, route guards and lazy boundaries.
- The architecture and security documents of the repository that state the rules for this area.

## Procedure
1. Read the scope: the router definition, route guards and lazy boundaries, and list every item to inspect.
2. Check every route that needs authentication or a permission has a guard and the server also enforces it.
3. Check redirects after login and logout cannot loop or leave the application.
4. Check unknown routes and lazy loading failures land on a safe screen.
5. Classify each finding as an unguarded route, a redirect loop or a dead end with severity, file, line and the concrete failure scenario.
6. Record the items that passed as well as the findings.

## Expected outputs
- An audit record of client routing, guards and redirects with per-item results and ranked findings.

## Validation
- Every item of the scope has a recorded pass or finding.
- Each finding has file, line, severity and a failure scenario that can be reproduced or argued from the code.

## Evidence
- The audit record for client routing, guards and redirects.
- The searches and commands used with their output.

## Failure behavior
- If any part of the scope cannot be read, report BLOCKED, never PASS.
- If the scope contains no the router definition, say so explicitly instead of returning an empty clean result.

## Rollback and recovery
- Read-only: nothing is changed, so there is nothing to roll back; rerun with the corrected scope if the scope was wrong.

## Human approval
- Read-only analysis: it reports and changes nothing, so no human approval is needed.
