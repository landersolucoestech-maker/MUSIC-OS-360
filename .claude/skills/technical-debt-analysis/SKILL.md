---
name: technical-debt-analysis
description: Inventories debt with evidence, cost and a disposition. Use when a task needs to know debt items with evidence, cost and a disposition before changing the code.
---
# technical-debt-analysis

## Classification
- kind: analysis
- domain: quality
- batch: 16
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Inventories debt with evidence, cost and a disposition.

## Invocation conditions
- A task needs to know debt items with evidence, cost and a disposition before changing the code.
- A reviewer or a gate asks for this analysis on the touched area.

## Required inputs
- The scope: the changed files or the area under study.
- The repository and, where relevant, the canonical naming map and architecture documents.

## Procedure
1. Define the scope and the exact question: debt items with evidence, cost and a disposition.
2. Collect the evidence with findings from reviewers, complexity and duplication measurements and the open issues of the area.
3. List each debt item with its location and the evidence for it.
4. Estimate the cost of leaving it as the future change it would hinder.
5. Give each item a disposition: fix now, schedule or accept with a reason.
6. Report each result as a debt item with location, cost and disposition, and list what was checked even when nothing is found.

## Expected outputs
- An analysis report that answers: debt items with evidence, cost and a disposition.
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
