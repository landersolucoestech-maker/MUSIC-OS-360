---
name: repo-inspect
description: Inspects repository state: branch, HEAD, tree, remotes and protected files. Use when a task needs to know the repository state: branch, HEAD, tree, remotes and protected files before changing the code.
---
# repo-inspect

## Classification
- kind: analysis
- domain: repository
- batch: 16
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Inspects repository state: branch, HEAD, tree, remotes and protected files.

## Invocation conditions
- A task needs to know the repository state: branch, HEAD, tree, remotes and protected files before changing the code.
- A reviewer or a gate asks for this analysis on the touched area.

## Required inputs
- The scope: the changed files or the area under study.
- The repository and, where relevant, the canonical naming map and architecture documents.

## Procedure
1. Define the scope and the exact question: the repository state: branch, HEAD, tree, remotes and protected files.
2. Collect the evidence with read-only git commands and a listing of the protected file patterns.
3. Read the branch, HEAD commit and upstream.
4. Read the status including untracked files and the configured remotes.
5. List which protected files exist or are modified.
6. Report each result as a state record of branch, HEAD, status, remotes and protected files, and list what was checked even when nothing is found.

## Expected outputs
- An analysis report that answers: the repository state: branch, HEAD, tree, remotes and protected files.
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
