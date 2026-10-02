---
name: send-distribution-notification
description: Notifies about a distribution event. Use when a distribution event such as a submission or a status change must be told to the owner or the artist team.
---
# send-distribution-notification

## Classification
- kind: high-impact-operation
- domain: operations
- batch: 18
- approval: external-send
- mutates: yes
- capability-unavailable: no

## Purpose
Notifies about a distribution event.

## Invocation conditions
- A distribution event such as a submission or a status change must be told to the owner or the artist team.

## Required inputs
- The distribution event and the recipient rules.

## Procedure
1. Select recipients by role from the Release record.
2. Write the message from the real status and never from a guessed one.
3. Request approval under the sending policy when the message leaves the organization and send after it.
4. Record the notification.

## Expected outputs
- A distribution notification prepared and, when allowed, sent and recorded.

## Validation
- The stated status equals the recorded provider status.

## Evidence
- The notification record with the status source.

## Failure behavior
- If the status is unavailable, say so in the message or do not send.

## Rollback and recovery
- A sent message cannot be recalled; compensate by sending a correction message and record it.

## Human approval
- Messages leaving the organization need approval under the sending policy.
