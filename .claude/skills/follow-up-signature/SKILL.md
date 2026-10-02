---
name: follow-up-signature
description: Reminds pending signers without altering the contract. Use when a contract is pending signature beyond the reminder threshold.
---
# follow-up-signature

## Classification
- kind: high-impact-operation
- domain: operations
- batch: 18
- approval: external-send
- mutates: yes
- capability-unavailable: no

## Purpose
Reminds pending signers without altering the contract.

## Invocation conditions
- A contract is pending signature beyond the reminder threshold.

## Required inputs
- The pending contract and its reminder history.

## Procedure
1. Check the reminder limits per signer and per contract.
2. Prepare the message from the template in the product language with humanized wording.
3. Request approval under the sending policy and stop.
4. After approval send through the notification path and record the reminder.

## Expected outputs
- A reminder prepared for approval and, after approval, a sent reminder recorded in the history.

## Validation
- Limits are respected and the recipient comes from the contract party record.

## Evidence
- The reminder history entry and the approval reference.

## Failure behavior
- If the limit is reached, do not send and escalate to the owner.

## Rollback and recovery
- A sent message cannot be recalled; compensate by recording a correction message to the same recipient when the reminder was wrong.

## Human approval
- The message leaves the organization, so the sending policy and its approval apply before it is sent.
