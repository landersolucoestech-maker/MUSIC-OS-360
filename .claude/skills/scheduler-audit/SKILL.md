---
name: scheduler-audit
description: Audits schedules for overlap, drift and missed runs. Use when a change touches the scheduler classes and cron definitions.
---
# scheduler-audit

## Classification
- kind: audit
- domain: backend
- batch: 16
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Audits schedules for overlap, drift and missed runs.

## Invocation conditions
- A change touches the scheduler classes and cron definitions.
- A reviewer, gate or owner asks for the audit of schedules for overlap, drift and missed runs.
- Before a release that includes changes to this area.

## Required inputs
- The diff or the area to audit: the scheduler classes and cron definitions.
- The architecture and security documents of the repository that state the rules for this area.

## Procedure
1. Read the scope: the scheduler classes and cron definitions, and list every item to inspect.
2. Check a run cannot overlap with the previous run or another instance.
3. Check missed runs after downtime are handled deliberately.
4. Check each schedule has an owner, a time zone and a failure alert.
5. Classify each finding as an overlap, a missed-run gap or an unowned schedule with severity, file, line and the concrete failure scenario.
6. Record the items that passed as well as the findings.

## Expected outputs
- An audit record of schedules for overlap, drift and missed runs with per-item results and ranked findings.

## Validation
- Every item of the scope has a recorded pass or finding.
- Each finding has file, line, severity and a failure scenario that can be reproduced or argued from the code.

## Evidence
- The audit record for schedules for overlap, drift and missed runs.
- The searches and commands used with their output.

## Failure behavior
- If any part of the scope cannot be read, report BLOCKED, never PASS.
- If the scope contains no the scheduler classes and cron definitions, say so explicitly instead of returning an empty clean result.

## Rollback and recovery
- Read-only: nothing is changed, so there is nothing to roll back; rerun with the corrected scope if the scope was wrong.

## Human approval
- Read-only analysis: it reports and changes nothing, so no human approval is needed.
