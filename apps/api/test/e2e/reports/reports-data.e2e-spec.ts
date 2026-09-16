/**
 * E2E real contra PostgreSQL: serviços reais de exportação, validação e commit.
 * Todos os fluxos de planilha usam XLSX OpenXML e inspecionam o workbook.
 */
import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';
import { DataSource } from 'typeorm';
import { ALL_ENTITIES } from '../../../src/database/entities';
import { EntityMetadataService } from '../../../src/modules/reports/entity-metadata.service';
import { ReportEntityDefinitionService } from '../../../src/modules/reports/definitions/report-entity-definition.service';
import { ExportQueryBuilderService } from '../../../src/modules/reports/export/export-query-builder.service';
import { ExportFormatService } from '../../../src/modules/reports/export/export-format.service';
import { ExportAuditService } from '../../../src/modules/reports/export/export-audit.service';
import { ExportEngineService } from '../../../src/modules/reports/export/export-engine.service';
import { ImportParserService } from '../../../src/modules/reports/import/import-parser.service';
import { ImportMapperService } from '../../../src/modules/reports/import/import-mapper.service';
import { ImportValidationService } from '../../../src/modules/reports/import/import-validation.service';
import { ImportEngineService } from '../../../src/modules/reports/import/import-engine.service';
import { ImportAuditService } from '../../../src/modules/reports/import/import-audit.service';
import { ImportCommitService } from '../../../src/modules/reports/import/import-commit.service';
import { ReportTableGuardService } from '../../../src/modules/reports/report-table-guard.service';
import { EncryptionService } from '../../../src/core/security/encryption.service';
import type { ConfigService } from '@nestjs/config';

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('dotenv').config({ path: path.resolve(__dirname, '../../../.env.development') });
} catch {
  // dotenv é opcional no PostgreSQL efêmero da CI.
}

const TENANT_A = '10000000-0000-0000-0000-000000000002';
const TENANT_B = '00000000-0000-4000-8000-0000000000ee';
const TAG = `SMOKE_${Date.now()}`;

function xlsxFile(sheetName: string, headers: string[], rows: unknown[][]) {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  return {
    filename: `${sheetName.toLowerCase()}.xlsx`,
    content: XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer,
  };
}

