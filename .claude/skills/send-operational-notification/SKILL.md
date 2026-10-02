---
name: send-operational-notification
description: Sends an operational notification through the configured channel. Use when an operational event needs someone informed.
---
# send-operational-notification

## Classification
- kind: high-impact-operation
- domain: operations
- batch: 18
- approval: external-send
- mutates: yes
- capability-unavailable: no

## Purpose
Sends an operational notification through the configured channel.

## Invocation conditions
- An operational event needs someone informed.

## Required inputs
- The event and the recipient rules.

## Procedure
1. Select recipients by role and permission, never from free text.
2. Write the message from the event data in the product language with humanized wording.
3. Deduplicate against recent notifications and check the sending policy.
4. Request approval when the message leaves the organization and send only after it.
5. Record the notification with its trigger.

## Expected outputs
- A notification prepared for sending and, when allowed, sent and recorded.

## Validation
- Recipients derive from roles and the message contains no invented data.

## Evidence
- The notification record with recipients, trigger and approval reference.

## Failure behavior
- If the policy blocks the send, record it and escalate instead of using another channel.

## Rollback and recovery
- A sent message cannot be recalled; compensate by sending a correction message to the same recipients and record it.

## Human approval
- Internal in-product notifications follow normal permissions; any message leaving the organization needs approval under the sending policy.
