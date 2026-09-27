import { BadRequestException } from '@nestjs/common';
import { resolveContractAliases, resolveContractQueryAliases } from './contract-legacy-alias.util';

function getBody(fn: () => void): { code: string; message: string; fields?: unknown[] } {
  try {
    fn();
    throw new Error('esperava BadRequestException');
  } catch (e) {
    if (!(e instanceof BadRequestException)) throw e;
    return e.getResponse() as { code: string; message: string; fields?: unknown[] };
  }
}

describe('resolveContractAliases — title (requiredness handled by the caller; only content/conflict here)', () => {
  it('fully absent → title undefined (caller decides whether it is an error)', () => {
    const { normalized } = resolveContractAliases({});
    expect(normalized.title).toBeUndefined();
  });

  it('title: null → CONTRACT_TITLE_INVALID', () => {
    const body = getBody(() => resolveContractAliases({ title: null }));
    expect(body.code).toBe('CONTRACT_TITLE_INVALID');
  });

  it('title: "" → CONTRACT_TITLE_INVALID', () => {
    expect(getBody(() => resolveContractAliases({ title: '' })).code).toBe('CONTRACT_TITLE_INVALID');
  });

  it('title: "   " (whitespace) → CONTRACT_TITLE_INVALID', () => {
    expect(getBody(() => resolveContractAliases({ title: '   ' })).code).toBe('CONTRACT_TITLE_INVALID');
  });

  it('invalid titulo (legacy PT) is also rejected', () => {
    expect(getBody(() => resolveContractAliases({ titulo: '' })).code).toBe('CONTRACT_TITLE_INVALID');
  });

  it('trim equivalence: title="Contrato A", titulo=" Contrato A " → accepted, persists the original (untrimmed) title value', () => {
    const { normalized, legacyAliasesUsed } = resolveContractAliases({ title: 'Contrato A', titulo: ' Contrato A ' });
    expect(normalized.title).toBe('Contrato A');
    expect(legacyAliasesUsed).toContain('titulo');
  });

  it('PT only (legacy) temporarily accepted: persists the original (untrimmed) value, records the alias', () => {
    const { normalized, legacyAliasesUsed } = resolveContractAliases({ titulo: ' Contrato A ' });
    expect(normalized.title).toBe(' Contrato A ');
    expect(legacyAliasesUsed).toEqual(['titulo']);
  });

  it('title and titulo with genuinely different content → CONTRACT_ALIAS_CONFLICT', () => {
    const body = getBody(() => resolveContractAliases({ title: 'A', titulo: 'B' }));
    expect(body.code).toBe('CONTRACT_ALIAS_CONFLICT');
  });
});

describe('resolveContractAliases — type/tipo (strict comparison, no trim)', () => {
  it('EN only', () => {
    expect(resolveContractAliases({ title: 'X', type: 'gravacao' }).normalized.type).toBe('gravacao');
  });

  it('PT only (legacy)', () => {
    const { normalized, legacyAliasesUsed } = resolveContractAliases({ title: 'X', tipo: 'gravacao' });
    expect(normalized.type).toBe('gravacao');
    expect(legacyAliasesUsed).toContain('tipo');
  });

  it('both equivalent (identical)', () => {
    const { normalized, legacyAliasesUsed } = resolveContractAliases({ title: 'X', type: 'gravacao', tipo: 'gravacao' });
    expect(normalized.type).toBe('gravacao');
    expect(legacyAliasesUsed).toContain('tipo');
  });

  it('both, conflicting', () => {
    expect(getBody(() => resolveContractAliases({ title: 'X', type: 'gravacao', tipo: 'edicao' })).code).toBe('CONTRACT_ALIAS_CONFLICT');
  });

  it('a whitespace-only difference is a CONFLICT (no trim applied to type)', () => {
    expect(getBody(() => resolveContractAliases({ title: 'X', type: 'gravacao', tipo: ' gravacao ' })).code).toBe('CONTRACT_ALIAS_CONFLICT');
  });

  it('both null → equivalent, returns null', () => {
    const { normalized, legacyAliasesUsed } = resolveContractAliases({ title: 'X', type: null, tipo: null });
    expect(normalized.type).toBeNull();
    expect(legacyAliasesUsed).toContain('tipo');
  });

  it('EN null and valid PT → CONFLICT (never a silent fallback)', () => {
    expect(getBody(() => resolveContractAliases({ title: 'X', type: null, tipo: 'gravacao' })).code).toBe('CONTRACT_ALIAS_CONFLICT');
  });

  it('valid EN and PT null → CONFLICT', () => {
    expect(getBody(() => resolveContractAliases({ title: 'X', type: 'gravacao', tipo: null })).code).toBe('CONTRACT_ALIAS_CONFLICT');
  });

  it('PT undefined is treated as absent (does not count as "both present")', () => {
    const { normalized, legacyAliasesUsed } = resolveContractAliases({ title: 'X', type: 'gravacao', tipo: undefined });
    expect(normalized.type).toBe('gravacao');
    expect(legacyAliasesUsed).toEqual([]);
  });

  it('fully absent → type undefined', () => {
    expect(resolveContractAliases({ title: 'X' }).normalized.type).toBeUndefined();
  });

  it('EN only with null → valid, no 400, returns null', () => {
    const { normalized, legacyAliasesUsed } = resolveContractAliases({ title: 'X', type: null });
    expect(normalized.type).toBeNull();
    expect(legacyAliasesUsed).toEqual([]);
  });

  it('PT only (legacy) with null → valid during deprecation, records the alias, returns null', () => {
    const { normalized, legacyAliasesUsed } = resolveContractAliases({ title: 'X', tipo: null });
    expect(normalized.type).toBeNull();
    expect(legacyAliasesUsed).toEqual(['tipo']);
  });
});

