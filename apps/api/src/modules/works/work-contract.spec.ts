import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CreateWorkDto } from './dto/create-work.dto';
import { QueryWorkDto } from './dto/query-work.dto';
import {
  LANGUAGE_LABEL_TO_CODE,
  LEGACY_WORK_VALUES,
  WORK_AI_ELEMENT_DEPRECATED_FIELDS,
  WORK_DEPRECATED_FIELDS,
  WORK_PARTICIPANT_DEPRECATED_FIELDS,
  canonicalWorkParticipantRole,
  canonicalizeWorkInput,
  canonicalizeWorkQuery,
} from './work-legacy-fields';

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

  it('maps the pre-CZ-039 query values still in use (tipo_obra, no-projeto)', () => {
    expect(errorsFor(QueryWorkDto, { tipo_obra: 'autoral', ecad: 'with_code', project_id: 'no-projeto' })).toEqual([]);
    expect(canonicalizeWorkQuery({ tipo_obra: 'autoral', ecad: 'without_code', project_id: 'no-projeto' }))
      .toEqual({ work_origin: 'original', ecad: 'without_code', project_id: 'none' });
  });

  it('rejects the removed com-ecad / sem-ecad query values (no live consumer)', () => {
    expect(errorsFor(QueryWorkDto, { ecad: 'com-ecad' })).not.toEqual([]);
    expect(errorsFor(QueryWorkDto, { ecad: 'sem-ecad' })).not.toEqual([]);
  });
});

// ─── Exhaustive pins of every legacy name of work-legacy-fields.ts (explicit static tables, not derived from the module) ───
type Json = Record<string, unknown>;
const canon = (input: Json, options: { update?: boolean } = {}): Json => canonicalizeWorkInput(input, options);
const parts = (out: Json): Json[] => out['participants'] as Json[];
type Row2 = ReadonlyArray<readonly [string, string]>;
type Row3 = ReadonlyArray<readonly [string, string, string]>;
const X_WORK_FIELDS: Row2 = [
  ['compositor', 'composer_name'],
  ['compositores', 'composer_names'],
  ['editora', 'publisher_name'],
  ['cod_entidade', 'society_code'],
  ['cod_ecad', 'ecad_code'],
  ['tipo_ia', 'ai_usage_level'],
  ['ia_harmonia', 'ai_harmony'],
  ['ia_melodia', 'ai_melody'],
  ['ia_letra', 'ai_lyrics'],
  ['referencias_conexas', 'related_references'],
  ['letristas', 'translator_names'],
  ['tipo_obra', 'work_origin'],
  ['participantes', 'participants'],
  ['idioma', 'language'],
  ['instrumental', 'is_instrumental'],
  ['criada_por_ia', 'ai_used'],
  ['outros_titulos', 'alternative_titles'],
  ['letra_completa', 'lyrics'],
];

const X_WORK_PARTICIPANT_KEYS: Row2 = [
  ['classeFuncao', 'role'],
  ['percentual', 'percentage'],
  ['nome', 'name'],
];

const X_WORK_AI_ELEMENT_KEYS: Row2 = [
  ['ferramenta', 'tool'],
];

const X_WORK_PARTICIPANT_ROLES: Row2 = [
  ['editor', 'publisher'],
  ['administrador', 'administrator'],
  ['compositor/autor', 'composer_author'],
  ['tradutor', 'translator'],
  ['não_informado', 'unspecified'],
];

/** [canonical column, legacy value, canonical value] */
const X_WORK_VALUES: Row3 = [
  ['work_origin', 'autoral', 'original'],
  ['work_origin', 'referencia', 'reference'],
  ['ai_usage_level', 'totalmente', 'full'],
  ['ai_usage_level', 'parcialmente', 'partial'],
  ['type', 'composicao', 'composition'],
  ['type', 'outro', 'other'],
];

