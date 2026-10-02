import 'reflect-metadata';
import { ArtistsService } from './artists.service';
import { ARTIST_DEPRECATED_FIELDS, ARTIST_DEPRECATED_ORDER_BY, ARTIST_NESTED_DEPRECATED_KEYS, LEGACY_ARTIST_VALUES, LEGACY_DISTRIBUTOR_IDS, canonicalArtistNestedColumn, canonicalizeArtistInput, canonicalizeArtistQuery } from './artist-legacy-fields';

/**
 * Contract of the deprecated (pre-CZ-042 Portuguese) artist input: every alias, legacy value,
 * nested jsonb key and orderBy value is pinned literally and exercised through the real
 * canonicalizer. Dropping or retargeting an alias fails here.
 */
const canon = (input: Record<string, unknown>, options?: { update?: boolean }) => canonicalizeArtistInput(input, options) as Record<string, any>;

const DEPRECATED_FIELDS: Array<[string, string]> = [
  ['nome_artistico', 'stage_name'],
  ['nome_civil', 'full_name'],
  ['foto_url', 'photo_url'],
  ['galeria_urls', 'gallery_urls'],
  ['especialidades', 'specialties'],
  ['documentos_pessoais_url', 'personal_documents_url'],
  ['presskit_url', 'press_kit_url'],
  ['data_nascimento', 'birth_date'],
  ['endereco', 'address'],
  ['telefone', 'phone'],
  ['banco', 'bank_name'],
  ['agencia', 'bank_branch'],
  ['conta', 'bank_account'],
  ['chave_pix', 'pix_key'],
  ['titular_conta', 'account_holder'],
  ['tipo_perfil', 'profile_type'],
  ['slug_artistico', 'artist_slug'],
  ['tags_musicais', 'music_tags'],
  ['fase_carreira', 'career_stage'],
  ['relacionamentos', 'relationships'],
  ['empresario_id', 'agent_id'],
  ['empresario_nome', 'agent_name'],
  ['empresario_telefone', 'agent_phone'],
  ['empresario_email', 'agent_email'],
  ['gravadora_id', 'record_label_id'],
  ['gravadora_nome', 'record_label_name'],
  ['gravadora_telefone', 'record_label_phone'],
  ['gravadora_email', 'record_label_email'],
  ['gravadora_responsavel_id', 'record_label_contact_id'],
  ['gravadora_responsavel_nome', 'record_label_contact_name'],
  ['gravadora_responsavel_telefone', 'record_label_contact_phone'],
  ['gravadora_responsavel_email', 'record_label_contact_email'],
  ['distribuidoras_selecionadas', 'selected_distributors'],
  ['distribuidoras_emails', 'distributor_emails'],
  ['distribuidoras_empresa_selecionadas', 'company_selected_distributors'],
  ['distribuidoras_empresa_emails', 'company_distributor_emails'],
  ['distribuidoras_gerais', 'general_distributors'],
  ['contatos_vinculados', 'linked_contacts'],
  ['contatos_equipe', 'team_contacts'],
  ['notas_internas', 'internal_notes'],
  ['manager_nome', 'manager_name'],
  ['manager_contato', 'manager_contact'],
  ['produtor_executivo', 'executive_producer'],
  ['agencia_booking', 'booking_agency'],
  ['label_parceira', 'partner_label'],
  ['contrato_id', 'contract_id'],
  ['genero', 'gender'],
  ['spotify_ouvintes', 'spotify_listeners'],
  ['youtube_inscritos', 'youtube_subscribers'],
  ['deezer_fas', 'deezer_fans'],
  ['apple_music_albuns_url', 'apple_music_albums'],
  ['soundcloud_seguidores_url', 'soundcloud_followers'],
  ['instagram_seguidores', 'instagram_followers'],
  ['tiktok_seguidores', 'tiktok_followers'],
];
const METADATA_ONLY_CANONICAL = new Set(['apple_music_albums','deezer_fans','gender','instagram_followers','soundcloud_followers','spotify_listeners','tiktok_followers','youtube_subscribers']);

