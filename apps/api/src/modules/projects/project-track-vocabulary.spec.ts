import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { CreateProjectDto } from './dto/projects.dto';
import {
  LEGACY_PROJECT_TRACK_INSTRUMENTAL,
  LEGACY_PROJECT_TRACK_LANGUAGE,
  PROJECT_TRACK_LANGUAGE_LABELS_PT_BR,
  canonicalProjectTrackInstrumental,
  canonicalProjectTrackLanguage,
  canonicalProjectTrackImportRows,
  PROJECT_TYPE_LABELS_PT_BR,
  projectTypeFromCell,
  projectTrackSoloFeatFromCell,
  projectTrackSoloFeatLabel,
  projectTrackOriginalRemixFromCell,
  projectTrackOriginalRemixLabel,
  canonicalProjectTracks,
  projectTrackInstrumentalFromCell,
  projectTrackInstrumentalLabel,
  projectTrackLanguageFromCell,
  projectTrackLanguageLabel,
} from './project-track-vocabulary';

describe('project track vocabulary (AP3 R3-06)', () => {
  it('legacy language slugs map to the ISO 639 codes of works.language and never collide with a code', () => {
    expect(LEGACY_PROJECT_TRACK_LANGUAGE['portugues']).toBe('pt');
    expect(LEGACY_PROJECT_TRACK_LANGUAGE['ingles']).toBe('en');
    expect(LEGACY_PROJECT_TRACK_LANGUAGE['chines-mandarim']).toBe('zh');
    expect(LEGACY_PROJECT_TRACK_LANGUAGE['instrumental-sem-letra']).toBe('zxx');
    expect(Object.keys(LEGACY_PROJECT_TRACK_LANGUAGE)).toHaveLength(42);
    const codes = new Set(Object.keys(PROJECT_TRACK_LANGUAGE_LABELS_PT_BR));
    for (const slug of Object.keys(LEGACY_PROJECT_TRACK_LANGUAGE)) expect(codes.has(slug)).toBe(false);
  });

  it('maps legacy values, keeps canonical and free text', () => {
    expect(canonicalProjectTrackInstrumental('sim')).toBe('yes');
    expect(canonicalProjectTrackInstrumental('nao')).toBe('no');
    expect(canonicalProjectTrackInstrumental('yes')).toBe('yes');
    expect(canonicalProjectTrackInstrumental(null)).toBeNull();
    expect(canonicalProjectTrackLanguage('ingles')).toBe('en');
    expect(canonicalProjectTrackLanguage('en')).toBe('en');
    expect(canonicalProjectTrackLanguage('Dialeto local')).toBe('Dialeto local');
    expect(Object.keys(LEGACY_PROJECT_TRACK_INSTRUMENTAL)).toEqual(['sim', 'nao', 'não']);
  });

  it('export labels are PT-BR and import accepts labels, legacy values and canonical values', () => {
    expect(projectTrackInstrumentalLabel('yes')).toBe('Sim');
    expect(projectTrackInstrumentalLabel('nao')).toBe('Não');
    expect(projectTrackInstrumentalLabel('talvez')).toBe('talvez');
    expect(projectTrackLanguageLabel('pt')).toBe('Português');
    expect(projectTrackLanguageLabel('portugues')).toBe('Português');
    expect(projectTrackLanguageLabel('Dialeto local')).toBe('Dialeto local');
    for (const cell of ['Sim', 'sim', ' YES ', 'yes']) expect(projectTrackInstrumentalFromCell(cell)).toBe('yes');
    for (const cell of ['Não', 'nao', 'no']) expect(projectTrackInstrumentalFromCell(cell)).toBe('no');
    for (const cell of ['Português', 'português', 'portugues', 'pt']) expect(projectTrackLanguageFromCell(cell)).toBe('pt');
    expect(projectTrackLanguageFromCell('Dialeto local')).toBe('Dialeto local');
  });

  it('canonicalProjectTracks maps each item and returns the same array when nothing changes', () => {
    const legacy = [{ name: 'A', instrumental: 'sim', language: 'ingles' }, { name: 'B' }, null];
    expect(canonicalProjectTracks(legacy)).toEqual([{ name: 'A', instrumental: 'yes', language: 'en' }, { name: 'B' }, null]);
    const canonical = [{ instrumental: 'no', language: 'pt' }];
    expect(canonicalProjectTracks(canonical)).toBe(canonical);
    expect(canonicalProjectTracks('x')).toBe('x');
  });

  it('the report import registry canonicalizes track cells before the INSERT', async () => {
    expect(canonicalProjectTrackImportRows([{ trackName: 'A', instrumental: 'Sim', trackLanguage: 'Inglês' }, { trackName: 'B', instrumental: 'nao', trackLanguage: 'ingles' }, { trackName: 'C' }, 'x'])).toEqual([
      { trackName: 'A', instrumental: 'yes', trackLanguage: 'en' },
      { trackName: 'B', instrumental: 'no', trackLanguage: 'en' },
      { trackName: 'C' },
      'x',
    ]);
    const { REPEATING_GROUP_IMPORT_WRITERS } = await import('../reports/computed-fields/registry');
    const calls: unknown[][] = [];
    const qr = { query: jest.fn((sql: string, params: unknown[]) => { calls.push(params); return Promise.resolve([]); }) } as any;
    await REPEATING_GROUP_IMPORT_WRITERS['projects.tracks'](qr, 't', 'p', [{ trackName: 'Faixa', instrumental: 'Sim', trackLanguage: 'Português' }]);
    expect(calls[0]).toEqual(expect.arrayContaining(['yes', 'pt']));
  });

  it('the DTO maps tracks and the deprecated musicas BEFORE validation (global ValidationPipe)', async () => {
    const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
    const dto = (await pipe.transform({ title: 'P', type: 'ep', tracks: [{ name: 'A', instrumental: 'nao', language: 'portugues' }], musicas: [{ instrumental: 'sim' }] }, { type: 'body', metatype: CreateProjectDto })) as CreateProjectDto;
    expect(dto.tracks).toEqual([{ name: 'A', instrumental: 'no', language: 'pt' }]);
    expect(dto.musicas).toEqual([{ instrumental: 'yes' }]);
  });
});

