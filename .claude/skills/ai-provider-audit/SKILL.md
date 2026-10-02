---
name: ai-provider-audit
description: Audits AI provider use for contracts, keys and failure handling. Use when a change touches provider call sites and configuration for the providers already supported.
---
# ai-provider-audit

## Classification
- kind: audit
- domain: ai-engineering
- batch: 17
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Audits AI provider use for contracts, keys and failure handling.

## Invocation conditions
- A change touches provider call sites and configuration for the providers already supported.
- A reviewer, gate or owner asks for the audit of AI provider usage.
- Before a release that includes changes to this area.

## Required inputs
- The diff or the area to audit: provider call sites and configuration for the providers already supported.
- The architecture and security documents of the repository that state the rules for this area.

## Procedure
1. Read the scope: provider call sites and configuration for the providers already supported, and list every item to inspect.
2. Check each call has a timeout, error classification and bounded retries.
3. Check the data sent is the minimum the task needs.
4. Check configuration comes from the validated environment schema and no provider is added outside the supported set.
5. Classify each finding as an unbounded call, an excess data send or an unsupported provider with severity, file, line and the concrete failure scenario.
6. Record the items that passed as well as the findings.

## Expected outputs
- An audit record of AI provider usage with per-item results and ranked findings.

## Validation
- Every item of the scope has a recorded pass or finding.
- Each finding has file, line, severity and a failure scenario that can be reproduced or argued from the code.

## Evidence
- The audit record for AI provider usage.
- The searches and commands used with their output.

## Failure behavior
- If any part of the scope cannot be read, report BLOCKED, never PASS.
- If the scope contains no provider call sites and configuration for the providers already supported, say so explicitly instead of returning an empty clean result.

## Rollback and recovery
- Read-only: nothing is changed, so there is nothing to roll back; rerun with the corrected scope if the scope was wrong.

## Human approval
- Read-only analysis: it reports and changes nothing, so no human approval is needed.
