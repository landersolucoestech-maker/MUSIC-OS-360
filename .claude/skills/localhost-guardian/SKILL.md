---
name: localhost-guardian
description: Keeps local servers on loopback and never exposes them externally. Use when local servers must be verified before the next action.
---
# localhost-guardian

## Classification
- kind: check
- domain: repository
- batch: 16
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Keeps local servers on loopback and never exposes them externally.

## Invocation conditions
- Local servers must be verified before the next action.
- A guard or gate requires the result of this check.

## Required inputs
- The planned action or the current repository state.
- The policy or rule that the check enforces.

## Procedure
1. List processes and ports started by the task.
2. Check each binds to loopback and not to all interfaces.
3. Check proxies and tunnels are not exposing a port.
4. Stop and report any exposed server.

## Expected outputs
- A local server result with bind addresses.

## Validation
- The check answers a single question: are all local servers bound to loopback only?
- The result is derived from commands run now, not from memory or earlier output.

## Evidence
- The listening socket listing.

## Failure behavior
- If a server cannot be inspected, treat it as exposed and report BLOCKED.

## Rollback and recovery
- Read-only: nothing is changed, so there is nothing to roll back; rerun with the corrected scope if the scope was wrong.

## Human approval
- Read-only analysis: it reports and changes nothing, so no human approval is needed.
