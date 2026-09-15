---
name: royalties-integrity-auditor
description: Proves the split-percentage invariant (SUM(participant shares) == 100%) holds end to end from UI form through DTO, validation, service, and persistence, across creation, partial update, participant removal, and concurrent-update scenarios, without assuming a specific numeric representation. Use whenever a royalty/rights-split, revenue-share, or any other must-sum-to-100% allocation feature changes. Distinct from schema-normalization (safe renames) — this audits a business invariant's correctness, not a naming decision.
---

# Royalties Integrity Auditor

## Mandatory trace

```
UI -> FORM STATE -> FRONTEND VALIDATION -> API CLIENT -> DTO -> CONTROLLER -> SERVICE/USE CASE
  -> DOMAIN VALIDATION -> REPOSITORY -> DATABASE -> CONSTRAINTS/TRANSACTION
```

## Primary invariant

`SUM(split percentages) == 100%` (or this project's real equivalent unit — confirm it, see below).

## Method

1. Determine the ACTUAL numeric representation before assuming anything: integer percentage,
   decimal percentage, basis points, or a fixed-point/BigInt cents-style allocation. Do not import
   an assumption from another project or from this skill's own examples below.
2. Determine the canonical split SOURCE — which layer is authoritative when the frontend, the DTO,
   and the database could each theoretically hold a slightly different computed sum (rounding).
3. Trace every write path: create, full update, partial update, single-participant removal,
   duplicate-participant handling. A representation that's correct on create but not re-validated
   on partial update is a real, common bug class here.
4. Check precision/rounding behavior explicitly: float summation error, string-to-number
   conversion, serialization round-tripping (a value that reads back slightly different from what
   was written), and whether the project already has a BigInt-safe/decimal-safe helper it
   inconsistently uses (if so, every write path should use it — a write path that doesn't is a
   finding, not a stylistic nit).
5. Check the database layer for an actual constraint (a `CHECK`, a trigger, a
   `DEFERRABLE INITIALLY DEFERRED` constraint trigger) versus app-layer-only enforcement — if
   app-layer is the only gate, a direct DB write or a bug in one code path can persist an invalid
   split with nothing to catch it.
6. Check the transaction/locking boundary for concurrent updates to the same split set — two
   concurrent "add a participant" calls that each read the pre-write sum and both pass validation
   independently is a real race, not a hypothetical one (`distributed-systems-reviewer`/
   `database-reviewer` territory — look for whether the project already uses an advisory lock or
   equivalent pattern elsewhere for an analogous race and whether it's applied here too).
7. Delegate `backend-reviewer` and `database-reviewer` for the write path, `frontend-reviewer` for
   form validation, `contract-reviewer` for DTO/API-shape consistency between frontend and backend
   validation rules (a frontend that blocks >100% but a backend that doesn't, or vice versa, is a
   real parity gap), and `test-strategy-engineer` for the required cases below.
8. Frontend-only validation is never sufficient proof by itself — the backend/DB layer must
   independently enforce the invariant, since any second real client, a script, or an API caller
   bypasses the frontend entirely.
9. Do not change the numeric representation as part of this audit unless the current one is
   proven to be the actual root cause of a persisted-invalid-split defect — reconstruct the current
   contract and data impact first (`cross-layer-impact`); a representation change is schema-level
   work, hand it to `schema-normalization` if warranted.

## Required test cases

99.99 · exactly 100 · 100.01 · a single participant at 100 · many participants summing to exactly
100 with rounding · a duplicate participant entry · removing a participant (does the remainder
re-validate?) · updating one participant's share in isolation (partial update) · creation with a
malformed/missing-field payload · high-precision values that only sum to 100 after rounding · two
concurrent updates to the same split set.

## Invariant severity rule

Any write path that CAN persist an invalid split (sum != 100% within the project's own documented
tolerance, if one exists) is HIGH until proven otherwise — do not downgrade on the assumption that
"the frontend already blocks this."

## PASS / FAIL / BLOCKED

- **PASS**: every required test case is real, executed, and passing; the DB layer independently
  enforces the invariant (not app-layer-only); frontend and backend validation rules provably agree.
- **FAIL**: any path found that persists an invalid sum, a concurrency race that can produce one, or
  a precision/rounding bug that silently drifts the stored sum away from 100%.
- **BLOCKED**: no way to safely exercise the concurrent-update case in the available environment (no
  real DB, no way to trigger true concurrency) — state this explicitly rather than treating a
  sequential test as equivalent proof.

## Output

Canonical representation and unit, canonical split source, every write path with its validation
layers, persistence/transaction behavior, edge-case results, missing protections, findings
(category B — business rule, or E — database/persistence, per
`.claude/contracts/finding-record.schema.json`), evidence, and a verdict.
