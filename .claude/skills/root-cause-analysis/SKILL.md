---
name: root-cause-analysis
description: Finds the proximate, contributing and systemic cause of a failure. Use when a task needs to know the proximate, contributing and systemic cause of a failure before changing the code.
---
# root-cause-analysis

## Classification
- kind: analysis
- domain: quality
- batch: 16
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Finds the proximate, contributing and systemic cause of a failure.

## Invocation conditions
- A task needs to know the proximate, contributing and systemic cause of a failure before changing the code.
- A reviewer or a gate asks for this analysis on the touched area.

## Required inputs
- The scope: the changed files or the area under study.
- The repository and, where relevant, the canonical naming map and architecture documents.

## Procedure
1. Define the scope and the exact question: the proximate, contributing and systemic cause of a failure.
2. Collect the evidence with the failing output, the history of the code, a minimal reproduction and the five whys.
3. Reproduce the failure with the smallest input and record the exact output.
4. Trace backwards from the failing line to the first wrong value or assumption.
5. Ask why each cause was possible until a systemic cause that a control could prevent is reached.
6. Report each result as a causal chain with proximate, contributing and systemic causes and the missing control, and list what was checked even when nothing is found.

## Expected outputs
- An analysis report that answers: the proximate, contributing and systemic cause of a failure.
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
