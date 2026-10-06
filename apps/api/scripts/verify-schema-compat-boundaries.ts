#!/usr/bin/env tsx
/**
 * scripts/verify-schema-compat-boundaries.ts
 *
 * Behavioral proof, against a REAL migrated PostgreSQL, of the compatibility boundaries that live in the database schema
 * (ledger rows with path `database-schema`): they cannot be proven by a jest spec with a mocked query runner.
 *
 *   1. invoices.payment_method: chk_invoices_payment_method still accepts the legacy value `transferencia` (deploy-window
 *      tolerance of migration 20260930000021) next to the canonical `bank_transfer`, and still rejects anything else.
 *   2. events.data: the legacy timestamp column stays equal to the canonical events.starts_at in both directions through the
 *      trigger trg_events_sync_start_columns (legacy writers fill data, canonical writers fill starts_at).
 *
 * Everything runs inside one transaction that is rolled back: no row survives. Exit 1 when a boundary does not behave.
 * It is the covering check of those two ledger rows; scripts/naming/schema-boundary-proof.mjs proves that this script FAILS when
 * the boundary is removed (mutation of the schema object), and records the result.
 *
 *   DB_SSL=false DATABASE_URL=postgresql://…/musicos360 npx tsx scripts/verify-schema-compat-boundaries.ts
 */
import { Client } from 'pg';

const LEGACY_PAYMENT_METHOD = 'transferencia';
const CANONICAL_PAYMENT_METHOD = 'bank_transfer';

type Check = { name: string; ok: boolean; detail?: string };

async function expectCheckViolation(client: Client, sql: string, params: unknown[]): Promise<boolean> {
  await client.query('SAVEPOINT s');
  try {
    await client.query(sql, params);
    await client.query('ROLLBACK TO SAVEPOINT s');
    return false;
  } catch (err) {
    await client.query('ROLLBACK TO SAVEPOINT s');
    return (err as { code?: string }).code === '23514';
  }
}

async function accepted(client: Client, sql: string, params: unknown[]): Promise<{ ok: boolean; detail?: string }> {
  await client.query('SAVEPOINT s');
  try {
    await client.query(sql, params);
    await client.query('ROLLBACK TO SAVEPOINT s');
    return { ok: true };
  } catch (err) {
    await client.query('ROLLBACK TO SAVEPOINT s');
    return { ok: false, detail: (err as Error).message };
  }
}

