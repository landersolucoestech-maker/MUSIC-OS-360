---
name: send-contract-notification
description: Notifies about a contract event. Use when a contract event such as a draft ready, a signature request or a completed contract must be told to a party.
---
# send-contract-notification

## Classification
- kind: high-impact-operation
- domain: operations
- batch: 18
- approval: external-send
- mutates: yes
- capability-unavailable: no

## Purpose
Notifies about a contract event.

## Invocation conditions
- A contract event such as a draft ready, a signature request or a completed contract must be told to a party.

## Required inputs
- The contract event and the party contact records.

## Procedure
1. Take the recipient from the validated party contact record.
2. Generate the body from the template with the contract data and attach only documents whose hash was verified.
3. Request approval under the sending policy and send after it.
4. Record the message, recipient and attachment hashes.

## Expected outputs
- A contract notification prepared and, after approval, sent and recorded.

## Validation
- Recipient and attachment hashes are verified.

## Evidence
- The message record with recipients and attachment hashes.

## Failure behavior
- If the recipient address is unverified, stop and ask for confirmation.

## Rollback and recovery
- A sent message cannot be recalled; compensate by sending a correction message and record it.

## Human approval
- The message leaves the organization with contract content, so the sending policy and its approval apply.
