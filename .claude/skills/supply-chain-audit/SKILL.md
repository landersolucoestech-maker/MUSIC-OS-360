---
name: supply-chain-audit
description: Audits lockfile, install scripts and artifact provenance. Use when a change touches lockfiles, install scripts, build outputs and release records.
---
# supply-chain-audit

## Classification
- kind: audit
- domain: security
- batch: 16
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Audits lockfile, install scripts and artifact provenance.

## Invocation conditions
- A change touches lockfiles, install scripts, build outputs and release records.
- A reviewer, gate or owner asks for the audit of lockfile, install scripts and artifact provenance.
- Before a release that includes changes to this area.

## Required inputs
- The diff or the area to audit: lockfiles, install scripts, build outputs and release records.
- The architecture and security documents of the repository that state the rules for this area.

## Procedure
1. Read the scope: lockfiles, install scripts, build outputs and release records, and list every item to inspect.
2. Check lockfile and manifest agree and only one package manager is used.
3. Read install and lifecycle scripts of new or changed packages.
4. Check the built artifact is traceable to a source commit.
5. Classify each finding as an unlocked input, a surprise script or an untraceable artifact with severity, file, line and the concrete failure scenario.
6. Record the items that passed as well as the findings.

## Expected outputs
- An audit record of lockfile, install scripts and artifact provenance with per-item results and ranked findings.

## Validation
- Every item of the scope has a recorded pass or finding.
- Each finding has file, line, severity and a failure scenario that can be reproduced or argued from the code.

## Evidence
- The audit record for lockfile, install scripts and artifact provenance.
- The searches and commands used with their output.

## Failure behavior
- If any part of the scope cannot be read, report BLOCKED, never PASS.
- If the scope contains no lockfiles, say so explicitly instead of returning an empty clean result.

## Rollback and recovery
- Read-only: nothing is changed, so there is nothing to roll back; rerun with the corrected scope if the scope was wrong.

## Human approval
- Read-only analysis: it reports and changes nothing, so no human approval is needed.
