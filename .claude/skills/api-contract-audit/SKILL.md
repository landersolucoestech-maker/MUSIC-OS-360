---
name: api-contract-audit
description: Audits an API contract for producer and consumer agreement. Use when a change touches the DTOs, controllers and the web clients and types that consume them.
---
# api-contract-audit

## Classification
- kind: audit
- domain: backend
- batch: 16
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Audits an API contract for producer and consumer agreement.

## Invocation conditions
- A change touches the DTOs, controllers and the web clients and types that consume them.
- A reviewer, gate or owner asks for the audit of an API contract for producer and consumer agreement.
- Before a release that includes changes to this area.

## Required inputs
- The diff or the area to audit: the DTOs, controllers and the web clients and types that consume them.
- The architecture and security documents of the repository that state the rules for this area.

## Procedure
1. Read the scope: the DTOs, controllers and the web clients and types that consume them, and list every item to inspect.
2. Compare response shapes with the types the clients use.
3. Check changes are backward compatible or versioned.
4. Check error shapes and status codes are documented and consistent.
5. Classify each finding as a contract break, an undocumented behavior or a drift with severity, file, line and the concrete failure scenario.
6. Record the items that passed as well as the findings.

## Expected outputs
- An audit record of an API contract for producer and consumer agreement with per-item results and ranked findings.

## Validation
- Every item of the scope has a recorded pass or finding.
- Each finding has file, line, severity and a failure scenario that can be reproduced or argued from the code.

## Evidence
- The audit record for an API contract for producer and consumer agreement.
- The searches and commands used with their output.

## Failure behavior
- If any part of the scope cannot be read, report BLOCKED, never PASS.
- If the scope contains no the DTOs, say so explicitly instead of returning an empty clean result.

## Rollback and recovery
- Read-only: nothing is changed, so there is nothing to roll back; rerun with the corrected scope if the scope was wrong.

## Human approval
- Read-only analysis: it reports and changes nothing, so no human approval is needed.
