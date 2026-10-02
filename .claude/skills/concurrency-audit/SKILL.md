---
name: concurrency-audit
description: Audits races, locks and lost updates. Use when a change touches read-modify-write sequences, state transitions and retried handlers.
---
# concurrency-audit

## Classification
- kind: audit
- domain: database
- batch: 16
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Audits races, locks and lost updates.

## Invocation conditions
- A change touches read-modify-write sequences, state transitions and retried handlers.
- A reviewer, gate or owner asks for the audit of races, locks and lost updates.
- Before a release that includes changes to this area.

## Required inputs
- The diff or the area to audit: read-modify-write sequences, state transitions and retried handlers.
- The architecture and security documents of the repository that state the rules for this area.

## Procedure
1. Read the scope: read-modify-write sequences, state transitions and retried handlers, and list every item to inspect.
2. Find read-modify-write sequences without a lock, version or atomic statement.
3. Check retried handlers for duplicate effects.
4. Describe a concrete interleaving for each risk.
5. Classify each finding as a race with its interleaving with severity, file, line and the concrete failure scenario.
6. Record the items that passed as well as the findings.

## Expected outputs
- An audit record of races, locks and lost updates with per-item results and ranked findings.

## Validation
- Every item of the scope has a recorded pass or finding.
- Each finding has file, line, severity and a failure scenario that can be reproduced or argued from the code.

## Evidence
- The audit record for races, locks and lost updates.
- The searches and commands used with their output.

## Failure behavior
- If any part of the scope cannot be read, report BLOCKED, never PASS.
- If the scope contains no read-modify-write sequences, say so explicitly instead of returning an empty clean result.

## Rollback and recovery
- Read-only: nothing is changed, so there is nothing to roll back; rerun with the corrected scope if the scope was wrong.

## Human approval
- Read-only analysis: it reports and changes nothing, so no human approval is needed.
