---
name: cache-audit
description: Audits cache keys, expiry and accidental sources of truth. Use when a change touches cache usage in services and the web query cache.
---
# cache-audit

## Classification
- kind: audit
- domain: backend
- batch: 16
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Audits cache keys, expiry and accidental sources of truth.

## Invocation conditions
- A change touches cache usage in services and the web query cache.
- A reviewer, gate or owner asks for the audit of cache keys, expiry and accidental sources of truth.
- Before a release that includes changes to this area.

## Required inputs
- The diff or the area to audit: cache usage in services and the web query cache.
- The architecture and security documents of the repository that state the rules for this area.

## Procedure
1. Read the scope: cache usage in services and the web query cache, and list every item to inspect.
2. Check keys include the tenant and every variable of the cached value.
3. Check expiry and invalidation exist and match how often the data changes.
4. Find caches that are read as the source of truth after the original changed.
5. Classify each finding as a key collision, a stale read or an unowned cache with severity, file, line and the concrete failure scenario.
6. Record the items that passed as well as the findings.

## Expected outputs
- An audit record of cache keys, expiry and accidental sources of truth with per-item results and ranked findings.

## Validation
- Every item of the scope has a recorded pass or finding.
- Each finding has file, line, severity and a failure scenario that can be reproduced or argued from the code.

## Evidence
- The audit record for cache keys, expiry and accidental sources of truth.
- The searches and commands used with their output.

## Failure behavior
- If any part of the scope cannot be read, report BLOCKED, never PASS.
- If the scope contains no cache usage in services and the web query cache, say so explicitly instead of returning an empty clean result.

## Rollback and recovery
- Read-only: nothing is changed, so there is nothing to roll back; rerun with the corrected scope if the scope was wrong.

## Human approval
- Read-only analysis: it reports and changes nothing, so no human approval is needed.