describe('artist deprecated field aliases (literal table)', () => {
  it('the production alias table equals the literal table', () => {
    expect(Object.entries(ARTIST_DEPRECATED_FIELDS).sort()).toEqual([...DEPRECATED_FIELDS].sort());
  });

  it.each(DEPRECATED_FIELDS)('%s -> %s: moved to the canonical key, deprecated key never survives', (legacy, canonical) => {
    const out = canonicalizeArtistInput({ [legacy]: 'v' }) as Record<string, unknown>;
    expect(out[canonical]).toBe('v');
    expect(legacy in out).toBe(false);
  });

  it.each(DEPRECATED_FIELDS)('%s -> %s: canonical key wins and an empty deprecated value never wipes it', (legacy, canonical) => {
    const wins = canonicalizeArtistInput({ [legacy]: 'old', [canonical]: 'new' }) as Record<string, unknown>;
    expect(wins[canonical]).toBe('new');
    expect(legacy in wins).toBe(false);
    const blank = canonicalizeArtistInput({ [legacy]: '', [canonical]: 'kept' }) as Record<string, unknown>;
    expect(blank[canonical]).toBe('kept');
    expect(canonicalizeArtistInput({ [legacy]: null }) as object).not.toHaveProperty(canonical);
  });

  it('negative: canonical-only input and unknown keys pass through untouched', () => {
    expect(canonicalizeArtistInput({ stage_name: 'A', whatever: 1 })).toEqual({ stage_name: 'A', whatever: 1 });
  });

  it('metadata-only legacy keys are also renamed inside metadata, and unknown legacy metadata keys are not promoted', () => {
    const out = canonicalizeArtistInput({ metadata: { genero: 'feminino', spotify_ouvintes: 10, instagram_seguidores: 5, nome_artistico: 'X' } }) as { metadata: Record<string, unknown> };
    expect(out.metadata).toEqual({ gender: 'female', spotify_listeners: 10, instagram_followers: 5, nome_artistico: 'X' });
    for (const canonical of METADATA_ONLY_CANONICAL) expect(Object.values(ARTIST_DEPRECATED_FIELDS)).toContain(canonical);
  });
});

describe('artist deprecated values (literal table)', () => {
  const VALUES: Array<['specialties' | 'profile_type' | 'relationship_type' | 'gender', string, string]> = [
    ['specialties', 'dj_produtor', 'dj_producer'], ['specialties', 'compositor_autor', 'songwriter'],
    ['specialties', 'interprete', 'performer'], ['specialties', 'produtor', 'producer'],
    ['profile_type', 'independente', 'independent'], ['profile_type', 'com_empresario', 'managed'],
    ['profile_type', 'gravadora', 'record_label'], ['profile_type', 'editora', 'publisher'],
    ['relationship_type', 'empresario', 'agent'], ['relationship_type', 'gravadora', 'record_label'],
    ['relationship_type', 'editora', 'publisher'], ['relationship_type', 'juridico', 'legal'],
    ['relationship_type', 'financeiro', 'finance'], ['relationship_type', 'contador', 'accountant'],
    ['relationship_type', 'assessoria', 'press_office'],
    ['gender', 'masculino', 'male'], ['gender', 'feminino', 'female'],
  ];

  it('the production value maps equal the literal table', () => {
    const fromMap = Object.entries(LEGACY_ARTIST_VALUES).flatMap(([k, m]) => Object.entries(m).map(([l, c]) => [k, l, c]));
    expect(fromMap.sort()).toEqual([...VALUES].sort());
  });

  it.each(VALUES)('%s: %s -> %s through canonicalizeArtistInput (case-insensitive)', (kind, legacy, canonical) => {
    const upper = ` ${legacy.toUpperCase()} `;
    if (kind === 'specialties') {
      expect(canon({ especialidades: [legacy, upper, 'dj'] }).specialties).toEqual([canonical, canonical, 'dj']);
    } else if (kind === 'profile_type') {
      expect(canon({ tipo_perfil: upper }).profile_type).toBe(canonical);
      expect(canon({ profile_type: legacy }).profile_type).toBe(canonical);
    } else if (kind === 'gender') {
      expect(canon({ gender: upper }).gender).toBe(canonical);
    } else {
      const out = canonicalizeArtistInput({ relationships: [{ nome: 'N', type: upper }] }) as { relationships: Array<Record<string, unknown>> };
      expect(out.relationships).toEqual([{ name: 'N', type: canonical }]);
    }
  });

  it('negative: unknown values are kept (never guessed) so the validator rejects them', () => {
    expect(canon({ tipo_perfil: 'banana' }).profile_type).toBe('banana');
    expect(canon({ gender: 'x' }).gender).toBe('x');
  });
});

