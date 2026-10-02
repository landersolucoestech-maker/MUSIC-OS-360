---
name: producer-consumer-trace
description: Matches every producer of a payload with every consumer. Use when a task needs to know every producer of a payload matched with every consumer before changing the code.
---
# producer-consumer-trace

## Classification
- kind: analysis
- domain: architecture
- batch: 16
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Matches every producer of a payload with every consumer.

## Invocation conditions
- A task needs to know every producer of a payload matched with every consumer before changing the code.
- A reviewer or a gate asks for this analysis on the touched area.

## Required inputs
- The scope: the changed files or the area under study.
- The repository and, where relevant, the canonical naming map and architecture documents.

## Procedure
1. Define the scope and the exact question: every producer of a payload matched with every consumer.
2. Collect the evidence with type definitions, emitters, queue adders, controllers and client calls.
3. List every producer of the payload with the shape it emits.
4. List every consumer with the shape it expects.
5. Compare shapes field by field and report drift, optionality and version differences.
6. Report each result as a producer and consumer table with the differences per field, and list what was checked even when nothing is found.

## Expected outputs
- An analysis report that answers: every producer of a payload matched with every consumer.
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
