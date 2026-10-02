---
name: dead-code-analysis
description: Finds code with no live consumer and proves it. Use when a task needs to know code with no live consumer, with proof before changing the code.
---
# dead-code-analysis

## Classification
- kind: analysis
- domain: quality
- batch: 16
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Finds code with no live consumer and proves it.

## Invocation conditions
- A task needs to know code with no live consumer, with proof before changing the code.
- A reviewer or a gate asks for this analysis on the touched area.

## Required inputs
- The scope: the changed files or the area under study.
- The repository and, where relevant, the canonical naming map and architecture documents.

## Procedure
1. Define the scope and the exact question: code with no live consumer, with proof.
2. Collect the evidence with reference searches that include dynamic lookups, decorators, configuration, tests and documentation.
3. Search references to each candidate in code, configuration, tests and documentation.
4. Check dynamic use through registries, string lookups and reflection.
5. Classify each candidate as proven unused, probably unused or used dynamically.
6. Report each result as a candidate with its classification and the search that supports it, and list what was checked even when nothing is found.

## Expected outputs
- An analysis report that answers: code with no live consumer, with proof.
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
