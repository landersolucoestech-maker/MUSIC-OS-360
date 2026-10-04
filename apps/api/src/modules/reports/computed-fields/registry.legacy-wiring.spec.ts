import { REPEATING_GROUP_IMPORT_WRITERS } from './registry';

/**
 * Legacy wiring: the projects.tracks repeating-group import writer must canonicalize the spreadsheet
 * cells (PT-BR labels, legacy sim/nao, legacy language slugs) before the INSERT.
 * INSERT params order: [id, tenant, project, name, solo_feat, original_remix, instrumental,
 * duration_min, duration_sec, genre, language, lyrics, audio_url, sort_order].
 */
const IDX = { soloFeat: 4, originalRemix: 5, instrumental: 6, language: 10 } as const;

async function runImport(items: unknown) {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const qr = { query: jest.fn(async (sql: string, params: unknown[]) => { calls.push({ sql, params }); }) };
  await REPEATING_GROUP_IMPORT_WRITERS['projects.tracks'](qr as never, 'tenant-a', 'proj-1', items);
  return calls.filter((c) => c.sql.includes('INSERT INTO "project_tracks"')).map((c) => c.params);
}

describe('REPEATING_GROUP_IMPORT_WRITERS["projects.tracks"] legacy wiring', () => {
  it.each([
    ['Sim', 'yes'],
    ['sim', 'yes'],
    ['Não', 'no'],
    ['nao', 'no'],
  ])('instrumental cell %p is inserted as %p', async (cell, canonical) => {
    const [params] = await runImport([{ trackName: 'Faixa', instrumental: cell }]);
    expect(params[IDX.instrumental]).toBe(canonical);
  });

  it.each([
    ['Português', 'pt'],
    ['Inglês', 'en'],
    ['ingles', 'en'], // legacy web slug
  ])('language cell %p is inserted as %p', async (cell, expected) => {
    const [params] = await runImport([{ trackName: 'Faixa', trackLanguage: cell }]);
    expect(params[IDX.language]).toBe(expected);
  });

  it('legacy slug of a hyphenated language maps to its ISO code', async () => {
    const [params] = await runImport([{ trackName: 'Faixa', trackLanguage: 'chines-mandarim' }]);
    expect(params[IDX.language]).toBe('zh');
  });

  it('solo/feat and original/remix PT-BR labels are canonicalized', async () => {
    const [params] = await runImport([{ trackName: 'Faixa', soloFeat: 'Feat', originalRemix: 'Remix' }]);
    expect(params[IDX.soloFeat]).toBe('feat');
    expect(params[IDX.originalRemix]).toBe('remix');
  });

  it('canonicalizes every row independently and keeps free-text language unchanged', async () => {
    const rows = await runImport([
      { trackName: 'A', instrumental: 'Sim', trackLanguage: 'Português' },
      { trackName: 'B', instrumental: 'Não', trackLanguage: 'Klingon' },
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0][IDX.instrumental]).toBe('yes');
    expect(rows[0][IDX.language]).toBe('pt');
    expect(rows[1][IDX.instrumental]).toBe('no');
    expect(rows[1][IDX.language]).toBe('Klingon');
  });

  it('never persists the raw PT-BR cell text', async () => {
    const [params] = await runImport([{ trackName: 'Faixa', instrumental: 'Sim', trackLanguage: 'Português', soloFeat: 'Solo' }]);
    for (const raw of ['Sim', 'Português', 'Solo']) expect(params).not.toContain(raw);
  });
});
