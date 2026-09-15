---
name: database-schema-drift
description: Detects material drift between the ORM/entity layer, migration history, expected and (when safely available) actual Postgres schema, constraints/indexes/FKs, RLS policies, generated types, and raw-SQL/repository usage. Use periodically, before trusting an entity definition as accurate, and whenever a migration or entity change is suspected to be out of sync with something else in the chain. Complements schema-normalization (the safe remediation path once a rename decision exists) — this is the detection side that surfaces whether such a decision is even needed.
---

# Database Schema Drift

## Reconciliation chain

```
ORM/ENTITY DEFINITIONS <-> MIGRATION HISTORY <-> EXPECTED POSTGRES SCHEMA <-> REAL DATABASE
  (when safely authorized and available) <-> CONSTRAINTS <-> INDEXES <-> FOREIGN KEYS
  <-> RLS/POLICIES <-> GENERATED DATABASE TYPES <-> REPOSITORIES/RAW SQL
  <-> RELEVANT API/SHARED TYPES
```

## Detect

Column present in DB but absent from the entity (or vice versa) · type mismatch · length mismatch ·
enum mismatch · nullable mismatch · default-value mismatch · a migration that should exist but
doesn't · a duplicate migration · a partially-applied migration · a missing or different constraint
· a missing or redundant index · an FK mismatch (including "no physical FK where the app assumes
one exists" — a real and common pattern, not automatically a bug, but must be confirmed
intentional) · a cascade-behavior mismatch · a tenant-owned table lacking the RLS policy its peers
have · policy drift between similar tables · stale generated types · raw SQL referencing a column
that no longer exists (or the entity's own name for it) · a repository built against the wrong
assumed schema · naming drift (a physical column the app-layer name no longer matches) · a
duplicate semantic field (two columns/entities modeling the same real-world concept) ·
migration-order drift (a migration that assumes a later one already ran, or vice versa).

## Classification (pick exactly one per drift found)

`REAL_DRIFT` · `INTENTIONAL_REPRESENTATION_BOUNDARY` (a deliberate app-layer vs. DB-layer
difference, documented) · `EXPAND_MIGRATE_CONTRACT_TRANSITION` (mid-flight per
`schema-normalization`'s own sequence) · `HISTORICAL_MIGRATION_DO_NOT_REWRITE` · `STALE_GENERATED_
ARTIFACT` · `FALSE_POSITIVE`.

Never modify a published/already-applied migration file to "fix" drift unless explicit repository
evidence proves that's this project's actual accepted practice for that class of migration
(`.claude/rules/data-governance.md`) — the correction is almost always a NEW migration, not an edit
to history.

## Method

1. Read the entity/ORM layer and the full migration history for the object(s) in scope.
2. If real, safely-authorized DB access exists: introspect read-only and compare directly. If it
   doesn't: reconstruct expected schema from migrations + entities + generated types, and say so
   explicitly — never invent or assume live DB state you haven't actually observed.
3. For a tenant-owned table, cross-check RLS policy presence AND whether its binding mechanism is
   actually active in the environment under review (see `security-tenancy-auditor` Invariant 3 —
   compose with that skill rather than re-deriving the same check independently).
4. Walk every raw-SQL/repository call site touching the object(s) in scope and confirm it agrees
   with the CURRENT schema, not a remembered/assumed one.
5. Delegate `database-reviewer` as the primary reviewer, `backend-reviewer` for repository/service
   usage, `security-reviewer` for any RLS/constraint drift with a security implication,
   `contract-reviewer` for generated-type/API-shape drift.
6. Use `schema-normalization` only for a CONFIRMED remediation with a canonical decision already
   made (via `canonical-naming` if a rename is involved) — this skill's own job ends at detection
   and classification, not at executing the fix.
7. After any confirmed correction, run a residual search (`residue-search`) for old
   column/table/type names still referenced anywhere in code, fixtures, or docs.

## PASS / FAIL / BLOCKED

- **PASS**: every object in scope reconciles cleanly across the full chain, or every drift found has
  a classification and, where warranted, a disposition.
- **FAIL**: `REAL_DRIFT` found with no disposition, or a tenant-owned table missing RLS its peers
  have.
- **BLOCKED**: no real DB access available to confirm actual (vs. expected) schema state for an
  object where that distinction matters — state the limitation explicitly and proceed on
  migrations+entities+generated-types only, clearly labeled as such, never presented as equivalent
  to a live-DB-verified result.

## Output

Per object: entity/ORM representation, migration state, expected DB shape, actual DB shape (if
observed), generated-types state, repository usage, drift type, severity, proposed remediation (if
`REAL_DRIFT`), whether a migration is required, data impact, tenant/RLS impact, evidence, and a
disposition. Record findings via `node .claude/runtime/ops.mjs finding add --category E ...`
(category E — database/persistence, per `.claude/contracts/finding-record.schema.json`).
