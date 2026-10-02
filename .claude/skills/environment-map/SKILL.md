---
name: environment-map
description: Lists environments, their variables and what each is allowed to reach. Use when a task needs the current environments, their variables and what each may reach before a change is planned or reviewed.
---
# environment-map

## Classification
- kind: map
- domain: architecture
- batch: 16
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Lists environments, their variables and what each is allowed to reach.

## Invocation conditions
- A task needs the current environments, their variables and what each may reach before a change is planned or reviewed.
- The recorded map is older than the last change to its sources.

## Required inputs
- The scope of the task and the repository tree.
- The sources to read: the environment documents, compose files, workflow files and configuration templates.

## Procedure
1. Read the sources: the environment documents, compose files, workflow files and configuration templates, and never rely on a remembered map.
2. Enumerate every environment and the services and data it can reach completely; sample nothing.
3. Record for each entry: environment, variables, reachable services, data class, who can deploy.
4. Mark entries that cannot be resolved as unknown instead of guessing.
5. Save the map with the workspace fingerprint it was built from.

## Expected outputs
- A environments, their variables and what each may reach map with one row per entry and its recorded columns.
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
