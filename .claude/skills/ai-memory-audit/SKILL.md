---
name: ai-memory-audit
description: Audits stored memory for staleness and authority. Use when a change touches memory storage, retrieval and expiry code.
---
# ai-memory-audit

## Classification
- kind: audit
- domain: ai-engineering
- batch: 17
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Audits stored memory for staleness and authority.

## Invocation conditions
- A change touches memory storage, retrieval and expiry code.
- A reviewer, gate or owner asks for the audit of AI memory.
- Before a release that includes changes to this area.

## Required inputs
- The diff or the area to audit: memory storage, retrieval and expiry code.
- The architecture and security documents of the repository that state the rules for this area.

## Procedure
1. Read the scope: memory storage, retrieval and expiry code, and list every item to inspect.
2. Check each memory has a source, a tenant and an expiry.
3. Check stale memories are marked and never served as current.
4. Check memory is excluded from authorization and approval decisions.
5. Classify each finding as an unsourced, stale or authoritative memory with severity, file, line and the concrete failure scenario.
6. Record the items that passed as well as the findings.

## Expected outputs
- An audit record of AI memory with per-item results and ranked findings.

## Validation
- Every item of the scope has a recorded pass or finding.
- Each finding has file, line, severity and a failure scenario that can be reproduced or argued from the code.

## Evidence
- The audit record for AI memory.
- The searches and commands used with their output.

## Failure behavior
- If any part of the scope cannot be read, report BLOCKED, never PASS.
- If the scope contains no memory storage, say so explicitly instead of returning an empty clean result.

## Rollback and recovery
- Read-only: nothing is changed, so there is nothing to roll back; rerun with the corrected scope if the scope was wrong.

## Human approval
- Read-only analysis: it reports and changes nothing, so no human approval is needed.
