import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CreateWorkDto } from './dto/create-work.dto';
import { QueryWorkDto } from './dto/query-work.dto';
import { WORK_DEPRECATED_FIELDS, canonicalizeWorkInput, canonicalizeWorkQuery } from './work-legacy-fields';

/**
 * CZ-039: work fields, values, participant keys/roles and query values are
 * English. LEGACY_WEB_WORK is the payload a pre-CZ-039 web build sends; it must
 * validate and map to the canonical contract (the Portuguese duplicates of the
 * registry fields land on the registry column, the single source of truth).
 */
const errorsFor = (dto: new () => object, plain: Record<string, unknown>) =>
  validateSync(plainToInstance(dto, plain, { enableImplicitConversion: true }), {
    whitelist: true,
    forbidNonWhitelisted: true,
  }).map((e) => e.property);

const LEGACY_WEB_WORK = {
  title: 'Minha Obra',
  idioma: 'Português',
  cod_ecad: 'ECAD-1',
  cod_entidade: 'ABR-1',
  instrumental: 'nao',
  criada_por_ia: true,
  tipo_ia: 'parcialmente',
  ia_harmonia: { ferramenta: 'Suno', prompt: 'p1' },
  ia_melodia: null,
  ia_letra: { ferramenta: 'GPT', prompt: 'p3' },
  outros_titulos: ['Alt'],
  referencias_conexas: ['Ref'],
  letra_completa: 'la la',
  participantes: [
    { id: 'p1', name: 'Fulano', classeFuncao: 'compositor/autor', link: '', percentual: '60' },
    { id: 'p2', name: 'Beltrano', classeFuncao: 'Tradutor', link: '', percentual: '40' },
  ],
  compositores: ['Fulano'],
  letristas: ['Beltrano'],
  tipo_obra: 'autoral',
};

describe('Work request contract (CZ-039)', () => {
  it('the pre-CZ-039 web payload validates', () => {
    expect(errorsFor(CreateWorkDto, LEGACY_WEB_WORK)).toEqual([]);
  });

  it('rejects unknown work_origin / ai_usage_level values', () => {
    expect(errorsFor(CreateWorkDto, { title: 'x', work_origin: 'musica' })).toContain('work_origin');
    expect(errorsFor(CreateWorkDto, { title: 'x', ai_usage_level: 'sometimes' })).toContain('ai_usage_level');
  });

  it('maps the pre-CZ-039 payload to canonical names, values and nested keys', () => {
    const out = canonicalizeWorkInput(LEGACY_WEB_WORK) as Record<string, unknown>;
    expect(out).toMatchObject({
      language: 'pt', ecad_code: 'ECAD-1', society_code: 'ABR-1', is_instrumental: false, ai_used: true,
      ai_usage_level: 'partial',
      ai_harmony: { tool: 'Suno', prompt: 'p1' }, ai_lyrics: { tool: 'GPT', prompt: 'p3' },
      alternative_titles: ['Alt'], related_references: ['Ref'], lyrics: 'la la',
      composer_names: ['Fulano'], translator_names: ['Beltrano'], work_origin: 'original',
      participants: [
        { id: 'p1', name: 'Fulano', role: 'composer_author', link: '', percentage: '60' },
        { id: 'p2', name: 'Beltrano', role: 'translator', link: '', percentage: '40' },
      ],
    });
    for (const legacy of Object.keys(WORK_DEPRECATED_FIELDS)) expect(out).not.toHaveProperty(legacy);
    // An empty value under a deprecated name never clears the canonical field
    // (deploy-skew protection, applyDeprecatedFieldAliases).
    expect(out).not.toHaveProperty('ai_melody');
  });

  it('maps the language labels that have no ISO 639-1 code to the ISO 639-2 special codes', () => {
    expect(canonicalizeWorkInput({ idioma: 'Instrumental (Sem Letra)' })).toEqual({ language: 'zxx' });
    expect(canonicalizeWorkInput({ idioma: 'Outro' })).toEqual({ language: 'und' });
  });

  it('the canonical field wins over its deprecated alias', () => {
    expect(canonicalizeWorkInput({ language: 'en', idioma: 'Português' })).toEqual({ language: 'en' });
    expect(canonicalizeWorkInput({ is_instrumental: true, instrumental: 'nao' })).toEqual({ is_instrumental: true });
  });

  it('an EDIT from a pre-CZ-039 build never overwrites data it could not read (form defaults, empty participants)', () => {
    // What the old build sends after reading a canonical response: its defaults for the fields it no longer finds.
    const oldBuildEdit = { title: 'Novo título', criada_por_ia: false, instrumental: 'nao', tipo_obra: 'referencia', participantes: [] };
    const out = canonicalizeWorkInput(oldBuildEdit, { update: true }) as Record<string, unknown>;
    expect(out).toEqual({ title: 'Novo título' });
    // On create the same values are the user's explicit choices and are kept.
    expect(canonicalizeWorkInput(oldBuildEdit)).toMatchObject({ ai_used: false, is_instrumental: false, work_origin: 'reference' });
  });

  it('maps the pre-CZ-039 query values', () => {
    expect(errorsFor(QueryWorkDto, { tipo_obra: 'autoral', ecad: 'com-ecad', project_id: 'no-projeto' })).toEqual([]);
    expect(canonicalizeWorkQuery({ tipo_obra: 'autoral', ecad: 'sem-ecad', project_id: 'no-projeto' }))
      .toEqual({ work_origin: 'original', ecad: 'without_code', project_id: 'none' });
  });
});
