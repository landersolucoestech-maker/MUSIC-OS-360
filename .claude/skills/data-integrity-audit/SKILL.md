---
name: data-integrity-audit
description: Audits invariants, constraints and cross-table consistency. Use when a change touches the entities, constraints and the code that writes shared data.
---
# data-integrity-audit

## Classification
- kind: audit
- domain: database
- batch: 16
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Audits invariants, constraints and cross-table consistency.

## Invocation conditions
- A change touches the entities, constraints and the code that writes shared data.
- A reviewer, gate or owner asks for the audit of invariants, constraints and cross-table consistency.
- Before a release that includes changes to this area.

## Required inputs
- The diff or the area to audit: the entities, constraints and the code that writes shared data.
- The architecture and security documents of the repository that state the rules for this area.

## Procedure
1. Read the scope: the entities, constraints and the code that writes shared data, and list every item to inspect.
2. List the invariants the application assumes and the constraint or single writer that protects each.
3. Find duplicate fields for one concept and the canonical one.
4. Find writes that skip validation such as raw updates and bulk paths.
5. Classify each finding as an unprotected invariant, a duplicate source of truth or a validation bypass with severity, file, line and the concrete failure scenario.
6. Record the items that passed as well as the findings.

## Expected outputs
- An audit record of invariants, constraints and cross-table consistency with per-item results and ranked findings.

## Validation
- Every item of the scope has a recorded pass or finding.
- Each finding has file, line, severity and a failure scenario that can be reproduced or argued from the code.

## Evidence
- The audit record for invariants, constraints and cross-table consistency.
- The searches and commands used with their output.

## Failure behavior
- If any part of the scope cannot be read, report BLOCKED, never PASS.
- If the scope contains no the entities, say so explicitly instead of returning an empty clean result.

## Rollback and recovery
- Read-only: nothing is changed, so there is nothing to roll back; rerun with the corrected scope if the scope was wrong.

## Human approval
- Read-only analysis: it reports and changes nothing, so no human approval is needed.