describe('resolveContractAliases — artist_id/artistId (UUID, case-insensitive comparison)', () => {
  const UUID_A = '11111111-1111-4111-8111-111111111111';
  const UUID_A_UPPER = '11111111-1111-4111-8111-111111111111'.toUpperCase();
  const UUID_B = '22222222-2222-4222-8222-222222222222';

  it('valid PT only', () => {
    expect(resolveContractAliases({ title: 'X', artist_id: UUID_A }).normalized.artist_id).toBe(UUID_A);
  });

  it('valid EN only', () => {
    const { normalized, legacyAliasesUsed } = resolveContractAliases({ title: 'X', artistId: UUID_A });
    expect(normalized.artist_id).toBe(UUID_A);
    expect(legacyAliasesUsed).toContain('artistId');
  });

  it('both with the same UUID but different casing → equivalent, persists the original PT value', () => {
    const { normalized } = resolveContractAliases({ title: 'X', artist_id: UUID_A, artistId: UUID_A_UPPER });
    expect(normalized.artist_id).toBe(UUID_A);
  });

  it('both different → conflict', () => {
    expect(getBody(() => resolveContractAliases({ title: 'X', artist_id: UUID_A, artistId: UUID_B })).code).toBe('CONTRACT_ALIAS_CONFLICT');
  });

  it('invalid UUID (PT only) → CONTRACT_UUID_INVALID', () => {
    expect(getBody(() => resolveContractAliases({ title: 'X', artist_id: 'not-a-uuid' })).code).toBe('CONTRACT_UUID_INVALID');
  });

  it('invalid UUID (EN only) → CONTRACT_UUID_INVALID', () => {
    expect(getBody(() => resolveContractAliases({ title: 'X', artistId: 'not-a-uuid' })).code).toBe('CONTRACT_UUID_INVALID');
  });

  it('null/null → equivalent, returns null', () => {
    const { normalized } = resolveContractAliases({ title: 'X', artist_id: null, artistId: null });
    expect(normalized.artist_id).toBeNull();
  });

  it('null/valid → conflict', () => {
    expect(getBody(() => resolveContractAliases({ title: 'X', artist_id: null, artistId: UUID_A })).code).toBe('CONTRACT_ALIAS_CONFLICT');
  });

  it('fully absent → undefined', () => {
    expect(resolveContractAliases({ title: 'X' }).normalized.artist_id).toBeUndefined();
  });
});

