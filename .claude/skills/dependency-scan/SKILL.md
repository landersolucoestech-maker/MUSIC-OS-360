---
name: dependency-scan
description: Scans dependencies for known vulnerabilities and bad licenses. Use when a change touches manifests, lockfiles and the scanner output.
---
# dependency-scan

## Classification
- kind: audit
- domain: security
- batch: 16
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Scans dependencies for known vulnerabilities and bad licenses.

## Invocation conditions
- A change touches manifests, lockfiles and the scanner output.
- A reviewer, gate or owner asks for the audit of dependencies for known vulnerabilities and bad licenses.
- Before a release that includes changes to this area.

## Required inputs
- The diff or the area to audit: manifests, lockfiles and the scanner output.
- The architecture and security documents of the repository that state the rules for this area.

## Procedure
1. Read the scope: manifests, lockfiles and the scanner output, and list every item to inspect.
2. Run the dependency scanner through the security verification engine.
3. Check reachability of each reported vulnerable path in this repository.
4. Check licenses against the project policy.
5. Classify each finding as a reachable vulnerability, an unreachable one or a license problem with severity, file, line and the concrete failure scenario.
6. Record the items that passed as well as the findings.

## Expected outputs
- An audit record of dependencies for known vulnerabilities and bad licenses with per-item results and ranked findings.

## Validation
- Every item of the scope has a recorded pass or finding.
- Each finding has file, line, severity and a failure scenario that can be reproduced or argued from the code.

## Evidence
- The audit record for dependencies for known vulnerabilities and bad licenses.
- The searches and commands used with their output.

## Failure behavior
- If any part of the scope cannot be read, report BLOCKED, never PASS.
- If the scope contains no manifests, say so explicitly instead of returning an empty clean result.

## Rollback and recovery
- Read-only: nothing is changed, so there is nothing to roll back; rerun with the corrected scope if the scope was wrong.

## Human approval
- Read-only analysis: it reports and changes nothing, so no human approval is needed.
