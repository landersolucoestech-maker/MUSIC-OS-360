---
name: repair-approved-inconsistency
description: Applies a repair only after an approval covers it. Use when a human approved the repair of a detected inconsistency.
---
# repair-approved-inconsistency

## Classification
- kind: high-impact-operation
- domain: operations
- batch: 18
- approval: auto-fix-legal-financial
- mutates: yes
- capability-unavailable: no

## Purpose
Applies a repair only after an approval covers it.

## Invocation conditions
- A human approved the repair of a detected inconsistency.

## Required inputs
- The repair proposal with before and after values and the approval record.

## Procedure
1. Verify the approval is recorded and bound to the exact proposal.
2. Verify the before values still match the live data; stop if they changed.
3. Apply only the proposed changes through the guarded service and record the before values.
4. Re-run the detection for the repaired records and record the result.

## Expected outputs
- Applied repairs, recorded before values and a re-detection result.

## Validation
- Only the approved records changed and the detection no longer reports them.

## Evidence
- The approval record, before values and the re-detection output.

## Failure behavior
- If live data changed since the proposal, stop and request a new proposal.

## Rollback and recovery
- Restore the recorded before values through the guarded service.

## Human approval
- Repairs of legal or financial data are never automatic: a named human approver must approve the exact proposal.
