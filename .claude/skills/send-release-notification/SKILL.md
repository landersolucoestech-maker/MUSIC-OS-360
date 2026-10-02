---
name: send-release-notification
description: Notifies about a release event. Use when a release milestone such as scheduled, delivered or live must be told to the team or partners.
---
# send-release-notification

## Classification
- kind: high-impact-operation
- domain: operations
- batch: 18
- approval: external-send
- mutates: yes
- capability-unavailable: no

## Purpose
Notifies about a release event.

## Invocation conditions
- A release milestone such as scheduled, delivered or live must be told to the team or partners.

## Required inputs
- The release event and the recipient rules.

## Procedure
1. Select recipients by role and partner list from the Release record.
2. Write the message from the real release state and dates.
3. Request approval under the sending policy when it leaves the organization and send after it.
4. Record the notification.

## Expected outputs
- A release notification prepared and, when allowed, sent and recorded.

## Validation
- Dates and state in the message equal the Release record.

## Evidence
- The notification record and the Release data version.

## Failure behavior
- If the Release data changed after drafting, regenerate before sending.

## Rollback and recovery
- A sent message cannot be recalled; compensate by sending a correction message and record it.

## Human approval
- Messages leaving the organization need approval under the sending policy.
