---
name: duplication-analysis
description: Finds duplicated code, rules and constants and names the authoritative copy. Use when a task needs to know duplicated code, rules and constants and the authoritative copy before changing the code.
---
# duplication-analysis

## Classification
- kind: analysis
- domain: quality
- batch: 16
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Finds duplicated code, rules and constants and names the authoritative copy.

## Invocation conditions
- A task needs to know duplicated code, rules and constants and the authoritative copy before changing the code.
- A reviewer or a gate asks for this analysis on the touched area.

## Required inputs
- The scope: the changed files or the area under study.
- The repository and, where relevant, the canonical naming map and architecture documents.

## Procedure
1. Define the scope and the exact question: duplicated code, rules and constants and the authoritative copy.
2. Collect the evidence with text and structure searches across apps and packages and the shared types.
3. Search for repeated blocks, repeated constants and enums and the same rule written in several layers.
4. Separate harmless similarity from knowledge that can drift.
5. Name the authoritative location for each duplicated rule and the copies to migrate.
6. Report each result as a duplicate group with all locations and the authoritative location, and list what was checked even when nothing is found.

## Expected outputs
- An analysis report that answers: duplicated code, rules and constants and the authoritative copy.
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