describe('resolveContractAliases — start_date/data_inicio/startsAt and end_date/data_fim/expiresAt (3 accepted names per field)', () => {
  it('the same instant in different ISO representations (canonical + 2 legacy) → equivalent, the canonical value wins', () => {
    const { normalized, legacyAliasesUsed } = resolveContractAliases({
      title: 'X',
      start_date: '2026-01-01T00:00:00.000Z',
      data_inicio: '2026-01-01T00:00:00Z',
      startsAt: '2026-01-01T00:00:00Z',
    });
    expect(normalized.start_date).toBe('2026-01-01T00:00:00.000Z');
    expect(legacyAliasesUsed).toEqual(expect.arrayContaining(['data_inicio', 'startsAt']));
  });

  it('only the legacy pt-BR alias (data_inicio) → accepted, resolved to start_date', () => {
    const { normalized, legacyAliasesUsed } = resolveContractAliases({ title: 'X', data_inicio: '2026-01-01T00:00:00.000Z' });
    expect(normalized.start_date).toBe('2026-01-01T00:00:00.000Z');
    expect(legacyAliasesUsed).toContain('data_inicio');
  });

  it('only the legacy EN alias (startsAt) → accepted, resolved to start_date', () => {
    const { normalized, legacyAliasesUsed } = resolveContractAliases({ title: 'X', startsAt: '2026-01-01T00:00:00.000Z' });
    expect(normalized.start_date).toBe('2026-01-01T00:00:00.000Z');
    expect(legacyAliasesUsed).toContain('startsAt');
  });

  it('data_inicio and startsAt (both legacy, no canonical) at different instants → conflict', () => {
    expect(getBody(() => resolveContractAliases({
      title: 'X', data_inicio: '2026-01-01T00:00:00.000Z', startsAt: '2026-01-02T00:00:00.000Z',
    })).code).toBe('CONTRACT_ALIAS_CONFLICT');
  });

  it('invalid date (data_inicio only) → CONTRACT_DATE_INVALID, does not throw RangeError', () => {
    expect(getBody(() => resolveContractAliases({ title: 'X', data_inicio: 'not-a-date' })).code).toBe('CONTRACT_DATE_INVALID');
  });

  it('invalid date (expiresAt only) → CONTRACT_DATE_INVALID', () => {
    expect(getBody(() => resolveContractAliases({ title: 'X', expiresAt: 'not-a-date' })).code).toBe('CONTRACT_DATE_INVALID');
  });

  it('null/null (data_fim/expiresAt) → equivalent, returns null (not the 1970 epoch)', () => {
    const { normalized } = resolveContractAliases({ title: 'X', data_fim: null, expiresAt: null });
    expect(normalized.end_date).toBeNull();
  });

  it('null/valid date → conflict', () => {
    expect(getBody(() => resolveContractAliases({
      title: 'X', data_fim: null, expiresAt: '2026-01-01T00:00:00.000Z',
    })).code).toBe('CONTRACT_ALIAS_CONFLICT');
  });

  it('undefined represents an absent property (no conflict)', () => {
    const { normalized } = resolveContractAliases({ title: 'X', data_fim: '2026-01-01T00:00:00.000Z', expiresAt: undefined });
    expect(normalized.end_date).toBe('2026-01-01T00:00:00.000Z');
  });

  it('fully absent → undefined', () => {
    expect(resolveContractAliases({ title: 'X' }).normalized.start_date).toBeUndefined();
  });
});

describe('resolveContractAliases — arquivo_url/fileUrl (strict, no normalization)', () => {
  it('PT only', () => {
    expect(resolveContractAliases({ title: 'X', arquivo_url: 'https://a.com/x.pdf' }).normalized.arquivo_url).toBe('https://a.com/x.pdf');
  });

  it('EN only, records the alias', () => {
    const { normalized, legacyAliasesUsed } = resolveContractAliases({ title: 'X', fileUrl: 'https://a.com/x.pdf' });
    expect(normalized.arquivo_url).toBe('https://a.com/x.pdf');
    expect(legacyAliasesUsed).toContain('fileUrl');
  });

  it('both identical → equivalent', () => {
    const { normalized } = resolveContractAliases({ title: 'X', arquivo_url: 'https://a.com/x.pdf', fileUrl: 'https://a.com/x.pdf' });
    expect(normalized.arquivo_url).toBe('https://a.com/x.pdf');
  });

  it('a whitespace difference is a conflict (no trim/URL normalization)', () => {
    expect(getBody(() => resolveContractAliases({
      title: 'X', arquivo_url: 'https://a.com/x.pdf', fileUrl: 'https://a.com/x.pdf ',
    })).code).toBe('CONTRACT_ALIAS_CONFLICT');
  });

  it('null/null → equivalent, returns null', () => {
    const { normalized } = resolveContractAliases({ title: 'X', arquivo_url: null, fileUrl: null });
    expect(normalized.arquivo_url).toBeNull();
  });

  it('null/value → conflict', () => {
    expect(getBody(() => resolveContractAliases({
      title: 'X', arquivo_url: null, fileUrl: 'https://a.com/x.pdf',
    })).code).toBe('CONTRACT_ALIAS_CONFLICT');
  });

  it('fully absent → undefined', () => {
    expect(resolveContractAliases({ title: 'X' }).normalized.arquivo_url).toBeUndefined();
  });
});

