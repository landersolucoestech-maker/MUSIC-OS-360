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

describe('ExportQueryBuilderService — query segura entity-driven', () => {
  const svc = new ExportQueryBuilderService();

  it('monta SELECT com colunas explícitas (nunca SELECT *) + tenant sempre', () => {
    const q = svc.build(DEF, base(), 'tenant-1');
    expect(q.sql).toContain('SELECT "nome_artistico", "email_encrypted" AS "email", "status" FROM "artists"');
    expect(q.sql).not.toContain('*');
    expect(q.sql).toContain('"tenant_id" = $1');
    expect(q.parameters[0]).toBe('tenant-1');
  });

  it('sem tenant → ForbiddenException', () => {
    expect(() => svc.build(DEF, base(), '')).toThrow(ForbiddenException);
  });

  it('coluna fora do contrato → 400', () => {
    expect(() => svc.build(DEF, base({ columns: ['email', 'segredo'] }), 't')).toThrow(BadRequestException);
  });

  it('coluna sensível → 400 (nunca exportada)', () => {
    expect(() => svc.build(DEF, base({ columns: ['cpf_encrypted'] }), 't')).toThrow(BadRequestException);
  });

  it('filtro permitido aplica WHERE parametrizado; filtro proibido → 400', () => {
    const q = svc.build(DEF, base({ filters: { status: 'ativo' } }), 't');
    expect(q.sql).toContain('"status" = $2');
    expect(q.parameters).toContain('ativo');
    expect(() => svc.build(DEF, base({ filters: { email: 'x@y' } }), 't')).toThrow(BadRequestException);
  });

  it('ordenação permitida; proibida → 400', () => {
    const q = svc.build(DEF, base({ sort: 'created_at', order: 'DESC' }), 't');
    expect(q.sql).toContain('ORDER BY "created_at" DESC');
    expect(() => svc.build(DEF, base({ sort: 'email' } as ExportQueryParams), 't')).toThrow(BadRequestException);
  });

  it('consulta o conjunto completo até a linha sentinela, sem OFFSET ou paginação silenciosa', () => {
    const q = svc.build(DEF, base(), 't');
    expect(q.sql).toContain(`LIMIT $${q.parameters.length}`);
    expect(q.sql).not.toContain('OFFSET');
    expect(q.parameters.at(-1)).toBe(EXPORT_DETECTION_LIMIT);
  });

  it('soft delete aplica deleted_at IS NULL quando informado', () => {
    const q = svc.build(DEF, base(), 't', { softDeleteColumn: 'deleted_at' });
    expect(q.sql).toContain('"deleted_at" IS NULL');
  });

  it('sem baseWhere declarado, nenhuma condição extra é adicionada (comportamento existente preservado)', () => {
    const q = svc.build(DEF, base(), 't');
    expect(q.sql).toBe(
      `SELECT "nome_artistico", "email_encrypted" AS "email", "status" FROM "artists" WHERE "tenant_id" = $1 LIMIT $2`,
    );
  });

  it('baseWhere (REM-06: invoices dual-purpose) é sempre aplicado no export genérico, mesmo sem filtro do chamador', () => {
    const invoicesDef: ReportEntityDefinition = {
      ...DEF, tableName: 'invoices', baseWhere: ["type != 'stripe_subscription'"],
    };
    const q = svc.build(invoicesDef, base(), 't');
    expect(q.sql).toContain(`WHERE "tenant_id" = $1 AND type != 'stripe_subscription'`);
  });

  // Regressão: seleção de colunas nunca pode determinar a ordem — apenas QUAIS
  // colunas entram. A ORDEM vem sempre de def.exportableColumns (config canônica).
  describe('ordem das colunas selecionadas — seleção filtra, nunca ordena', () => {
    it('subconjunto enviado na ordem canônica preserva a ordem canônica', () => {
      const q = svc.build(DEF, base({ columns: ['nome_artistico', 'status'] }), 't');
      expect(q.columns).toEqual(['nome_artistico', 'status']);
    });

    it('subconjunto enviado FORA da ordem canônica é reordenado pela config canônica', () => {
      // Canônico: nome_artistico, email, status. Chamador envia status antes de nome_artistico.
      const q = svc.build(DEF, base({ columns: ['status', 'nome_artistico'] }), 't');
      expect(q.columns).toEqual(['nome_artistico', 'status']);
      expect(q.sql).toContain('SELECT "nome_artistico", "status" FROM "artists"');
    });

    it('ordem dos cliques não interfere: duas seleções do mesmo conjunto em ordens diferentes produzem a mesma saída', () => {
      const q1 = svc.build(DEF, base({ columns: ['email', 'nome_artistico'] }), 't');
      const q2 = svc.build(DEF, base({ columns: ['nome_artistico', 'email'] }), 't');
      expect(q1.columns).toEqual(['nome_artistico', 'email']);
      expect(q2.columns).toEqual(['nome_artistico', 'email']);
      expect(q1.columns).toEqual(q2.columns);
    });

    it('sem seleção (export completo) usa exportableColumns na ordem declarada', () => {
      const q = svc.build(DEF, base(), 't');
      expect(q.columns).toEqual(['nome_artistico', 'email', 'status']);
    });
  });
});
