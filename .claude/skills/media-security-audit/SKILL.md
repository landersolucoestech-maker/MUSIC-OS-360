---
name: media-security-audit
description: Audits media handling for type, size, origin and exposure risks. Use when a change touches media upload, processing and delivery code.
---
# media-security-audit

## Classification
- kind: audit
- domain: security
- batch: 16
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Audits media handling for type, size, origin and exposure risks.

## Invocation conditions
- A change touches media upload, processing and delivery code.
- A reviewer, gate or owner asks for the audit of media handling for type, size, origin and exposure.
- Before a release that includes changes to this area.

## Required inputs
- The diff or the area to audit: media upload, processing and delivery code.
- The architecture and security documents of the repository that state the rules for this area.

## Procedure
1. Read the scope: media upload, processing and delivery code, and list every item to inspect.
2. Check media type and size limits and processing in a safe way.
3. Check origin and ownership are verified before processing.
4. Check delivery urls do not expose private media.
5. Classify each finding as a media handling risk with its exposure with severity, file, line and the concrete failure scenario.
6. Record the items that passed as well as the findings.

## Expected outputs
- An audit record of media handling for type, size, origin and exposure with per-item results and ranked findings.

## Validation
- Every item of the scope has a recorded pass or finding.
- Each finding has file, line, severity and a failure scenario that can be reproduced or argued from the code.

## Evidence
- The audit record for media handling for type, size, origin and exposure.
- The searches and commands used with their output.

## Failure behavior
- If any part of the scope cannot be read, report BLOCKED, never PASS.
- If the scope contains no media upload, say so explicitly instead of returning an empty clean result.

## Rollback and recovery
- Read-only: nothing is changed, so there is nothing to roll back; rerun with the corrected scope if the scope was wrong.

## Human approval
- Read-only analysis: it reports and changes nothing, so no human approval is needed.