describe('resolveContractAliases — valor/value (numeric coercion)', () => {
  it('10 and "10" are equivalent', () => {
    const { normalized } = resolveContractAliases({ title: 'X', valor: 10, value: '10' });
    expect(normalized.fixed_value).toBe('10');
  });

  it('10 and "10.0" are equivalent', () => {
    const { normalized } = resolveContractAliases({ title: 'X', valor: 10, value: '10.0' });
    expect(normalized.fixed_value).toBe('10');
  });

  it('0 and "0" are equivalent', () => {
    const { normalized } = resolveContractAliases({ title: 'X', valor: 0, value: '0' });
    expect(normalized.fixed_value).toBe('0');
  });

  it('0 and "" are NOT equivalent — "" is invalid → CONTRACT_VALUE_INVALID', () => {
    expect(getBody(() => resolveContractAliases({ title: 'X', valor: 0, value: '' })).code).toBe('CONTRACT_VALUE_INVALID');
  });

  it('empty string alone → CONTRACT_VALUE_INVALID', () => {
    expect(getBody(() => resolveContractAliases({ title: 'X', valor: '' })).code).toBe('CONTRACT_VALUE_INVALID');
  });

  it('whitespace only → CONTRACT_VALUE_INVALID', () => {
    expect(getBody(() => resolveContractAliases({ title: 'X', value: '   ' })).code).toBe('CONTRACT_VALUE_INVALID');
  });

  it('NaN (non-numeric string) → CONTRACT_VALUE_INVALID', () => {
    expect(getBody(() => resolveContractAliases({ title: 'X', valor: 'abc' })).code).toBe('CONTRACT_VALUE_INVALID');
  });

  it('Infinity → CONTRACT_VALUE_INVALID', () => {
    expect(getBody(() => resolveContractAliases({ title: 'X', valor: Infinity })).code).toBe('CONTRACT_VALUE_INVALID');
  });

  it('invalid types (object/array/boolean) → CONTRACT_VALUE_INVALID', () => {
    expect(getBody(() => resolveContractAliases({ title: 'X', valor: {} })).code).toBe('CONTRACT_VALUE_INVALID');
    expect(getBody(() => resolveContractAliases({ title: 'X', valor: [] })).code).toBe('CONTRACT_VALUE_INVALID');
    expect(getBody(() => resolveContractAliases({ title: 'X', valor: true })).code).toBe('CONTRACT_VALUE_INVALID');
  });

  it('null/0 conflict (null is never treated as zero)', () => {
    expect(getBody(() => resolveContractAliases({ title: 'X', valor: null, value: 0 })).code).toBe('CONTRACT_ALIAS_CONFLICT');
  });

  it('null/null → equivalent, returns null', () => {
    const { normalized } = resolveContractAliases({ title: 'X', valor: null, value: null });
    expect(normalized.fixed_value).toBeNull();
  });

  it('fully absent → undefined', () => {
    expect(resolveContractAliases({ title: 'X' }).normalized.fixed_value).toBeUndefined();
  });

  it('conflicting values (10 vs 20) → CONTRACT_ALIAS_CONFLICT', () => {
    expect(getBody(() => resolveContractAliases({ title: 'X', valor: 10, value: '20' })).code).toBe('CONTRACT_ALIAS_CONFLICT');
  });
});

describe('resolveContractQueryAliases — only type/tipo and artist_id/artistId', () => {
  it('canonical type', () => {
    expect(resolveContractQueryAliases({ type: 'gravacao' }).normalized.type).toBe('gravacao');
  });

  it('legacy tipo', () => {
    const { normalized, legacyAliasesUsed } = resolveContractQueryAliases({ tipo: 'gravacao' });
    expect(normalized.type).toBe('gravacao');
    expect(legacyAliasesUsed).toContain('tipo');
  });

  it('canonical artist_id', () => {
    const uuid = '11111111-1111-4111-8111-111111111111';
    expect(resolveContractQueryAliases({ artist_id: uuid }).normalized.artist_id).toBe(uuid);
  });

  it('legacy artistId', () => {
    const uuid = '11111111-1111-4111-8111-111111111111';
    const { normalized, legacyAliasesUsed } = resolveContractQueryAliases({ artistId: uuid });
    expect(normalized.artist_id).toBe(uuid);
    expect(legacyAliasesUsed).toContain('artistId');
  });

  it('type/tipo conflict', () => {
    expect(getBody(() => resolveContractQueryAliases({ type: 'gravacao', tipo: 'edicao' })).code).toBe('CONTRACT_ALIAS_CONFLICT');
  });

  it('null/null in type → equivalent', () => {
    const { normalized } = resolveContractQueryAliases({ type: null, tipo: null });
    expect(normalized.type).toBeNull();
  });

  it('fully absent → empty object', () => {
    const { normalized, legacyAliasesUsed } = resolveContractQueryAliases({});
    expect(normalized.type).toBeUndefined();
    expect(normalized.artist_id).toBeUndefined();
    expect(legacyAliasesUsed).toEqual([]);
  });

  it('confirms title/value/dates are not processed by the query (absent from the result even when sent)', () => {
    const { normalized } = resolveContractQueryAliases({ title: 'X', value: '10', startsAt: '2026-01-01T00:00:00.000Z' } as never);
    expect(normalized).not.toHaveProperty('title');
    expect(normalized).not.toHaveProperty('valor');
    expect(normalized).not.toHaveProperty('start_date');
    expect(Object.keys(normalized)).toEqual([]);
  });
});
