---
name: ai-security-audit
description: Audits AI paths for injection, leakage and tool abuse. Use when a change touches the AI modules, automations, skill runners, prompts, tool definitions and queue jobs.
---
# ai-security-audit

## Classification
- kind: audit
- domain: ai-engineering
- batch: 17
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Audits AI paths for injection, leakage and tool abuse.

## Invocation conditions
- A change touches the AI modules, automations, skill runners, prompts, tool definitions and queue jobs.
- A reviewer, gate or owner asks for the audit of AI security.
- Before a release that includes changes to this area.

## Required inputs
- The diff or the area to audit: the AI modules, automations, skill runners, prompts, tool definitions and queue jobs.
- The architecture and security documents of the repository that state the rules for this area.

## Procedure
1. Read the scope: the AI modules, automations, skill runners, prompts, tool definitions and queue jobs, and list every item to inspect.
2. Trace untrusted sources into prompts, tools, memory and retrieval.
3. Check tools run with minimum authority and tenant scope and output is validated before use.
4. Check context and memory cannot cross tenants.
5. Classify each finding as a path where untrusted content can cause leakage or an unauthorized action with severity, file, line and the concrete failure scenario.
6. Record the items that passed as well as the findings.

## Expected outputs
- An audit record of AI security with per-item results and ranked findings.

## Validation
- Every item of the scope has a recorded pass or finding.
- Each finding has file, line, severity and a failure scenario that can be reproduced or argued from the code.

## Evidence
- The audit record for AI security.
- The searches and commands used with their output.

## Failure behavior
- If any part of the scope cannot be read, report BLOCKED, never PASS.
- If the scope contains no the AI modules, say so explicitly instead of returning an empty clean result.

## Rollback and recovery
- Read-only: nothing is changed, so there is nothing to roll back; rerun with the corrected scope if the scope was wrong.

## Human approval
- Read-only analysis: it reports and changes nothing, so no human approval is needed.
