#!/usr/bin/env ts-node
/**
 * scripts/verify-catalog-integrity.ts
 *
 * Read-only referential integrity diagnostic of the music catalog (works, phonograms, shares, releases, artists,
 * contracts): references to missing or archived parents, references across tenants, shares that mix the independent
 * Work and Phonogram structures, and duplicated strong ids (ISWC, ISRC, UPC).
 *
 * It runs inside a READ ONLY transaction that is rolled back, so it cannot change data. Use an administrative
 * DATABASE_URL (the checks must see every tenant, so a row-level-security role would hide the rows to inspect).
 *
 * Usage:
 *   pnpm --filter @music-os-360/api verify:catalog-integrity [-- --tenant <uuid>]
 * Exit code: 0 when there is no error finding, 1 otherwise.
 */
import 'reflect-metadata';
import { Client } from 'pg';
import { formatCatalogIntegrityReport, runCatalogIntegrity } from '../src/modules/catalog-integrity/catalog-integrity.runner';

async function main(): Promise<void> {
  const databaseUrl = process.env['DATABASE_URL'];
  if (!databaseUrl) {
    console.error('DATABASE_URL is required (an administrative connection to the database to inspect).');
    process.exit(2);
  }
  const tenantFlag = process.argv.indexOf('--tenant');
  const tenantId = tenantFlag > 0 ? process.argv[tenantFlag + 1] : null;
  if (tenantFlag > 0 && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantId ?? '')) {
    console.error('--tenant must be a UUID.');
    process.exit(2);
  }
  const host = (() => { try { return new URL(databaseUrl).hostname; } catch { return ''; } })();
  const sslOff = process.env['DB_SSL'] === 'false' || ['localhost', '127.0.0.1', '::1'].includes(host);
  const client = new Client({ connectionString: databaseUrl, ssl: sslOff ? false : { rejectUnauthorized: false } });
  await client.connect();
  try {
    const report = await runCatalogIntegrity(client, { tenantId });
    console.log(formatCatalogIntegrityReport(report));
    process.exitCode = report.errors > 0 ? 1 : 0;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(2);
});
