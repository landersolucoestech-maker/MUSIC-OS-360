---
name: plan
description: Produces an ordered, dependency-aware execution plan. Use when a requirement has been analyzed and work must be ordered.
---
# plan

## Classification
- kind: governance
- domain: governance
- batch: 16
- approval: none
- mutates: no
- capability-unavailable: no

## Purpose
Produces an ordered, dependency-aware execution plan.

## Invocation conditions
- A requirement has been analyzed and work must be ordered.
- A gate failed and the remediation needs an order.

## Required inputs
- The requirements with their criteria and the discovery record.

## Procedure
1. List the changes needed and the files each touches.
2. Order them by dependency and mark which can run in parallel with disjoint file ownership.
3. Attach the validation and the reviewer to each step.
4. Mark steps that need approval and why.
5. Record the plan so progress can be checked against it.

## Expected outputs
- An ordered plan with dependencies, owners, validations and approvals.

## Validation
- Every step has an owner, a validation and a defined file scope.
- Parallel steps have disjoint scopes.

## Evidence
- The recorded plan with step owners, validations and approvals.

## Failure behavior
- If a step cannot be scoped, split it until it can or report the unknown.

## Rollback and recovery
- Read-only: nothing is changed, so there is nothing to roll back; rerun with the corrected scope if the scope was wrong.

## Human approval
- Read-only analysis: it reports and changes nothing, so no human approval is needed.
