import { UnprocessableEntityException } from '@nestjs/common';
import { ReportTableGuardService } from './report-table-guard.service';
import type { EntityReport } from './entity-metadata.types';

function report(partial: Partial<EntityReport>): EntityReport {
  return {
    entityName: 'X', tableName: 'x', label: null, category: 'REPORTABLE' as any, reportable: true,
    columns: [], relations: [], hasTenantId: false, hasSoftDelete: false, hasTimestamps: false, risks: [],
    ...partial,
  };
}

function guardWithTables(tables: string[] | null) {
  const ds = tables === null ? null : ({ query: jest.fn().mockResolvedValue(tables.map((t) => ({ tablename: t }))) } as any);
  return new ReportTableGuardService(ds);
}

describe('ReportTableGuardService — availability guard', () => {
  it('existing table → does not throw', async () => {
    const g = guardWithTables(['artists']);
    await expect(
      g.assertTableUsable('artists', report({ tableName: 'artists', hasTenantId: true, columns: [{ name: 'tenant_id', isTenantId: true } as any] })),
    ).resolves.toBeUndefined();
  });

  it('nonexistent table → 422 (never 500)', async () => {
    const g = guardWithTables(['artists']);
    await expect(g.assertTableUsable('crm_contacts', report({ tableName: 'crm_contacts' })))
      .rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('missing metadata (report undefined) → 422', async () => {
    const g = guardWithTables(['artists']);
    await expect(g.assertTableUsable('fantasma', undefined)).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('multi-tenant without physical tenant_id column → 422', async () => {
    const g = guardWithTables(['weird']);
    await expect(
      g.assertTableUsable('weird', report({ tableName: 'weird', hasTenantId: true, columns: [] })),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('without DataSource → safe degradation (does not block)', async () => {
    const g = guardWithTables(null);
    await expect(g.assertTableUsable('crm_contacts', report({ tableName: 'crm_contacts' }))).resolves.toBeUndefined();
    await expect(g.existingTables()).resolves.toBeNull();
  });

  it('existingTables is cached (single query)', async () => {
    const ds = { query: jest.fn().mockResolvedValue([{ tablename: 'a' }]) } as any;
    const g = new ReportTableGuardService(ds);
    await g.existingTables();
    await g.existingTables();
    expect(ds.query).toHaveBeenCalledTimes(1);
  });
});
