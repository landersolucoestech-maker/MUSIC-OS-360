---
name: blast-radius-analysis
description: Computes which files, modules and consumers a change can break. Use when a task needs to know which files, modules and consumers a change can break before changing the code.
---
# blast-radius-analysis

## Classification
- kind: analysis
- domain: architecture
- batch: 16
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Computes which files, modules and consumers a change can break.

## Invocation conditions
- A task needs to know which files, modules and consumers a change can break before changing the code.
- A reviewer or a gate asks for this analysis on the touched area.

## Required inputs
- The scope: the changed files or the area under study.
- The repository and, where relevant, the canonical naming map and architecture documents.

## Procedure
1. Define the scope and the exact question: which files, modules and consumers a change can break.
2. Collect the evidence with the import graph, the API and event maps and a reference search of the changed symbols.
3. List every direct consumer of each changed symbol, route, table and event.
4. Follow the consumers one level further for shared types and contracts.
5. Classify each affected item as certain, likely or possible with the reason.
6. Report each result as a list of affected items with certainty and reason, and list what was checked even when nothing is found.

## Expected outputs
- An analysis report that answers: which files, modules and consumers a change can break.
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
