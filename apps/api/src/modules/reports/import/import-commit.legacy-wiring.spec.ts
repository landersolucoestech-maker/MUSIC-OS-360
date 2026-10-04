import { ImportCommitService } from './import-commit.service';
import { EntityCategory } from '../entity-metadata.types';
import type { ReportEntityDefinition } from '../definitions/report-entity-definition.types';
import type { ImportValidationResult } from './import.types';

/**
 * Legacy wiring of ImportCommitService.insertGroup:
 *  - contractMetadataFields(contract): contract fields stored inside a jsonb column are assembled into ONE object
 *    per jsonb column (never written as plain columns);
 *  - canonicalImportJsonColumn(table, column, object): legacy keys/values inside that object are canonicalized.
 */
const artistsDef: ReportEntityDefinition = {
  entityName: 'ArtistEntity', tableName: 'artists', category: EntityCategory.REPORTABLE,
  identityColumn: 'stage_name', displayColumn: 'stage_name', dateColumn: 'created_at',
  exportableColumns: ['stage_name'], importableColumns: ['stage_name'],
  filterableColumns: [], sortableColumns: ['stage_name'], searchableColumns: ['stage_name'],
  sensitiveColumns: [], requiredImportColumns: ['stage_name'], supportsExport: true, supportsImport: true,
};
const leadsDef: ReportEntityDefinition = {
  ...artistsDef, entityName: 'LeadEntity', tableName: 'leads', identityColumn: 'name', displayColumn: 'name',
  exportableColumns: ['name'], importableColumns: ['name'], sortableColumns: ['name'], searchableColumns: ['name'],
  requiredImportColumns: ['name'],
};

function validation(entity: string, data: Record<string, unknown>): ImportValidationResult {
  return {
    entity, supportsImport: true, mapping: {}, unknownColumns: [], ignoredColumns: [],
    totalRows: 1, validRows: 1, invalidRows: 0,
    rows: [{ index: 0, data, valid: true, errors: [], warnings: [] }],
    errors: [], warnings: [],
  };
}

function makeSvc(def: ReportEntityDefinition, result: ImportValidationResult, jsonbColumns: string[]) {
  const qr = {
    connect: jest.fn().mockResolvedValue(undefined),
    startTransaction: jest.fn().mockResolvedValue(undefined),
    commitTransaction: jest.fn().mockResolvedValue(undefined),
    rollbackTransaction: jest.fn().mockResolvedValue(undefined),
    release: jest.fn().mockResolvedValue(undefined),
    query: jest.fn((sql: string, _params?: unknown[]) =>
      Promise.resolve(String(sql).includes('information_schema.columns') ? jsonbColumns.map((column_name) => ({ column_name })) : [])),
    isTransactionActive: true,
  };
  const svc = new ImportCommitService(
    { createQueryRunner: () => qr } as any,
    { validateFile: jest.fn().mockReturnValue(result) } as any,
    { getDefinition: () => def } as any,
    { record: jest.fn() } as any,
    { encryptNullable: jest.fn((v: string | null) => (v == null ? null : `enc:${v}`)) } as any,
    undefined as any,
  );
  return { svc, qr };
}

const file = { filename: 'x.xlsx', content: Buffer.from('xlsx') };

async function insertOf(def: ReportEntityDefinition, data: Record<string, unknown>, jsonbColumns: string[]) {
  const { svc, qr } = makeSvc(def, validation(def.tableName, data), jsonbColumns);
  const out = await svc.commit(def.tableName, file, 'tenant-1', 'user-1');
  expect(out.errors).toEqual([]);
  const insert = qr.query.mock.calls.find((call: any[]) => String(call[0]).startsWith('INSERT'));
  expect(insert).toBeDefined();
  const cols = String(insert![0]).match(/\(([^)]*)\) VALUES/)![1].split(', ').map((c) => c.replace(/"/g, ''));
  const values = insert![1] as unknown[];
  const get = (column: string): unknown => values[cols.indexOf(column)];
  const getJson = (column: string): Record<string, unknown> => {
    const raw = get(column);
    return (typeof raw === 'string' ? JSON.parse(raw) : raw) as Record<string, unknown>;
  };
  return { cols, values, get, getJson };
}

describe('ImportCommitService legacy wiring: jsonb (metadata) fields', () => {
  it('artists: metadata-only contract fields are written inside the metadata jsonb, never as plain columns', async () => {
    const { cols, getJson } = await insertOf(
      artistsDef,
      { stage_name: 'A0', instagram_url: 'https://instagram.com/a0', tiktok_url: 'https://tiktok.com/@a0', gender: 'male' },
      ['metadata'],
    );
    expect(cols).toContain('metadata');
    for (const plain of ['instagram_url', 'tiktok_url', 'gender']) expect(cols).not.toContain(plain);
    expect(getJson('metadata')).toEqual({
      instagram_url: 'https://instagram.com/a0',
      tiktok_url: 'https://tiktok.com/@a0',
      gender: 'male',
    });
  });

  it('artists: a legacy-valued metadata field (gender) is persisted canonical', async () => {
    const { getJson } = await insertOf(artistsDef, { stage_name: 'A0', gender: 'Masculino' }, ['metadata']);
    const metadata = getJson('metadata');
    expect(metadata.gender).toBe('male');
    expect(typeof getJson('metadata')).toBe('object'); // the jsonb value is the object, never the table name string
    expect(metadata).not.toBe('artists');
  });

  it('artists: feminino maps to female and a row without metadata fields writes no metadata column', async () => {
    const withGender = await insertOf(artistsDef, { stage_name: 'A0', gender: 'feminino' }, ['metadata']);
    expect(withGender.getJson('metadata').gender).toBe('female');
    const without = await insertOf(artistsDef, { stage_name: 'A1' }, ['metadata']);
    expect(without.cols).not.toContain('metadata');
  });

  it('leads: crm_internal_data / service_payload objects are assembled per column with canonical values', async () => {
    const { cols, getJson } = await insertOf(
      leadsDef,
      { name: 'Lead 1', priority: 'alta', temperature: 'quente', leadSource: 'indicacao', jobTitle: 'CEO' },
      ['crm_internal_data', 'service_payload'],
    );
    for (const plain of ['priority', 'temperature', 'leadSource', 'jobTitle']) expect(cols).not.toContain(plain);
    expect(getJson('crm_internal_data')).toEqual({ priority: 'high', temperature: 'hot', leadSource: 'referral' });
    expect(getJson('service_payload')).toEqual({ jobTitle: 'CEO' });
  });

  it('leads: a legacy-keyed crm cell value is never persisted as the raw legacy value', async () => {
    const { getJson } = await insertOf(leadsDef, { name: 'Lead 1', priority: 'baixa' }, ['crm_internal_data']);
    const crm = getJson('crm_internal_data');
    expect(crm.priority).toBe('low');
    expect(JSON.stringify(crm)).not.toContain('baixa');
  });
});
