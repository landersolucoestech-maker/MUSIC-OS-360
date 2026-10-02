---
name: database-audit
description: Audits schema, constraints, indexes and RLS. Use when a change touches the migrations, entities and the migrated catalog.
---
# database-audit

## Classification
- kind: audit
- domain: database
- batch: 16
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Audits schema, constraints, indexes and RLS.

## Invocation conditions
- A change touches the migrations, entities and the migrated catalog.
- A reviewer, gate or owner asks for the audit of schema, constraints, indexes and policies.
- Before a release that includes changes to this area.

## Required inputs
- The diff or the area to audit: the migrations, entities and the migrated catalog.
- The architecture and security documents of the repository that state the rules for this area.

## Procedure
1. Read the scope: the migrations, entities and the migrated catalog, and list every item to inspect.
2. Compare entities with the catalog columns, types and nullability.
3. Check constraints protect the invariants the application assumes.
4. Check indexes match query patterns and tenant tables have enabled and forced policies.
5. Classify each finding as a drift, an unprotected invariant, a missing index or a missing policy with severity, file, line and the concrete failure scenario.
6. Record the items that passed as well as the findings.

## Expected outputs
- An audit record of schema, constraints, indexes and policies with per-item results and ranked findings.

## Validation
- Every item of the scope has a recorded pass or finding.
- Each finding has file, line, severity and a failure scenario that can be reproduced or argued from the code.

## Evidence
- The audit record for schema, constraints, indexes and policies.
- The searches and commands used with their output.

## Failure behavior
- If any part of the scope cannot be read, report BLOCKED, never PASS.
- If the scope contains no the migrations, say so explicitly instead of returning an empty clean result.

## Rollback and recovery
- Read-only: nothing is changed, so there is nothing to roll back; rerun with the corrected scope if the scope was wrong.

## Human approval
- Read-only analysis: it reports and changes nothing, so no human approval is needed.
