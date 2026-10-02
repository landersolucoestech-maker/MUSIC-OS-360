---
name: runtime-path-trace
description: Follows a request or job through the real runtime path. Use when a task needs to know the real runtime path of a request or job before changing the code.
---
# runtime-path-trace

## Classification
- kind: analysis
- domain: reliability
- batch: 16
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Follows a request or job through the real runtime path.

## Invocation conditions
- A task needs to know the real runtime path of a request or job before changing the code.
- A reviewer or a gate asks for this analysis on the touched area.

## Required inputs
- The scope: the changed files or the area under study.
- The repository and, where relevant, the canonical naming map and architecture documents.

## Procedure
1. Define the scope and the exact question: the real runtime path of a request or job.
2. Collect the evidence with the route handler, guards, interceptors, services, queue jobs and external calls, confirmed by running the path where possible.
3. Name the entry point and every guard and interceptor that runs before the handler.
4. Follow the calls into services, database access, queue jobs and external calls.
5. Where the path can be run locally, run it and compare the observed order with the read order.
6. Report each result as an ordered path with the observed or read status of each step, and list what was checked even when nothing is found.

## Expected outputs
- An analysis report that answers: the real runtime path of a request or job.
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
