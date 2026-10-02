---
name: send-rejection-notification
description: Notifies with the real distributor rejection reason. Use when a distributor rejection must be told to the responsible person with the corrections needed.
---
# send-rejection-notification

## Classification
- kind: high-impact-operation
- domain: operations
- batch: 18
- approval: external-send
- mutates: yes
- capability-unavailable: no

## Purpose
Notifies with the real distributor rejection reason.

## Invocation conditions
- A distributor rejection must be told to the responsible person with the corrections needed.

## Required inputs
- The classified rejection and the correction tasks.

## Procedure
1. Select the recipient from the owner of each correction task.
2. Write the message listing each reason in humanized language with the required correction.
3. Request approval under the sending policy when it leaves the organization and send after it.
4. Record the notification.

## Expected outputs
- A rejection notification prepared and, when allowed, sent and recorded.

## Validation
- Every reason in the message matches a reason in the rejection record.

## Evidence
- The notification record and the rejection reference.

## Failure behavior
- If a reason cannot be mapped to a correction, flag it for human review before sending.

## Rollback and recovery
- A sent message cannot be recalled; compensate by sending a correction message and record it.

## Human approval
- Messages leaving the organization need approval under the sending policy.
