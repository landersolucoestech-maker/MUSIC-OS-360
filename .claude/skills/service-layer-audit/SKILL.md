---
name: service-layer-audit
description: Audits services for business rule placement and transactions. Use when a change modifies services.
---
# service-layer-audit

## Classification
- kind: audit
- domain: backend
- batch: 16
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Audits services for business rule placement and transactions.

## Invocation conditions
- A change modifies services.
- A reviewer, gate or owner asks for the audit of services for business rule placement and transactions.
- Before a release that includes changes to this area.

## Required inputs
- The diff or the area to audit: the changed services.
- The architecture and security documents of the repository that state the rules for this area.

## Procedure
1. Read the scope: the changed services, and list every item to inspect.
2. Check business rules live in services and not in controllers or repositories.
3. Check multi-step writes are in a transaction and external calls are outside it.
4. Check the same rule is not implemented again in another layer without a stated reason.
5. Classify each finding as a misplaced rule, a missing transaction or a duplicated rule with severity, file, line and the concrete failure scenario.
6. Record the items that passed as well as the findings.

## Expected outputs
- An audit record of services for business rule placement and transactions with per-item results and ranked findings.

## Validation
- Every item of the scope has a recorded pass or finding.
- Each finding has file, line, severity and a failure scenario that can be reproduced or argued from the code.

## Evidence
- The audit record for services for business rule placement and transactions.
- The searches and commands used with their output.

## Failure behavior
- If any part of the scope cannot be read, report BLOCKED, never PASS.
- If the scope contains no the changed services, say so explicitly instead of returning an empty clean result.

## Rollback and recovery
- Read-only: nothing is changed, so there is nothing to roll back; rerun with the corrected scope if the scope was wrong.

## Human approval
- Read-only analysis: it reports and changes nothing, so no human approval is needed.
