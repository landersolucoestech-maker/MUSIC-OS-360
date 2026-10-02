---
name: ai-hallucination-audit
description: Audits outputs for claims without evidence. Use when a change touches outputs of summarizing, explaining and recommending features with their source data.
---
# ai-hallucination-audit

## Classification
- kind: audit
- domain: ai-engineering
- batch: 17
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Audits outputs for claims without evidence.

## Invocation conditions
- A change touches outputs of summarizing, explaining and recommending features with their source data.
- A reviewer, gate or owner asks for the audit of hallucination risk.
- Before a release that includes changes to this area.

## Required inputs
- The diff or the area to audit: outputs of summarizing, explaining and recommending features with their source data.
- The architecture and security documents of the repository that state the rules for this area.

## Procedure
1. Read the scope: outputs of summarizing, explaining and recommending features with their source data, and list every item to inspect.
2. Compare sampled outputs with the data given to the model.
3. Check identifiers, names and sources in outputs exist in the data.
4. Check numbers and legal or financial statements come from deterministic code and not from the model.
5. Classify each finding as an ungrounded claim with the missing grounding with severity, file, line and the concrete failure scenario.
6. Record the items that passed as well as the findings.

## Expected outputs
- An audit record of hallucination risk with per-item results and ranked findings.

## Validation
- Every item of the scope has a recorded pass or finding.
- Each finding has file, line, severity and a failure scenario that can be reproduced or argued from the code.

## Evidence
- The audit record for hallucination risk.
- The searches and commands used with their output.

## Failure behavior
- If any part of the scope cannot be read, report BLOCKED, never PASS.
- If the scope contains no outputs of summarizing, say so explicitly instead of returning an empty clean result.

## Rollback and recovery
- Read-only: nothing is changed, so there is nothing to roll back; rerun with the corrected scope if the scope was wrong.

## Human approval
- Read-only analysis: it reports and changes nothing, so no human approval is needed.