const X_WORK_LANGUAGES: Row2 = [
  ['Alemão', 'de'],
  ['Amárico', 'am'],
  ['Árabe', 'ar'],
  ['Bengali', 'bn'],
  ['Chinês Mandarim', 'zh'],
  ['Coreano', 'ko'],
  ['Dinamarquês', 'da'],
  ['Espanhol', 'es'],
  ['Finlandês', 'fi'],
  ['Francês', 'fr'],
  ['Grego', 'el'],
  ['Hebraico', 'he'],
  ['Hindi', 'hi'],
  ['Holandês', 'nl'],
  ['Indonésio', 'id'],
  ['Inglês', 'en'],
  ['Iorubá', 'yo'],
  ['Italiano', 'it'],
  ['Japonês', 'ja'],
  ['Latim', 'la'],
  ['Malaio', 'ms'],
  ['Norueguês', 'no'],
  ['Persa', 'fa'],
  ['Polonês', 'pl'],
  ['Português', 'pt'],
  ['Punjabi', 'pa'],
  ['Russo', 'ru'],
  ['Suaíli', 'sw'],
  ['Sueco', 'sv'],
  ['Tailandês', 'th'],
  ['Tamil', 'ta'],
  ['Telugu', 'te'],
  ['Turco', 'tr'],
  ['Ucraniano', 'uk'],
  ['Urdu', 'ur'],
  ['Vietnamita', 'vi'],
  ['Zulu', 'zu'],
  ['Cantonês', 'yue'],
  ['Filipino', 'fil'],
  ['Multilíngue', 'mul'],
  ['Instrumental (Sem Letra)', 'zxx'],
  ['Outro', 'und'],
];

const X_WORK_QUERY_PROJECT_VALUES: Row2 = [['no-projeto', 'none'], ['sem-projeto', 'none']];

