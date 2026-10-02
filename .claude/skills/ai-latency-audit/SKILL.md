---
name: ai-latency-audit
description: Audits end-to-end latency of AI paths. Use when a change touches user-facing AI paths and their timeouts.
---
# ai-latency-audit

## Classification
- kind: audit
- domain: ai-engineering
- batch: 17
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Audits end-to-end latency of AI paths.

## Invocation conditions
- A change touches user-facing AI paths and their timeouts.
- A reviewer, gate or owner asks for the audit of AI latency.
- Before a release that includes changes to this area.

## Required inputs
- The diff or the area to audit: user-facing AI paths and their timeouts.
- The architecture and security documents of the repository that state the rules for this area.

## Procedure
1. Read the scope: user-facing AI paths and their timeouts, and list every item to inspect.
2. Measure time to first token and total time on the real path.
3. Check streaming, caching of stable results and safe parallelism.
4. Check timeouts and what the user sees while waiting.
5. Classify each finding as a measured latency problem with its driver with severity, file, line and the concrete failure scenario.
6. Record the items that passed as well as the findings.

## Expected outputs
- An audit record of AI latency with per-item results and ranked findings.

## Validation
- Every item of the scope has a recorded pass or finding.
- Each finding has file, line, severity and a failure scenario that can be reproduced or argued from the code.

## Evidence
- The audit record for AI latency.
- The searches and commands used with their output.

## Failure behavior
- If any part of the scope cannot be read, report BLOCKED, never PASS.
- If the scope contains no user-facing AI paths and their timeouts, say so explicitly instead of returning an empty clean result.

## Rollback and recovery
- Read-only: nothing is changed, so there is nothing to roll back; rerun with the corrected scope if the scope was wrong.

## Human approval
- Read-only analysis: it reports and changes nothing, so no human approval is needed.
