---
name: prompt-injection-audit
description: Audits model inputs for injection from untrusted content. Use when a change touches prompt construction, retrieval and tool definitions.
---
# prompt-injection-audit

## Classification
- kind: audit
- domain: security
- batch: 16
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Audits model inputs for injection from untrusted content.

## Invocation conditions
- A change touches prompt construction, retrieval and tool definitions.
- A reviewer, gate or owner asks for the audit of model inputs for injection from untrusted content.
- Before a release that includes changes to this area.

## Required inputs
- The diff or the area to audit: prompt construction, retrieval and tool definitions.
- The architecture and security documents of the repository that state the rules for this area.

## Procedure
1. Read the scope: prompt construction, retrieval and tool definitions, and list every item to inspect.
2. Trace each untrusted source into prompts and tool arguments.
3. Check untrusted text is delimited as data and cannot change instructions.
4. Check tools reachable from that context are minimal and high-impact tools need approval.
5. Classify each finding as a source-to-sink path that lets text steer the model with severity, file, line and the concrete failure scenario.
6. Record the items that passed as well as the findings.

## Expected outputs
- An audit record of model inputs for injection from untrusted content with per-item results and ranked findings.

## Validation
- Every item of the scope has a recorded pass or finding.
- Each finding has file, line, severity and a failure scenario that can be reproduced or argued from the code.

## Evidence
- The audit record for model inputs for injection from untrusted content.
- The searches and commands used with their output.

## Failure behavior
- If any part of the scope cannot be read, report BLOCKED, never PASS.
- If the scope contains no prompt construction, say so explicitly instead of returning an empty clean result.

## Rollback and recovery
- Read-only: nothing is changed, so there is nothing to roll back; rerun with the corrected scope if the scope was wrong.

## Human approval
- Read-only analysis: it reports and changes nothing, so no human approval is needed.
