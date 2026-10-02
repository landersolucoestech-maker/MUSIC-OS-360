---
name: data-flow-trace
description: Traces how one piece of data moves from input to storage to output. Use when a task needs to know how one piece of data moves from input to storage to output before changing the code.
---
# data-flow-trace

## Classification
- kind: analysis
- domain: architecture
- batch: 16
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Traces how one piece of data moves from input to storage to output.

## Invocation conditions
- A task needs to know how one piece of data moves from input to storage to output before changing the code.
- A reviewer or a gate asks for this analysis on the touched area.

## Required inputs
- The scope: the changed files or the area under study.
- The repository and, where relevant, the canonical naming map and architecture documents.

## Procedure
1. Define the scope and the exact question: how one piece of data moves from input to storage to output.
2. Collect the evidence with the DTOs, services, repositories, entities, serializers and client code that handle the field.
3. Start from the input boundary and name the validation applied.
4. Follow the field through services into the table and column, noting every transformation.
5. Follow it from storage to every output: API, export, log, cache and client display.
6. Report each result as a step list from source to every sink with the transformation at each step, and list what was checked even when nothing is found.

## Expected outputs
- An analysis report that answers: how one piece of data moves from input to storage to output.
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
