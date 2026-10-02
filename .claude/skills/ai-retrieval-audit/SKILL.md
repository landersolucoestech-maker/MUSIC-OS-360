---
name: ai-retrieval-audit
description: Audits retrieval for tenant scope and source quality. Use when a change touches indexing, filtering and ranking code.
---
# ai-retrieval-audit

## Classification
- kind: audit
- domain: ai-engineering
- batch: 17
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Audits retrieval for tenant scope and source quality.

## Invocation conditions
- A change touches indexing, filtering and ranking code.
- A reviewer, gate or owner asks for the audit of AI retrieval.
- Before a release that includes changes to this area.

## Required inputs
- The diff or the area to audit: indexing, filtering and ranking code.
- The architecture and security documents of the repository that state the rules for this area.

## Procedure
1. Read the scope: indexing, filtering and ranking code, and list every item to inspect.
2. Check tenant and permission filters apply inside the retrieval query.
3. Check deleted content leaves the index.
4. Check retrieved text is marked as untrusted data and carries its source id and date.
5. Classify each finding as a cross-tenant result, a deleted item still retrievable or an unmarked passage with severity, file, line and the concrete failure scenario.
6. Record the items that passed as well as the findings.

## Expected outputs
- An audit record of AI retrieval with per-item results and ranked findings.

## Validation
- Every item of the scope has a recorded pass or finding.
- Each finding has file, line, severity and a failure scenario that can be reproduced or argued from the code.

## Evidence
- The audit record for AI retrieval.
- The searches and commands used with their output.

## Failure behavior
- If any part of the scope cannot be read, report BLOCKED, never PASS.
- If the scope contains no indexing, say so explicitly instead of returning an empty clean result.

## Rollback and recovery
- Read-only: nothing is changed, so there is nothing to roll back; rerun with the corrected scope if the scope was wrong.

## Human approval
- Read-only analysis: it reports and changes nothing, so no human approval is needed.
