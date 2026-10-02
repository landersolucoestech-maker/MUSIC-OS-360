---
name: dependency-safety-check
description: Checks a dependency change for scripts, churn and provenance. Use when a dependency change must be verified before the next action.
---
# dependency-safety-check

## Classification
- kind: check
- domain: repository
- batch: 16
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Checks a dependency change for scripts, churn and provenance.

## Invocation conditions
- A dependency change must be verified before the next action.
- A guard or gate requires the result of this check.

## Required inputs
- The planned action or the current repository state.
- The policy or rule that the check enforces.

## Procedure
1. Diff the manifest and lockfile and list each added, removed and changed package.
2. Read install and lifecycle scripts of new packages.
3. Check only the repository package manager lockfile changed.
4. Report transitive churn that nothing explains.

## Expected outputs
- A dependency safety result per package.

## Validation
- The check answers a single question: is the dependency change intended, reproducible and free of surprise scripts?
- The result is derived from commands run now, not from memory or earlier output.

## Evidence
- Package change list and lockfile diff statistics.

## Failure behavior
- If the lockfile diff cannot be read, report BLOCKED.

## Rollback and recovery
- Read-only: nothing is changed, so there is nothing to roll back; rerun with the corrected scope if the scope was wrong.

## Human approval
- Read-only analysis: it reports and changes nothing, so no human approval is needed.
