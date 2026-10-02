---
name: navigation-audit
description: Audits routes, menus and links for dead ends and auth redirects. Use when a change touches the menus, links and route definitions.
---
# navigation-audit

## Classification
- kind: audit
- domain: frontend
- batch: 16
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Audits routes, menus and links for dead ends and auth redirects.

## Invocation conditions
- A change touches the menus, links and route definitions.
- A reviewer, gate or owner asks for the audit of routes, menus and links for dead ends and auth redirects.
- Before a release that includes changes to this area.

## Required inputs
- The diff or the area to audit: the menus, links and route definitions.
- The architecture and security documents of the repository that state the rules for this area.

## Procedure
1. Read the scope: the menus, links and route definitions, and list every item to inspect.
2. Follow every menu entry and link to its destination.
3. Check destinations exist and respect permissions.
4. Check authentication redirects return the user to the intended page.
5. Classify each finding as a dead end, a broken link or a wrong redirect with severity, file, line and the concrete failure scenario.
6. Record the items that passed as well as the findings.

## Expected outputs
- An audit record of routes, menus and links for dead ends and auth redirects with per-item results and ranked findings.

## Validation
- Every item of the scope has a recorded pass or finding.
- Each finding has file, line, severity and a failure scenario that can be reproduced or argued from the code.

## Evidence
- The audit record for routes, menus and links for dead ends and auth redirects.
- The searches and commands used with their output.

## Failure behavior
- If any part of the scope cannot be read, report BLOCKED, never PASS.
- If the scope contains no the menus, say so explicitly instead of returning an empty clean result.

## Rollback and recovery
- Read-only: nothing is changed, so there is nothing to roll back; rerun with the corrected scope if the scope was wrong.

## Human approval
- Read-only analysis: it reports and changes nothing, so no human approval is needed.
