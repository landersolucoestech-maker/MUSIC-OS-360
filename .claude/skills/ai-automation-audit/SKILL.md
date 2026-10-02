---
name: ai-automation-audit
description: Audits an automation for approvals, idempotency and evidence. Use when a change touches automation classes, triggers, tenant handling and limits.
---
# ai-automation-audit

## Classification
- kind: audit
- domain: ai-engineering
- batch: 17
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Audits an automation for approvals, idempotency and evidence.

## Invocation conditions
- A change touches automation classes, triggers, tenant handling and limits.
- A reviewer, gate or owner asks for the audit of AI automations.
- Before a release that includes changes to this area.

## Required inputs
- The diff or the area to audit: automation classes, triggers, tenant handling and limits.
- The architecture and security documents of the repository that state the rules for this area.

## Procedure
1. Read the scope: automation classes, triggers, tenant handling and limits, and list every item to inspect.
2. Check each automation resolves and enters the tenant context explicitly.
3. Check triggers are idempotent and rate limited per tenant.
4. Check cost is bounded and each run writes an audit entry.
5. Classify each finding as an ambient privilege, a duplicate trigger or an unbounded cost with severity, file, line and the concrete failure scenario.
6. Record the items that passed as well as the findings.

## Expected outputs
- An audit record of AI automations with per-item results and ranked findings.

## Validation
- Every item of the scope has a recorded pass or finding.
- Each finding has file, line, severity and a failure scenario that can be reproduced or argued from the code.

## Evidence
- The audit record for AI automations.
- The searches and commands used with their output.

## Failure behavior
- If any part of the scope cannot be read, report BLOCKED, never PASS.
- If the scope contains no automation classes, say so explicitly instead of returning an empty clean result.

## Rollback and recovery
- Read-only: nothing is changed, so there is nothing to roll back; rerun with the corrected scope if the scope was wrong.

## Human approval
- Read-only analysis: it reports and changes nothing, so no human approval is needed.