describe('artist nested keys, distributor ids and orderBy', () => {
  const NESTED: Array<[string, string]> = [
    ['nome', 'name'], ['telefone', 'phone'], ['escritorio', 'office'], ['responsaveis', 'responsibles'],
    ['distribuidoras', 'distributors'], ['nomeCustom', 'customName'], ['categoria', 'category'],
  ];

  it('nested alias table equals the literal table', () => {
    expect(Object.entries(ARTIST_NESTED_DEPRECATED_KEYS).sort()).toEqual([...NESTED].sort());
  });

  it.each(NESTED)('nested %s -> %s (recursively, in every nested jsonb column)', (legacy, canonical) => {
    for (const column of ['relationships', 'linked_contacts', 'team_contacts', 'general_distributors', 'documents']) {
      const out = canonicalArtistNestedColumn(column, [{ [legacy]: 'v', inner: [{ [legacy]: 'w' }] }]) as Array<Record<string, unknown>>;
      expect(out[0][canonical]).toBe('v');
      expect(legacy in out[0]).toBe(false);
      expect((out[0].inner as Array<Record<string, unknown>>)[0][canonical]).toBe('w');
    }
  });

  it('the legacy distributor id outros -> other in general_distributors and nested distributors lists; other ids untouched', () => {
    expect({ ...LEGACY_DISTRIBUTOR_IDS }).toEqual({ outros: 'other' });
    expect(canonicalArtistNestedColumn('general_distributors', [{ id: 'outros' }, { id: 'distrokid' }])).toEqual([{ id: 'other' }, { id: 'distrokid' }]);
    expect(canonicalArtistNestedColumn('team_contacts', [{ distribuidoras: [{ id: 'outros' }] }])).toEqual([{ distributors: [{ id: 'other' }] }]);
  });

  it('orderBy deprecated values map to canonical columns; others pass through', () => {
    expect({ ...ARTIST_DEPRECATED_ORDER_BY }).toEqual({ nome_artistico: 'stage_name', status_cadastro: 'registration_status' });
    expect(canonicalizeArtistQuery({ orderBy: 'nome_artistico' })).toEqual({ orderBy: 'stage_name' });
    expect(canonicalizeArtistQuery({ orderBy: 'status_cadastro' })).toEqual({ orderBy: 'registration_status' });
    expect(canonicalizeArtistQuery({ orderBy: 'created_at' })).toEqual({ orderBy: 'created_at' });
    expect(canonicalizeArtistQuery({ orderBy: 'constructor' })).toEqual({ orderBy: 'constructor' });
  });

  it('on update, unreadable legacy edit values (empty lists/maps, false, default tipo_perfil) are dropped instead of wiping data', () => {
    const out = canonicalizeArtistInput({ especialidades: [], tipo_perfil: 'independente', relacionamentos: [], nome_artistico: 'Keep' }, { update: true }) as Record<string, unknown>;
    expect(out).toEqual({ stage_name: 'Keep' });
    const create = canonicalizeArtistInput({ tipo_perfil: 'independente' }) as Record<string, unknown>;
    expect(create.profile_type).toBe('independent');
  });
});

describe('artist list: deprecated `vinculo` query alias behaves exactly like `relationship`', () => {
  async function whereClauses(query: Record<string, unknown>): Promise<string[]> {
    const calls: string[] = [];
    const qb: Record<string, jest.Mock> = {};
    for (const m of ['where', 'andWhere']) qb[m] = jest.fn((sql: string) => { calls.push(String(sql)); return qb; });
    for (const m of ['orderBy', 'addOrderBy', 'skip', 'take']) qb[m] = jest.fn(() => qb);
    qb.getManyAndCount = jest.fn(async () => [[], 0]);
    const repo = { createQueryBuilder: jest.fn(() => qb) };
    const ds = { getRepository: () => repo, query: jest.fn(async () => []) };
    const service = new ArtistsService(ds as never, {} as never, {} as never, {} as never);
    await service.list('t1', query as never);
    return calls;
  }

  it.each(['exclusive', 'partner', 'independent'])('vinculo=%s produces the same filter as relationship=%s', async (value) => {
    const viaAlias = await whereClauses({ vinculo: value });
    const viaCanonical = await whereClauses({ relationship: value });
    expect(viaAlias).toEqual(viaCanonical);
    expect(viaAlias.length).toBeGreaterThan(2); // tenant + deleted_at + the relationship EXISTS filter
  });

  it('canonical relationship wins over the deprecated vinculo; no filter without either', async () => {
    expect(await whereClauses({ relationship: 'independent', vinculo: 'exclusive' })).toEqual(await whereClauses({ relationship: 'independent' }));
    expect(await whereClauses({})).toHaveLength(2);
  });
});
