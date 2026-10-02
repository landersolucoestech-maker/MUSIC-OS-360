---
name: component-audit
description: Audits components for props, state, reuse and tests. Use when a change modifies components and their tests.
---
# component-audit

## Classification
- kind: audit
- domain: frontend
- batch: 16
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Audits components for props, state, reuse and tests.

## Invocation conditions
- A change modifies components and their tests.
- A reviewer, gate or owner asks for the audit of components for props, state, reuse and tests.
- Before a release that includes changes to this area.

## Required inputs
- The diff or the area to audit: the changed components and their tests.
- The architecture and security documents of the repository that state the rules for this area.

## Procedure
1. Read the scope: the changed components and their tests, and list every item to inspect.
2. Check props are typed narrowly and defaults are explicit.
3. Check state is placed at the lowest level that needs it and effects have correct dependencies.
4. Check a component with similar behavior does not already exist, and that tests cover its states.
5. Classify each finding as a typing gap, a state placement problem, a duplicate or a missing test with severity, file, line and the concrete failure scenario.
6. Record the items that passed as well as the findings.

## Expected outputs
- An audit record of components for props, state, reuse and tests with per-item results and ranked findings.

## Validation
- Every item of the scope has a recorded pass or finding.
- Each finding has file, line, severity and a failure scenario that can be reproduced or argued from the code.

## Evidence
- The audit record for components for props, state, reuse and tests.
- The searches and commands used with their output.

## Failure behavior
- If any part of the scope cannot be read, report BLOCKED, never PASS.
- If the scope contains no the changed components and their tests, say so explicitly instead of returning an empty clean result.

## Rollback and recovery
- Read-only: nothing is changed, so there is nothing to roll back; rerun with the corrected scope if the scope was wrong.

## Human approval
- Read-only analysis: it reports and changes nothing, so no human approval is needed.
