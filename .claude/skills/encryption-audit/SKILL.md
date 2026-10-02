---
name: encryption-audit
description: Audits encryption choices, key handling and field-level protection. Use when a change touches cryptographic code and configuration.
---
# encryption-audit

## Classification
- kind: audit
- domain: security
- batch: 16
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Audits encryption choices, key handling and field-level protection.

## Invocation conditions
- A change touches cryptographic code and configuration.
- A reviewer, gate or owner asks for the audit of encryption choices, key handling and field-level protection.
- Before a release that includes changes to this area.

## Required inputs
- The diff or the area to audit: cryptographic code and configuration.
- The architecture and security documents of the repository that state the rules for this area.

## Procedure
1. Read the scope: cryptographic code and configuration, and list every item to inspect.
2. Check the primitives and modes are current and come from the platform or approved library.
3. Check keys are sourced from the environment mechanism, separated by purpose and rotatable.
4. Check nonces and initialization vectors are unique and random.
5. Classify each finding as a weak primitive or an unsafe key use with severity, file, line and the concrete failure scenario.
6. Record the items that passed as well as the findings.

## Expected outputs
- An audit record of encryption choices, key handling and field-level protection with per-item results and ranked findings.

## Validation
- Every item of the scope has a recorded pass or finding.
- Each finding has file, line, severity and a failure scenario that can be reproduced or argued from the code.

## Evidence
- The audit record for encryption choices, key handling and field-level protection.
- The searches and commands used with their output.

## Failure behavior
- If any part of the scope cannot be read, report BLOCKED, never PASS.
- If the scope contains no cryptographic code and configuration, say so explicitly instead of returning an empty clean result.

## Rollback and recovery
- Read-only: nothing is changed, so there is nothing to roll back; rerun with the corrected scope if the scope was wrong.

## Human approval
- Read-only analysis: it reports and changes nothing, so no human approval is needed.
