/**
 * scripts/rbac-roleid-backfill.ts  (STEP 12-G)
 *
 * Controlled dry-run / backfill of org_members.role_id from org_members.role.
 * - NO viewer fallback: an unmatched role is NOT filled (it is reported).
 * - Idempotent: only touches rows with role_id IS NULL.
 * - Transactional and reversible (role_id goes back to NULL; `role` is never changed).
 *
 * Usage:
 *   MODE=dryrun      tsx scripts/rbac-roleid-backfill.ts   (default — does not write)
 *   MODE=apply       tsx scripts/rbac-roleid-backfill.ts   (only applies if the dry-run is 100% valid)
 *   MODE=rollback-sim tsx scripts/rbac-roleid-backfill.ts  (simulates the reversal; does not write)
 */
import 'reflect-metadata';
import { AppDataSource } from '../src/database/datasource';

type Cls = 'OK' | 'ALIAS' | 'SEM_CORRESPONDENCIA' | 'CROSS_TENANT' | 'ARQUIVADA' | 'REMOVIDA' | 'ALIAS_INVALIDO';

// Detects once whether the roles.archived_at column exists (pre-Enterprise-006 DBs do not have it).
async function hasArchivedColumn(ds: any): Promise<boolean> {
  const r = await ds.query(`SELECT 1 FROM information_schema.columns WHERE table_name='roles' AND column_name='archived_at'`);
  return r.length > 0;
}

async function classify(ds: any, tenantId: string | null, role: string, archSel: string): Promise<{ roleId: string | null; cls: Cls }> {
  const rows = await ds.query(
    `SELECT id, tenant_id, canonical_role_id, ${archSel} AS archived_at, deleted_at FROM roles
     WHERE slug=$1 AND (tenant_id=$2 OR tenant_id IS NULL)
     ORDER BY (tenant_id=$2) DESC NULLS LAST LIMIT 1`, [role, tenantId]);
  if (rows.length === 0) {
    const other = await ds.query(`SELECT 1 FROM roles WHERE slug=$1 AND tenant_id IS NOT NULL AND tenant_id<>$2 AND deleted_at IS NULL LIMIT 1`, [role, tenantId]);
    return { roleId: null, cls: other.length ? 'CROSS_TENANT' : 'SEM_CORRESPONDENCIA' };
  }
  const r = rows[0];
  if (r.deleted_at) return { roleId: null, cls: 'REMOVIDA' };
  if (r.archived_at) return { roleId: null, cls: 'ARQUIVADA' };
  if (r.canonical_role_id) {
    const can = await ds.query(`SELECT id, ${archSel} AS archived_at, deleted_at FROM roles WHERE id=$1`, [r.canonical_role_id]);
    if (!can.length || can[0].deleted_at || can[0].archived_at) return { roleId: null, cls: 'ALIAS_INVALIDO' };
    return { roleId: can[0].id, cls: 'ALIAS' };
  }
  return { roleId: r.id, cls: 'OK' };
}

async function main() {
  const mode = process.env['MODE'] ?? 'dryrun';
  const ds = AppDataSource;
  await ds.initialize();
  const t0 = Date.now();

  const archSel = (await hasArchivedColumn(ds)) ? '"archived_at"' : 'NULL::timestamptz';
  const members = await ds.query(`SELECT id, tenant_id, role, role_id FROM org_members ORDER BY created_at`);
  const report: Array<{ membership_id: string; tenant_id: string; role: string; expected_role_id: string | null; cls: Cls; status: string }> = [];
  let valid = 0, invalid = 0, alreadyFilled = 0;

  for (const m of members) {
    const { roleId, cls } = await classify(ds, m.tenant_id, m.role, archSel);
    const filled = m.role_id != null;
    if (filled) alreadyFilled++;
    if (roleId) valid++; else invalid++;
    report.push({
      membership_id: m.id, tenant_id: m.tenant_id, role: m.role,
      expected_role_id: roleId, cls,
      status: filled ? 'JA_PREENCHIDO' : (roleId ? 'A_PREENCHER' : 'BLOQUEADO'),
    });
  }

  console.log(`\n=== ${mode.toUpperCase()} — org_members: ${members.length} ===`);
  console.table(report);
  const byCls: Record<string, number> = {};
  for (const r of report) byCls[r.cls] = (byCls[r.cls] ?? 0) + 1;
  console.log('classifications:', byCls, '| valid:', valid, '| invalid:', invalid, '| already filled:', alreadyFilled);

  if (mode === 'rollback-sim') {
    const filled = report.filter((r) => r.status === 'JA_PREENCHIDO').length;
    console.log(`\n[ROLLBACK-SIM] records with role_id filled that would go back to NULL: ${filled}. Reversible: YES. Dependencies: none (role remains the legacy source). NO WRITES.`);
    await ds.destroy(); return;
  }

  if (mode === 'apply') {
    if (invalid > 0) {
      console.error(`\n[APPLY ABORTED] ${invalid} membership(s) without a resolvable role_id — dry-run not 100% valid. Backfill NOT executed.`);
      await ds.destroy(); process.exit(2);
    }
    const qr = ds.createQueryRunner();
    await qr.connect(); await qr.startTransaction();
    try {
      let updated = 0;
      for (const r of report) {
        if (r.status === 'A_PREENCHER' && r.expected_role_id) {
          const res = await qr.query(`UPDATE org_members SET role_id=$1, updated_at=now() WHERE id=$2 AND role_id IS NULL RETURNING id`, [r.expected_role_id, r.membership_id]);
          // TypeORM (pg) returns [rows, affected]; we count the rows actually returned by RETURNING.
          const rows = Array.isArray(res) && Array.isArray(res[0]) ? res[0] : res;
          updated += Array.isArray(rows) ? rows.length : 0;
        }
      }
      await qr.commitTransaction();
      console.log(`\n[APPLY] backfill commit OK — rows updated: ${updated} (idempotent: role_id IS NULL).`);
    } catch (e) {
      await qr.rollbackTransaction();
      console.error('[APPLY] rollback due to error:', (e as Error).message); process.exitCode = 1;
    } finally { await qr.release(); }
  } else {
    console.log('\n[DRY-RUN] no writes performed.');
  }

  console.log(`tempo: ${Date.now() - t0}ms`);
  await ds.destroy();
}
main().catch((e) => { console.error('ERROR:', e?.message ?? e); process.exit(1); });
