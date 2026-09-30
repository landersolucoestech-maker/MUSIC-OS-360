/**
 * Opt-in Postgres round trip for migration
 * 20260930000003_BackfillAndRestrictMarketingContentApprovalToEnglish.
 *
 * NOT part of the default test run: it does nothing unless RUN_PG_INTEGRATION=1.
 * It creates a THROWAWAY cluster (initdb in a fresh temp dir, unix socket only,
 * random port, removed at the end) and never reads DATABASE_URL, so it cannot
 * touch a real database.
 *
 *   RUN_PG_INTEGRATION=1 pnpm --filter @music-os/api exec tsx scripts/verify-marketing-content-approval-roundtrip.ts
 *
 * Needs the PostgreSQL server binaries (initdb, pg_ctl); set PG_BIN to their
 * directory when they are not on PATH or under /usr/lib/postgresql/<v>/bin.
 * When run as root the cluster is created and owned by the `postgres` OS user
 * (initdb refuses root).
 *
 * Covered: up on legacy data (preserves other keys and updated_at, FORCE RLS
 * table), second up (no-op), legacy write rejected by the CHECK (23514), down
 * (restores the Portuguese values one-to-one), up again, and the residue path
 * (unknown string / JSON number aborts up before the CHECK, leaves data
 * untouched; down refuses on residue).
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, rmSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from 'pg';
import { BackfillAndRestrictMarketingContentApprovalToEnglish20260930000003 as Migration } from '../src/database/migrations/20260930000003_BackfillAndRestrictMarketingContentApprovalToEnglish';

const CONSTRAINT = 'chk_marketing_content_posts_metadata_approval';

function findBin(): string {
  const candidates = [process.env.PG_BIN, ...(existsSync('/usr/lib/postgresql') ? readdirSync('/usr/lib/postgresql').sort().reverse().map((v) => `/usr/lib/postgresql/${v}/bin`) : [])];
  for (const dir of candidates) if (dir && existsSync(join(dir, 'initdb'))) return dir;
  throw new Error('PostgreSQL server binaries not found: set PG_BIN to the directory containing initdb/pg_ctl');
}

async function main(): Promise<void> {
  if (process.env.RUN_PG_INTEGRATION !== '1') {
    console.log('SKIPPED: set RUN_PG_INTEGRATION=1 to run the Postgres round trip (throwaway cluster).');
    return;
  }
  const bin = findBin();
  const isRoot = typeof process.getuid === 'function' && process.getuid() === 0;
  const base = mkdtempSync(join(tmpdir(), 'pg-approval-roundtrip-'));
  chmodSync(base, 0o755);
  const data = join(base, 'data');
  const port = 40000 + Math.floor(Math.random() * 20000);
  const as = (cmd: string, args: string[]) =>
    isRoot ? execFileSync('runuser', ['-u', 'postgres', '--', cmd, ...args], { stdio: 'pipe' }) : execFileSync(cmd, args, { stdio: 'pipe' });
  if (isRoot) execFileSync('chown', ['postgres', base]);

  let started = false;
  try {
    as(join(bin, 'initdb'), ['-D', data, '-U', 'postgres', '--auth=trust', '-E', 'UTF8']);
    as(join(bin, 'pg_ctl'), ['-D', data, '-w', '-o', `-c listen_addresses='' -c unix_socket_directories=${base} -p ${port}`, '-l', join(base, 'log'), 'start']);
    started = true;
    await run(base, port);
    console.log('PASS: marketing content approval migration round trip');
  } finally {
    if (started) as(join(bin, 'pg_ctl'), ['-D', data, '-m', 'immediate', 'stop']);
    rmSync(base, { recursive: true, force: true });
  }
}

async function run(host: string, port: number): Promise<void> {
  const c = new Client({ host, port, user: 'postgres', database: 'postgres' });
  await c.connect();
  const migration = new Migration();
  const runner = { query: async (sql: string, params?: unknown[]) => (await c.query(sql, params as never)).rows };
  const silence = console.log;
  const exec = async (dir: 'up' | 'down') => {
    console.log = () => undefined;
    await c.query('BEGIN');
    try {
      await migration[dir](runner as never);
      await c.query('COMMIT');
    } catch (e) {
      await c.query('ROLLBACK');
      throw e;
    } finally {
      console.log = silence;
    }
  };
  const approvals = async () =>
    (await c.query(`SELECT title, metadata FROM marketing_content_posts ORDER BY id`)).rows as Array<{ title: string; metadata: Record<string, unknown> }>;
  const constraintRows = async () => (await c.query(`SELECT convalidated FROM pg_constraint WHERE conname = $1`, [CONSTRAINT])).rows;

  await c.query(`
    CREATE TABLE marketing_content_posts(id serial PRIMARY KEY, tenant_id int, metadata jsonb NOT NULL DEFAULT '{}', updated_at timestamptz NOT NULL DEFAULT '2026-01-01', title text);
    ALTER TABLE marketing_content_posts ENABLE ROW LEVEL SECURITY;
    ALTER TABLE marketing_content_posts FORCE ROW LEVEL SECURITY;
    CREATE POLICY t ON marketing_content_posts USING (tenant_id = nullif(current_setting('app.tenant', true), '')::int);
    INSERT INTO marketing_content_posts(tenant_id, metadata, title) VALUES
      (1, '{"approval":"pendente","channels":["instagram"],"n":{"a":[1,null]}}', 'pendente'),
      (2, '{"approval":" Aprovado ","k":1}', 'aprovado'),
      (2, '{"approval":"reprovado"}', 'reprovado'),
      (1, '{"approval":"ajustes_solicitados","approvalNote":"pendente"}', 'ajustes'),
      (1, '{"approval":null}', 'jsonnull'),
      (1, '{}', 'nokey'),
      (3, '{"approval":"pending"}', 'canonical');`);

  const before = await approvals();
  await exec('up');
  const afterUp = await approvals();
  assert.deepEqual(afterUp.map((r) => r.metadata.approval), ['pending', 'approved', 'rejected', 'revision_requested', null, undefined, 'pending']);
  assert.deepEqual(afterUp[0].metadata.channels, ['instagram']);
  assert.deepEqual(afterUp[0].metadata.n, { a: [1, null] });
  assert.equal(afterUp[3].metadata.approvalNote, 'pendente');
  assert.equal((await c.query(`SELECT count(*)::int AS n FROM marketing_content_posts WHERE updated_at <> '2026-01-01'`)).rows[0].n, 0);
  assert.deepEqual(await constraintRows(), [{ convalidated: true }]);

  await exec('up');
  assert.deepEqual(await approvals(), afterUp, 'second up must be a no-op');

  await assert.rejects(
    c.query(`INSERT INTO marketing_content_posts(tenant_id, metadata) VALUES (1, '{"approval":"pendente"}')`),
    (e: { code?: string }) => e.code === '23514',
  );

  await exec('down');
  assert.deepEqual(await constraintRows(), []);
  assert.deepEqual((await approvals()).map((r) => r.metadata.approval), ['pendente', 'aprovado', 'reprovado', 'ajustes_solicitados', null, undefined, 'pendente']);
  assert.equal(before.length, (await approvals()).length);

  await exec('up');
  assert.deepEqual(await approvals(), afterUp, 'up after down restores the canonical state');

  // Residue: unknown string and JSON number, inserted after dropping the CHECK.
  await c.query(`ALTER TABLE marketing_content_posts DROP CONSTRAINT ${CONSTRAINT}`);
  await c.query(`INSERT INTO marketing_content_posts(tenant_id, metadata, title) VALUES (1, '{"approval":"unknown_value"}', 'r1'), (1, '{"approval":3}', 'r2')`);
  const withResidue = await approvals();
  await assert.rejects(exec('up'), /unexpected values after backfill: \[3, unknown_value\]/);
  assert.deepEqual(await constraintRows(), [], 'no CHECK is left after an aborted up');
  assert.deepEqual(await approvals(), withResidue, 'aborted up leaves data untouched');
  await assert.rejects(exec('down'), /neither canonical nor legacy/);
  assert.deepEqual(await approvals(), withResidue, 'refused down leaves data untouched');

  await c.end();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
