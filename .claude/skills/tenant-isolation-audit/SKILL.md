---
name: tenant-isolation-audit
description: Audits queries, caches, jobs and webhooks for cross-tenant access. Use when a change touches queries, policies, cache keys, queue payloads, storage paths and webhook handlers.
---
# tenant-isolation-audit

## Classification
- kind: audit
- domain: security
- batch: 16
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Audits queries, caches, jobs and webhooks for cross-tenant access.

## Invocation conditions
- A change touches queries, policies, cache keys, queue payloads, storage paths and webhook handlers.
- A reviewer, gate or owner asks for the audit of queries, caches, jobs and webhooks for cross-tenant access.
- Before a release that includes changes to this area.

## Required inputs
- The diff or the area to audit: queries, policies, cache keys, queue payloads, storage paths and webhook handlers.
- The architecture and security documents of the repository that state the rules for this area.

## Procedure
1. Read the scope: queries, policies, cache keys, queue payloads, storage paths and webhook handlers, and list every item to inspect.
2. Check each query and policy carries the tenant condition on every table involved.
3. Check cache keys, queue payloads and storage paths contain the tenant.
4. Check webhooks and callbacks resolve the tenant by proof, and demand a cross-tenant negative test for each defect.
5. Classify each finding as a path where one tenant can read or write the data of another with severity, file, line and the concrete failure scenario.
6. Record the items that passed as well as the findings.

## Expected outputs
- An audit record of queries, caches, jobs and webhooks for cross-tenant access with per-item results and ranked findings.

## Validation
- Every item of the scope has a recorded pass or finding.
- Each finding has file, line, severity and a failure scenario that can be reproduced or argued from the code.

## Evidence
- The audit record for queries, caches, jobs and webhooks for cross-tenant access.
- The searches and commands used with their output.

## Failure behavior
- If any part of the scope cannot be read, report BLOCKED, never PASS.
- If the scope contains no queries, say so explicitly instead of returning an empty clean result.

## Rollback and recovery
- Read-only: nothing is changed, so there is nothing to roll back; rerun with the corrected scope if the scope was wrong.

## Human approval
- Read-only analysis: it reports and changes nothing, so no human approval is needed.
