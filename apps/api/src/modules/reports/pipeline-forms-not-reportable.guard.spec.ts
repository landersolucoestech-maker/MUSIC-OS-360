/**
 * pipeline-forms-not-reportable.guard.spec.ts  ·  Part 87 (updated Part 88)
 *
 * Permanent guard: "pipelines" (Pipelines) and "pipeline_opportunities"
 * (Oportunidades de Pipeline) can never appear in the Reports Center
 * — neither in the entity inventory, nor in /definitions, nor via
 * direct export/import/template. They keep existing normally in their
 * own modules, just outside the scope of Reports.
 * Part 88: pipeline_opportunities explicitly removed from the registry
 * (still without an audited explicit contract) — it stopped being an exception.
 * 2026-08-22: "forms" removed from this guard — the generic Forms module
 * (DropGenericFormsModule20260822000005) stopped existing by product
 * decision; the table no longer exists, so there is nothing left to
 * "exclude from Reports".
 */
import { EntityMetadataService } from './entity-metadata.service';
import { ReportEntityDefinitionService } from './definitions/report-entity-definition.service';
import { ExportEngineService } from './export/export-engine.service';
import { ImportEngineService } from './import/import-engine.service';
import { ExportQueryBuilderService } from './export/export-query-builder.service';
import { ExportFormatService } from './export/export-format.service';
import { ImportParserService } from './import/import-parser.service';
import { ImportMapperService } from './import/import-mapper.service';
import { ImportValidationService } from './import/import-validation.service';
import { ReportTableGuardService } from './report-table-guard.service';

const BLOCKED_TABLES = ['pipelines', 'pipeline_opportunities'];

describe('Permanent guard: pipelines are never reportable (Part 87)', () => {
  const metadata = new EntityMetadataService();
  const inv = metadata.scan();

  it.each(BLOCKED_TABLES)('%s: category NOT_REPORTABLE and reportable=false in the inventory', (table) => {
    const entity = inv.entities.find((e) => e.tableName === table);
    expect(entity).toBeDefined();
    expect(entity!.reportable).toBe(false);
    expect(entity!.category).toBe('NOT_REPORTABLE');
  });

  it.each(BLOCKED_TABLES)('%s: absent from ReportEntityDefinitionService.getDefinitions()', (table) => {
    const defs = new ReportEntityDefinitionService(metadata).getDefinitions();
    expect(defs.find((d) => d.tableName === table)).toBeUndefined();
  });

  describe.each(BLOCKED_TABLES)('%s: direct export/import return REPORT_ENTITY_NOT_AVAILABLE', (table) => {
    const tableGuard = { assertTableUsable: jest.fn().mockResolvedValue(undefined) } as unknown as ReportTableGuardService;
    const definitions = new ReportEntityDefinitionService(metadata);

    it('export() rejects with REPORT_ENTITY_NOT_AVAILABLE', async () => {
      const engine = new ExportEngineService(
        { query: jest.fn() } as never,
        metadata,
        definitions,
        new ExportQueryBuilderService(),
        new ExportFormatService(),
        { record: jest.fn() } as never,
        tableGuard,
        { decryptNullable: jest.fn() } as never,
      );
      await expect(
        engine.export(table, { format: 'xlsx' }, 'tenant-1', 'user-1'),
      ).rejects.toMatchObject({ response: { error: 'REPORT_ENTITY_NOT_AVAILABLE' } });
    });

    it('buildTemplate() rejects with REPORT_ENTITY_NOT_AVAILABLE', async () => {
      const engine = new ImportEngineService(
        metadata,
        definitions,
        new ImportParserService(),
        new ImportMapperService(),
        new ImportValidationService(),
        tableGuard,
        new ExportFormatService(),
      );
      await expect(engine.buildTemplate(table, 'tenant-1')).rejects.toMatchObject({
        response: { error: 'REPORT_ENTITY_NOT_AVAILABLE' },
      });
    });
  });
});
