---
name: ai-fallback-audit
description: Audits fallbacks for safe degraded behavior. Use when a change touches error paths of AI features and static fallback copy.
---
# ai-fallback-audit

## Classification
- kind: audit
- domain: ai-engineering
- batch: 17
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Audits fallbacks for safe degraded behavior.

## Invocation conditions
- A change touches error paths of AI features and static fallback copy.
- A reviewer, gate or owner asks for the audit of AI fallback behavior.
- Before a release that includes changes to this area.

## Required inputs
- The diff or the area to audit: error paths of AI features and static fallback copy.
- The architecture and security documents of the repository that state the rules for this area.

## Procedure
1. Read the scope: error paths of AI features and static fallback copy, and list every item to inspect.
2. Inject provider timeouts, errors and malformed output on a disposable target.
3. Check the user sees a clear message and the record shows the failed state.
4. Check static fallback text is labeled and never presented as generated analysis.
5. Classify each finding as a hidden failure or a fabricated result with severity, file, line and the concrete failure scenario.
6. Record the items that passed as well as the findings.

## Expected outputs
- An audit record of AI fallback behavior with per-item results and ranked findings.

## Validation
- Every item of the scope has a recorded pass or finding.
- Each finding has file, line, severity and a failure scenario that can be reproduced or argued from the code.

## Evidence
- The audit record for AI fallback behavior.
- The searches and commands used with their output.

## Failure behavior
- If any part of the scope cannot be read, report BLOCKED, never PASS.
- If the scope contains no error paths of AI features and static fallback copy, say so explicitly instead of returning an empty clean result.

## Rollback and recovery
- Read-only: nothing is changed, so there is nothing to roll back; rerun with the corrected scope if the scope was wrong.

## Human approval
- Read-only analysis: it reports and changes nothing, so no human approval is needed.
