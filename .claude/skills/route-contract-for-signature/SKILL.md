---
name: route-contract-for-signature
description: Sends a generated contract into the configured signature flow. Use when a reviewed contract must be sent to its signers.
---
# route-contract-for-signature

## Classification
- kind: high-impact-operation
- domain: operations
- batch: 18
- approval: signature
- mutates: yes
- capability-unavailable: no

## Purpose
Sends a generated contract into the configured signature flow.

## Invocation conditions
- A reviewed contract must be sent to its signers.

## Required inputs
- The reviewed contract with its recorded review.
- The signer list and the chosen signature provider.

## Procedure
1. Check the review is recorded and the document hash equals the reviewed hash.
2. Prepare the request with signers, order and provider and the exact document hash.
3. Create the approval request for signature bound to that hash and stop.
4. After the recorded approval, send through the guarded provider service and record the provider reference.
5. Report provider unavailability and never use another channel.

## Expected outputs
- An approval request and, after approval, a recorded signature request with the provider reference.

## Validation
- The approval is bound to the document hash that was sent.
- No request was sent before the approval was recorded.

## Evidence
- The approval record, the document hash and the provider reference.

## Failure behavior
- If the hash changed after review, stop and request a new review and approval.
- If the provider is unavailable, report it and keep the request ready.

## Rollback and recovery
- Compensate by cancelling the signature request at the provider and recording a correction notice to the signers; a sent request cannot be unsent.

## Human approval
- Sending a contract for signature is a legal act: a named human approver must approve this exact document hash before it is sent.
