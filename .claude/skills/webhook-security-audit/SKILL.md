---
name: webhook-security-audit
description: Audits webhook signature, replay and tenant resolution. Use when a change touches the inbound webhook controllers and handlers.
---
# webhook-security-audit

## Classification
- kind: audit
- domain: security
- batch: 16
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Audits webhook signature, replay and tenant resolution.

## Invocation conditions
- A change touches the inbound webhook controllers and handlers.
- A reviewer, gate or owner asks for the audit of webhook signature, replay and tenant resolution.
- Before a release that includes changes to this area.

## Required inputs
- The diff or the area to audit: the inbound webhook controllers and handlers.
- The architecture and security documents of the repository that state the rules for this area.

## Procedure
1. Read the scope: the inbound webhook controllers and handlers, and list every item to inspect.
2. Check the signature is verified on the raw body with constant-time comparison before parsing.
3. Check replay protection and idempotency on the event id.
4. Check the tenant is resolved by a proven link and not by trusting the payload.
5. Classify each finding as a forgeable, replayable or misattributed webhook with severity, file, line and the concrete failure scenario.
6. Record the items that passed as well as the findings.

## Expected outputs
- An audit record of webhook signature, replay and tenant resolution with per-item results and ranked findings.

## Validation
- Every item of the scope has a recorded pass or finding.
- Each finding has file, line, severity and a failure scenario that can be reproduced or argued from the code.

## Evidence
- The audit record for webhook signature, replay and tenant resolution.
- The searches and commands used with their output.

## Failure behavior
- If any part of the scope cannot be read, report BLOCKED, never PASS.
- If the scope contains no the inbound webhook controllers and handlers, say so explicitly instead of returning an empty clean result.

## Rollback and recovery
- Read-only: nothing is changed, so there is nothing to roll back; rerun with the corrected scope if the scope was wrong.

## Human approval
- Read-only analysis: it reports and changes nothing, so no human approval is needed.
