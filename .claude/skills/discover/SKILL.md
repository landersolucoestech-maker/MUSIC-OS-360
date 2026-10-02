---
name: discover
description: Discovers the real stack, entry points and unknowns of a task area. Use when a task area is unfamiliar or the cached knowledge of it may be stale.
---
# discover

## Classification
- kind: governance
- domain: governance
- batch: 16
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Discovers the real stack, entry points and unknowns of a task area.

## Invocation conditions
- A task area is unfamiliar or the cached knowledge of it may be stale.
- A reviewer reports that the architecture differs from what was mapped.

## Required inputs
- The task description and the repository tree.

## Procedure
1. Read the manifests, workspace configuration and the source tree of the task area.
2. Identify entry points, data stores, external calls and tests that touch the area.
3. List what is unknown and the cheapest way to settle each unknown.
4. Record the discovered facts with their source files and prefer them over memory.

## Expected outputs
- A discovery record of stack, entry points, data and unknowns.

## Validation
- Every claim cites a source file.
- Unknowns are listed, not filled by assumption.

## Evidence
- The discovery record with source references.

## Failure behavior
- If the area cannot be read, report BLOCKED with the unreadable parts.

## Rollback and recovery
- Read-only: nothing is changed, so there is nothing to roll back; rerun with the corrected scope if the scope was wrong.

## Human approval
- Read-only analysis: it reports and changes nothing, so no human approval is needed.
