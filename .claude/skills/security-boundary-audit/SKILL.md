---
name: security-boundary-audit
description: Audits every trust boundary for validation and authorization. Use when a change touches every place where input or identity crosses a boundary in the change.
---
# security-boundary-audit

## Classification
- kind: audit
- domain: security
- batch: 16
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Audits every trust boundary for validation and authorization.

## Invocation conditions
- A change touches every place where input or identity crosses a boundary in the change.
- A reviewer, gate or owner asks for the audit of trust boundaries for validation and authorization.
- Before a release that includes changes to this area.

## Required inputs
- The diff or the area to audit: every place where input or identity crosses a boundary in the change.
- The architecture and security documents of the repository that state the rules for this area.

## Procedure
1. Read the scope: every place where input or identity crosses a boundary in the change, and list every item to inspect.
2. List the boundaries: HTTP, queue, webhook, file, provider and model.
3. Check each validates input and authorizes the actor and tenant.
4. Check failures deny by default and reveal nothing internal.
5. Classify each finding as an unvalidated or unauthorized crossing with severity, file, line and the concrete failure scenario.
6. Record the items that passed as well as the findings.

## Expected outputs
- An audit record of trust boundaries for validation and authorization with per-item results and ranked findings.

## Validation
- Every item of the scope has a recorded pass or finding.
- Each finding has file, line, severity and a failure scenario that can be reproduced or argued from the code.

## Evidence
- The audit record for trust boundaries for validation and authorization.
- The searches and commands used with their output.

## Failure behavior
- If any part of the scope cannot be read, report BLOCKED, never PASS.
- If the scope contains no every place where input or identity crosses a boundary in the change, say so explicitly instead of returning an empty clean result.

## Rollback and recovery
- Read-only: nothing is changed, so there is nothing to roll back; rerun with the corrected scope if the scope was wrong.

## Human approval
- Read-only analysis: it reports and changes nothing, so no human approval is needed.