describe('work legacy names: every deprecated field, nested key and value, one by one', () => {
  it('the exported alias table declares exactly the expected pairs', () => {
    expect({ ...WORK_DEPRECATED_FIELDS }).toEqual(Object.fromEntries(X_WORK_FIELDS));
    expect({ ...WORK_PARTICIPANT_DEPRECATED_FIELDS }).toEqual(Object.fromEntries(X_WORK_PARTICIPANT_KEYS));
    expect({ ...WORK_AI_ELEMENT_DEPRECATED_FIELDS }).toEqual(Object.fromEntries(X_WORK_AI_ELEMENT_KEYS));
    expect({ ...LANGUAGE_LABEL_TO_CODE }).toEqual(Object.fromEntries(X_WORK_LANGUAGES));
  });

  // idioma and instrumental carry a VALUE conversion on top of the rename; their legacy-only sample is a convertible value.
  const SAMPLE: Record<string, [unknown, unknown]> = {
    idioma: ['Português', 'pt'],
    instrumental: ['sim', true],
  };

  it.each(X_WORK_FIELDS)('field %s -> %s: legacy-only moves (value converted where applicable), the CANONICAL value wins when both are sent, the legacy key is removed', (legacy, canonical) => {
    const [legacyValue, expected] = SAMPLE[legacy] ?? ['legacy-value', 'legacy-value'];
    const only = canon({ [legacy]: legacyValue });
    expect(only[canonical]).toEqual(expected);
    expect(only).not.toHaveProperty(legacy);
    const canonicalValue = legacy === 'instrumental' ? false : legacy === 'idioma' ? 'en' : 'canonical-value';
    const both = canon({ [legacy]: legacyValue, [canonical]: canonicalValue });
    expect(both[canonical]).toEqual(canonicalValue);
    expect(both).not.toHaveProperty(legacy);
  });

  it('instrumental: the legacy negative flag -> false, any other text -> null', () => {
    expect(canon({ instrumental: 'nao' })).toEqual({ is_instrumental: false });
    expect(canon({ instrumental: 'talvez' })).toEqual({ is_instrumental: null });
  });

  it.each(X_WORK_LANGUAGES)('idioma label %s -> ISO code %s; an unknown label is kept', (label, code) => {
    expect(canon({ idioma: label })).toEqual({ language: code });
    expect(canon({ idioma: `${label}?` })).toEqual({ language: `${label}?` });
  });

  it.each(X_WORK_PARTICIPANT_KEYS)('participant key %s -> %s: legacy-only moves, canonical wins when both are present', (legacy, canonical) => {
    const only = canon({ participantes: [{ [legacy]: 'legacy-value' }] });
    expect(parts(only)[0][canonical]).toBe('legacy-value');
    expect(parts(only)[0]).not.toHaveProperty(legacy);
    const both = canon({ participantes: [{ [legacy]: 'legacy-value', [canonical]: 'canonical-value' }] });
    expect(parts(both)[0][canonical]).toBe('canonical-value');
    expect(parts(both)[0]).not.toHaveProperty(legacy);
  });

  it('participantes -> participants: the canonical participants list wins when both are sent', () => {
    expect(canon({ participantes: [{ name: 'old' }], participants: [{ name: 'new' }] })).toEqual({ participants: [{ name: 'new' }] });
  });

  it.each(X_WORK_AI_ELEMENT_KEYS)('AI element key %s -> %s in ai_harmony / ai_melody / ai_lyrics (canonical wins when both)', (legacy, canonical) => {
    for (const column of ['ai_harmony', 'ai_melody', 'ai_lyrics']) {
      const only = canon({ [column]: { [legacy]: 'legacy-value' } });
      expect(only[column]).toEqual({ [canonical]: 'legacy-value' });
      const both = canon({ [column]: { [legacy]: 'legacy-value', [canonical]: 'canonical-value' } });
      expect(both[column]).toEqual({ [canonical]: 'canonical-value' });
    }
  });

  it.each(X_WORK_PARTICIPANT_ROLES)('participant role %s -> %s (case-insensitive, in canonicalizeWorkInput and canonicalWorkParticipantRole); the canonical role is unchanged', (legacy, canonical) => {
    expect(canonicalWorkParticipantRole(legacy)).toBe(canonical);
    expect(canonicalWorkParticipantRole(legacy.toUpperCase())).toBe(canonical);
    expect(canonicalWorkParticipantRole(canonical)).toBe(canonical);
    const out = canon({ participantes: [{ classeFuncao: legacy }] });
    expect(parts(out)[0]['role']).toBe(canonical);
  });

  it('participant role: blank -> unspecified; unknown text is kept', () => {
    expect(canonicalWorkParticipantRole('  ')).toBe('unspecified');
    expect(canonicalWorkParticipantRole(undefined)).toBe('unspecified');
    expect(canonicalWorkParticipantRole('Produtor Executivo')).toBe('Produtor Executivo');
  });

  it.each(X_WORK_VALUES)('column %s: legacy value %s -> %s; the canonical value is unchanged; also exported in LEGACY_WORK_VALUES', (column, legacy, canonical) => {
    expect(canon({ [column]: legacy })).toEqual({ [column]: canonical });
    expect(canon({ [column]: canonical })).toEqual({ [column]: canonical });
    expect((LEGACY_WORK_VALUES as Record<string, Record<string, string>>)[column][legacy]).toBe(canonical);
  });

  it.each(X_WORK_VALUES.filter(([column]) => column === 'work_origin'))('query value of work_origin %s -> %s, and tipo_obra is the legacy query key of work_origin', (_c, legacy, canonical) => {
    expect(canonicalizeWorkQuery({ work_origin: legacy })).toEqual({ work_origin: canonical });
    expect(canonicalizeWorkQuery({ tipo_obra: legacy })).toEqual({ work_origin: canonical });
    expect(canonicalizeWorkQuery({ tipo_obra: legacy, work_origin: 'reference' })).toEqual({ work_origin: 'reference' });
  });

  it.each(X_WORK_QUERY_PROJECT_VALUES)('query project_id %s -> %s; other values are kept', (legacy, canonical) => {
    expect(canonicalizeWorkQuery({ project_id: legacy })).toEqual({ project_id: canonical });
    expect(canonicalizeWorkQuery({ project_id: 'a-real-uuid' })).toEqual({ project_id: 'a-real-uuid' });
  });

  it('on UPDATE the keys a pre-CZ-039 edit always sends with unreadable defaults are dropped, never written over the stored data', () => {
    const out = canon(
      { criada_por_ia: false, instrumental: 'nao', tipo_obra: 'referencia', participantes: [], other_field: 'x' },
      { update: true },
    );
    expect(out).toEqual({ other_field: 'x' });
    // a non-empty legacy participant list is still honoured on update
    expect(canon({ participantes: [{ nome: 'A' }] }, { update: true })).toEqual({ participants: [{ name: 'A' }] });
    // ...and the same keys are kept on CREATE
    expect(canon({ criada_por_ia: false, tipo_obra: 'referencia', participantes: [] })).toEqual({ ai_used: false, work_origin: 'reference', participants: [] });
  });
});
