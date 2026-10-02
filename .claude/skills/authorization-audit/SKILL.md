---
name: authorization-audit
description: Verifies every endpoint and job enforces server-side authorization. Use when a change touches controllers, guards, decorators, queue processors and scheduled jobs.
---
# authorization-audit

## Classification
- kind: audit
- domain: security
- batch: 16
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Verifies every endpoint and job enforces server-side authorization.

## Invocation conditions
- A change touches controllers, guards, decorators, queue processors and scheduled jobs.
- A reviewer, gate or owner asks for the audit of every endpoint and job for server-side authorization.
- Before a release that includes changes to this area.

## Required inputs
- The diff or the area to audit: controllers, guards, decorators, queue processors and scheduled jobs.
- The architecture and security documents of the repository that state the rules for this area.

## Procedure
1. Read the scope: controllers, guards, decorators, queue processors and scheduled jobs, and list every item to inspect.
2. List every endpoint and job in scope and the authorization check each performs.
3. Check ownership and tenant are verified against the target resource, not only the caller role.
4. Check batch, export and background paths apply the same rules as single-item paths, and prove each defect with a denied-case scenario.
5. Classify each finding as a route or job reachable without the right permission, ownership or tenant with severity, file, line and the concrete failure scenario.
6. Record the items that passed as well as the findings.

## Expected outputs
- An audit record of every endpoint and job for server-side authorization with per-item results and ranked findings.

## Validation
- Every item of the scope has a recorded pass or finding.
- Each finding has file, line, severity and a failure scenario that can be reproduced or argued from the code.

## Evidence
- The audit record for every endpoint and job for server-side authorization.
- The searches and commands used with their output.

## Failure behavior
- If any part of the scope cannot be read, report BLOCKED, never PASS.
- If the scope contains no controllers, say so explicitly instead of returning an empty clean result.

## Rollback and recovery
- Read-only: nothing is changed, so there is nothing to roll back; rerun with the corrected scope if the scope was wrong.

## Human approval
- Read-only analysis: it reports and changes nothing, so no human approval is needed.
