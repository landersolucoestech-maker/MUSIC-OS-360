---
name: secret-scan
description: Scans for committed secrets with the repository scanners. Use when a change touches the working tree, the staged content, the history window in scope and the built output.
---
# secret-scan

## Classification
- kind: audit
- domain: security
- batch: 16
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Scans for committed secrets with the repository scanners.

## Invocation conditions
- A change touches the working tree, the staged content, the history window in scope and the built output.
- A reviewer, gate or owner asks for the audit of committed secrets.
- Before a release that includes changes to this area.

## Required inputs
- The diff or the area to audit: the working tree, the staged content, the history window in scope and the built output.
- The architecture and security documents of the repository that state the rules for this area.

## Procedure
1. Read the scope: the working tree, the staged content, the history window in scope and the built output, and list every item to inspect.
2. Run the repository secret scanners and read their output.
3. Check configuration templates contain only placeholders of the right shape and never real values.
4. Report locations only and never print a value.
5. Classify each finding as a secret-shaped value with its location with severity, file, line and the concrete failure scenario.
6. Record the items that passed as well as the findings.

## Expected outputs
- An audit record of committed secrets with per-item results and ranked findings.

## Validation
- Every item of the scope has a recorded pass or finding.
- Each finding has file, line, severity and a failure scenario that can be reproduced or argued from the code.

## Evidence
- The audit record for committed secrets.
- The searches and commands used with their output.

## Failure behavior
- If any part of the scope cannot be read, report BLOCKED, never PASS.
- If the scope contains no the working tree, say so explicitly instead of returning an empty clean result.

## Rollback and recovery
- Read-only: nothing is changed, so there is nothing to roll back; rerun with the corrected scope if the scope was wrong.

## Human approval
- Read-only analysis: it reports and changes nothing, so no human approval is needed.
