---
name: integration-audit
description: Audits integrations for secrets, retries, idempotency and failure handling. Use when a change touches the integration modules and external call sites.
---
# integration-audit

## Classification
- kind: audit
- domain: integrations
- batch: 16
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Audits integrations for secrets, retries, idempotency and failure handling.

## Invocation conditions
- A change touches the integration modules and external call sites.
- A reviewer, gate or owner asks for the audit of integrations for secrets, retries, idempotency and failure handling.
- Before a release that includes changes to this area.

## Required inputs
- The diff or the area to audit: the integration modules and external call sites.
- The architecture and security documents of the repository that state the rules for this area.

## Procedure
1. Read the scope: the integration modules and external call sites, and list every item to inspect.
2. Check secrets come from the validated environment schema and never appear in output.
3. Check every call has a timeout, bounded retries and idempotency where it writes.
4. Check failures are classified and shown humanized.
5. Classify each finding as a secret exposure, an unbounded call or an unhandled failure with severity, file, line and the concrete failure scenario.
6. Record the items that passed as well as the findings.

## Expected outputs
- An audit record of integrations for secrets, retries, idempotency and failure handling with per-item results and ranked findings.

## Validation
- Every item of the scope has a recorded pass or finding.
- Each finding has file, line, severity and a failure scenario that can be reproduced or argued from the code.

## Evidence
- The audit record for integrations for secrets, retries, idempotency and failure handling.
- The searches and commands used with their output.

## Failure behavior
- If any part of the scope cannot be read, report BLOCKED, never PASS.
- If the scope contains no the integration modules and external call sites, say so explicitly instead of returning an empty clean result.

## Rollback and recovery
- Read-only: nothing is changed, so there is nothing to roll back; rerun with the corrected scope if the scope was wrong.

## Human approval
- Read-only analysis: it reports and changes nothing, so no human approval is needed.
