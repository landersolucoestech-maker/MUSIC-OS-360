---
name: safe-db-rename
description: Safely renames a physical database object (column, table, index, constraint, FK) with zero/low downtime and full rollback capability — narrower and more mechanical than schema-normalization (which covers the broader expand-migrate-contract sequence for ANY schema change, including type changes and splits). Use specifically when the change IS a rename with no structural/type change, and you need the exact dependency-aware sequencing a rename requires.
---

# Safe DB Rename

A rename touches more than the renamed object: dependent indexes, constraints, foreign keys,
views, triggers, and functions/procedures reference it by name, and every producer/consumer in
application code reads/writes the old name. This skill is the dependency-aware sequencing
`schema-normalization`'s general expand-migrate-contract pattern doesn't spell out at this level of
mechanical detail. Both skills share the same underlying principle
(`.claude/rules/data-governance.md`) and neither renames in place — see `schema-normalization` for
the broader pattern this specializes.

## 1. Physical column/table rename

Never `ALTER TABLE ... RENAME COLUMN` directly against a live table with active readers on the old
name — even though it's one statement, it breaks the currently-deployed application version the
instant it commits. Instead: add the new column/table (expand), backfill, dual-write during the
transition, migrate readers, then drop the old one (contract) — see `schema-normalization`'s
5-step sequence, applied here specifically to a same-type rename.

## 2. Foreign key (FK) rename

An FK constraint name is usually independent of the column names it references. Renaming the
columns it references does NOT require renaming the constraint, but renaming the CONSTRAINT itself
(if it has an old, inconsistent name) is its own zero-downtime operation:
`ALTER TABLE ... RENAME CONSTRAINT old_fk_name TO new_fk_name` (Postgres) is metadata-only and safe
to run directly, unlike a column/table rename — it doesn't touch data or require dual-write.

## 3. Index rename

`ALTER INDEX old_idx_name RENAME TO new_idx_name` is also metadata-only and safe to run directly —
it does not rebuild the index or block reads/writes. Confirm the project's migration tool doesn't
model this as a drop+recreate (which WOULD rebuild and could lock), and verify no application code
depends on the index's name directly (rare, but check monitoring/alerting configs that reference
index names).

## 4. Constraint rename (check/unique constraints)

Same as FK rename: a `RENAME CONSTRAINT` is metadata-only in Postgres-family databases. Verify the
project's actual database engine supports this directly — some engines require drop+recreate,
which for a CHECK or UNIQUE constraint on a large table can require a full table scan; sequence
that as its own reviewed step, not bundled with the rename.

## 5. View/trigger/function dependency

Grep for every view, trigger, and stored function/procedure referencing the object being renamed —
a physical rename breaks any dependent view/function that hardcodes the old name (most databases
do NOT cascade a rename into dependent view/function definitions automatically). Update each
dependent definition in the same migration, or immediately after, so nothing is left silently
broken between steps.

## 6. Migration preservation

Never edit or renumber an already-applied migration to reflect the rename — write a new migration
implementing the expand step, per the mission rule that already-applied historical migrations must
not be rewritten indiscriminately. The rename's full history stays visible across migration files.

## 7. Existing data

The backfill step must handle every existing row, including NULLs and any legacy/malformed values
already present — decide and document the NULL-handling behavior (default, computed, left NULL)
before writing the backfill, not as an afterthought when it fails partway through.

## 8. Zero/low-downtime sequencing

Order strictly: (1) add new object, nullable/defaulted; (2) backfill in batches sized to avoid long
locks on a large table; (3) add dual-write in the application so both old and new stay in sync for
any row written during the transition; (4) migrate readers to the new object one bounded batch at a
time (`cross-layer-impact` skill); (5) stop dual-write once no reader depends on the old object;
(6) drop the old object in a separate, explicitly-labeled migration. Never collapse steps to "save
a deploy."

## 9. Producer/consumer rollout

Because step 4 above can span multiple deploys, verify BOTH the previous and the new application
version can run correctly against the same database state throughout the transition — a rename
that requires a single atomic app+db deploy to avoid breakage is not zero-downtime and needs
explicit approval as a maintenance-window change instead (`.claude/policies/authority.json`'s
`production-write` class).

## 10. Rollback/recovery

Each step has an independent rollback: step 1 (drop the new empty object), step 2 (safe to
re-run/no-op if idempotent), step 3 (revert the dual-write code), step 4 (revert readers to the old
object — only safe while step 5 hasn't happened), step 6 is the point of no return (only reachable
once nothing depends on the old object). Record a `recovery-plan` (kind `SCHEMA_ROLLBACK`) before
starting the drop step specifically, since it's the only irreversible one.

## 11. Residual SQL search

After the contract step, grep the entire codebase (application code, other migrations, seed/fixture
data, reporting queries, ORM entity definitions, raw SQL in scripts) for the OLD name — a rename
"completed" in the schema but still referenced somewhere in code is a silent future bug, not a
finished rename. Use the `residue-search` skill for this pass and dispose of every hit explicitly.

## Output

Update `docs/NAMING_NORMALIZATION_CANONICAL_MAP.md`/`docs/NAMING_NORMALIZATION_STATUS.md` status to
`migrating` at step 1 and `done` only after step 6 (drop) actually lands and step 11's residual
search comes back clean. Evidence for each step via `node .claude/runtime/ops.mjs evidence run`
against the real migration/verification command.
