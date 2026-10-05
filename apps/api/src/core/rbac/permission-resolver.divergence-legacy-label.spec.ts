import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import { PermissionResolverService } from './permission-resolver.service';

/**
 * Behavioral proof of LEGACY_DIVERGENCE_LABEL (permission-resolver.service.ts): the `rbac_dual_read` telemetry line
 * carries the canonical English `divergence` and, for one release, the previous Portuguese value in `divergence_legacy`
 * (DIVERGENTE / REMOVIDA / ARQUIVADA). Each label is made observable through the real classifyDivergence + observeDualRead
 * path; only the database rows (the boundary's input) are supplied.
 */
type Row = { slug: string; tenant_id: string | null; archived_at: Date | null; deleted_at: Date | null; canonical_slug: string | null };
const base: Row = { slug: 'juridico', tenant_id: null, archived_at: null, deleted_at: null, canonical_slug: null };

function resolverWith(rows: Row[]): PermissionResolverService {
  const ds = { isInitialized: true, query: jest.fn().mockResolvedValue(rows) } as unknown as DataSource;
  return new PermissionResolverService(ds);
}

async function emit(
  svc: PermissionResolverService,
  opts: { role?: string; roleId?: string | null; tenantId?: string | null } = {},
): Promise<Record<string, unknown>> {
  const log = jest.spyOn(Logger.prototype, 'log').mockImplementation();
  try {
    const roleId = opts.roleId === undefined ? 'role-id' : opts.roleId;
    await (svc as unknown as { observeDualRead: (i: unknown) => Promise<void> }).observeDualRead({
      path: 'role_id', reason: 'role_id_resolved',
      member: { role: opts.role ?? 'legal', role_id: roleId, tenant_id: opts.tenantId ?? 't' }, roleId,
      usedPermissions: ['a'], legacyPermissions: ['a'],
      ds: (svc as unknown as { ds: DataSource }).ds, tenantId: opts.tenantId === undefined ? 't' : opts.tenantId,
    });
    const line = log.mock.calls.map((c) => String(c[0])).find((m) => m.includes('rbac_dual_read'));
    return JSON.parse(line as string) as Record<string, unknown>;
  } finally {
    log.mockRestore();
  }
}

describe('rbac_dual_read divergence_legacy: exact Portuguese telemetry labels', () => {
  const OLD = process.env['RBAC_DUAL_READ_TELEMETRY'];
  beforeEach(() => { delete process.env['RBAC_DUAL_READ_TELEMETRY']; });
  afterAll(() => { if (OLD === undefined) delete process.env['RBAC_DUAL_READ_TELEMETRY']; else process.env['RBAC_DUAL_READ_TELEMETRY'] = OLD; });

  it('archived role row -> divergence ARCHIVED, divergence_legacy exactly ARQUIVADA', async () => {
    const out = await emit(resolverWith([{ ...base, archived_at: new Date() }]));
    expect(out['divergence']).toBe('ARCHIVED');
    expect(out['divergence_legacy']).toBe('ARQUIVADA');
  });

  it('soft-deleted role row -> divergence REMOVED, divergence_legacy exactly REMOVIDA', async () => {
    const out = await emit(resolverWith([{ ...base, deleted_at: new Date() }]));
    expect(out['divergence']).toBe('REMOVED');
    expect(out['divergence_legacy']).toBe('REMOVIDA');
  });

  it('missing role row -> divergence REMOVED, divergence_legacy exactly REMOVIDA', async () => {
    const out = await emit(resolverWith([]));
    expect(out['divergence']).toBe('REMOVED');
    expect(out['divergence_legacy']).toBe('REMOVIDA');
  });

  it('different role string on the row -> divergence DIVERGENT, divergence_legacy exactly DIVERGENTE', async () => {
    const out = await emit(resolverWith([base]), { role: 'sales' });
    expect(out['divergence']).toBe('DIVERGENT');
    expect(out['divergence_legacy']).toBe('DIVERGENTE');
  });

  it('deleted wins over archived (REMOVIDA, not ARQUIVADA)', async () => {
    const out = await emit(resolverWith([{ ...base, deleted_at: new Date(), archived_at: new Date() }]));
    expect(out['divergence_legacy']).toBe('REMOVIDA');
  });

  it('the three labels are distinct and none equals its canonical value', async () => {
    const seen = new Set<unknown>();
    for (const [rows, role] of [
      [[{ ...base, archived_at: new Date() }], 'legal'],
      [[{ ...base, deleted_at: new Date() }], 'legal'],
      [[base], 'sales'],
    ] as const) {
      const out = await emit(resolverWith([...rows]), { role });
      expect(out['divergence_legacy']).not.toBe(out['divergence']);
      seen.add(out['divergence_legacy']);
    }
    expect([...seen].sort()).toEqual(['ARQUIVADA', 'DIVERGENTE', 'REMOVIDA']);
  });

  it.each<[string, Row[], { role?: string; roleId?: string | null; tenantId?: string }, string]>([
    ['MATCH', [base], { role: 'legal' }, 'MATCH'],
    ['ALIAS', [{ ...base, canonical_slug: 'legal' }], {}, 'ALIAS'],
    ['CROSS_TENANT', [{ ...base, tenant_id: 'other-tenant' }], { tenantId: 't' }, 'CROSS_TENANT'],
    ['NO_ROLE_ID', [base], { roleId: null }, 'NO_ROLE_ID'],
  ])('%s has no Portuguese alias: divergence_legacy repeats the canonical value (near-miss is not translated)', async (_n, rows, opts, expected) => {
    const out = await emit(resolverWith(rows), opts);
    expect(out['divergence']).toBe(expected);
    expect(out['divergence_legacy']).toBe(expected);
    expect(['DIVERGENTE', 'REMOVIDA', 'ARQUIVADA']).not.toContain(out['divergence_legacy']);
  });

  it('telemetry disabled -> no line at all (labels are not emitted)', async () => {
    process.env['RBAC_DUAL_READ_TELEMETRY'] = 'false';
    const log = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    try {
      const svc = resolverWith([{ ...base, archived_at: new Date() }]);
      await (svc as unknown as { observeDualRead: (i: unknown) => Promise<void> }).observeDualRead({
        path: 'role_id', reason: 'x', member: { role: 'legal', role_id: 'r', tenant_id: 't' }, roleId: 'r',
        usedPermissions: [], legacyPermissions: [], ds: (svc as unknown as { ds: DataSource }).ds, tenantId: 't',
      });
      expect(log.mock.calls.some((c) => String(c[0]).includes('rbac_dual_read'))).toBe(false);
    } finally {
      log.mockRestore();
    }
  });
});
