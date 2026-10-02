---
name: worker-audit
description: Audits workers for concurrency, shutdown and failure behavior. Use when a change touches the processors and scheduler classes.
---
# worker-audit

## Classification
- kind: audit
- domain: backend
- batch: 16
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Audits workers for concurrency, shutdown and failure behavior.

## Invocation conditions
- A change touches the processors and scheduler classes.
- A reviewer, gate or owner asks for the audit of workers for concurrency, shutdown and failure behavior.
- Before a release that includes changes to this area.

## Required inputs
- The diff or the area to audit: the processors and scheduler classes.
- The architecture and security documents of the repository that state the rules for this area.

## Procedure
1. Read the scope: the processors and scheduler classes, and list every item to inspect.
2. Check concurrency against resources and provider quotas.
3. Check graceful shutdown drains or releases in-flight jobs.
4. Check jobs run inside the tenant context and stalled jobs are detected.
5. Classify each finding as a hang, a lost in-flight job or a missing tenant context with severity, file, line and the concrete failure scenario.
6. Record the items that passed as well as the findings.

## Expected outputs
- An audit record of workers for concurrency, shutdown and failure behavior with per-item results and ranked findings.

## Validation
- Every item of the scope has a recorded pass or finding.
- Each finding has file, line, severity and a failure scenario that can be reproduced or argued from the code.

## Evidence
- The audit record for workers for concurrency, shutdown and failure behavior.
- The searches and commands used with their output.

## Failure behavior
- If any part of the scope cannot be read, report BLOCKED, never PASS.
- If the scope contains no the processors and scheduler classes, say so explicitly instead of returning an empty clean result.

## Rollback and recovery
- Read-only: nothing is changed, so there is nothing to roll back; rerun with the corrected scope if the scope was wrong.

## Human approval
- Read-only analysis: it reports and changes nothing, so no human approval is needed.
