---
name: xss-audit
description: Audits rendering of user content for script injection. Use when a change touches rendering code, templates, generated documents and email bodies.
---
# xss-audit

## Classification
- kind: audit
- domain: security
- batch: 16
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Audits rendering of user content for script injection.

## Invocation conditions
- A change touches rendering code, templates, generated documents and email bodies.
- A reviewer, gate or owner asks for the audit of rendering of user content for script injection.
- Before a release that includes changes to this area.

## Required inputs
- The diff or the area to audit: rendering code, templates, generated documents and email bodies.
- The architecture and security documents of the repository that state the rules for this area.

## Procedure
1. Read the scope: rendering code, templates, generated documents and email bodies, and list every item to inspect.
2. Find user-controlled values rendered as HTML, set as attributes or used in links.
3. Check the sanitizer and safe URL helpers are used strictly.
4. Check generated documents and emails escape values.
5. Classify each finding as a source, a sink and a payload that executes with severity, file, line and the concrete failure scenario.
6. Record the items that passed as well as the findings.

## Expected outputs
- An audit record of rendering of user content for script injection with per-item results and ranked findings.

## Validation
- Every item of the scope has a recorded pass or finding.
- Each finding has file, line, severity and a failure scenario that can be reproduced or argued from the code.

## Evidence
- The audit record for rendering of user content for script injection.
- The searches and commands used with their output.

## Failure behavior
- If any part of the scope cannot be read, report BLOCKED, never PASS.
- If the scope contains no rendering code, say so explicitly instead of returning an empty clean result.

## Rollback and recovery
- Read-only: nothing is changed, so there is nothing to roll back; rerun with the corrected scope if the scope was wrong.

## Human approval
- Read-only analysis: it reports and changes nothing, so no human approval is needed.
