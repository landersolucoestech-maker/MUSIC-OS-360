---
name: config-map
description: Lists every configuration key with its source, default and consumers. Use when a task needs the current configuration keys with source, default and consumers before a change is planned or reviewed.
---
# config-map

## Classification
- kind: map
- domain: architecture
- batch: 16
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Lists every configuration key with its source, default and consumers.

## Invocation conditions
- A task needs the current configuration keys with source, default and consumers before a change is planned or reviewed.
- The recorded map is older than the last change to its sources.

## Required inputs
- The scope of the task and the repository tree.
- The sources to read: the environment schema, configuration modules, example environment templates and the code that reads the keys.

## Procedure
1. Read the sources: the environment schema, configuration modules, example environment templates and the code that reads the keys, and never rely on a remembered map.
2. Enumerate every configuration key completely; sample nothing.
3. Record for each entry: key, validation rule, default, consumers, whether it is secret.
4. Mark entries that cannot be resolved as unknown instead of guessing.
5. Save the map with the workspace fingerprint it was built from.

## Expected outputs
- A configuration keys with source, default and consumers map with one row per entry and its recorded columns.
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