function readWorkbook(buffer: Buffer, expectedSheet: string) {
  expect(buffer.subarray(0, 4)).toEqual(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  expect(workbook.SheetNames).toEqual([expectedSheet]);
  const worksheet = workbook.Sheets[expectedSheet];
  expect(worksheet).toBeDefined();
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(worksheet!, {
    header: 1,
    raw: true,
    defval: null,
  });
  expect(matrix.length).toBeGreaterThanOrEqual(1);
  return matrix;
}

describe('Reports E2E — PostgreSQL real e XLSX', () => {
  let ds: DataSource;
  let exportEngine: ExportEngineService;
  let importEngine: ImportEngineService;
  let commit: ImportCommitService;

  beforeAll(async () => {
    // An explicitly-provided process env must always win over .env.development.
    const envPath = path.resolve(process.cwd(), '.env.development');
    const envText = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
    const url = (
      process.env['DATABASE_URL'] ??
      envText.match(/^DATABASE_URL=(.+)$/m)?.[1] ??
      ''
    ).trim().replace(/^["']|["']$/g, '');

    ds = await new DataSource({
      type: 'postgres',
      url,
      entities: ALL_ENTITIES,
      synchronize: false,
      logging: false,
      ssl: false,
    }).initialize();

    const metadata = new EntityMetadataService();
    const definitions = new ReportEntityDefinitionService(metadata);
    const tableGuard = new ReportTableGuardService(ds);
    const exportFormat = new ExportFormatService();
    const encryption = new EncryptionService({
      get: jest.fn().mockReturnValue(process.env['ENCRYPTION_KEY']),
    } as unknown as ConfigService);

    exportEngine = new ExportEngineService(
      ds,
      metadata,
      definitions,
      new ExportQueryBuilderService(),
      exportFormat,
      new ExportAuditService(),
      tableGuard,
      encryption,
    );
    importEngine = new ImportEngineService(
      metadata,
      definitions,
      new ImportParserService(),
      new ImportMapperService(),
      new ImportValidationService(),
      tableGuard,
      exportFormat,
    );
    commit = new ImportCommitService(
      ds,
      importEngine,
      definitions,
      new ImportAuditService(),
      encryption,
      undefined as any,
    );

    await ds.query(
      `INSERT INTO artists (id, tenant_id, nome_artistico)
       VALUES (gen_random_uuid(), $1, $2)`,
      [TENANT_A, `${TAG}_A`],
    );
    await ds.query(
      `INSERT INTO artists (id, tenant_id, nome_artistico)
       VALUES (gen_random_uuid(), $1, $2)`,
      [TENANT_B, `${TAG}_B`],
    );
  }, 30_000);

  afterAll(async () => {
    if (ds?.isInitialized) {
      await ds.query(`DELETE FROM artists WHERE nome_artistico LIKE $1`, [`${TAG}%`]);
      await ds.destroy();
    }
  });

  const artistFile = (names: string[], extraHeaders: string[] = [], extraValues: unknown[][] = []) =>
    xlsxFile(
      'Artistas',
      ['Nome artístico', ...extraHeaders],
      names.map((name, index) => [name, ...(extraValues[index] ?? [])]),
    );

  const countArtists = async (name: string): Promise<number> => {
    const result = await ds.query(
      `SELECT COUNT(*)::int AS count
       FROM artists
       WHERE nome_artistico = $1 AND tenant_id = $2`,
      [name, TENANT_A],
    );
    return result[0].count as number;
  };

  it('export XLSX: labels pt-BR, conteúdo e isolamento de tenant', async () => {
    const result = await exportEngine.export(
      'artists',
      { format: 'xlsx', page: 1, pageSize: 1000 },
      TENANT_A,
      'e2e',
    );
    expect(result.format).toBe('xlsx');
    expect(result.contentType).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    const matrix = readWorkbook(result.body as Buffer, 'Artistas');
    const headers = matrix[0] as unknown[];
    expect(headers).toContain('Nome artístico');
    expect(headers).not.toContain('nome_artistico');
    const serialized = JSON.stringify(matrix);
    expect(serialized).toContain(`${TAG}_A`);
    expect(serialized).not.toContain(`${TAG}_B`);
  });

  it('export XLSX: possui ZIP íntegro e uma única aba', async () => {
    const result = await exportEngine.export(
      'artists',
      { format: 'xlsx', page: 1, pageSize: 10 },
      TENANT_A,
      'e2e',
    );
    const matrix = readWorkbook(result.body as Buffer, 'Artistas');
    expect(matrix[0]?.length).toBeGreaterThan(0);
    expect(matrix.length).toBeGreaterThan(1);
  });

  it('import VALIDATE não persiste', async () => {
    const name = `${TAG}_V`;
    const before = await countArtists(name);
    const validation = await importEngine.validateFile(
      'artists',
      artistFile([name]),
      TENANT_A,
    );
    expect(validation.validRows).toBe(1);
    expect(await countArtists(name)).toBe(before);
  });

  it('import COMMIT persiste com tenant correto e create-only', async () => {
    const name = `${TAG}_C`;
    const result = await commit.commit(
      'artists',
      artistFile([name]),
      TENANT_A,
      'e2e',
    );
    expect(result.importedRows).toBe(1);
    expect(await countArtists(name)).toBe(1);
    const row = await ds.query(
      `SELECT tenant_id FROM artists WHERE nome_artistico = $1`,
      [name],
    );
    expect(row[0].tenant_id).toBe(TENANT_A);
  });

  it('create-only rejeita segunda importação sem sobrescrever', async () => {
    const name = `${TAG}_C`;
    const result = await commit.commit(
      'artists',
      artistFile([name]),
      TENANT_A,
      'e2e',
    );
    expect(result.importedRows).toBe(0);
    expect(result.errors.some((error) => /já existe/i.test(error))).toBe(true);
    expect(await countArtists(name)).toBe(1);
  });

  it('rollback transacional impede persistência parcial', async () => {
    const duplicate = `${TAG}_C`;
    const fresh = `${TAG}_R`;
    const result = await commit.commit(
      'artists',
      artistFile([fresh, duplicate]),
      TENANT_A,
      'e2e',
    );
    expect(result.importedRows).toBe(0);
    expect(await countArtists(fresh)).toBe(0);
  });

  it('tenant informado no workbook é ignorado e não permite spoofing', async () => {
    const name = `${TAG}_T`;
    const result = await commit.commit(
      'artists',
      artistFile([name], ['tenant_id'], [[TENANT_B]]),
      TENANT_A,
      'e2e',
    );
    expect(result.importedRows).toBe(1);
    const row = await ds.query(
      `SELECT tenant_id FROM artists WHERE nome_artistico = $1`,
      [name],
    );
    expect(row[0]?.tenant_id).toBe(TENANT_A);
  });

  it('export de entidade sem tabela física retorna 422 controlado', async () => {
    await expect(
      exportEngine.export(
        'crm_contacts',
        { format: 'xlsx', page: 1, pageSize: 10 },
        TENANT_A,
        'e2e',
      ),
    ).rejects.toMatchObject({ status: 422 });
  });

  it('tabelas materializadas existem', async () => {
    const profiles = await ds.query(
      `SELECT to_regclass('public.artist_platform_profiles') AS table_name`,
    );
    const releaseWorks = await ds.query(
      `SELECT to_regclass('public.release_works') AS table_name`,
    );
    expect(profiles[0].table_name).toBe('artist_platform_profiles');
    expect(releaseWorks[0].table_name).toBe('release_works');
  });

  it('soft delete usa colunas existentes nas tabelas operacionais', async () => {
    await expect(
      ds.query(`SELECT id, deleted_at FROM payroll_entries WHERE deleted_at IS NULL LIMIT 1`),
    ).resolves.toBeDefined();
    await expect(
      ds.query(`SELECT id, deleted_at, documento_url, created_by FROM leave_requests WHERE deleted_at IS NULL LIMIT 1`),
    ).resolves.toBeDefined();
    await expect(
      ds.query(`SELECT id, created_at, updated_at, deleted_at FROM audiovisual_approvals WHERE deleted_at IS NULL LIMIT 1`),
    ).resolves.toBeDefined();
  });

  it('INSERT em audiovisual_approvals preenche timestamps e permite rollback', async () => {
    const runner = ds.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      await runner.query(
        `INSERT INTO audiovisual_approvals
           (id, tenant_id, audiovisual_project_id, status, revision_round, requested_at)
         VALUES (gen_random_uuid(), $1, gen_random_uuid(), 'pending', 1, now())`,
        [TENANT_A],
      );
      const row = await runner.query(
        `SELECT created_at, updated_at
         FROM audiovisual_approvals
         WHERE tenant_id = $1
         ORDER BY created_at DESC
         LIMIT 1`,
        [TENANT_A],
      );
      expect(row[0].created_at).toBeTruthy();
      expect(row[0].updated_at).toBeTruthy();
    } finally {
      await runner.rollbackTransaction();
      await runner.release();
    }
  });

  it('coluna sensível não pode ser exportada', async () => {
    const definitions = new ReportEntityDefinitionService(
      new EntityMetadataService(),
    ).getDefinitions();
    const withSensitive = definitions.find(
      (definition) => definition.sensitiveColumns.length > 0,
    );
    expect(withSensitive).toBeDefined();
    await expect(
      exportEngine.export(
        withSensitive!.tableName,
        {
          format: 'xlsx',
          page: 1,
          pageSize: 1,
          columns: [withSensitive!.sensitiveColumns[0]!],
        },
        TENANT_A,
        'e2e',
      ),
    ).rejects.toMatchObject({ status: 400 });
  });

  describe('leads', () => {
    const LEAD_TAG = `SMOKE_LEAD_${Date.now()}`;
    const leadFile = (names: string[]) =>
      xlsxFile('Leads', ['Nome'], names.map((name) => [name]));
    const countLeads = async (name: string): Promise<number> => {
      const result = await ds.query(
        `SELECT COUNT(*)::int AS count
         FROM leads
         WHERE nome = $1 AND tenant_id = $2`,
        [name, TENANT_A],
      );
      return result[0].count as number;
    };

    beforeAll(async () => {
      await ds.query(
        `INSERT INTO leads
           (id, tenant_id, nome, status, cidade, tipo_servico, origem_lead, tags)
         VALUES
           (gen_random_uuid(), $1, $2, 'new', 'São Paulo', 'distribuicao', 'indicacao', ARRAY['vip']::text[])`,
        [TENANT_A, `${LEAD_TAG}_A`],
      );
      await ds.query(
        `INSERT INTO leads (id, tenant_id, nome, status)
         VALUES (gen_random_uuid(), $1, $2, 'new')`,
        [TENANT_B, `${LEAD_TAG}_B`],
      );
    });

    afterAll(async () => {
      await ds.query(`DELETE FROM leads WHERE nome LIKE $1`, [`${LEAD_TAG}%`]);
    });

    it('export XLSX inclui campos reconciliados e isola tenant', async () => {
      const result = await exportEngine.export(
        'leads',
        { format: 'xlsx', page: 1, pageSize: 1000 },
        TENANT_A,
        'e2e',
      );
      const matrix = readWorkbook(result.body as Buffer, 'Leads');
      const headers = matrix[0] as unknown[];
      expect(headers).toEqual(
        expect.arrayContaining(['Tipo de serviço', 'Origem do lead', 'Cidade', 'Etiquetas']),
      );
      expect(headers).not.toEqual(
        expect.arrayContaining([
          'email_encrypted',
          'telefone_encrypted',
          'dados_internos_crm',
          'payload_servico',
        ]),
      );
      const serialized = JSON.stringify(matrix);
      expect(serialized).toContain(`${LEAD_TAG}_A`);
      expect(serialized).not.toContain(`${LEAD_TAG}_B`);
    });

    it('export XLSX usa cabeçalhos pt-BR sem chaves técnicas', async () => {
      const result = await exportEngine.export(
        'leads',
        { format: 'xlsx', page: 1, pageSize: 10 },
        TENANT_A,
        'e2e',
      );
      const matrix = readWorkbook(result.body as Buffer, 'Leads');
      const headers = matrix[0] as unknown[];
      expect(headers).toContain('Tipo de serviço');
      expect(headers).not.toContain('tipoServico');
    });

    it('import VALIDATE não persiste', async () => {
      const name = `${LEAD_TAG}_V`;
      const before = await countLeads(name);
      const validation = await importEngine.validateFile(
        'leads',
        leadFile([name]),
        TENANT_A,
      );
      expect(validation.validRows).toBe(1);
      expect(await countLeads(name)).toBe(before);
    });

    it('import COMMIT persiste com tenant correto', async () => {
      const name = `${LEAD_TAG}_C`;
      const result = await commit.commit(
        'leads',
        leadFile([name]),
        TENANT_A,
        'e2e',
      );
      expect(result.importedRows).toBe(1);
      expect(await countLeads(name)).toBe(1);
      const row = await ds.query(`SELECT tenant_id FROM leads WHERE nome = $1`, [name]);
      expect(row[0].tenant_id).toBe(TENANT_A);
    });

    it('rollback de leads impede persistência parcial', async () => {
      const duplicate = `${LEAD_TAG}_C`;
      const fresh = `${LEAD_TAG}_R`;
      const result = await commit.commit(
        'leads',
        leadFile([fresh, duplicate]),
        TENANT_A,
        'e2e',
      );
      expect(result.importedRows).toBe(0);
      expect(await countLeads(fresh)).toBe(0);
    });
  });
});
