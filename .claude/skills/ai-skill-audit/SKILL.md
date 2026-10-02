---
name: ai-skill-audit
description: Audits an AI skill for determinism, outputs and failure behavior. Use when a change touches skill definitions, schemas, runners and the registry.
---
# ai-skill-audit

## Classification
- kind: audit
- domain: ai-engineering
- batch: 17
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Audits an AI skill for determinism, outputs and failure behavior.

## Invocation conditions
- A change touches skill definitions, schemas, runners and the registry.
- A reviewer, gate or owner asks for the audit of product AI skills.
- Before a release that includes changes to this area.

## Required inputs
- The diff or the area to audit: skill definitions, schemas, runners and the registry.
- The architecture and security documents of the repository that state the rules for this area.

## Procedure
1. Read the scope: skill definitions, schemas, runners and the registry, and list every item to inspect.
2. Check each skill has an input schema, an output schema and a version.
3. Check output validation fails visibly on mismatch.
4. Check each skill is registered once and its consumers match its current contract.
5. Classify each finding as a missing schema, a silent mismatch or a stale consumer with severity, file, line and the concrete failure scenario.
6. Record the items that passed as well as the findings.

## Expected outputs
- An audit record of product AI skills with per-item results and ranked findings.

## Validation
- Every item of the scope has a recorded pass or finding.
- Each finding has file, line, severity and a failure scenario that can be reproduced or argued from the code.

## Evidence
- The audit record for product AI skills.
- The searches and commands used with their output.

## Failure behavior
- If any part of the scope cannot be read, report BLOCKED, never PASS.
- If the scope contains no skill definitions, say so explicitly instead of returning an empty clean result.

## Rollback and recovery
- Read-only: nothing is changed, so there is nothing to roll back; rerun with the corrected scope if the scope was wrong.

## Human approval
- Read-only analysis: it reports and changes nothing, so no human approval is needed.
