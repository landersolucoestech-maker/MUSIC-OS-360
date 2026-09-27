# Database Governance — Soft Delete + Indexes + Migration Safety + Pagination

## What & Why
The current Drizzle schema has no standardized soft delete (physical DELETE on every table), has no composite indexes for multi-tenant queries (every SELECT by tenantId does a full table scan), pagination is client-side (storage.list returns everything and the frontend slices it), and the migrations have no rollback strategy. In production with thousands of records per tenant, queries without a tenantId + created_at index degrade to O(n). Hard deletes make auditing and data recovery impossible.

## Done looks like
- A `deleted_at TIMESTAMP NULL DEFAULT NULL` field added to all main tables (artists, works, phonograms, contracts, clients, leads, transactions, projects, campaigns, events, inventory, licensing)
- All Drizzle queries filter `deleted_at IS NULL` automatically via a `withSoftDelete()` helper
- Composite indexes created: `(tenant_id, deleted_at, created_at DESC)` on the main tables
- Indexes on FKs: `(tenant_id, artist_id)`, `(tenant_id, work_id)`, `(tenant_id, status)` where applicable
- Standardized cursor-based pagination: a `paginate(query, { cursor, limit })` helper returns `{ data, nextCursor, hasMore }`
- Migration governance: every migration has documented `up()` and `down()`; a `migrations/README.md` file with conventions
- `drizzle-kit generate` and `migrate` work without errors
- `tsc --noEmit` without errors

## Out of scope
- Changing the business logic of any module
- Rewriting existing queries (only adding the filter via the helper)
- Row Level Security in the database (hardening phase)
- Backup strategy (phase 5)

## Steps
1. **Schema — soft delete columns** — add `deleted_at: timestamp('deleted_at')` to all main tables in `schema.ts`; generate the migration with drizzle-kit; apply it via `npm run db:migrate`
2. **withSoftDelete helper** — create `database/helpers/soft-delete.ts` with `withSoftDelete<T>(query)`, which adds `.where(isNull(table.deleted_at))`; create `softDelete(db, table, id)`, which does an UPDATE instead of a DELETE; update `database/index.ts` to export them
3. **Composite indexes** — add to the schema: an index `(tenant_id, deleted_at, created_at)` on the 10+ main tables; an index `(tenant_id, status)` on contracts, transactions, leads; run the migration
4. **Cursor-based pagination helper** — create `database/helpers/paginate.ts` with `paginate<T>({ query, cursor, limit, orderCol })` returning `{ items: T[], nextCursor: string | null, hasMore: boolean }`; use an encoded UUID as the opaque cursor
5. **Migration README** — create `apps/api/drizzle/README.md` documenting: the naming convention, how to generate, how to apply, how to revert manually (drizzle does not support automatic down — document the rollback SQL for each migration)
6. **Update DELETE endpoints** — in the existing controllers, replace `db.delete(table).where(eq(id))` with `softDelete(db, table, id)` via the helper; ensure that GET queries use `withSoftDelete()`

## Relevant files
- `apps/api/src/database/schema.ts`
- `apps/api/src/database/database.module.ts`
- `apps/api/drizzle/` (migrations directory)
- `apps/api/src/modules/artists/artists.service.ts` (example of a DELETE to update)
- `apps/api/src/modules/contracts/contracts.service.ts`
- `apps/api/src/modules/transactions/transactions.service.ts`
