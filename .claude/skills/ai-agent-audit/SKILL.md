---
name: ai-agent-audit
description: Audits an AI agent definition for scope, tools and escalation. Use when a change touches agent definitions, their tool lists, loops and limits.
---
# ai-agent-audit

## Classification
- kind: audit
- domain: ai-engineering
- batch: 17
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Audits an AI agent definition for scope, tools and escalation.

## Invocation conditions
- A change touches agent definitions, their tool lists, loops and limits.
- A reviewer, gate or owner asks for the audit of product AI agents.
- Before a release that includes changes to this area.

## Required inputs
- The diff or the area to audit: agent definitions, their tool lists, loops and limits.
- The architecture and security documents of the repository that state the rules for this area.

## Procedure
1. Read the scope: agent definitions, their tool lists, loops and limits, and list every item to inspect.
2. List each agent with its tools, step limit, time limit and spend limit.
3. Check each tool has a policy entry and each loop is bounded.
4. Check model output is validated before it is acted on and high-impact actions are approval gated.
5. Classify each finding as an unbounded loop, a tool without policy or an ungated action with severity, file, line and the concrete failure scenario.
6. Record the items that passed as well as the findings.

## Expected outputs
- An audit record of product AI agents with per-item results and ranked findings.

## Validation
- Every item of the scope has a recorded pass or finding.
- Each finding has file, line, severity and a failure scenario that can be reproduced or argued from the code.

## Evidence
- The audit record for product AI agents.
- The searches and commands used with their output.

## Failure behavior
- If any part of the scope cannot be read, report BLOCKED, never PASS.
- If the scope contains no agent definitions, say so explicitly instead of returning an empty clean result.

## Rollback and recovery
- Read-only: nothing is changed, so there is nothing to roll back; rerun with the corrected scope if the scope was wrong.

## Human approval
- Read-only analysis: it reports and changes nothing, so no human approval is needed.
