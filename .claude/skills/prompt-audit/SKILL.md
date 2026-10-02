---
name: prompt-audit
description: Audits prompts for injection surface, ambiguity and drift. Use when a change touches prompt files, prompt builders and their tests.
---
# prompt-audit

## Classification
- kind: audit
- domain: ai-engineering
- batch: 17
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Audits prompts for injection surface, ambiguity and drift.

## Invocation conditions
- A change touches prompt files, prompt builders and their tests.
- A reviewer, gate or owner asks for the audit of prompts for structure, safety and stability.
- Before a release that includes changes to this area.

## Required inputs
- The diff or the area to audit: prompt files, prompt builders and their tests.
- The architecture and security documents of the repository that state the rules for this area.

## Procedure
1. Read the scope: prompt files, prompt builders and their tests, and list every item to inspect.
2. Check instructions are separated from data and untrusted content is marked as data.
3. Check the output contract matches the schema and the prompt is versioned.
4. Check no secret or unneeded personal data enters the prompt.
5. Classify each finding as an injectable construction, a contract mismatch or an unneeded data inclusion with severity, file, line and the concrete failure scenario.
6. Record the items that passed as well as the findings.

## Expected outputs
- An audit record of prompts for structure, safety and stability with per-item results and ranked findings.

## Validation
- Every item of the scope has a recorded pass or finding.
- Each finding has file, line, severity and a failure scenario that can be reproduced or argued from the code.

## Evidence
- The audit record for prompts for structure, safety and stability.
- The searches and commands used with their output.

## Failure behavior
- If any part of the scope cannot be read, report BLOCKED, never PASS.
- If the scope contains no prompt files, say so explicitly instead of returning an empty clean result.

## Rollback and recovery
- Read-only: nothing is changed, so there is nothing to roll back; rerun with the corrected scope if the scope was wrong.

## Human approval
- Read-only analysis: it reports and changes nothing, so no human approval is needed.
