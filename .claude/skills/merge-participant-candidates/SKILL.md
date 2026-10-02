---
name: merge-participant-candidates
description: Prepares a merge proposal and never applies it without approval. Use when two participant records are confirmed to be the same real person or company.
---
# merge-participant-candidates

## Classification
- kind: high-impact-operation
- domain: operations
- batch: 18
- approval: entity-merge
- mutates: yes
- capability-unavailable: no

## Purpose
Prepares a merge proposal and never applies it without approval.

## Invocation conditions
- Two participant records are confirmed to be the same real person or company.

## Required inputs
- The duplicate candidate pair with its evidence and impact list.

## Procedure
1. Check the evidence and the impact list are current for both records.
2. Create the approval request for the merge naming both records, the survivor and every affected Work, Phonogram, share and contract, and stop.
3. After the recorded approval run the merge through the guarded service, keeping the full pre-merge snapshot.
4. Verify that every link now points to the survivor and that share totals are unchanged.

## Expected outputs
- An approval request and, after approval, a merged record with a pre-merge snapshot.

## Validation
- Share totals and rights per Work and Phonogram are identical before and after.
- The merge ran only after an approval bound to the exact pair.

## Evidence
- The approval record, the pre-merge snapshot and the before and after share totals.

## Failure behavior
- If totals differ after the merge, restore from the snapshot immediately and report.

## Rollback and recovery
- Restore both records and all links from the pre-merge snapshot through the guarded service.

## Human approval
- A merge changes who is credited and paid: a named human approver must approve this exact pair and survivor before it runs.
