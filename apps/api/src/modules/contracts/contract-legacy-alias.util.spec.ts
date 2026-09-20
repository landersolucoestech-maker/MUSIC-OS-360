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

describe('resolveContractAliases — title (obrigatoriedade tratada pelo chamador; aqui só conteúdo/conflito)', () => {
  it('ausência total → title undefined (chamador decide se é erro)', () => {
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

  it('titulo (PT legado) inválido também rejeita', () => {
    expect(getBody(() => resolveContractAliases({ titulo: '' })).code).toBe('CONTRACT_TITLE_INVALID');
  });

  it('equivalência por trim: title="Contrato A", titulo=" Contrato A " → aceito, persiste o valor de title original (não trimmed)', () => {
    const { normalized, legacyAliasesUsed } = resolveContractAliases({ title: 'Contrato A', titulo: ' Contrato A ' });
    expect(normalized.title).toBe('Contrato A');
    expect(legacyAliasesUsed).toContain('titulo');
  });

  it('somente PT (legado) aceito temporariamente: persiste o valor original (não trimmed), registra alias', () => {
    const { normalized, legacyAliasesUsed } = resolveContractAliases({ titulo: ' Contrato A ' });
    expect(normalized.title).toBe(' Contrato A ');
    expect(legacyAliasesUsed).toEqual(['titulo']);
  });

  it('title e titulo com conteúdos realmente diferentes → CONTRACT_ALIAS_CONFLICT', () => {
    const body = getBody(() => resolveContractAliases({ title: 'A', titulo: 'B' }));
    expect(body.code).toBe('CONTRACT_ALIAS_CONFLICT');
  });
});

describe('resolveContractAliases — type/tipo (comparação estrita, sem trim)', () => {
  it('somente EN', () => {
    expect(resolveContractAliases({ title: 'X', type: 'gravacao' }).normalized.type).toBe('gravacao');
  });

  it('somente PT (legado)', () => {
    const { normalized, legacyAliasesUsed } = resolveContractAliases({ title: 'X', tipo: 'gravacao' });
    expect(normalized.type).toBe('gravacao');
    expect(legacyAliasesUsed).toContain('tipo');
  });

  it('ambos equivalentes (idênticos)', () => {
    const { normalized, legacyAliasesUsed } = resolveContractAliases({ title: 'X', type: 'gravacao', tipo: 'gravacao' });
    expect(normalized.type).toBe('gravacao');
    expect(legacyAliasesUsed).toContain('tipo');
  });

  it('ambos conflitantes', () => {
    expect(getBody(() => resolveContractAliases({ title: 'X', type: 'gravacao', tipo: 'edicao' })).code).toBe('CONTRACT_ALIAS_CONFLICT');
  });

  it('diferença só de espaços é CONFLITO (sem trim aplicado a type)', () => {
    expect(getBody(() => resolveContractAliases({ title: 'X', type: 'gravacao', tipo: ' gravacao ' })).code).toBe('CONTRACT_ALIAS_CONFLICT');
  });

  it('ambos null → equivalente, retorna null', () => {
    const { normalized, legacyAliasesUsed } = resolveContractAliases({ title: 'X', type: null, tipo: null });
    expect(normalized.type).toBeNull();
    expect(legacyAliasesUsed).toContain('tipo');
  });

  it('EN null e PT válido → CONFLITO (nunca fallback silencioso)', () => {
    expect(getBody(() => resolveContractAliases({ title: 'X', type: null, tipo: 'gravacao' })).code).toBe('CONTRACT_ALIAS_CONFLICT');
  });

  it('EN válido e PT null → CONFLITO', () => {
    expect(getBody(() => resolveContractAliases({ title: 'X', type: 'gravacao', tipo: null })).code).toBe('CONTRACT_ALIAS_CONFLICT');
  });

  it('PT undefined é tratado como ausente (não conta como "ambos presentes")', () => {
    const { normalized, legacyAliasesUsed } = resolveContractAliases({ title: 'X', type: 'gravacao', tipo: undefined });
    expect(normalized.type).toBe('gravacao');
    expect(legacyAliasesUsed).toEqual([]);
  });

  it('ausência total → type undefined', () => {
    expect(resolveContractAliases({ title: 'X' }).normalized.type).toBeUndefined();
  });

  it('somente EN com null → válido, não gera 400, retorna null', () => {
    const { normalized, legacyAliasesUsed } = resolveContractAliases({ title: 'X', type: null });
    expect(normalized.type).toBeNull();
    expect(legacyAliasesUsed).toEqual([]);
  });

  it('somente PT (legado) com null → válido durante a depreciação, registra alias, retorna null', () => {
    const { normalized, legacyAliasesUsed } = resolveContractAliases({ title: 'X', tipo: null });
    expect(normalized.type).toBeNull();
    expect(legacyAliasesUsed).toEqual(['tipo']);
  });
});

describe('resolveContractAliases — artist_id/artistId (UUID, case-insensitive na comparação)', () => {
  const UUID_A = '11111111-1111-4111-8111-111111111111';
  const UUID_A_UPPER = '11111111-1111-4111-8111-111111111111'.toUpperCase();
  const UUID_B = '22222222-2222-4222-8222-222222222222';

  it('somente PT válido', () => {
    expect(resolveContractAliases({ title: 'X', artist_id: UUID_A }).normalized.artist_id).toBe(UUID_A);
  });

  it('somente EN válido', () => {
    const { normalized, legacyAliasesUsed } = resolveContractAliases({ title: 'X', artistId: UUID_A });
    expect(normalized.artist_id).toBe(UUID_A);
    expect(legacyAliasesUsed).toContain('artistId');
  });

  it('ambos com mesmo UUID mas capitalização diferente → equivalente, persiste o valor PT original', () => {
    const { normalized } = resolveContractAliases({ title: 'X', artist_id: UUID_A, artistId: UUID_A_UPPER });
    expect(normalized.artist_id).toBe(UUID_A);
  });

  it('ambos diferentes → conflito', () => {
    expect(getBody(() => resolveContractAliases({ title: 'X', artist_id: UUID_A, artistId: UUID_B })).code).toBe('CONTRACT_ALIAS_CONFLICT');
  });

  it('UUID inválido (só PT) → CONTRACT_UUID_INVALID', () => {
    expect(getBody(() => resolveContractAliases({ title: 'X', artist_id: 'not-a-uuid' })).code).toBe('CONTRACT_UUID_INVALID');
  });

  it('UUID inválido (só EN) → CONTRACT_UUID_INVALID', () => {
    expect(getBody(() => resolveContractAliases({ title: 'X', artistId: 'not-a-uuid' })).code).toBe('CONTRACT_UUID_INVALID');
  });

  it('null/null → equivalente, retorna null', () => {
    const { normalized } = resolveContractAliases({ title: 'X', artist_id: null, artistId: null });
    expect(normalized.artist_id).toBeNull();
  });

  it('null/válido → conflito', () => {
    expect(getBody(() => resolveContractAliases({ title: 'X', artist_id: null, artistId: UUID_A })).code).toBe('CONTRACT_ALIAS_CONFLICT');
  });

  it('ausência total → undefined', () => {
    expect(resolveContractAliases({ title: 'X' }).normalized.artist_id).toBeUndefined();
  });
});

describe('resolveContractAliases — start_date/data_inicio/startsAt e end_date/data_fim/expiresAt (3 nomes aceitos por campo)', () => {
  it('mesmo instante em representações ISO diferentes (canônico + 2 legados) → equivalente, valor do canônico vence', () => {
    const { normalized, legacyAliasesUsed } = resolveContractAliases({
      title: 'X',
      start_date: '2026-01-01T00:00:00.000Z',
      data_inicio: '2026-01-01T00:00:00Z',
      startsAt: '2026-01-01T00:00:00Z',
    });
    expect(normalized.start_date).toBe('2026-01-01T00:00:00.000Z');
    expect(legacyAliasesUsed).toEqual(expect.arrayContaining(['data_inicio', 'startsAt']));
  });

  it('somente o alias legado pt-BR (data_inicio) → aceito, resolvido para start_date', () => {
    const { normalized, legacyAliasesUsed } = resolveContractAliases({ title: 'X', data_inicio: '2026-01-01T00:00:00.000Z' });
    expect(normalized.start_date).toBe('2026-01-01T00:00:00.000Z');
    expect(legacyAliasesUsed).toContain('data_inicio');
  });

  it('somente o alias legado EN (startsAt) → aceito, resolvido para start_date', () => {
    const { normalized, legacyAliasesUsed } = resolveContractAliases({ title: 'X', startsAt: '2026-01-01T00:00:00.000Z' });
    expect(normalized.start_date).toBe('2026-01-01T00:00:00.000Z');
    expect(legacyAliasesUsed).toContain('startsAt');
  });

  it('data_inicio e startsAt (os 2 legados, sem o canônico) instantes diferentes → conflito', () => {
    expect(getBody(() => resolveContractAliases({
      title: 'X', data_inicio: '2026-01-01T00:00:00.000Z', startsAt: '2026-01-02T00:00:00.000Z',
    })).code).toBe('CONTRACT_ALIAS_CONFLICT');
  });

  it('data inválida (só data_inicio) → CONTRACT_DATE_INVALID, não lança RangeError', () => {
    expect(getBody(() => resolveContractAliases({ title: 'X', data_inicio: 'not-a-date' })).code).toBe('CONTRACT_DATE_INVALID');
  });

  it('data inválida (só expiresAt) → CONTRACT_DATE_INVALID', () => {
    expect(getBody(() => resolveContractAliases({ title: 'X', expiresAt: 'not-a-date' })).code).toBe('CONTRACT_DATE_INVALID');
  });

  it('null/null (data_fim/expiresAt) → equivalente, retorna null (não vira epoch 1970)', () => {
    const { normalized } = resolveContractAliases({ title: 'X', data_fim: null, expiresAt: null });
    expect(normalized.end_date).toBeNull();
  });

  it('null/data válida → conflito', () => {
    expect(getBody(() => resolveContractAliases({
      title: 'X', data_fim: null, expiresAt: '2026-01-01T00:00:00.000Z',
    })).code).toBe('CONTRACT_ALIAS_CONFLICT');
  });

  it('undefined representa propriedade ausente (não conflita)', () => {
    const { normalized } = resolveContractAliases({ title: 'X', data_fim: '2026-01-01T00:00:00.000Z', expiresAt: undefined });
    expect(normalized.end_date).toBe('2026-01-01T00:00:00.000Z');
  });

  it('ausência total → undefined', () => {
    expect(resolveContractAliases({ title: 'X' }).normalized.start_date).toBeUndefined();
  });
});

describe('resolveContractAliases — arquivo_url/fileUrl (estrita, sem normalização)', () => {
  it('somente PT', () => {
    expect(resolveContractAliases({ title: 'X', arquivo_url: 'https://a.com/x.pdf' }).normalized.arquivo_url).toBe('https://a.com/x.pdf');
  });

  it('somente EN, registra alias', () => {
    const { normalized, legacyAliasesUsed } = resolveContractAliases({ title: 'X', fileUrl: 'https://a.com/x.pdf' });
    expect(normalized.arquivo_url).toBe('https://a.com/x.pdf');
    expect(legacyAliasesUsed).toContain('fileUrl');
  });

  it('ambos idênticos → equivalente', () => {
    const { normalized } = resolveContractAliases({ title: 'X', arquivo_url: 'https://a.com/x.pdf', fileUrl: 'https://a.com/x.pdf' });
    expect(normalized.arquivo_url).toBe('https://a.com/x.pdf');
  });

  it('diferença por espaços é conflito (sem trim/normalização de URL)', () => {
    expect(getBody(() => resolveContractAliases({
      title: 'X', arquivo_url: 'https://a.com/x.pdf', fileUrl: 'https://a.com/x.pdf ',
    })).code).toBe('CONTRACT_ALIAS_CONFLICT');
  });

  it('null/null → equivalente, retorna null', () => {
    const { normalized } = resolveContractAliases({ title: 'X', arquivo_url: null, fileUrl: null });
    expect(normalized.arquivo_url).toBeNull();
  });

  it('null/valor → conflito', () => {
    expect(getBody(() => resolveContractAliases({
      title: 'X', arquivo_url: null, fileUrl: 'https://a.com/x.pdf',
    })).code).toBe('CONTRACT_ALIAS_CONFLICT');
  });

  it('ausência total → undefined', () => {
    expect(resolveContractAliases({ title: 'X' }).normalized.arquivo_url).toBeUndefined();
  });
});

describe('resolveContractAliases — valor/value (coerção numérica)', () => {
  it('10 e "10" são equivalentes', () => {
    const { normalized } = resolveContractAliases({ title: 'X', valor: 10, value: '10' });
    expect(normalized.fixed_value).toBe('10');
  });

  it('10 e "10.0" são equivalentes', () => {
    const { normalized } = resolveContractAliases({ title: 'X', valor: 10, value: '10.0' });
    expect(normalized.fixed_value).toBe('10');
  });

  it('0 e "0" são equivalentes', () => {
    const { normalized } = resolveContractAliases({ title: 'X', valor: 0, value: '0' });
    expect(normalized.fixed_value).toBe('0');
  });

  it('0 e "" NÃO são equivalentes — "" é inválido → CONTRACT_VALUE_INVALID', () => {
    expect(getBody(() => resolveContractAliases({ title: 'X', valor: 0, value: '' })).code).toBe('CONTRACT_VALUE_INVALID');
  });

  it('string vazia isolada → CONTRACT_VALUE_INVALID', () => {
    expect(getBody(() => resolveContractAliases({ title: 'X', valor: '' })).code).toBe('CONTRACT_VALUE_INVALID');
  });

  it('whitespace isolado → CONTRACT_VALUE_INVALID', () => {
    expect(getBody(() => resolveContractAliases({ title: 'X', value: '   ' })).code).toBe('CONTRACT_VALUE_INVALID');
  });

  it('NaN (string não numérica) → CONTRACT_VALUE_INVALID', () => {
    expect(getBody(() => resolveContractAliases({ title: 'X', valor: 'abc' })).code).toBe('CONTRACT_VALUE_INVALID');
  });

  it('Infinity → CONTRACT_VALUE_INVALID', () => {
    expect(getBody(() => resolveContractAliases({ title: 'X', valor: Infinity })).code).toBe('CONTRACT_VALUE_INVALID');
  });

  it('tipos inválidos (objeto/array/boolean) → CONTRACT_VALUE_INVALID', () => {
    expect(getBody(() => resolveContractAliases({ title: 'X', valor: {} })).code).toBe('CONTRACT_VALUE_INVALID');
    expect(getBody(() => resolveContractAliases({ title: 'X', valor: [] })).code).toBe('CONTRACT_VALUE_INVALID');
    expect(getBody(() => resolveContractAliases({ title: 'X', valor: true })).code).toBe('CONTRACT_VALUE_INVALID');
  });

  it('null/0 são conflitantes (null nunca é tratado como zero)', () => {
    expect(getBody(() => resolveContractAliases({ title: 'X', valor: null, value: 0 })).code).toBe('CONTRACT_ALIAS_CONFLICT');
  });

  it('null/null → equivalente, retorna null', () => {
    const { normalized } = resolveContractAliases({ title: 'X', valor: null, value: null });
    expect(normalized.fixed_value).toBeNull();
  });

  it('ausência total → undefined', () => {
    expect(resolveContractAliases({ title: 'X' }).normalized.fixed_value).toBeUndefined();
  });

  it('valores conflitantes (10 vs 20) → CONTRACT_ALIAS_CONFLICT', () => {
    expect(getBody(() => resolveContractAliases({ title: 'X', valor: 10, value: '20' })).code).toBe('CONTRACT_ALIAS_CONFLICT');
  });
});

describe('resolveContractQueryAliases — apenas type/tipo e artist_id/artistId', () => {
  it('type canônico', () => {
    expect(resolveContractQueryAliases({ type: 'gravacao' }).normalized.type).toBe('gravacao');
  });

  it('tipo legado', () => {
    const { normalized, legacyAliasesUsed } = resolveContractQueryAliases({ tipo: 'gravacao' });
    expect(normalized.type).toBe('gravacao');
    expect(legacyAliasesUsed).toContain('tipo');
  });

  it('artist_id canônico', () => {
    const uuid = '11111111-1111-4111-8111-111111111111';
    expect(resolveContractQueryAliases({ artist_id: uuid }).normalized.artist_id).toBe(uuid);
  });

  it('artistId legado', () => {
    const uuid = '11111111-1111-4111-8111-111111111111';
    const { normalized, legacyAliasesUsed } = resolveContractQueryAliases({ artistId: uuid });
    expect(normalized.artist_id).toBe(uuid);
    expect(legacyAliasesUsed).toContain('artistId');
  });

  it('conflito type/tipo', () => {
    expect(getBody(() => resolveContractQueryAliases({ type: 'gravacao', tipo: 'edicao' })).code).toBe('CONTRACT_ALIAS_CONFLICT');
  });

  it('null/null em type → equivalente', () => {
    const { normalized } = resolveContractQueryAliases({ type: null, tipo: null });
    expect(normalized.type).toBeNull();
  });

  it('ausência total → objeto vazio', () => {
    const { normalized, legacyAliasesUsed } = resolveContractQueryAliases({});
    expect(normalized.type).toBeUndefined();
    expect(normalized.artist_id).toBeUndefined();
    expect(legacyAliasesUsed).toEqual([]);
  });

  it('confirma que title/value/datas não são processados pela query (ausentes do resultado mesmo se enviados)', () => {
    const { normalized } = resolveContractQueryAliases({ title: 'X', value: '10', startsAt: '2026-01-01T00:00:00.000Z' } as never);
    expect(normalized).not.toHaveProperty('title');
    expect(normalized).not.toHaveProperty('valor');
    expect(normalized).not.toHaveProperty('start_date');
    expect(Object.keys(normalized)).toEqual([]);
  });
});
