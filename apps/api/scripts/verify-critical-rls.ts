import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import type { QueryRunner } from 'typeorm';
import { AppDataSource } from '../src/database/datasource';

// Resynchronized (forensic audit 2026-09-20): the contacts,
// contact_contracts and contact_timeline tables no longer exist in the database -- they were
// consolidated into "clients" (the "Contact = Client" decision, see
// ContactsService) during a pre-existing cleanup of this codebase. Only
// clients and client_attachments have a real physical successor; contact_contracts
// and contact_timeline became in-memory Maps (see ContactContractsService /
// ContactTimelineService) with no table to test RLS on. lead_uploads is a
// module unrelated to contacts and remains unchanged.
const TABLES = ['clients', 'client_attachments', 'lead_uploads'] as const;

type TableName = (typeof TABLES)[number];

// The number of FOR ALL policies varies per table: clients/client_attachments
// were consolidated into 2 policies (tenant_isolation + super_admin_full_access)
// by the Rebuild*InCanonicalFormOrder/CreateClientAttachments migrations;
// lead_uploads still uses the older pattern of 4 per-command policies
// (HardenContactsLeadUploadsRls), never migrated -- confirmed live, not
// assumed.
const EXPECTED_POLICIES: Record<TableName, number> = {
  clients: 2,
  client_attachments: 2,
  lead_uploads: 4,
};

type Fixture = {
  tenantA: string;
  tenantB: string;
  orgA: string;
  orgB: string;
  clientA: string;
  clientB: string;
  leadA: string;
  leadB: string;
  rowsB: Record<TableName, string>;
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
  console.log(`OK  ${message}`);
}

async function asTenant<T>(
  qr: QueryRunner,
  tenantId: string | null,
  action: () => Promise<T>,
): Promise<T> {
  await qr.startTransaction();
  try {
    await qr.query('SET LOCAL ROLE authenticated');
    if (tenantId) {
      await qr.query(
        `SELECT set_config('app.current_tenant_id', $1, true)`,
        [tenantId],
      );
    }
    const result = await action();
    await qr.rollbackTransaction();
    return result;
  } catch (error) {
    if (qr.isTransactionActive) await qr.rollbackTransaction();
    throw error;
  }
}

async function expectDenied(action: () => Promise<unknown>, message: string) {
  try {
    await action();
  } catch {
    console.log(`OK  ${message}`);
    return;
  }
  throw new Error(`${message}: operation was accepted`);
}

async function createFixture(qr: QueryRunner): Promise<Fixture> {
  const fixture: Fixture = {
    tenantA: randomUUID(),
    tenantB: randomUUID(),
    orgA: randomUUID(),
    orgB: randomUUID(),
    clientA: randomUUID(),
    clientB: randomUUID(),
    leadA: randomUUID(),
    leadB: randomUUID(),
    rowsB: {
      clients: randomUUID(),
      client_attachments: randomUUID(),
      lead_uploads: randomUUID(),
    },
  };
  fixture.rowsB.clients = fixture.clientB;

  await qr.query(
    `INSERT INTO public.organizations (id, name, slug, plan)
     VALUES ($1, 'Critical RLS A', $2, 'starter'),
            ($3, 'Critical RLS B', $4, 'starter')`,
    [
      fixture.orgA,
      `critical-rls-a-${fixture.orgA.slice(0, 8)}`,
      fixture.orgB,
      `critical-rls-b-${fixture.orgB.slice(0, 8)}`,
    ],
  );
  await qr.query(
    `INSERT INTO public.tenants (id, org_id, name, slug, plan)
     VALUES ($1, $2, 'Critical RLS A', $3, 'starter'),
            ($4, $5, 'Critical RLS B', $6, 'starter')`,
    [
      fixture.tenantA,
      fixture.orgA,
      `critical-rls-a-${fixture.tenantA.slice(0, 8)}`,
      fixture.tenantB,
      fixture.orgB,
      `critical-rls-b-${fixture.tenantB.slice(0, 8)}`,
    ],
  );

  // categoria/perfil/nome are NOT NULL without a default in ClientEntity.
  await qr.query(
    `INSERT INTO public.clients (id, tenant_id, categoria, perfil, nome)
     VALUES ($1, $2, 'producer', 'outros', 'Client A'),
            ($3, $4, 'producer', 'outros', 'Client B')`,
    [fixture.clientA, fixture.tenantA, fixture.clientB, fixture.tenantB],
  );
  await qr.query(
    `INSERT INTO public.leads (id, tenant_id, name)
     VALUES ($1, $2, 'Lead A'),
            ($3, $4, 'Lead B')`,
    [fixture.leadA, fixture.tenantA, fixture.leadB, fixture.tenantB],
  );

  await qr.query(
    `INSERT INTO public.client_attachments
       (id, tenant_id, client_id, storage_key, filename, mime_type, size_bytes)
     VALUES ($1, $2, $3, 'rls-test/tenant-b.pdf', 'tenant-b.pdf', 'application/pdf', 1)`,
    [fixture.rowsB.client_attachments, fixture.tenantB, fixture.clientB],
  );
  await qr.query(
    `INSERT INTO public.lead_uploads
       (id, tenant_id, lead_id, file_name, mime_type, extension, size)
     VALUES ($1, $2, $3, 'tenant-b.pdf', 'application/pdf', 'pdf', 1)`,
    [fixture.rowsB.lead_uploads, fixture.tenantB, fixture.leadB],
  );

  return fixture;
}

