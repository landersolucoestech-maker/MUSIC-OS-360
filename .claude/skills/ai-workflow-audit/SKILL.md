---
name: ai-workflow-audit
description: Audits an AI workflow for ordering, gates and recovery. Use when a change touches workflow definitions, state storage, retries and approval gates.
---
# ai-workflow-audit

## Classification
- kind: audit
- domain: ai-engineering
- batch: 17
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Audits an AI workflow for ordering, gates and recovery.

## Invocation conditions
- A change touches workflow definitions, state storage, retries and approval gates.
- A reviewer, gate or owner asks for the audit of AI workflows.
- Before a release that includes changes to this area.

## Required inputs
- The diff or the area to audit: workflow definitions, state storage, retries and approval gates.
- The architecture and security documents of the repository that state the rules for this area.

## Procedure
1. Read the scope: workflow definitions, state storage, retries and approval gates, and list every item to inspect.
2. Check each step is idempotent and state survives a restart.
3. Check approval gates sit before every irreversible or external step.
4. Check failure leaves a visible state and the audit trail records each step.
5. Classify each finding as a repeatable effect, a gate after its effect or a silent failure with severity, file, line and the concrete failure scenario.
6. Record the items that passed as well as the findings.

## Expected outputs
- An audit record of AI workflows with per-item results and ranked findings.

## Validation
- Every item of the scope has a recorded pass or finding.
- Each finding has file, line, severity and a failure scenario that can be reproduced or argued from the code.

## Evidence
- The audit record for AI workflows.
- The searches and commands used with their output.

## Failure behavior
- If any part of the scope cannot be read, report BLOCKED, never PASS.
- If the scope contains no workflow definitions, say so explicitly instead of returning an empty clean result.

## Rollback and recovery
- Read-only: nothing is changed, so there is nothing to roll back; rerun with the corrected scope if the scope was wrong.

## Human approval
- Read-only analysis: it reports and changes nothing, so no human approval is needed.
