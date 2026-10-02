---
name: loading-state-audit
description: Audits loading states for every async surface. Use when a change touches the changed pages and components that fetch data.
---
# loading-state-audit

## Classification
- kind: audit
- domain: frontend
- batch: 16
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Audits loading states for every async surface.

## Invocation conditions
- A change touches the changed pages and components that fetch data.
- A reviewer, gate or owner asks for the audit of loading states for every async surface.
- Before a release that includes changes to this area.

## Required inputs
- The diff or the area to audit: the changed pages and components that fetch data.
- The architecture and security documents of the repository that state the rules for this area.

## Procedure
1. Read the scope: the changed pages and components that fetch data, and list every item to inspect.
2. List every async surface and the state shown while it loads.
3. Check the layout does not jump when content arrives.
4. Check long loads show progress or a message and can fail into an error state.
5. Classify each finding as a missing or jarring loading state with severity, file, line and the concrete failure scenario.
6. Record the items that passed as well as the findings.

## Expected outputs
- An audit record of loading states for every async surface with per-item results and ranked findings.

## Validation
- Every item of the scope has a recorded pass or finding.
- Each finding has file, line, severity and a failure scenario that can be reproduced or argued from the code.

## Evidence
- The audit record for loading states for every async surface.
- The searches and commands used with their output.

## Failure behavior
- If any part of the scope cannot be read, report BLOCKED, never PASS.
- If the scope contains no the changed pages and components that fetch data, say so explicitly instead of returning an empty clean result.

## Rollback and recovery
- Read-only: nothing is changed, so there is nothing to roll back; rerun with the corrected scope if the scope was wrong.

## Human approval
- Read-only analysis: it reports and changes nothing, so no human approval is needed.
