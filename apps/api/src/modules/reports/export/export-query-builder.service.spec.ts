import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ExportQueryBuilderService } from './export-query-builder.service';
import { EntityCategory } from '../entity-metadata.types';
import type { ReportEntityDefinition } from '../definitions/report-entity-definition.types';
import { EXPORT_DETECTION_LIMIT, type ExportQueryParams } from './export.types';

const DEF: ReportEntityDefinition = {
  entityName: 'ArtistEntity', tableName: 'artists', category: EntityCategory.REPORTABLE,
  identityColumn: 'nome_artistico', displayColumn: 'nome_artistico', dateColumn: 'created_at',
  exportableColumns: ['nome_artistico', 'email', 'status'],
  importableColumns: ['nome_artistico', 'email'],
  filterableColumns: ['status'],
  sortableColumns: ['nome_artistico', 'created_at'],
  searchableColumns: ['nome_artistico', 'email'],
  sensitiveColumns: ['cpf_encrypted'],
  requiredImportColumns: ['nome_artistico'],
  supportsExport: true, supportsImport: true,
};
const base = (p: Partial<ExportQueryParams> = {}): ExportQueryParams => ({ format: 'xlsx', ...p });

describe('ExportQueryBuilderService — entity-driven safe query', () => {
  const svc = new ExportQueryBuilderService();

  it('builds SELECT with explicit columns (never SELECT *) + tenant always', () => {
    const q = svc.build(DEF, base(), 'tenant-1');
    expect(q.sql).toContain('SELECT "nome_artistico", "email_encrypted" AS "email", "status" FROM "artists"');
    expect(q.sql).not.toContain('*');
    expect(q.sql).toContain('"tenant_id" = $1');
    expect(q.parameters[0]).toBe('tenant-1');
  });

  it('without tenant → ForbiddenException', () => {
    expect(() => svc.build(DEF, base(), '')).toThrow(ForbiddenException);
  });

  it('column outside the contract → 400', () => {
    expect(() => svc.build(DEF, base({ columns: ['email', 'segredo'] }), 't')).toThrow(BadRequestException);
  });

  it('sensitive column → 400 (never exported)', () => {
    expect(() => svc.build(DEF, base({ columns: ['cpf_encrypted'] }), 't')).toThrow(BadRequestException);
  });

  it('allowed filter applies a parameterized WHERE; forbidden filter → 400', () => {
    const q = svc.build(DEF, base({ filters: { status: 'ativo' } }), 't');
    expect(q.sql).toContain('"status" = $2');
    expect(q.parameters).toContain('ativo');
    expect(() => svc.build(DEF, base({ filters: { email: 'x@y' } }), 't')).toThrow(BadRequestException);
  });

  it('allowed ordering; forbidden → 400', () => {
    const q = svc.build(DEF, base({ sort: 'created_at', order: 'DESC' }), 't');
    expect(q.sql).toContain('ORDER BY "created_at" DESC');
    expect(() => svc.build(DEF, base({ sort: 'email' } as ExportQueryParams), 't')).toThrow(BadRequestException);
  });

  it('queries the full set up to the sentinel row, without OFFSET or silent pagination', () => {
    const q = svc.build(DEF, base(), 't');
    expect(q.sql).toContain(`LIMIT $${q.parameters.length}`);
    expect(q.sql).not.toContain('OFFSET');
    expect(q.parameters.at(-1)).toBe(EXPORT_DETECTION_LIMIT);
  });

  it('soft delete applies deleted_at IS NULL when provided', () => {
    const q = svc.build(DEF, base(), 't', { softDeleteColumn: 'deleted_at' });
    expect(q.sql).toContain('"deleted_at" IS NULL');
  });

  it('without a declared baseWhere, no extra condition is added (existing behavior preserved)', () => {
    const q = svc.build(DEF, base(), 't');
    expect(q.sql).toBe(
      `SELECT "nome_artistico", "email_encrypted" AS "email", "status" FROM "artists" WHERE "tenant_id" = $1 LIMIT $2`,
    );
  });

  it('baseWhere (REM-06: invoices dual-purpose) is always applied in the generic export, even without a caller filter', () => {
    const invoicesDef: ReportEntityDefinition = {
      ...DEF, tableName: 'invoices', baseWhere: ["type != 'stripe_subscription'"],
    };
    const q = svc.build(invoicesDef, base(), 't');
    expect(q.sql).toContain(`WHERE "tenant_id" = $1 AND type != 'stripe_subscription'`);
  });

  // Regression: column selection can never determine the order — only WHICH
  // columns are included. The ORDER always comes from def.exportableColumns (canonical config).
  describe('order of selected columns — selection filters, never orders', () => {
    it('subset sent in canonical order preserves the canonical order', () => {
      const q = svc.build(DEF, base({ columns: ['nome_artistico', 'status'] }), 't');
      expect(q.columns).toEqual(['nome_artistico', 'status']);
    });

    it('subset sent OUT of canonical order is reordered by the canonical config', () => {
      // Canonical: nome_artistico, email, status. Caller sends status before nome_artistico.
      const q = svc.build(DEF, base({ columns: ['status', 'nome_artistico'] }), 't');
      expect(q.columns).toEqual(['nome_artistico', 'status']);
      expect(q.sql).toContain('SELECT "nome_artistico", "status" FROM "artists"');
    });

    it('click order does not interfere: two selections of the same set in different orders produce the same output', () => {
      const q1 = svc.build(DEF, base({ columns: ['email', 'nome_artistico'] }), 't');
      const q2 = svc.build(DEF, base({ columns: ['nome_artistico', 'email'] }), 't');
      expect(q1.columns).toEqual(['nome_artistico', 'email']);
      expect(q2.columns).toEqual(['nome_artistico', 'email']);
      expect(q1.columns).toEqual(q2.columns);
    });

    it('without selection (full export) uses exportableColumns in the declared order', () => {
      const q = svc.build(DEF, base(), 't');
      expect(q.columns).toEqual(['nome_artistico', 'email', 'status']);
    });
  });
});
