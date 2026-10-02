---
name: resume-after-approval
description: Resumes a paused run only on a granted approval. Use when a pending approval request received a decision.
---
# resume-after-approval

## Classification
- kind: high-impact-operation
- domain: operations
- batch: 18
- approval: none
- mutates: yes
- capability-unavailable: no

## Purpose
Resumes a paused run only on a granted approval.

## Invocation conditions
- A pending approval request received a decision.

## Required inputs
- The approval decision record and the stopped automation checkpoint.

## Procedure
1. Read the decision and check it is approve, recorded, unexpired and bound to the same payload hash.
2. On reject, expiry or mismatch stop the automation and record why.
3. On a valid approve resume from the checkpoint with only the approved payload.
4. Record the resume in the audit trail.

## Expected outputs
- A resumed automation or a recorded stop.

## Validation
- The resumed payload hash equals the approved hash.

## Evidence
- The decision record reference and the resume entry.

## Failure behavior
- If the payload hash differs, stop and request a new approval.

## Rollback and recovery
- Stop the resumed automation at the next checkpoint and restore already applied steps with the recovery skill.

## Human approval
- This skill never grants approval; it only continues after a human decision that is recorded and matches the payload.
