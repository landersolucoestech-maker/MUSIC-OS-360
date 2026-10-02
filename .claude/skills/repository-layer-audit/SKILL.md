---
name: repository-layer-audit
description: Audits repositories for tenant scoping and query safety. Use when a change touches the changed repositories and query builders.
---
# repository-layer-audit

## Classification
- kind: audit
- domain: backend
- batch: 16
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Audits repositories for tenant scoping and query safety.

## Invocation conditions
- A change touches the changed repositories and query builders.
- A reviewer, gate or owner asks for the audit of repositories for tenant scoping and query safety.
- Before a release that includes changes to this area.

## Required inputs
- The diff or the area to audit: the changed repositories and query builders.
- The architecture and security documents of the repository that state the rules for this area.

## Procedure
1. Read the scope: the changed repositories and query builders, and list every item to inspect.
2. Check every query carries the tenant condition on every table involved.
3. Check queries are parameterized and identifiers come from an allowlist.
4. Check list queries are paginated and select only the needed columns.
5. Classify each finding as a missing tenant condition, an injection risk or an unbounded query with severity, file, line and the concrete failure scenario.
6. Record the items that passed as well as the findings.

## Expected outputs
- An audit record of repositories for tenant scoping and query safety with per-item results and ranked findings.

## Validation
- Every item of the scope has a recorded pass or finding.
- Each finding has file, line, severity and a failure scenario that can be reproduced or argued from the code.

## Evidence
- The audit record for repositories for tenant scoping and query safety.
- The searches and commands used with their output.

## Failure behavior
- If any part of the scope cannot be read, report BLOCKED, never PASS.
- If the scope contains no the changed repositories and query builders, say so explicitly instead of returning an empty clean result.

## Rollback and recovery
- Read-only: nothing is changed, so there is nothing to roll back; rerun with the corrected scope if the scope was wrong.

## Human approval
- Read-only analysis: it reports and changes nothing, so no human approval is needed.
