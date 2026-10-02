---
name: transaction-audit
description: Audits transaction boundaries and partial failure. Use when a change touches handlers that perform more than one write or call an outside service.
---
# transaction-audit

## Classification
- kind: audit
- domain: database
- batch: 16
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Audits transaction boundaries and partial failure.

## Invocation conditions
- A change touches handlers that perform more than one write or call an outside service.
- A reviewer, gate or owner asks for the audit of transaction boundaries and partial failure.
- Before a release that includes changes to this area.

## Required inputs
- The diff or the area to audit: handlers that perform more than one write or call an outside service.
- The architecture and security documents of the repository that state the rules for this area.

## Procedure
1. Read the scope: handlers that perform more than one write or call an outside service, and list every item to inspect.
2. List the writes of each handler and decide which must be atomic.
3. Check failure after the first write leaves consistent data.
4. Find network calls inside open transactions.
5. Classify each finding as a partial failure state or a call inside a transaction with severity, file, line and the concrete failure scenario.
6. Record the items that passed as well as the findings.

## Expected outputs
- An audit record of transaction boundaries and partial failure with per-item results and ranked findings.

## Validation
- Every item of the scope has a recorded pass or finding.
- Each finding has file, line, severity and a failure scenario that can be reproduced or argued from the code.

## Evidence
- The audit record for transaction boundaries and partial failure.
- The searches and commands used with their output.

## Failure behavior
- If any part of the scope cannot be read, report BLOCKED, never PASS.
- If the scope contains no handlers that perform more than one write or call an outside service, say so explicitly instead of returning an empty clean result.

## Rollback and recovery
- Read-only: nothing is changed, so there is nothing to roll back; rerun with the corrected scope if the scope was wrong.

## Human approval
- Read-only analysis: it reports and changes nothing, so no human approval is needed.
