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
