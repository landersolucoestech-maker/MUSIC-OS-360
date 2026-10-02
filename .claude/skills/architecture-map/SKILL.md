---
name: architecture-map
description: Maps the real modules, layers and boundaries of the repository. Use when a task needs an up-to-date map of modules, layers and boundaries of the repository before a change is planned or reviewed.
---
# architecture-map

## Classification
- kind: map
- domain: architecture
- batch: 16
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Maps the real modules, layers and boundaries of the repository.

## Invocation conditions
- A task needs an up-to-date map of modules, layers and boundaries of the repository before a change is planned or reviewed.
- The recorded map is older than the last change to its sources.

## Required inputs
- The scope of the task and the repository tree.
- The sources to read: the root manifests, the workspace file, the source trees of `apps` and `packages` and the architecture documents.

## Procedure
1. Read the sources: the root manifests, the workspace file, the source trees of `apps` and `packages` and the architecture documents, and never rely on a remembered map.
2. Enumerate every app, package, module and layer with its entry points completely; sample nothing.
3. Record for each entry: name, path, responsibility, dependencies in and out, owner.
4. Mark entries that cannot be resolved as unknown instead of guessing.
5. Save the map with the workspace fingerprint it was built from.

## Expected outputs
- A modules, layers and boundaries of the repository map with one row per entry and its recorded columns.
- A list of unknown entries.

## Validation
- The number of entries equals a fresh count taken directly from the sources.
- Every entry has every column filled or marked unknown.

## Evidence
- The map file with the source file and line of each entry.
- The commands used to count entries.

## Failure behavior
- If a source cannot be read, report BLOCKED with the missing source and do not produce a partial map as complete.
- If the map is empty, state what was searched so an empty result is not mistaken for a clean one.

## Rollback and recovery
- Read-only: nothing is changed, so there is nothing to roll back; rerun with the corrected scope if the scope was wrong.

## Human approval
- Read-only analysis: it reports and changes nothing, so no human approval is needed.
