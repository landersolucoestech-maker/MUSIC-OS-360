---
name: send-signature-reminder
description: Reminds a signer of a pending signature. Use when a signer has not signed within the expected time.
---
# send-signature-reminder

## Classification
- kind: high-impact-operation
- domain: operations
- batch: 18
- approval: external-send
- mutates: yes
- capability-unavailable: no

## Purpose
Reminds a signer of a pending signature.

## Invocation conditions
- A signer has not signed within the expected time.

## Required inputs
- The pending signature record and reminder history.

## Procedure
1. Check the reminder limit per signer and the cooldown.
2. Generate the reminder from the template with the signing link supplied by the provider.
3. Request approval under the sending policy and send after it.
4. Record the reminder in the history.

## Expected outputs
- A reminder prepared and, after approval, sent and recorded.

## Validation
- Limits are respected and the recipient is the contract signer.

## Evidence
- The reminder history entry and approval reference.

## Failure behavior
- If the limit is reached, do not send and escalate.

## Rollback and recovery
- A sent reminder cannot be recalled; compensate by sending a correction message when it was wrong and record it.

## Human approval
- The message leaves the organization, so the sending policy and its approval apply.
