import { EntityMetadataService } from '../entity-metadata.service';
import { ReportEntityDefinitionService } from './report-entity-definition.service';
import { tryGetFieldLabelPtBr } from '../i18n/field-labels.pt-br';
import { EntityCategory } from '../entity-metadata.types';
import {
  contractEncryptedFields,
  contractMetadataFields,
  getReportFormContract,
} from '../form-contracts/report-form-contracts';

/** FASE 2.1 — contratos por entidade reportável, ancorados na metadata real. */
describe('ReportEntityDefinitionService — contratos', () => {
  const metadata = new EntityMetadataService();
  const inv = metadata.scan();
  const reportable = inv.entities.filter((e) => e.reportable);
  const defs = new ReportEntityDefinitionService(metadata).getDefinitions();
  const colsByTable = new Map(inv.entities.map((e) => [e.tableName, new Set(e.columns.map((c) => c.name))]));

  it('toda entidade reportável efetiva possui ReportEntityDefinition', () => {
    expect(defs.length).toBe(reportable.length);
    for (const e of reportable) {
      expect(defs.find((d) => d.tableName === e.tableName)).toBeDefined();
    }
  });

  it('REM-06: a definição real de invoices exclui type=stripe_subscription do export/import genérico', () => {
    const invoicesDef = defs.find((d) => d.tableName === 'invoices');
    expect(invoicesDef).toBeDefined();
    expect(invoicesDef!.baseWhere).toEqual(["type != 'stripe_subscription'"]);
  });

  it('tabelas sem exclusão declarada continuam com baseWhere vazio (comportamento existente preservado)', () => {
    const artistsDef = defs.find((d) => d.tableName === 'artists');
    expect(artistsDef).toBeDefined();
    expect(artistsDef!.baseWhere).toEqual([]);
  });

  it('toda coluna declarada no contrato possui lastro físico ou resolver repetível', () => {
    const offenders: string[] = [];
    for (const d of defs) {
      const real = colsByTable.get(d.tableName)!;
      const all = [
        d.identityColumn, d.displayColumn, d.dateColumn,
        ...d.exportableColumns, ...d.importableColumns, ...d.filterableColumns,
        ...d.sortableColumns, ...d.searchableColumns, ...d.sensitiveColumns,
        ...d.requiredImportColumns,
      ];
      const contract = getReportFormContract(d.tableName);
      const encrypted = contract ? contractEncryptedFields(contract) : {};
      const metaFields = contract ? contractMetadataFields(contract) : {};
      const repeatingFields = new Set(contract?.repeatingGroup?.fields.map((field) => field.key) ?? []);
      const fieldsByKey = new Map(contract?.fields.map((field) => [field.key, field]) ?? []);

      for (const col of all) {
        const field = fieldsByKey.get(col);
        const physical = field?.physical ?? col;
        const backedByContract =
          repeatingFields.has(col) ||
          (field?.storage === 'column' && real.has(physical)) ||
          (encrypted[col] !== undefined && real.has(encrypted[col])) ||
          (metaFields[col] !== undefined && real.has(metaFields[col]));
        if (!real.has(col) && !backedByContract) offenders.push(`${d.tableName}.${col}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('toda coluna visível do contrato possui label pt-BR', () => {
    const offenders: string[] = [];
    for (const d of defs) {
      const visible = new Set([
        d.identityColumn, d.displayColumn, d.dateColumn,
        ...d.exportableColumns, ...d.importableColumns, ...d.filterableColumns,
        ...d.sortableColumns, ...d.searchableColumns,
      ]);
      for (const col of visible) if (tryGetFieldLabelPtBr(col) === null) offenders.push(`${d.tableName}.${col}`);
    }
    expect(offenders).toEqual([]);
  });

  it('colunas sensíveis NUNCA aparecem como exportáveis/importáveis', () => {
    const offenders: string[] = [];
    for (const d of defs) {
      for (const s of d.sensitiveColumns) {
        if (d.exportableColumns.includes(s) || d.importableColumns.includes(s)) {
          offenders.push(`${d.tableName}.${s}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('identityColumn, displayColumn e dateColumn possuem lastro e label', () => {
    for (const d of defs) {
      const real = colsByTable.get(d.tableName)!;
      const contract = getReportFormContract(d.tableName);
      const fieldsByKey = new Map(contract?.fields.map((field) => [field.key, field]) ?? []);
      for (const col of [d.identityColumn, d.displayColumn, d.dateColumn]) {
        const physical = fieldsByKey.get(col)?.physical ?? col;
        expect(real.has(physical)).toBe(true);
        expect(tryGetFieldLabelPtBr(col)).not.toBeNull();
      }
    }
  });

  it('importação deriva SEMPRE do mesmo schema da exportação', () => {
    const offenders: string[] = [];
    for (const d of defs) {
      for (const col of d.importableColumns) {
        if (!d.exportableColumns.includes(col)) offenders.push(`${d.tableName}.${col}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('nenhuma entidade reportável expõe relacionamento completo como coluna de export/import', () => {
    const offenders: string[] = [];
    for (const e of reportable) {
      const d = defs.find((x) => x.tableName === e.tableName)!;
      for (const rel of e.relations) {
        if (d.exportableColumns.includes(rel.property) || d.importableColumns.includes(rel.property)) {
          offenders.push(`${e.tableName}.${rel.property}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('contratos núcleo têm forma coerente', () => {
    const artists = defs.find((d) => d.tableName === 'artists')!;
    expect(artists.supportsExport).toBe(true);
    expect(artists.exportableColumns.length).toBeGreaterThan(0);
    expect(artists.exportableColumns).not.toContain('id');
    expect(artists.exportableColumns).not.toContain('tenant_id');
    expect(artists.requiredImportColumns.length).toBeGreaterThan(0);
  });

  describe('entidade REPORTABLE sem contrato explícito nunca aparece', () => {
    function defsFor(columns: Array<Partial<import('../entity-metadata.types').ColumnMeta> & { name: string }>) {
      const fakeMetadata = {
        scan: () => ({
          entities: [{
            entityName: 'FakeEntity', tableName: 'fake_table', category: EntityCategory.REPORTABLE,
            reportable: true, hasTenantId: true, hasSoftDelete: false, hasTimestamps: false, risks: [],
            columns: columns.map((c) => ({
              label: null, type: 'varchar', nullable: true, primary: false, generated: false,
              isEnum: false, isCreatedAt: false, isUpdatedAt: false, isDeletedAt: false, isTenantId: false,
              ...c,
            })),
          }],
        }),
      } as unknown as EntityMetadataService;
      return new ReportEntityDefinitionService(fakeMetadata).getDefinitions();
    }

    it('fake_table sem contrato registrado produz ZERO definições', () => {
      const result = defsFor([
        { name: 'nome', type: 'varchar' },
        { name: 'tags', type: 'simple-array' },
        { name: 'conteudo_html', type: 'text' },
        { name: 'preferencias', type: 'json' },
        { name: 'observacoes', type: 'text' },
      ]);
      expect(result).toEqual([]);
    });
  });
});
