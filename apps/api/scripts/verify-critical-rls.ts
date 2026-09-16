import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import type { QueryRunner } from 'typeorm';
import { AppDataSource } from '../src/database/datasource';

const TABLES = [
  'contacts',
  'contact_attachments',
  'contact_contracts',
  'contact_timeline',
  'lead_uploads',
] as const;

type TableName = (typeof TABLES)[number];

type Fixture = {
  tenantA: string;
  tenantB: string;
  orgA: string;
  orgB: string;
  contactA: string;
  contactB: string;
  contractA: string;
  contractB: string;
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
  throw new Error(`${message}: operação foi aceita`);
}

async function createFixture(qr: QueryRunner): Promise<Fixture> {
  const fixture: Fixture = {
    tenantA: randomUUID(),
    tenantB: randomUUID(),
    orgA: randomUUID(),
    orgB: randomUUID(),
    contactA: randomUUID(),
    contactB: randomUUID(),
    contractA: randomUUID(),
    contractB: randomUUID(),
    leadA: randomUUID(),
    leadB: randomUUID(),
    rowsB: {
      contacts: randomUUID(),
      contact_attachments: randomUUID(),
      contact_contracts: randomUUID(),
      contact_timeline: randomUUID(),
      lead_uploads: randomUUID(),
    },
  };
  fixture.rowsB.contacts = fixture.contactB;

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

  await qr.query(
    `INSERT INTO public.contacts (id, tenant_id, name, contact_type)
     VALUES ($1, $2, 'Contact A', 'person'),
            ($3, $4, 'Contact B', 'person')`,
    [fixture.contactA, fixture.tenantA, fixture.contactB, fixture.tenantB],
  );
  await qr.query(
    `INSERT INTO public.contracts (id, tenant_id, title, type)
     VALUES ($1, $2, 'Contract A', 'test'),
            ($3, $4, 'Contract B', 'test')`,
    [fixture.contractA, fixture.tenantA, fixture.contractB, fixture.tenantB],
  );
  await qr.query(
    `INSERT INTO public.leads (id, tenant_id, nome)
     VALUES ($1, $2, 'Lead A'),
            ($3, $4, 'Lead B')`,
    [fixture.leadA, fixture.tenantA, fixture.leadB, fixture.tenantB],
  );

  await qr.query(
    `INSERT INTO public.contact_attachments
       (id, tenant_id, contact_id, file_name, mime_type, extension, size)
     VALUES ($1, $2, $3, 'tenant-b.pdf', 'application/pdf', 'pdf', 1)`,
    [
      fixture.rowsB.contact_attachments,
      fixture.tenantB,
      fixture.contactB,
    ],
  );
  await qr.query(
    `INSERT INTO public.contact_contracts
       (id, tenant_id, contact_id, contract_id)
     VALUES ($1, $2, $3, $4)`,
    [
      fixture.rowsB.contact_contracts,
      fixture.tenantB,
      fixture.contactB,
      fixture.contractB,
    ],
  );
  await qr.query(
    `INSERT INTO public.contact_timeline
       (id, tenant_id, contact_id, event_type, summary)
     VALUES ($1, $2, $3, 'note', 'Tenant B')`,
    [fixture.rowsB.contact_timeline, fixture.tenantB, fixture.contactB],
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
    case 'contacts':
      return {
        sql: `INSERT INTO public.contacts
                (id, tenant_id, name, contact_type)
              VALUES ($1, $2, 'Allowed Contact', 'person') RETURNING id`,
        params: [id, fixture.tenantA],
      };
    case 'contact_attachments':
      return {
        sql: `INSERT INTO public.contact_attachments
                (id, tenant_id, contact_id, file_name, mime_type, extension, size)
              VALUES ($1, $2, $3, 'allowed.pdf', 'application/pdf', 'pdf', 1)
              RETURNING id`,
        params: [id, fixture.tenantA, fixture.contactA],
      };
    case 'contact_contracts':
      return {
        sql: `INSERT INTO public.contact_contracts
                (id, tenant_id, contact_id, contract_id)
              VALUES ($1, $2, $3, $4) RETURNING id`,
        params: [id, fixture.tenantA, fixture.contactA, fixture.contractA],
      };
    case 'contact_timeline':
      return {
        sql: `INSERT INTO public.contact_timeline
                (id, tenant_id, contact_id, event_type, summary)
              VALUES ($1, $2, $3, 'note', 'Allowed') RETURNING id`,
        params: [id, fixture.tenantA, fixture.contactA],
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
  if (table === 'contact_attachments' || table === 'contact_timeline') {
    params[2] = fixture.contactB;
  } else if (table === 'contact_contracts') {
    params[2] = fixture.contactB;
    params[3] = fixture.contractB;
  } else if (table === 'lead_uploads') {
    params[2] = fixture.leadB;
  }
  return { sql: statement.sql, params };
}

function crossParentInsert(
  table: Exclude<TableName, 'contacts'>,
  fixture: Fixture,
): { sql: string; params: unknown[] } {
  const statement = sameTenantInsert(table, fixture);
  const params = [...statement.params];
  if (table === 'contact_attachments' || table === 'contact_timeline') {
    params[2] = fixture.contactB;
  } else if (table === 'contact_contracts') {
    params[2] = fixture.contactB;
    params[3] = fixture.contractA;
  } else {
    params[2] = fixture.leadB;
  }
  return { sql: statement.sql, params };
}

async function cleanup(qr: QueryRunner, fixture: Fixture | null) {
  if (!fixture) return;
  await qr.query(`DELETE FROM public.contact_attachments WHERE tenant_id IN ($1, $2)`, [
    fixture.tenantA,
    fixture.tenantB,
  ]);
  await qr.query(`DELETE FROM public.contact_contracts WHERE tenant_id IN ($1, $2)`, [
    fixture.tenantA,
    fixture.tenantB,
  ]);
  await qr.query(`DELETE FROM public.contact_timeline WHERE tenant_id IN ($1, $2)`, [
    fixture.tenantA,
    fixture.tenantB,
  ]);
  await qr.query(`DELETE FROM public.lead_uploads WHERE tenant_id IN ($1, $2)`, [
    fixture.tenantA,
    fixture.tenantB,
  ]);
  await qr.query(`DELETE FROM public.contacts WHERE tenant_id IN ($1, $2)`, [
    fixture.tenantA,
    fixture.tenantB,
  ]);
  await qr.query(`DELETE FROM public.contracts WHERE tenant_id IN ($1, $2)`, [
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
    assert(schemaRows.length === TABLES.length, 'as cinco tabelas foram encontradas');
    for (const row of schemaRows) {
      assert(row.relrowsecurity === true, `${row.relname}: RLS habilitado`);
      assert(row.relforcerowsecurity === true, `${row.relname}: FORCE RLS habilitado`);
      assert(row.policies === 4, `${row.relname}: quatro policies mínimas`);
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
        `${fn.proname}: search_path seguro`,
      );
      assert(fn.public_execute === false, `${fn.proname}: PUBLIC sem EXECUTE`);
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
    assert(exposedPartitions.length === 0, 'partições RBAC sem CRUD direto');

    fixture = await createFixture(qr);

    for (const table of TABLES) {
      const ownRows = await asTenant(qr, fixture.tenantA, () =>
        qr.query(`SELECT id FROM public."${table}" WHERE tenant_id = $1`, [
          fixture!.tenantA,
        ]),
      );
      assert(
        table === 'contacts' ? ownRows.length === 1 : ownRows.length === 0,
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
      assert(noContext.length === 0, `${table}: sem tenant context = 0`);

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
        `${table}: INSERT com tenant divergente negado`,
      );

      if (table !== 'contacts') {
        const crossParent = crossParentInsert(table, fixture);
        await expectDenied(
          () =>
            asTenant(qr, fixture!.tenantA, () =>
              qr.query(crossParent.sql, crossParent.params),
            ),
          `${table}: vínculo com pai de outro tenant negado`,
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
    'FALHA verify:critical-rls:',
    error instanceof Error ? error.stack : error,
  );
  process.exit(1);
});
