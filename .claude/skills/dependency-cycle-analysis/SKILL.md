---
name: dependency-cycle-analysis
description: Finds import cycles between modules and packages. Use when a task needs to know import cycles between modules and packages before changing the code.
---
# dependency-cycle-analysis

## Classification
- kind: analysis
- domain: architecture
- batch: 16
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Finds import cycles between modules and packages.

## Invocation conditions
- A task needs to know import cycles between modules and packages before changing the code.
- A reviewer or a gate asks for this analysis on the touched area.

## Required inputs
- The scope: the changed files or the area under study.
- The repository and, where relevant, the canonical naming map and architecture documents.

## Procedure
1. Define the scope and the exact question: import cycles between modules and packages.
2. Collect the evidence with the import graph of the source trees.
3. Build the import graph at module and package level.
4. Find strongly connected components larger than one node.
5. For each cycle list the edges that close it and the smallest edge to cut.
6. Report each result as a cycle with its member nodes and the edge to cut, and list what was checked even when nothing is found.

## Expected outputs
- An analysis report that answers: import cycles between modules and packages.
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
