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
