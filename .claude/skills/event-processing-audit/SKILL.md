---
name: event-processing-audit
description: Audits event handlers for duplicate effects and ordering. Use when a change touches the event handlers and their emitters.
---
# event-processing-audit

## Classification
- kind: audit
- domain: backend
- batch: 16
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Audits event handlers for duplicate effects and ordering.

## Invocation conditions
- A change touches the event handlers and their emitters.
- A reviewer, gate or owner asks for the audit of event handlers for duplicate effects and ordering.
- Before a release that includes changes to this area.

## Required inputs
- The diff or the area to audit: the event handlers and their emitters.
- The architecture and security documents of the repository that state the rules for this area.

## Procedure
1. Read the scope: the event handlers and their emitters, and list every item to inspect.
2. Check each handler is idempotent under redelivery.
3. Check out-of-order events cannot move state backwards.
4. Check handler failures are surfaced and do not block unrelated events.
5. Classify each finding as a duplicate effect, an ordering hazard or a swallowed failure with severity, file, line and the concrete failure scenario.
6. Record the items that passed as well as the findings.

## Expected outputs
- An audit record of event handlers for duplicate effects and ordering with per-item results and ranked findings.

## Validation
- Every item of the scope has a recorded pass or finding.
- Each finding has file, line, severity and a failure scenario that can be reproduced or argued from the code.

## Evidence
- The audit record for event handlers for duplicate effects and ordering.
- The searches and commands used with their output.

## Failure behavior
- If any part of the scope cannot be read, report BLOCKED, never PASS.
- If the scope contains no the event handlers and their emitters, say so explicitly instead of returning an empty clean result.

## Rollback and recovery
- Read-only: nothing is changed, so there is nothing to roll back; rerun with the corrected scope if the scope was wrong.

## Human approval
- Read-only analysis: it reports and changes nothing, so no human approval is needed.
