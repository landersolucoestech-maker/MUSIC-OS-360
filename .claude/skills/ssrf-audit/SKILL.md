---
name: ssrf-audit
description: Audits server-side fetches for attacker-influenced targets. Use when a change touches outbound request code that uses input or stored data as the target.
---
# ssrf-audit

## Classification
- kind: audit
- domain: security
- batch: 16
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Audits server-side fetches for attacker-influenced targets.

## Invocation conditions
- A change touches outbound request code that uses input or stored data as the target.
- A reviewer, gate or owner asks for the audit of server-side fetches for attacker-influenced targets.
- Before a release that includes changes to this area.

## Required inputs
- The diff or the area to audit: outbound request code that uses input or stored data as the target.
- The architecture and security documents of the repository that state the rules for this area.

## Procedure
1. Read the scope: outbound request code that uses input or stored data as the target, and list every item to inspect.
2. Find every fetch whose target is influenced by input.
3. Check host and scheme allowlists and the block of private ranges after resolution.
4. Check redirects, timeouts and size limits.
5. Classify each finding as a reachable internal target with severity, file, line and the concrete failure scenario.
6. Record the items that passed as well as the findings.

## Expected outputs
- An audit record of server-side fetches for attacker-influenced targets with per-item results and ranked findings.

## Validation
- Every item of the scope has a recorded pass or finding.
- Each finding has file, line, severity and a failure scenario that can be reproduced or argued from the code.

## Evidence
- The audit record for server-side fetches for attacker-influenced targets.
- The searches and commands used with their output.

## Failure behavior
- If any part of the scope cannot be read, report BLOCKED, never PASS.
- If the scope contains no outbound request code that uses input or stored data as the target, say so explicitly instead of returning an empty clean result.

## Rollback and recovery
- Read-only: nothing is changed, so there is nothing to roll back; rerun with the corrected scope if the scope was wrong.

## Human approval
- Read-only analysis: it reports and changes nothing, so no human approval is needed.
