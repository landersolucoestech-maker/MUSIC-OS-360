---
name: design-system-audit
description: Audits use of the design system tokens and components. Use when a change modifies screens and the shared UI primitives.
---
# design-system-audit

## Classification
- kind: audit
- domain: frontend
- batch: 16
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Audits use of the design system tokens and components.

## Invocation conditions
- A change modifies screens and the shared UI primitives.
- A reviewer, gate or owner asks for the audit of use of design system tokens and components.
- Before a release that includes changes to this area.

## Required inputs
- The diff or the area to audit: the changed screens and the shared UI primitives.
- The architecture and security documents of the repository that state the rules for this area.

## Procedure
1. Read the scope: the changed screens and the shared UI primitives, and list every item to inspect.
2. Check shared primitives are used instead of local re-implementations.
3. Check colors, spacing and typography use tokens, not literal values.
4. Check variants and states exist for every primitive used.
5. Classify each finding as a bypass of the design system or a missing variant with severity, file, line and the concrete failure scenario.
6. Record the items that passed as well as the findings.

## Expected outputs
- An audit record of use of design system tokens and components with per-item results and ranked findings.

## Validation
- Every item of the scope has a recorded pass or finding.
- Each finding has file, line, severity and a failure scenario that can be reproduced or argued from the code.

## Evidence
- The audit record for use of design system tokens and components.
- The searches and commands used with their output.

## Failure behavior
- If any part of the scope cannot be read, report BLOCKED, never PASS.
- If the scope contains no the changed screens and the shared UI primitives, say so explicitly instead of returning an empty clean result.

## Rollback and recovery
- Read-only: nothing is changed, so there is nothing to roll back; rerun with the corrected scope if the scope was wrong.

## Human approval
- Read-only analysis: it reports and changes nothing, so no human approval is needed.
