---
name: submit-distribution
description: Submits the package through the configured distributor integration. Use when a validated package must be delivered to a distributor.
---
# submit-distribution

## Classification
- kind: high-impact-operation
- domain: operations
- batch: 18
- approval: external-send-irreversible
- mutates: yes
- capability-unavailable: yes

## Purpose
Submits the package through the configured distributor integration.

## Invocation conditions
- A validated package must be delivered to a distributor.

## Required inputs
- The assembled package with its hash and a current readiness result.
- A configured distributor provider.

## Procedure
1. Check a distributor provider is configured; if not, return CAPABILITY_UNAVAILABLE and stop.
2. Confirm the readiness result is current and the package hash is unchanged.
3. Create the approval request for the irreversible send naming the exact payload and distributor, and stop.
4. After the recorded approval send through the guarded provider service and record the provider response.

## Expected outputs
- A CAPABILITY_UNAVAILABLE result, or an approval request and after approval a recorded submission.

## Validation
- The send happens only after an approval bound to the package hash.
- No submission is simulated.

## Evidence
- The approval record, the package hash and the provider response.

## Failure behavior
- If the package changed since approval, stop and request a new approval.
- If the provider fails, classify the failure and do not retry blindly.

## Rollback and recovery
- A delivery cannot be unsent: request a takedown or correction from the distributor through the rejection skill and record the compensation.

## Human approval
- Delivery to a distributor is irreversible and external: a named human approver must approve this exact package before it is sent.

## Capability unavailable
- required integration: distributor provider, not configured in this repository (only an unconfigured distributor class exists)
- expected contract: a package with metadata and asset references in; a submission id and status out
- expected input: the assembled distribution package and its hash
- expected output: a submission id with the distributor status
- safe fallback: keep the validated package and the approval request ready and let an authorized person deliver it outside the system and record the result
