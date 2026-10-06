import { CATALOG_INTEGRITY_CHECKS } from './catalog-integrity.checks';
import { runCatalogIntegrity } from './catalog-integrity.runner';

/**
 * Real PostgreSQL proof of the catalog integrity diagnostic. Gated by PG_INTEGRATION_URL like the other real-database
 * specs (CI points it at the migrated disposable `_mig` database).
 *
 *  - against the REAL migrated schema every check executes (a wrong table or column name would fail here);
 *  - against session-scoped TEMP tables (dropped when the connection closes, nothing persists) seeded with one
 *    violation per check, every check finds exactly its violation and nothing else;
 *  - a write inside the READ ONLY transaction is rejected by PostgreSQL itself.
 */
const pgUrl = process.env.PG_INTEGRATION_URL;

const T1 = '00000000-0000-4000-8000-0000000000a1';
const T2 = '00000000-0000-4000-8000-0000000000a2';
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

(pgUrl ? describe : describe.skip)('catalog integrity on a real PostgreSQL', () => {
  it('every check executes against the real migrated schema', async () => {
    const { Client } = await import('pg');
    const client = new Client({ connectionString: pgUrl });
    await client.connect();
    try {
      const report = await runCatalogIntegrity(client);
      expect(report.checks).toHaveLength(CATALOG_INTEGRITY_CHECKS.length);
      for (const check of report.checks) expect(Array.isArray(check.findings)).toBe(true);
    } finally {
      await client.end();
    }
  });

  it('PostgreSQL rejects a write inside the READ ONLY transaction the runner opens', async () => {
    const { Client } = await import('pg');
    const client = new Client({ connectionString: pgUrl });
    await client.connect();
    try {
      await client.query('BEGIN READ ONLY');
      await expect(client.query(`INSERT INTO works (tenant_id, title, type) VALUES ($1, 'x', 'original')`, [T1]))
        .rejects.toThrow(/read-only transaction/i);
    } finally {
      await client.query('ROLLBACK').catch(() => undefined);
      await client.end();
    }
  });

  it('finds exactly the seeded violation of each check, per tenant, and nothing in a clean tenant', async () => {
    const { Client } = await import('pg');
    const client = new Client({ connectionString: pgUrl });
    await client.connect();
    try {
      // Session-scoped temp tables shadow the real ones for this connection only.
      await client.query(`CREATE TEMP TABLE artists (id uuid PRIMARY KEY, tenant_id uuid NOT NULL)`);
      await client.query(`CREATE TEMP TABLE works (id uuid PRIMARY KEY, tenant_id uuid NOT NULL, artist_id uuid, iswc text, deleted_at timestamp)`);
      await client.query(`CREATE TEMP TABLE phonograms (id uuid PRIMARY KEY, tenant_id uuid NOT NULL, work_id uuid, artist_id uuid, isrc text, deleted_at timestamp)`);
      await client.query(`CREATE TEMP TABLE releases (id uuid PRIMARY KEY, tenant_id uuid NOT NULL, artist_id uuid, upc text, deleted_at timestamp)`);
      await client.query(`CREATE TEMP TABLE contracts (id uuid PRIMARY KEY, tenant_id uuid NOT NULL, artist_id uuid)`);
      await client.query(`CREATE TEMP TABLE work_participants (id uuid PRIMARY KEY, tenant_id uuid NOT NULL, work_id uuid)`);
      await client.query(`CREATE TEMP TABLE shares (id uuid PRIMARY KEY, tenant_id uuid NOT NULL, work_id uuid, phonogram_id uuid, release_id uuid, deleted_at timestamp)`);

      // tenant 2 owns the "foreign" records; tenant 1 holds every violation.
      await client.query(`INSERT INTO artists VALUES ($1, $3), ($2, $4)`, [id(1), id(2), T1, T2]);
      await client.query(`INSERT INTO works (id, tenant_id, artist_id, iswc, deleted_at) VALUES
        ($1, $5, $4, 'T-000.000.001-0', NULL),
        ($2, $6, NULL, NULL, NULL),
        ($3, $5, NULL, 'T-000.000.002-0', now()),
        ($7, $5, NULL, 'T-000.000.003-0', NULL),
        ($8, $5, NULL, 'T-000.000.003-0', NULL)`, [id(10), id(11), id(12), id(2), T1, T2, id(13), id(14)]);
      await client.query(`INSERT INTO phonograms (id, tenant_id, work_id, artist_id, isrc, deleted_at) VALUES
        ($1, $5, $4, NULL, NULL, NULL),
        ($2, $5, $3, NULL, NULL, NULL),
        ($6, $5, NULL, $7, 'BRABC2600001', NULL),
        ($8, $5, NULL, NULL, 'BRABC2600002', NULL),
        ($9, $5, NULL, NULL, 'BRABC2600002', NULL),
        ($10, $11, NULL, NULL, NULL, NULL)`, [id(20), id(21), id(12), id(11), T1, id(22), id(2), id(23), id(24), id(25), T2]);
      await client.query(`INSERT INTO releases (id, tenant_id, artist_id, upc, deleted_at) VALUES
        ($1, $4, $3, NULL, NULL), ($2, $4, NULL, '123456789012', NULL), ($5, $4, NULL, '123456789012', NULL), ($6, $7, NULL, '123456789012', NULL)`,
      [id(30), id(31), id(2), T1, id(32), id(33), T2]);
      await client.query(`INSERT INTO contracts VALUES ($1, $3, $2)`, [id(40), id(2), T1]);
      await client.query(`INSERT INTO work_participants VALUES ($1, $3, $2)`, [id(50), id(11), T1]);
      await client.query(`INSERT INTO shares (id, tenant_id, work_id, phonogram_id, release_id, deleted_at) VALUES
        ($1, $7, $2, NULL, NULL, NULL),
        ($3, $7, NULL, $4, NULL, NULL),
        ($5, $7, NULL, NULL, $6, NULL),
        ($8, $7, $9, $10, NULL, NULL),
        ($11, $7, $12, NULL, NULL, NULL)`,
      [id(60), id(11), id(61), id(25), id(62), id(33), T1, id(63), id(10), id(21), id(64), id(12)]);

      const report = await runCatalogIntegrity(client);
      const found = Object.fromEntries(report.checks.map((c) => [c.id, c.findings.map((f) => f.entityId).sort()]));
      expect(found).toEqual({
        phonogram_work_missing: [id(21)],
        phonogram_work_cross_tenant: [id(20)],
        share_work_cross_tenant: [id(60)],
        share_phonogram_cross_tenant: [id(61)],
        share_release_cross_tenant: [id(62)],
        share_mixed_structure: [id(63)],
        share_of_archived_work: [id(64)],
        work_artist_cross_tenant: [id(10)],
        phonogram_artist_cross_tenant: [id(22)],
        release_artist_cross_tenant: [id(30)],
        contract_artist_cross_tenant: [id(40)],
        work_participant_cross_tenant: [id(50)],
        duplicate_work_iswc: [id(13), id(14)],
        duplicate_phonogram_isrc: [id(23), id(24)],
        duplicate_release_upc: [id(31), id(32)],
      });
      expect(report.errors).toBe(Object.entries(found).filter(([k]) => k !== 'share_of_archived_work').reduce((n, [, v]) => n + v.length, 0));
      expect(report.warnings).toBe(1);

      // The tenant filter narrows every check to one tenant.
      const t2 = await runCatalogIntegrity(client, { tenantId: T2 });
      expect(t2.checks.flatMap((c) => c.findings)).toEqual([]);
      const t1 = await runCatalogIntegrity(client, { tenantId: T1 });
      expect(t1.errors).toBe(report.errors);

      // The diagnostic changed nothing.
      const after = await client.query(`SELECT (SELECT count(*) FROM works) AS w, (SELECT count(*) FROM shares) AS s, (SELECT count(*) FROM phonograms) AS p`);
      expect(after.rows[0]).toEqual({ w: '5', s: '5', p: '6' });
    } finally {
      await client.end();
    }
  });
});
