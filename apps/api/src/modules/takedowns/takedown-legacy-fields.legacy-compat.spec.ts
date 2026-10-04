import { TakedownsService } from './takedowns.service';
import { applyDeprecatedFieldAliases } from '../../common/compat/deprecated-field-aliases.util';
import {
  ACCEPTED_TAKEDOWN_PRIORITIES,
  ACCEPTED_TAKEDOWN_TYPES,
  canonicalTakedownPriority,
  canonicalTakedownType,
  TAKEDOWN_DEPRECATED_FIELDS,
  TAKEDOWN_QUERY_DEPRECATED_FIELDS,
} from './takedown-legacy-fields';

describe('takedown legacy request vocabulary (legacy in, canonical out)', () => {
  it.each([['enviado', 'sent'], ['recebido', 'received'], ['sent', 'sent']])('type %s -> %s', (legacy, canonical) => {
    expect(canonicalTakedownType(legacy)).toBe(canonical);
  });

  it.each([['alta', 'high'], ['media', 'medium'], ['baixa', 'low'], ['high', 'high']])('priority %s -> %s', (legacy, canonical) => {
    expect(canonicalTakedownPriority(legacy)).toBe(canonical);
  });

  it('non-strings pass through and legacy values are still accepted as input', () => {
    expect(canonicalTakedownType(undefined)).toBeUndefined();
    expect(ACCEPTED_TAKEDOWN_TYPES).toEqual(expect.arrayContaining(['sent', 'enviado']));
    expect(ACCEPTED_TAKEDOWN_PRIORITIES).toEqual(expect.arrayContaining(['high', 'alta']));
  });

  it('deprecated fields move to canonical names; the canonical field wins when both are sent', () => {
    const out = applyDeprecatedFieldAliases(
      { obra_afetada: 'W', url_infracao: 'u', prioridade: 'alta', data_identificacao: 'd', platform: 'YT', plataforma: 'ignored' },
      TAKEDOWN_DEPRECATED_FIELDS,
    );
    expect(out).toEqual({ affected_work: 'W', infringing_url: 'u', priority: 'alta', identified_at: 'd', platform: 'YT' });
    expect(applyDeprecatedFieldAliases({ plataforma: 'YT' }, TAKEDOWN_QUERY_DEPRECATED_FIELDS)).toEqual({ platform: 'YT' });
  });
});

// ─── Exhaustive pins of every legacy name of takedown-legacy-fields.ts (explicit static tables, not derived from the module) ───
type Row2 = ReadonlyArray<readonly [string, string]>;
const X_TAKEDOWN_FIELDS: Row2 = [
  ['obra_afetada', 'affected_work'],
  ['artista', 'artist_name'],
  ['plataforma', 'platform'],
  ['url_infracao', 'infringing_url'],
  ['motivo', 'reason'],
  ['prioridade', 'priority'],
  ['data_identificacao', 'identified_at'],
  ['evidencias', 'evidence'],
];

const X_TAKEDOWN_TYPES: Row2 = [
  ['enviado', 'sent'],
  ['recebido', 'received'],
];

const X_TAKEDOWN_PRIORITIES: Row2 = [
  ['alta', 'high'],
  ['media', 'medium'],
  ['baixa', 'low'],
];

