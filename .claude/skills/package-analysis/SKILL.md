---
name: package-analysis
description: Analyzes workspace packages, their dependencies and boundaries. Use when a task needs to know workspace packages, their dependencies and boundaries before changing the code.
---
# package-analysis

## Classification
- kind: analysis
- domain: architecture
- batch: 16
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Analyzes workspace packages, their dependencies and boundaries.

## Invocation conditions
- A task needs to know workspace packages, their dependencies and boundaries before changing the code.
- A reviewer or a gate asks for this analysis on the touched area.

## Required inputs
- The scope: the changed files or the area under study.
- The repository and, where relevant, the canonical naming map and architecture documents.

## Procedure
1. Define the scope and the exact question: workspace packages, their dependencies and boundaries.
2. Collect the evidence with package manifests, workspace configuration and import statements.
3. List each package with its declared dependencies and its real imports.
4. Find declared but unused and used but undeclared dependencies.
5. Check packages do not depend on apps and that the dependency direction is acyclic.
6. Report each result as a package table with declared and real dependencies, and list what was checked even when nothing is found.

## Expected outputs
- An analysis report that answers: workspace packages, their dependencies and boundaries.
- The list of items examined and the list of findings.

## Validation
- Every item in scope has a result, positive or negative.
- Each finding names the file and the evidence that supports it.

## Evidence
- The analysis report with file and line references.
- The commands and searches used.

## Failure behavior
- If the scope cannot be examined completely, report BLOCKED with the part that was not examined.
- Never report a clean result without listing what was examined.

## Rollback and recovery
- Read-only: nothing is changed, so there is nothing to roll back; rerun with the corrected scope if the scope was wrong.

## Human approval
- Read-only analysis: it reports and changes nothing, so no human approval is needed.
