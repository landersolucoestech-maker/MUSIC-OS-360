---
name: stale-code-analysis
description: Finds code whose assumptions no longer match the schema or contracts. Use when a task needs to know code whose assumptions no longer match the schema or contracts before changing the code.
---
# stale-code-analysis

## Classification
- kind: analysis
- domain: quality
- batch: 16
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Finds code whose assumptions no longer match the schema or contracts.

## Invocation conditions
- A task needs to know code whose assumptions no longer match the schema or contracts before changing the code.
- A reviewer or a gate asks for this analysis on the touched area.

## Required inputs
- The scope: the changed files or the area under study.
- The repository and, where relevant, the canonical naming map and architecture documents.

## Procedure
1. Define the scope and the exact question: code whose assumptions no longer match the schema or contracts.
2. Collect the evidence with entities compared with the catalog, DTOs compared with controllers and clients compared with responses.
3. Compare entity fields with the migrated schema columns.
4. Compare DTO and client types with the real response shape.
5. Find branches that handle values the schema or contract can no longer produce.
6. Report each result as a stale item with the assumption it makes and the fact that contradicts it, and list what was checked even when nothing is found.

## Expected outputs
- An analysis report that answers: code whose assumptions no longer match the schema or contracts.
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
