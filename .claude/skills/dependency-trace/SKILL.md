---
name: dependency-trace
description: Traces what a module imports and what imports it. Use when a task needs to know what a module imports and what imports it before changing the code.
---
# dependency-trace

## Classification
- kind: analysis
- domain: architecture
- batch: 16
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Traces what a module imports and what imports it.

## Invocation conditions
- A task needs to know what a module imports and what imports it before changing the code.
- A reviewer or a gate asks for this analysis on the touched area.

## Required inputs
- The scope: the changed files or the area under study.
- The repository and, where relevant, the canonical naming map and architecture documents.

## Procedure
1. Define the scope and the exact question: what a module imports and what imports it.
2. Collect the evidence with import statements and the workspace dependency declarations.
3. List the imports of the module split by internal, workspace and external packages.
4. List the importers of the module across apps and packages.
5. Flag imports of internals of another module and imports that point against the layering.
6. Report each result as an import table with direction and a flag for violations, and list what was checked even when nothing is found.

## Expected outputs
- An analysis report that answers: what a module imports and what imports it.
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