export async function runChecks(client: Client): Promise<Check[]> {
  const checks: Check[] = [];
  const tenant = await client.query(`INSERT INTO tenants (org_id, name, slug) VALUES (gen_random_uuid(), 'boundary-probe', 'boundary-probe-' || substr(md5(random()::text), 1, 8)) RETURNING id`);
  const tenantId = tenant.rows[0].id as string;

  const insertInvoice = 'INSERT INTO invoices (tenant_id, type, legacy_amount, payment_method) VALUES ($1, $2, 1, $3)';
  const legacy = await accepted(client, insertInvoice, [tenantId, 'sale', LEGACY_PAYMENT_METHOD]);
  checks.push({ name: `invoices.payment_method accepts the legacy value ${LEGACY_PAYMENT_METHOD}`, ok: legacy.ok, detail: legacy.detail });
  const canonical = await accepted(client, insertInvoice, [tenantId, 'sale', CANONICAL_PAYMENT_METHOD]);
  checks.push({ name: `invoices.payment_method accepts the canonical value ${CANONICAL_PAYMENT_METHOD}`, ok: canonical.ok, detail: canonical.detail });
  checks.push({ name: 'invoices.payment_method rejects an unknown value (CHECK violation 23514)', ok: await expectCheckViolation(client, insertInvoice, [tenantId, 'sale', 'not_a_method']) });

  // 3. invoices.tipo_nota: the persisted column of the fiscal document kind (API name fiscal_document_type) keeps its legacy
  //    name; a row written with a kind reads back the same kind from that exact column.
  const insertKind = 'INSERT INTO invoices (tenant_id, type, legacy_amount, tipo_nota) VALUES ($1, $2, 1, $3) RETURNING tipo_nota';
  await client.query('SAVEPOINT kind');
  try {
    const kind = await client.query(insertKind, [tenantId, 'sale', 'nfe']);
    checks.push({ name: 'invoices.tipo_nota stores and returns the fiscal document kind', ok: kind.rows[0]?.tipo_nota === 'nfe' });
  } catch (err) {
    checks.push({ name: 'invoices.tipo_nota stores and returns the fiscal document kind', ok: false, detail: (err as Error).message });
  }
  await client.query('ROLLBACK TO SAVEPOINT kind');

  const probe = '2031-02-03 04:05:06';
  const sameInstant = (a: unknown, b: unknown): boolean => a !== null && b !== null && String(a) === String(b);
  try {
    await client.query('SAVEPOINT ev');
    const legacyWriter = await client.query(`INSERT INTO events (tenant_id, title, type, data) VALUES ($1, 'legacy writer', 'show', $2) RETURNING data, starts_at`, [tenantId, probe]);
    checks.push({ name: 'a legacy writer (data only) gets starts_at filled by the trigger', ok: sameInstant(legacyWriter.rows[0].starts_at, legacyWriter.rows[0].data) });
  } catch (err) {
    await client.query('ROLLBACK TO SAVEPOINT ev');
    checks.push({ name: 'a legacy writer (data only) gets starts_at filled by the trigger', ok: false, detail: (err as Error).message });
  }
  try {
    await client.query('SAVEPOINT ev2');
    const canonicalWriter = await client.query(`INSERT INTO events (tenant_id, title, type, data, starts_at) VALUES ($1, 'canonical writer', 'show', $2, $2) RETURNING id`, [tenantId, probe]);
    const id = canonicalWriter.rows[0].id as string;
    await client.query(`UPDATE events SET starts_at = '2032-03-04 05:06:07' WHERE id = $1`, [id]);
    const afterCanonicalUpdate = await client.query(`SELECT data, starts_at FROM events WHERE id = $1`, [id]);
    checks.push({ name: 'updating starts_at alone moves the legacy data column', ok: sameInstant(afterCanonicalUpdate.rows[0].data, afterCanonicalUpdate.rows[0].starts_at) && String(afterCanonicalUpdate.rows[0].starts_at).includes('2032') });
    await client.query(`UPDATE events SET data = '2033-04-05 06:07:08' WHERE id = $1`, [id]);
    const afterLegacyUpdate = await client.query(`SELECT data, starts_at FROM events WHERE id = $1`, [id]);
    checks.push({ name: 'updating the legacy data column alone moves starts_at', ok: sameInstant(afterLegacyUpdate.rows[0].starts_at, afterLegacyUpdate.rows[0].data) && String(afterLegacyUpdate.rows[0].starts_at).includes('2033') });
  } catch (err) {
    await client.query('ROLLBACK TO SAVEPOINT ev2');
    checks.push({ name: 'a canonical writer keeps data and starts_at equal through updates', ok: false, detail: (err as Error).message });
  }
  return checks;
}

async function main(): Promise<void> {
  const url = process.env['DATABASE_URL'];
  if (!url) { console.error('verify-schema-compat-boundaries: DATABASE_URL is not set'); process.exit(2); }
  const client = new Client({ connectionString: url, ssl: process.env['DB_SSL'] === 'true' ? { rejectUnauthorized: false } : undefined });
  await client.connect();
  let checks: Check[] = [];
  try {
    await client.query('BEGIN');
    checks = await runChecks(client);
  } finally {
    await client.query('ROLLBACK').catch(() => undefined);
    await client.end();
  }
  for (const c of checks) console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.name}${c.ok ? '' : ` (${c.detail ?? 'unexpected behavior'})`}`);
  const failed = checks.filter((c) => !c.ok);
  console.log(`schema compat boundaries: ${checks.length - failed.length}/${checks.length} checks passed`);
  if (failed.length) process.exit(1);
}

if (require.main === module) {
  main().catch((err) => { console.error(`verify-schema-compat-boundaries FAILED: ${(err as Error).message}`); process.exit(2); });
}