describe('takedown legacy names: every deprecated field and value, one by one', () => {
  it('the exported alias tables declare exactly the expected pairs', () => {
    expect({ ...TAKEDOWN_DEPRECATED_FIELDS }).toEqual(Object.fromEntries(X_TAKEDOWN_FIELDS));
    expect({ ...TAKEDOWN_QUERY_DEPRECATED_FIELDS }).toEqual({ plataforma: 'platform' });
  });

  it.each(X_TAKEDOWN_FIELDS)('field %s -> %s: legacy-only moves, the CANONICAL value wins when both are sent', (legacy, canonical) => {
    expect(applyDeprecatedFieldAliases({ [legacy]: 'legacy-value' }, TAKEDOWN_DEPRECATED_FIELDS)).toEqual({ [canonical]: 'legacy-value' });
    expect(applyDeprecatedFieldAliases({ [legacy]: 'legacy-value', [canonical]: 'canonical-value' }, TAKEDOWN_DEPRECATED_FIELDS)).toEqual({ [canonical]: 'canonical-value' });
  });

  it('query field plataforma -> platform: canonical wins when both are sent', () => {
    expect(applyDeprecatedFieldAliases({ plataforma: 'a' }, TAKEDOWN_QUERY_DEPRECATED_FIELDS)).toEqual({ platform: 'a' });
    expect(applyDeprecatedFieldAliases({ plataforma: 'a', platform: 'b' }, TAKEDOWN_QUERY_DEPRECATED_FIELDS)).toEqual({ platform: 'b' });
  });

  it.each(X_TAKEDOWN_TYPES)('type %s -> %s; still accepted as input', (legacy, canonical) => {
    expect(canonicalTakedownType(legacy)).toBe(canonical);
    expect(canonicalTakedownType(canonical)).toBe(canonical);
    expect(ACCEPTED_TAKEDOWN_TYPES).toContain(legacy);
  });

  it.each(X_TAKEDOWN_PRIORITIES)('priority %s -> %s; still accepted as input', (legacy, canonical) => {
    expect(canonicalTakedownPriority(legacy)).toBe(canonical);
    expect(canonicalTakedownPriority(canonical)).toBe(canonical);
    expect(ACCEPTED_TAKEDOWN_PRIORITIES).toContain(legacy);
  });

  it('a legacy type is not read as a priority and the accepted sets are exactly canonical + legacy', () => {
    expect(canonicalTakedownPriority('enviado')).toBe('enviado');
    expect(canonicalTakedownType('alta')).toBe('alta');
    expect([...ACCEPTED_TAKEDOWN_TYPES].sort()).toEqual(['enviado', 'recebido', 'received', 'sent']);
    expect([...ACCEPTED_TAKEDOWN_PRIORITIES].sort()).toEqual(['alta', 'baixa', 'high', 'low', 'media', 'medium']);
  });
});

// ─── Service wiring: the legacy names must be translated on the real service's persistence boundary ───
describe('TakedownsService wiring: legacy payload/query names are applied before persistence', () => {
  function makeWiredService() {
    const qb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn(async () => [[], 0]),
      getOne: jest.fn(async () => ({ id: 't1', tenant_id: 'tenant-1' })),
    };
    const repo = {
      create: jest.fn((v: unknown) => v),
      save: jest.fn(async (v: unknown) => ({ id: 't1', ...(v as object) })),
      update: jest.fn(async () => ({ affected: 1 })),
      createQueryBuilder: jest.fn(() => qb),
    };
    const ds = { getRepository: jest.fn(() => repo) };
    return { service: new TakedownsService(ds as never), repo, qb };
  }

  const LEGACY_PAYLOAD = Object.fromEntries([
    ...X_TAKEDOWN_FIELDS.map(([legacy], i) => [legacy, `value-${i}`]),
    ['type', 'enviado'],
  ]);
  const EXPECTED_PERSISTED = {
    ...Object.fromEntries(X_TAKEDOWN_FIELDS.map(([, canonical], i) => [canonical, `value-${i}`])),
    type: 'sent',
    priority: 'high',
  };

  // priority is itself one of the deprecated fields (value-5) -> override it with a legacy VALUE to also pin the value mapping
  const payload = { ...LEGACY_PAYLOAD, prioridade: 'alta' };

  it('create persists the canonical column names and canonical type/priority values', async () => {
    const { service, repo } = makeWiredService();
    await service.create('tenant-1', 'user-1', payload as never);
    const persisted = repo.create.mock.calls[0][0] as Record<string, unknown>;
    expect(persisted).toEqual({ ...EXPECTED_PERSISTED, tenant_id: 'tenant-1', created_by: 'user-1' });
    for (const [legacy] of X_TAKEDOWN_FIELDS) expect(persisted).not.toHaveProperty(legacy);
  });

  it('update persists the canonical column names and canonical type/priority values', async () => {
    const { service, repo } = makeWiredService();
    await service.update('tenant-1', 'user-1', 't1', payload as never);
    const updates = (repo.update.mock.calls[0] as unknown[])[1] as Record<string, unknown>;
    expect(updates).toMatchObject(EXPECTED_PERSISTED);
    for (const [legacy] of X_TAKEDOWN_FIELDS) expect(updates).not.toHaveProperty(legacy);
  });

  it('list maps the legacy query filter to the canonical platform filter', async () => {
    const { service, qb } = makeWiredService();
    await service.list('tenant-1', { ['plataforma']: 'youtube' } as never);
    expect(qb.andWhere).toHaveBeenCalledWith('t.platform = :platform', { platform: 'youtube' });
  });

  it('list: the canonical query filter wins over the legacy one', async () => {
    const { service, qb } = makeWiredService();
    await service.list('tenant-1', { ['plataforma']: 'legacy', platform: 'canonical' } as never);
    expect(qb.andWhere).toHaveBeenCalledWith('t.platform = :platform', { platform: 'canonical' });
  });
});
