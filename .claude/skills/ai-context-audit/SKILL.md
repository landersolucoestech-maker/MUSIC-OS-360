---
name: ai-context-audit
description: Audits what context a model receives and what it must not. Use when a change touches context builders and the queries behind them.
---
# ai-context-audit

## Classification
- kind: audit
- domain: ai-engineering
- batch: 17
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Audits what context a model receives and what it must not.

## Invocation conditions
- A change touches context builders and the queries behind them.
- A reviewer, gate or owner asks for the audit of AI context assembly.
- Before a release that includes changes to this area.

## Required inputs
- The diff or the area to audit: context builders and the queries behind them.
- The architecture and security documents of the repository that state the rules for this area.

## Procedure
1. Read the scope: context builders and the queries behind them, and list every item to inspect.
2. Check each feature includes only the fields it needs and excludes personal data it does not need.
3. Check every query is scoped to the tenant and the requester permissions.
4. Check sources and dates are labeled and the size is bounded.
5. Classify each finding as an over-inclusion, a scoping gap or an unlabeled source with severity, file, line and the concrete failure scenario.
6. Record the items that passed as well as the findings.

## Expected outputs
- An audit record of AI context assembly with per-item results and ranked findings.

## Validation
- Every item of the scope has a recorded pass or finding.
- Each finding has file, line, severity and a failure scenario that can be reproduced or argued from the code.

## Evidence
- The audit record for AI context assembly.
- The searches and commands used with their output.

## Failure behavior
- If any part of the scope cannot be read, report BLOCKED, never PASS.
- If the scope contains no context builders and the queries behind them, say so explicitly instead of returning an empty clean result.

## Rollback and recovery
- Read-only: nothing is changed, so there is nothing to roll back; rerun with the corrected scope if the scope was wrong.

## Human approval
- Read-only analysis: it reports and changes nothing, so no human approval is needed.