function sameTenantInsert(
  table: TableName,
  fixture: Fixture,
): { sql: string; params: unknown[] } {
  const id = randomUUID();
  switch (table) {
    case 'clients':
      return {
        sql: `INSERT INTO public.clients
                (id, tenant_id, categoria, perfil, nome)
              VALUES ($1, $2, 'producer', 'outros', 'Allowed Client') RETURNING id`,
        params: [id, fixture.tenantA],
      };
    case 'client_attachments':
      return {
        sql: `INSERT INTO public.client_attachments
                (id, tenant_id, client_id, storage_key, filename, mime_type, size_bytes)
              VALUES ($1, $2, $3, 'rls-test/allowed.pdf', 'allowed.pdf', 'application/pdf', 1)
              RETURNING id`,
        params: [id, fixture.tenantA, fixture.clientA],
      };
    case 'lead_uploads':
      return {
        sql: `INSERT INTO public.lead_uploads
                (id, tenant_id, lead_id, file_name, mime_type, extension, size)
              VALUES ($1, $2, $3, 'allowed.pdf', 'application/pdf', 'pdf', 1)
              RETURNING id`,
        params: [id, fixture.tenantA, fixture.leadA],
      };
  }
}

function divergentInsert(
  table: TableName,
  fixture: Fixture,
): { sql: string; params: unknown[] } {
  const statement = sameTenantInsert(table, fixture);
  const params = [...statement.params];
  params[1] = fixture.tenantB;
  if (table === 'client_attachments') {
    params[2] = fixture.clientB;
  } else if (table === 'lead_uploads') {
    params[2] = fixture.leadB;
  }
  return { sql: statement.sql, params };
}

function crossParentInsert(
  table: Exclude<TableName, 'clients'>,
  fixture: Fixture,
): { sql: string; params: unknown[] } {
  const statement = sameTenantInsert(table, fixture);
  const params = [...statement.params];
  if (table === 'client_attachments') {
    params[2] = fixture.clientB;
  } else {
    params[2] = fixture.leadB;
  }
  return { sql: statement.sql, params };
}

async function cleanup(qr: QueryRunner, fixture: Fixture | null) {
  if (!fixture) return;
  await qr.query(`DELETE FROM public.client_attachments WHERE tenant_id IN ($1, $2)`, [
    fixture.tenantA,
    fixture.tenantB,
  ]);
  await qr.query(`DELETE FROM public.lead_uploads WHERE tenant_id IN ($1, $2)`, [
    fixture.tenantA,
    fixture.tenantB,
  ]);
  await qr.query(`DELETE FROM public.clients WHERE tenant_id IN ($1, $2)`, [
    fixture.tenantA,
    fixture.tenantB,
  ]);
  await qr.query(`DELETE FROM public.leads WHERE tenant_id IN ($1, $2)`, [
    fixture.tenantA,
    fixture.tenantB,
  ]);
  await qr.query(`DELETE FROM public.tenants WHERE id IN ($1, $2)`, [
    fixture.tenantA,
    fixture.tenantB,
  ]);
  await qr.query(`DELETE FROM public.organizations WHERE id IN ($1, $2)`, [
    fixture.orgA,
    fixture.orgB,
  ]);
}

