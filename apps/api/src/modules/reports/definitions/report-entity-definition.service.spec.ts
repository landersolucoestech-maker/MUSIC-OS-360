import { EntityMetadataService } from '../entity-metadata.service';
import { ReportEntityDefinitionService, HIDDEN_INTERNAL_HINT } from './report-entity-definition.service';
import { tryGetFieldLabelPtBr } from '../i18n/field-labels.pt-br';
import { EntityCategory } from '../entity-metadata.types';
import {
  contractEncryptedFields,
  contractMetadataFields,
  getReportFormContract,
} from '../form-contracts/report-form-contracts';

/** PHASE 2.1 — contracts per reportable entity, anchored in real metadata. */
describe('ReportEntityDefinitionService — contracts', () => {
  const metadata = new EntityMetadataService();
  const inv = metadata.scan();
  const reportable = inv.entities.filter((e) => e.reportable);
  const defs = new ReportEntityDefinitionService(metadata).getDefinitions();
  const colsByTable = new Map(inv.entities.map((e) => [e.tableName, new Set(e.columns.map((c) => c.name))]));

  it('every effectively reportable entity has a ReportEntityDefinition', () => {
    expect(defs.length).toBe(reportable.length);
    for (const e of reportable) {
      expect(defs.find((d) => d.tableName === e.tableName)).toBeDefined();
    }
  });

  it('REM-06: the real invoices definition excludes type=stripe_subscription from generic export/import', () => {
    const invoicesDef = defs.find((d) => d.tableName === 'invoices');
    expect(invoicesDef).toBeDefined();
    expect(invoicesDef!.baseWhere).toEqual(["type != 'stripe_subscription'"]);
  });

  it('tables without a declared exclusion keep an empty baseWhere (existing behavior preserved)', () => {
    const artistsDef = defs.find((d) => d.tableName === 'artists');
    expect(artistsDef).toBeDefined();
    expect(artistsDef!.baseWhere).toEqual([]);
  });

  it('every column declared in the contract has physical backing or a repeating resolver', () => {
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

  it('every visible contract column has a pt-BR label', () => {
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

  it('sensitive columns NEVER appear as exportable/importable', () => {
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

  it('identityColumn, displayColumn and dateColumn have backing and a label', () => {
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

  it('import ALWAYS derives from the same schema as export', () => {
    const offenders: string[] = [];
    for (const d of defs) {
      for (const col of d.importableColumns) {
        if (!d.exportableColumns.includes(col)) offenders.push(`${d.tableName}.${col}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('no reportable entity exposes a full relationship as an export/import column', () => {
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

  it('core contracts have a coherent shape', () => {
    const artists = defs.find((d) => d.tableName === 'artists')!;
    expect(artists.supportsExport).toBe(true);
    expect(artists.exportableColumns.length).toBeGreaterThan(0);
    expect(artists.exportableColumns).not.toContain('id');
    expect(artists.exportableColumns).not.toContain('tenant_id');
    expect(artists.requiredImportColumns.length).toBeGreaterThan(0);
  });

  describe('REPORTABLE entity without an explicit contract never appears', () => {
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

    it('fake_table without a registered contract produces ZERO definitions', () => {
      const result = defsFor([
        { name: 'name', type: 'varchar' },
        { name: 'tags', type: 'simple-array' },
        { name: 'html_content', type: 'text' },
        { name: 'preferences', type: 'json' },
        { name: 'notes', type: 'text' },
      ]);
      expect(result).toEqual([]);
    });
  });

  describe('HIDDEN_INTERNAL_HINT deny-list (English only)', () => {
    const allColumnNames = Array.from(new Set(inv.entities.flatMap((e) => e.columns.map((c) => c.name))));
    const REMOVED_PT = /^(notas?_internas?|observacoes?_internas?|comentarios?_internos?)$/i;

    it('inspects real entity metadata (non-empty)', () => {
      expect(allColumnNames.length).toBeGreaterThan(50);
    });

    it('none of the removed Portuguese alternatives matches a real entity column', () => {
      expect(allColumnNames.filter((n) => REMOVED_PT.test(n))).toEqual([]);
    });

    it('internal_notes (and widened English forms) stay hidden; Portuguese legacy names no longer match', () => {
      for (const n of ['internal_notes', 'internal_note', 'internal_comments', 'internal_observations', 'INTERNAL_NOTES']) {
        expect(HIDDEN_INTERNAL_HINT.test(n)).toBe(true);
      }
      for (const n of ['notes', 'notas_internas', 'observacoes_internas', 'comentarios_internos', 'internal_notes_x']) {
        expect(HIDDEN_INTERNAL_HINT.test(n)).toBe(false);
      }
    });

    it('every real column matched by the deny-list is excluded from filterable/sortable/searchable columns', () => {
      const hidden = inv.entities.flatMap((e) => e.columns.filter((c) => HIDDEN_INTERNAL_HINT.test(c.name)).map((c) => ({ t: e.tableName, n: c.name })));
      expect(hidden.length).toBeGreaterThan(0);
      for (const { t, n } of hidden) {
        const d = defs.find((x) => x.tableName === t);
        if (!d) continue;
        expect([...d.filterableColumns, ...d.sortableColumns, ...d.searchableColumns]).not.toContain(n);
      }
    });

    describe('derived columns on a contract table with a reintroduced internal-notes column', () => {
      function releasesDefWith(extra: string[]) {
        const real = inv.entities.find((e) => e.tableName === 'releases')!;
        const fake = {
          scan: () => ({
            entities: [{
              ...real,
              columns: [
                ...real.columns,
                ...extra.map((name) => ({
                  name, label: null, type: 'text', nullable: true, primary: false, generated: false,
                  isEnum: false, isCreatedAt: false, isUpdatedAt: false, isDeletedAt: false, isTenantId: false,
                })),
              ],
            }],
          }),
        } as unknown as EntityMetadataService;
        return new ReportEntityDefinitionService(fake).getDefinitions().find((d) => d.tableName === 'releases')!;
      }

      it('the real releases definition never derives internal_notes into filter/sort/search (positive control: notes is searchable)', () => {
        const d = releasesDefWith([]);
        const derived = [...d.filterableColumns, ...d.sortableColumns, ...d.searchableColumns];
        expect(d.searchableColumns).toContain('notes');
        expect(derived).not.toContain('internal_notes');
      });

      it.each(['internal_note', 'internal_comments', 'internal_observations'])('a reintroduced English %s column is hidden from derived columns', (name) => {
        const d = releasesDefWith([name]);
        expect([...d.filterableColumns, ...d.sortableColumns, ...d.searchableColumns]).not.toContain(name);
      });

      it.each(['notas_internas', 'observacoes_internas', 'comentarios_internos'])('a reintroduced Portuguese %s column is not in the contract, so it is never exported, imported or searched', (name) => {
        const d = releasesDefWith([name]);
        expect(d.exportableColumns).not.toContain(name);
        expect(d.importableColumns).not.toContain(name);
        expect([...d.filterableColumns, ...d.sortableColumns, ...d.searchableColumns]).not.toContain(name);
      });
    });

    it('no real column name matches the dead Portuguese filter hints (situacao|categoria|prioridade|ativo)', () => {
      expect(allColumnNames.filter((n) => /^(situacao|categoria|prioridade|ativo)$/.test(n))).toEqual([]);
    });
  });
});