describe('project type / solo-feat / original-remix PT-BR labels', () => {
  it.each([
    ['single', 'Single'], ['ep', 'EP'], ['album', 'Álbum'],
  ])('projectType %s <-> %s', (canonical, label) => {
    expect(PROJECT_TYPE_LABELS_PT_BR[canonical]).toBe(label);
    expect(projectTypeFromCell(label)).toBe(canonical);
    expect(projectTypeFromCell(`  ${label.toUpperCase()} `)).toBe(canonical);
    expect(projectTypeFromCell(canonical)).toBe(canonical);
  });

  it.each([['solo', 'Solo'], ['feat', 'Feat']])('soloFeat %s <-> %s', (canonical, label) => {
    expect(projectTrackSoloFeatLabel(canonical)).toBe(label);
    expect(projectTrackSoloFeatFromCell(label)).toBe(canonical);
    expect(projectTrackSoloFeatFromCell(` ${label.toLowerCase()} `)).toBe(canonical);
  });

  it.each([['original', 'Original'], ['remix', 'Remix']])('originalRemix %s <-> %s', (canonical, label) => {
    expect(projectTrackOriginalRemixLabel(canonical)).toBe(label);
    expect(projectTrackOriginalRemixFromCell(label)).toBe(canonical);
    expect(projectTrackOriginalRemixFromCell(canonical)).toBe(canonical);
  });

  it('unknown text and non-strings are unchanged; import rows map the cells back', () => {
    expect(projectTypeFromCell('Coletânea')).toBe('Coletânea');
    expect(projectTrackSoloFeatLabel('x')).toBe('x');
    expect(projectTrackSoloFeatFromCell(null)).toBeNull();
    expect(projectTrackSoloFeatLabel(Object.prototype.toString.name)).toBe('toString');
    expect(canonicalProjectTrackImportRows([{ soloFeat: 'Feat', originalRemix: 'Remix' }])).toEqual([{ soloFeat: 'feat', originalRemix: 'remix' }]);
  });
});
