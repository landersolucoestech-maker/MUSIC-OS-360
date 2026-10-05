import { ConfigService } from '@nestjs/config';
import * as XLSX from 'xlsx';
import { ExportEngineService } from './export-engine.service';
import { ExportQueryBuilderService } from './export-query-builder.service';
import { ExportFormatService } from './export-format.service';
import { EntityCategory } from '../entity-metadata.types';
import type { ReportEntityDefinition } from '../definitions/report-entity-definition.types';
import { EncryptionService } from '../../../core/security/encryption.service';
import { REPORT_FORM_CONTRACTS, contractEncryptedFields, contractLegacyPlaintextColumns } from '../form-contracts/report-form-contracts';

/**
 * BLK-CRM-PII-PLAINTEXT: the artists export reads the personal/bank fields from the ciphertext column and falls
 * back to the legacy plaintext column (dual-read), never exports the raw ciphertext, never the metadata jsonb.
 */
const encryption = new EncryptionService({ get: () => 'cd'.repeat(32) } as unknown as ConfigService);
const COLUMNS = ['stage_name', 'rg', 'birth_date', 'bank_account', 'pix_key', 'email'];

const DEF: ReportEntityDefinition = {
  entityName: 'ArtistEntity', tableName: 'artists', category: EntityCategory.REPORTABLE,
  identityColumn: 'stage_name', displayColumn: 'stage_name', dateColumn: 'created_at',
  exportableColumns: COLUMNS, importableColumns: ['stage_name'], filterableColumns: ['status'],
  sortableColumns: ['stage_name', 'created_at'], searchableColumns: ['stage_name'],
  sensitiveColumns: ['cpf_cnpj_encrypted', 'rg_encrypted'], requiredImportColumns: ['stage_name'],
  supportsExport: true, supportsImport: true,
};

function engineWith(rows: Record<string, unknown>[]) {
  const ds = { query: jest.fn().mockResolvedValue(rows) } as any;
  const metadata = { scan: () => ({ entities: [{ tableName: 'artists', label: 'Artistas', reportable: true, hasSoftDelete: false, columns: [] }] }) } as any;
  const definitions = { getDefinition: () => DEF } as any;
  const audit = { record: jest.fn() } as any;
  const tableGuard = { assertTableUsable: jest.fn().mockResolvedValue(undefined) } as any;
  return {
    ds,
    engine: new ExportEngineService(ds, metadata, definitions, new ExportQueryBuilderService(), new ExportFormatService(), audit, tableGuard, encryption),
  };
}

describe('artists PII export (dual-read, BLK-CRM-PII-PLAINTEXT)', () => {
  it('the contract declares the personal/bank fields as encrypted with their legacy plaintext column', () => {
    const contract = REPORT_FORM_CONTRACTS.artists;
    for (const field of ['birth_date', 'rg', 'address', 'bank_name', 'bank_branch', 'bank_account', 'pix_key', 'account_holder']) {
      expect(contractEncryptedFields(contract)[field]).toBe(`${field}_encrypted`);
      expect(contractLegacyPlaintextColumns(contract)[field]).toBe(field);
    }
  });

  it('SQL reads ciphertext first and the legacy plaintext column (as text) as fallback; tenant bound as $1', async () => {
    const { engine, ds } = engineWith([]);
    await engine.export('artists', { format: 'xlsx' }, 'tenant-1', 'user-1');
    const [sql, parameters] = ds.query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('COALESCE("rg_encrypted", "rg"::text) AS "rg"');
    expect(sql).toContain('COALESCE("birth_date_encrypted", "birth_date"::text) AS "birth_date"');
    expect(sql).toContain('"email_encrypted" AS "email"');
    expect(sql).not.toMatch(/\bmetadata\b/);
    expect(sql).toContain('"tenant_id" = $1');
    expect(parameters[0]).toBe('tenant-1');
  });

  it('decrypts ciphertext, passes legacy plaintext through, never emits ciphertext', async () => {
    const { engine } = engineWith([
      { stage_name: 'Nova', rg: encryption.encrypt('RG-NEW'), birth_date: encryption.encrypt('1990-05-06'), bank_account: encryption.encrypt('111-1'), pix_key: null, email: encryption.encrypt('n@x.com') },
      { stage_name: 'Antiga', rg: 'RG-LEGACY', birth_date: '1980-01-02', bank_account: '222-2', pix_key: 'pix-legado', email: null },
    ]);
    const result = await engine.export('artists', { format: 'xlsx' }, 'tenant-1', 'user-1');
    const sheet = XLSX.read(result.body as Buffer, { type: 'buffer' });
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet.Sheets[sheet.SheetNames[0]], { header: 1 });
    const flat = JSON.stringify(rows);
    expect(flat).toContain('RG-NEW');
    expect(flat).toContain('06/05/1990'); // formatted by the export (pt-BR date)
    expect(flat).toContain('RG-LEGACY');
    expect(flat).toContain('02/01/1980');
    expect(flat).toContain('pix-legado');
    expect(flat).not.toContain('enc:v1:');
    expect(flat).not.toContain('[encrypted]');
  });
});
