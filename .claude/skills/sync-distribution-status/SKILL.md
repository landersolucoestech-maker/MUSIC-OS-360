---
name: sync-distribution-status
description: Reads the distributor status without inventing one. Use when a submission exists and its status may have changed.
---
# sync-distribution-status

## Classification
- kind: operation
- domain: operations
- batch: 18
- approval: none
- mutates: yes
- capability-unavailable: yes

## Purpose
Reads the distributor status without inventing one.

## Invocation conditions
- A submission exists and its status may have changed.

## Required inputs
- The submission records.
- A configured distributor provider.

## Procedure
1. Check a distributor provider is configured; if not, return CAPABILITY_UNAVAILABLE and leave the recorded status unchanged.
2. Query the status through the guarded path for each open submission.
3. Compare with the recorded status and list conflicts.
4. Update the recorded status through the guarded service only when the provider answered, and record the provider time.

## Expected outputs
- A status report or a CAPABILITY_UNAVAILABLE result.

## Validation
- A status is recorded only from a provider answer with its timestamp.

## Evidence
- The provider answer and the status update entry.

## Failure behavior
- If the provider fails, classify the failure and keep the recorded status.

## Rollback and recovery
- Revert a wrong status update by restoring the previous status from the recorded update entry.

## Human approval
- Read of an external status and a record update inside normal permissions: no separate approval is needed.

## Capability unavailable
- required integration: distributor provider, not configured in this repository
- expected contract: a submission id in; a status with reasons and timestamp out
- expected input: submission id
- expected output: status with timestamp
- safe fallback: keep the recorded status and ask a person to update it manually with the source of the information
