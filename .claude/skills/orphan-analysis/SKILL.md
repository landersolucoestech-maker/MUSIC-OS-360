---
name: orphan-analysis
description: Finds files, exports, tables and routes nothing references. Use when a task needs to know files, exports, tables and routes that nothing references before changing the code.
---
# orphan-analysis

## Classification
- kind: analysis
- domain: quality
- batch: 16
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Finds files, exports, tables and routes nothing references.

## Invocation conditions
- A task needs to know files, exports, tables and routes that nothing references before changing the code.
- A reviewer or a gate asks for this analysis on the touched area.

## Required inputs
- The scope: the changed files or the area under study.
- The repository and, where relevant, the canonical naming map and architecture documents.

## Procedure
1. Define the scope and the exact question: files, exports, tables and routes that nothing references.
2. Collect the evidence with reference searches for files and exports, the catalog for tables and the router for routes.
3. List files and exports with no importer outside their own tests.
4. List tables with no entity and routes with no client or caller.
5. Check configuration and documentation references before calling anything an orphan.
6. Report each result as an orphan candidate with the kind and the search that found no reference, and list what was checked even when nothing is found.

## Expected outputs
- An analysis report that answers: files, exports, tables and routes that nothing references.
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