async function main() {
  await AppDataSource.initialize();
  const qr = AppDataSource.createQueryRunner();
  await qr.connect();
  let fixture: Fixture | null = null;

  try {
    const schemaRows = await qr.query(
      `SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity,
              count(p.policyname)::int AS policies
         FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
         LEFT JOIN pg_policies p
           ON p.schemaname = n.nspname AND p.tablename = c.relname
        WHERE n.nspname = 'public'
          AND c.relname = ANY($1::text[])
        GROUP BY c.relname, c.relrowsecurity, c.relforcerowsecurity
        ORDER BY c.relname`,
      [TABLES],
    );
    assert(schemaRows.length === TABLES.length, 'critical tables were found');
    for (const row of schemaRows) {
      assert(row.relrowsecurity === true, `${row.relname}: RLS enabled`);
      assert(row.relforcerowsecurity === true, `${row.relname}: FORCE RLS enabled`);
      assert(
        row.policies === EXPECTED_POLICIES[row.relname as TableName],
        `${row.relname}: ${EXPECTED_POLICIES[row.relname as TableName]} policies expected`,
      );
    }

    const functions = await qr.query(`
      SELECT p.proname, p.prosecdef, p.proconfig,
             has_function_privilege(
               'public',
               format('public.%I()', p.proname),
               'EXECUTE'
             ) AS public_execute
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public'
         AND p.proname IN ('app_current_tenant_id', 'private_get_tenant_id')
       ORDER BY p.proname
    `);
    for (const fn of functions) {
      assert(fn.prosecdef === true, `${fn.proname}: SECURITY DEFINER preservado`);
      assert(
        fn.proconfig?.includes('search_path=pg_catalog'),
        `${fn.proname}: safe search_path`,
      );
      assert(fn.public_execute === false, `${fn.proname}: PUBLIC without EXECUTE`);
    }

    const exposedPartitions = await qr.query(`
      SELECT c.relname
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public'
         AND c.relname = ANY($1::text[])
         AND (
           has_table_privilege('authenticated', c.oid, 'SELECT,INSERT,UPDATE,DELETE')
           OR has_table_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,DELETE')
         )
    `, [[
      'rbac_decision_logs',
      'rbac_decision_logs_2026_05',
      'rbac_decision_logs_2026_06',
      'rbac_decision_logs_2026_07',
      'rbac_decision_logs_2026_08',
      'rbac_decision_logs_default',
    ]]);
    assert(exposedPartitions.length === 0, 'RBAC partitions without direct CRUD');

    fixture = await createFixture(qr);

    for (const table of TABLES) {
      const ownRows = await asTenant(qr, fixture.tenantA, () =>
        qr.query(`SELECT id FROM public."${table}" WHERE tenant_id = $1`, [
          fixture!.tenantA,
        ]),
      );
      assert(
        table === 'clients' ? ownRows.length === 1 : ownRows.length === 0,
        `${table}: SELECT same-tenant permitido`,
      );

      const crossSelect = await asTenant(qr, fixture.tenantA, () =>
        qr.query(`SELECT id FROM public."${table}" WHERE id = $1`, [
          fixture!.rowsB[table],
        ]),
      );
      assert(crossSelect.length === 0, `${table}: SELECT cross-tenant = 0`);

      const crossUpdate = await asTenant(qr, fixture.tenantA, () =>
        qr.query(
          `WITH affected AS (
             UPDATE public."${table}" SET tenant_id = tenant_id
              WHERE id = $1
              RETURNING id
           )
           SELECT count(*)::int AS count FROM affected`,
          [fixture!.rowsB[table]],
        ),
      );
      assert(crossUpdate[0]?.count === 0, `${table}: UPDATE cross-tenant = 0`);

      const crossDelete = await asTenant(qr, fixture.tenantA, () =>
        qr.query(
          `WITH affected AS (
             DELETE FROM public."${table}"
              WHERE id = $1
              RETURNING id
           )
           SELECT count(*)::int AS count FROM affected`,
          [fixture!.rowsB[table]],
        ),
      );
      assert(crossDelete[0]?.count === 0, `${table}: DELETE cross-tenant = 0`);

      const noContext = await asTenant(qr, null, () =>
        qr.query(`SELECT id FROM public."${table}" WHERE tenant_id = $1`, [
          fixture!.tenantB,
        ]),
      );
      assert(noContext.length === 0, `${table}: without tenant context = 0`);

      const sameInsert = sameTenantInsert(table, fixture);
      const inserted = await asTenant(qr, fixture.tenantA, () =>
        qr.query(sameInsert.sql, sameInsert.params),
      );
      assert(inserted.length === 1, `${table}: INSERT same-tenant permitido`);

      const divergent = divergentInsert(table, fixture);
      await expectDenied(
        () =>
          asTenant(qr, fixture!.tenantA, () =>
            qr.query(divergent.sql, divergent.params),
          ),
        `${table}: INSERT with mismatched tenant denied`,
      );

      if (table !== 'clients') {
        const crossParent = crossParentInsert(table, fixture);
        await expectDenied(
          () =>
            asTenant(qr, fixture!.tenantA, () =>
              qr.query(crossParent.sql, crossParent.params),
            ),
          `${table}: link to a parent from another tenant denied`,
        );
      }
    }
  } finally {
    await cleanup(qr, fixture);
    await qr.release();
    await AppDataSource.destroy();
  }
}

main().catch((error) => {
  console.error(
    'FAIL verify:critical-rls:',
    error instanceof Error ? error.stack : error,
  );
  process.exit(1);
});
