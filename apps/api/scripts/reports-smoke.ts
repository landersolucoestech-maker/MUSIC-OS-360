/**
 * Real HTTP smoke of the Reports Center against a running API and PostgreSQL.
 * Validates structural XLSX export, import, create-only, rollback and tenant isolation.
 */
import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';
import { DataSource } from 'typeorm';
import { ALL_ENTITIES } from '../src/database/entities';
import { assertDatabaseCommandEnv } from '../src/core/config/env.schema';

const API = (process.env['API_URL'] ?? 'http://localhost:3001').replace(/\/$/, '');
const TAG = `HTTPSMOKE_${Date.now()}`;
let failures = 0;

function check(name: string, condition: boolean, detail = ''): void {
  console.log(`  ${condition ? 'PASS' : 'FAIL'}  ${name}${condition ? '' : ` ${detail}`}`);
  if (!condition) failures += 1;
}

async function api(
  method: string,
  route: string,
  headers: Record<string, string> = {},
  body?: unknown,
) {
  const response = await fetch(`${API}/api/v1${route}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const contentType = response.headers.get('content-type') ?? '';
  const data = contentType.includes('json')
    ? await response.json().catch(() => null)
    : await response.text();
  return { status: response.status, data, headers: response.headers };
}

function workbookBody(names: string[]) {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet([
    ['Nome artístico'],
    ...names.map((name) => [name]),
  ]);
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Artistas');
  return {
    filename: 'artists.xlsx',
    contentBase64: XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' }) as string,
  };
}

function unwrap(value: unknown): any {
  if (
    value &&
    typeof value === 'object' &&
    'data' in value &&
    !Array.isArray(value) &&
    !('validRows' in value) &&
    !('importedRows' in value)
  ) {
    return (value as { data: unknown }).data;
  }
  return value;
}

async function main(): Promise<void> {
  console.log(`\n[reports:smoke] API=${API}`);
  // An explicitly-provided process env must always win over .env.development.
  const envPath = path.resolve(process.cwd(), '.env.development');
  const envText = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
  const url = (process.env['DATABASE_URL'] ?? envText.match(/^DATABASE_URL=(.+)$/m)?.[1] ?? '')
    .trim()
    .replace(/^["']|["']$/g, '');
  assertDatabaseCommandEnv('reports-smoke', { ...process.env, DATABASE_URL: url });

  const dataSource = await new DataSource({
    type: 'postgres',
    url,
    entities: ALL_ENTITIES,
    synchronize: false,
    logging: false,
    ssl: false,
  }).initialize();

  try {
    const tokenResponse = await api('GET', '/dev-auth/token');
    const payload = unwrap(tokenResponse.data);
    const token = payload?.token;
    const tenantId = payload?.orgId ?? payload?.tenantId;
    check('dev-auth fornece JWT e tenant', Boolean(token && tenantId), `status=${tokenResponse.status}`);
    const headers = { Authorization: `Bearer ${token}`, 'X-Tenant-ID': tenantId };

    const exportResponse = await fetch(
      `${API}/api/v1/reports/entities/artists/export?format=xlsx`,
      { headers },
    );
    const exportBuffer = Buffer.from(await exportResponse.arrayBuffer());
    check('export responds 200', exportResponse.status === 200, `status=${exportResponse.status}`);
    check(
      'export uses the XLSX MIME type',
      exportResponse.headers.get('content-type')?.includes(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ) === true,
    );
    check('file has a ZIP signature', exportBuffer[0] === 0x50 && exportBuffer[1] === 0x4b);

    const exportedWorkbook = XLSX.read(exportBuffer, { type: 'buffer', cellDates: true });
    check(
      'workbook has a single Artistas sheet',
      exportedWorkbook.SheetNames.length === 1 && exportedWorkbook.SheetNames[0] === 'Artistas',
      `sheets=${exportedWorkbook.SheetNames.join(',')}`,
    );
    const exportedRows = XLSX.utils.sheet_to_json<unknown[]>(
      exportedWorkbook.Sheets.Artistas!,
      { header: 1, raw: true },
    );
    check(
      'header is pt-BR and does not expose the physical key',
      exportedRows[0]?.includes('Nome artístico') === true &&
        exportedRows[0]?.includes('stage_name') === false,
    );

    const unsupported = await api(
      'GET',
      '/reports/entities/artists/export?format=xml',
      headers,
    );
    check('unsupported format is rejected', unsupported.status === 400, `status=${unsupported.status}`);

    const noToken = await api('GET', '/reports/entities/artists/export?format=xlsx');
    check('export without token is blocked', [401, 403].includes(noToken.status), `status=${noToken.status}`);

    const validateName = `${TAG}_V`;
    const validation = await api(
      'POST',
      '/reports/entities/artists/import/validate',
      headers,
      workbookBody([validateName]),
    );
    check(
      'preview validates one row',
      [200, 201].includes(validation.status) && unwrap(validation.data)?.validRows === 1,
      `status=${validation.status}`,
    );
    const previewCount = await dataSource.query(
      'SELECT COUNT(*)::int AS count FROM artists WHERE stage_name=$1',
      [validateName],
    );
    check('preview does not persist', previewCount[0].count === 0);

    const commitName = `${TAG}_C`;
    const firstCommit = await api(
      'POST',
      '/reports/entities/artists/import/commit',
      headers,
      workbookBody([commitName]),
    );
    check(
      'commit imports one row',
      unwrap(firstCommit.data)?.importedRows === 1,
      `status=${firstCommit.status}`,
    );
    const stored = await dataSource.query(
      'SELECT tenant_id FROM artists WHERE stage_name=$1',
      [commitName],
    );
    check('commit persiste no tenant correto', stored[0]?.tenant_id === tenantId);

    const duplicateCommit = await api(
      'POST',
      '/reports/entities/artists/import/commit',
      headers,
      workbookBody([commitName]),
    );
    check(
      'create-only rejects duplicates',
      unwrap(duplicateCommit.data)?.importedRows === 0 &&
        (unwrap(duplicateCommit.data)?.errors ?? []).some((error: string) => /já existe/i.test(error)),
    );

    const rollbackName = `${TAG}_R`;
    await api(
      'POST',
      '/reports/entities/artists/import/commit',
      headers,
      workbookBody([rollbackName, commitName]),
    );
    const rollbackCount = await dataSource.query(
      'SELECT COUNT(*)::int AS count FROM artists WHERE stage_name=$1',
      [rollbackName],
    );
    check('batch error performs a full rollback', rollbackCount[0].count === 0);
  } finally {
    try {
      await dataSource.query('DELETE FROM artists WHERE stage_name LIKE $1', [`${TAG}%`]);
    } finally {
      await dataSource.destroy();
    }
  }

  console.log(
    `\n[reports:smoke] ${failures === 0 ? 'OK — all flows passed' : `FAILED — ${failures} failure(s)`}\n`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error('[reports:smoke] fatal error:', error instanceof Error ? error.stack : error);
  process.exit(1);
});
