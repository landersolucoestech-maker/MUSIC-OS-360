---
name: ownership-analysis
description: Finds paths with no owner or with two writers. Use when a task needs to know paths with no owner or two writers before changing the code.
---
# ownership-analysis

## Classification
- kind: analysis
- domain: governance
- batch: 16
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Finds paths with no owner or with two writers.

## Invocation conditions
- A task needs to know paths with no owner or two writers before changing the code.
- A reviewer or a gate asks for this analysis on the touched area.

## Required inputs
- The scope: the changed files or the area under study.
- The repository and, where relevant, the canonical naming map and architecture documents.

## Procedure
1. Define the scope and the exact question: paths with no owner or two writers.
2. Collect the evidence with the ownership registry compared with the real path tree.
3. List all directories under apps and packages and match each against the ownership patterns.
4. Find paths no pattern covers.
5. Find paths claimed by more than one writer and decide whether they are serialized.
6. Report each result as a path with its owners and a flag for none or overlapping, and list what was checked even when nothing is found.

## Expected outputs
- An analysis report that answers: paths with no owner or two writers.
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
