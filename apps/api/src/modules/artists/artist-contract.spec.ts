import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CreateArtistDto } from './dto/create-artist.dto';
import { UpdateArtistDto } from './dto/update-artist.dto';
import { ArtistsService } from './artists.service';
import {
  ARTIST_DEPRECATED_FIELDS,
  ARTIST_METADATA_ONLY_FIELDS,
  canonicalizeArtistInput,
  canonicalizeArtistQuery,
} from './artist-legacy-fields';

/**
 * CZ-042: artist fields, values and nested jsonb keys are English; every form
 * field has its own column (single source of truth). LEGACY_WEB_ARTIST is the
 * payload a pre-CZ-042 web build sends; it must validate, land on the canonical
 * columns, and the response must carry no Portuguese key and no ciphertext.
 */
const errorsFor = (dto: new () => object, plain: Record<string, unknown>) =>
  validateSync(plainToInstance(dto, plain), { whitelist: true, forbidNonWhitelisted: true }).map((e) => e.property);

const CONTRACT_ID = '5f0c3c52-4a8e-4a39-9d51-2b7a2a4ac001';

const LEGACY_WEB_ARTIST = {
  nome_artistico: 'MC Aurora',
  nome_civil: 'Aurora da Silva',
  music_genre: 'Funk',
  foto_url: 'https://cdn.example.com/a.png',
  galeria_urls: ['https://cdn.example.com/g1.png'],
  especialidades: ['dj', 'dj_produtor', 'compositor_autor', 'interprete', 'produtor'],
  documentos_pessoais_url: 'https://cdn.example.com/docs.pdf',
  presskit_url: 'https://cdn.example.com/press.pdf',
  data_nascimento: '1995-04-20',
  rg: '12.345.678-9',
  endereco: 'Rua A, 1',
  email: 'aurora@example.com',
  telefone: '+55 11 99999-0000',
  cpf_cnpj: '123.456.789-00',
  banco: 'Banco X',
  agencia: '0001',
  conta: '12345-6',
  chave_pix: 'aurora@pix',
  titular_conta: 'Aurora da Silva',
  tipo_perfil: 'com_empresario',
  slug_artistico: 'mc-aurora',
  tags_musicais: ['funk', 'pop'],
  fase_carreira: 'emergente',
  relacionamentos: [{
    type: 'empresario', nome: 'Beto', telefone: '11', email: 'b@x.com', escritorio: 'Escritório B', crc: '',
    responsaveis: [{ nome: 'Carla', telefone: '12', email: 'c@x.com' }],
    distribuidoras: [{ id: 'd1', nomeCustom: 'Distro Própria' }],
  }],
  empresario_id: 'c-1', empresario_nome: 'Beto', empresario_telefone: '11', empresario_email: 'b@x.com',
  gravadora_id: 'c-2', gravadora_nome: 'Selo Z', gravadora_telefone: '21', gravadora_email: 'z@x.com',
  gravadora_responsavel_id: 'c-3', gravadora_responsavel_nome: 'Dani',
  gravadora_responsavel_telefone: '31', gravadora_responsavel_email: 'd@x.com',
  distribuidoras_selecionadas: { onerpm: true },
  distribuidoras_emails: { onerpm: 'o@x.com' },
  distribuidoras_empresa_selecionadas: { believe: true },
  distribuidoras_empresa_emails: { believe: 'b@x.com' },
  distribuidoras_gerais: [{ id: 'g1', nomeCustom: 'Outra' }],
  contatos_vinculados: [{ contactId: 'c-9', distribuidoras: [{ id: 'd2' }] }],
  contatos_equipe: [{ nome: 'Eva', categoria: 'produção', telefone: '41', email: 'e@x.com', distribuidoras: [] }],
  notas_internas: 'nota interna',
  manager_nome: 'Fábio',
  manager_contato: 'fabio@x.com',
  produtor_executivo: 'Gil',
  agencia_booking: 'Booking H',
  label_parceira: 'Selo I',
  contrato_id: CONTRACT_ID,
  genero: 'Feminino',
  instagram_url: 'https://www.instagram.com/mcaurora',
  spotify_ouvintes: 1000,
  youtube_inscritos: 2000,
  deezer_fas: 30,
  apple_music_albuns_url: 2,
  soundcloud_seguidores_url: 40,
  instagram_seguidores: 5000,
  tiktok_seguidores: 6000,
};

const PT_KEYS = new Set([
  ...Object.keys(ARTIST_DEPRECATED_FIELDS),
  'status_cadastro', 'telefone_encrypted', 'manager_contato_encrypted', 'contrato_id', 'metadata',
]);

function makeService(existing: Record<string, unknown> = {}) {
  const store: { row: Record<string, unknown> } = {
    row: { id: 'artist-1', tenant_id: 't1', status: 'in_negotiation', metadata: {}, ...existing },
  };
  const qb: Record<string, jest.Mock> = {};
  for (const m of ['where', 'andWhere', 'orderBy', 'skip', 'take']) qb[m] = jest.fn(() => qb);
  qb.getOne = jest.fn(async () => ({ ...store.row }));
  const repo = {
    createQueryBuilder: jest.fn(() => qb),
    create: jest.fn((value: Record<string, unknown>) => value),
    save: jest.fn(async (value: Record<string, unknown>) => { store.row = { id: 'artist-1', ...value }; return { ...store.row }; }),
    update: jest.fn(async (_criteria: unknown, updates: Record<string, unknown>) => {
      store.row = { ...store.row, ...updates };
      return { affected: 1 };
    }),
  };
  const ds = { getRepository: jest.fn(() => repo), query: jest.fn(async (sql: string) => (String(sql).startsWith('SELECT 1 FROM "') ? [{ exists: 1 }] : [])) };
  const encryption = {
    encryptNullable: jest.fn((v: string | null | undefined) => (v == null || v === '' ? null : `cipher:${v}`)),
    decryptNullable: jest.fn((v: string | null) => (v == null ? null : v.replace('cipher:', ''))),
  };
  const events = { emitTyped: jest.fn() };
  const planLimit = { enforce: jest.fn().mockResolvedValue(undefined) };
  const service = new ArtistsService(ds as any, encryption as any, events as any, planLimit as any);
  return { service, repo, store, events };
}

describe('Artist request/response contract (CZ-042)', () => {
  it('the pre-CZ-042 web payload validates (deprecated keys are declared)', () => {
    expect(errorsFor(CreateArtistDto, LEGACY_WEB_ARTIST)).toEqual([]);
    expect(errorsFor(UpdateArtistDto, LEGACY_WEB_ARTIST)).toEqual([]);
  });

  it('keys outside the contract are still rejected (the pipe stays strict)', () => {
    expect(errorsFor(CreateArtistDto, { stage_name: 'x', status_cadastro: 'active' })).toContain('status_cadastro');
    expect(errorsFor(CreateArtistDto, { stage_name: 'x', tipo_pessoa: 'pf' })).toContain('tipo_pessoa');
  });

  it('maps the pre-CZ-042 payload to canonical names, values and nested keys', () => {
    const out = canonicalizeArtistInput(LEGACY_WEB_ARTIST) as Record<string, unknown>;
    expect(out).toMatchObject({
      stage_name: 'MC Aurora', full_name: 'Aurora da Silva', photo_url: 'https://cdn.example.com/a.png',
      gallery_urls: ['https://cdn.example.com/g1.png'],
      specialties: ['dj', 'dj_producer', 'songwriter', 'performer', 'producer'],
      personal_documents_url: 'https://cdn.example.com/docs.pdf', press_kit_url: 'https://cdn.example.com/press.pdf',
      birth_date: '1995-04-20', address: 'Rua A, 1', phone: '+55 11 99999-0000',
      bank_name: 'Banco X', bank_branch: '0001', bank_account: '12345-6', pix_key: 'aurora@pix', account_holder: 'Aurora da Silva',
      profile_type: 'managed', artist_slug: 'mc-aurora', music_tags: ['funk', 'pop'], career_stage: 'emergente',
      relationships: [{
        type: 'agent', name: 'Beto', phone: '11', email: 'b@x.com', office: 'Escritório B', crc: '',
        responsibles: [{ name: 'Carla', phone: '12', email: 'c@x.com' }],
        distributors: [{ id: 'd1', customName: 'Distro Própria' }],
      }],
      agent_id: 'c-1', agent_name: 'Beto', agent_phone: '11', agent_email: 'b@x.com',
      record_label_id: 'c-2', record_label_name: 'Selo Z', record_label_phone: '21', record_label_email: 'z@x.com',
      record_label_contact_id: 'c-3', record_label_contact_name: 'Dani',
      record_label_contact_phone: '31', record_label_contact_email: 'd@x.com',
      selected_distributors: { onerpm: true }, distributor_emails: { onerpm: 'o@x.com' },
      company_selected_distributors: { believe: true }, company_distributor_emails: { believe: 'b@x.com' },
      general_distributors: [{ id: 'g1', customName: 'Outra' }],
      linked_contacts: [{ contactId: 'c-9', distributors: [{ id: 'd2' }] }],
      team_contacts: [{ name: 'Eva', category: 'produção', phone: '41', email: 'e@x.com', distributors: [] }],
      internal_notes: 'nota interna', manager_name: 'Fábio', manager_contact: 'fabio@x.com',
      executive_producer: 'Gil', booking_agency: 'Booking H', partner_label: 'Selo I', contract_id: CONTRACT_ID,
      gender: 'female', spotify_listeners: 1000, youtube_subscribers: 2000, deezer_fans: 30,
      apple_music_albums: 2, soundcloud_followers: 40, instagram_followers: 5000, tiktok_followers: 6000,
    });
    for (const legacy of Object.keys(ARTIST_DEPRECATED_FIELDS)) expect(out).not.toHaveProperty(legacy);
  });

  it('the canonical field wins over its deprecated alias; an empty deprecated value is dropped', () => {
    expect(canonicalizeArtistInput({ stage_name: 'A', nome_artistico: 'B' })).toEqual({ stage_name: 'A' });
    expect(canonicalizeArtistInput({ banco: '', telefone: null, genero: undefined })).toEqual({});
  });

  it('maps the pre-CZ-042 orderBy values', () => {
    expect(canonicalizeArtistQuery({ orderBy: 'nome_artistico' })).toEqual({ orderBy: 'stage_name' });
    expect(canonicalizeArtistQuery({ orderBy: 'status_cadastro' })).toEqual({ orderBy: 'registration_status' });
    expect(canonicalizeArtistQuery({ orderBy: 'created_at' })).toEqual({ orderBy: 'created_at' });
  });

  it('create() with the legacy payload persists the canonical columns; metadata holds only metadata-only keys', async () => {
    const { service, repo, events } = makeService();
    await service.create('t1', 'u1', LEGACY_WEB_ARTIST as any);

    const persisted = repo.create.mock.calls[0][0] as Record<string, unknown>;
    expect(persisted).toMatchObject({
      stage_name: 'MC Aurora', full_name: 'Aurora da Silva', bank_branch: '0001', agent_name: 'Beto',
      profile_type: 'managed', contract_id: CONTRACT_ID, internal_notes: 'nota interna', birth_date: '1995-04-20',
      phone_encrypted: 'cipher:+55 11 99999-0000', manager_contact_encrypted: 'cipher:fabio@x.com',
      email_encrypted: 'cipher:aurora@example.com', cpf_cnpj_encrypted: 'cipher:123.456.789-00',
    });
    for (const key of Object.keys(persisted)) expect(PT_KEYS.has(key) && key !== 'metadata').toBe(false);
    expect(Object.keys(persisted.metadata as object).sort()).toEqual([
      'apple_music_albums', 'deezer_fans', 'gender', 'instagram_followers', 'instagram_url',
      'soundcloud_followers', 'spotify_listeners', 'tiktok_followers', 'youtube_subscribers',
    ]);
    expect(events.emitTyped).toHaveBeenCalledWith('artist.created', expect.objectContaining({
      payload: expect.objectContaining({ stageName: 'MC Aurora' }),
    }));
  });

  it('the response has no Portuguese key, no ciphertext and only the allow-listed metadata keys', async () => {
    const { service } = makeService({
      stage_name: 'MC Aurora',
      phone_encrypted: 'cipher:+55 11 1', email_encrypted: null, cpf_cnpj_encrypted: null,
      manager_contact_encrypted: 'cipher:fabio@x.com',
      // Historical pre-CZ-042 keys stay in the row but are never returned.
      metadata: { gender: 'female', spotify_listeners: 10, genero: 'Feminino', banco: 'Velho', nome_artistico: 'Antigo', leadId: 'l1' },
    });
    const response = await service.findByIdForResponse('t1', 'artist-1') as Record<string, unknown>;

    expect(response).toMatchObject({ stage_name: 'MC Aurora', phone: '+55 11 1', manager_contact: 'fabio@x.com', gender: 'female', spotify_listeners: 10 });
    for (const key of Object.keys(response)) {
      expect(PT_KEYS.has(key)).toBe(false);
      expect(key).not.toMatch(/_encrypted$/);
    }
    expect(response).not.toHaveProperty('metadata');
    expect(response).not.toHaveProperty('leadId');
    expect(JSON.stringify(response)).not.toContain('cipher:');
    // Anything that is not a row column or a decrypted PII key must be an allow-listed metadata key.
    const rowColumns = new Set(['id', 'tenant_id', 'status', 'stage_name']);
    const decrypted = new Set(['email', 'phone', 'cpf_cnpj', 'manager_contact']);
    const extra = Object.keys(response).filter((k) => !rowColumns.has(k) && !decrypted.has(k));
    expect(extra.sort()).toEqual(['gender', 'spotify_listeners']);
    expect(extra.every((k) => (ARTIST_METADATA_ONLY_FIELDS as readonly string[]).includes(k))).toBe(true);
  });

  it('update(): an empty legacy value never wipes the stored column; the canonical null clears it', async () => {
    const { service, repo } = makeService({ stage_name: 'MC Aurora', bank_name: 'Banco X', phone_encrypted: 'cipher:1' });

    await service.update('t1', 'u1', 'artist-1', { banco: '', telefone: null, nome_artistico: '' } as any);
    const firstUpdates = repo.update.mock.calls[0][1] as Record<string, unknown>;
    expect(firstUpdates).not.toHaveProperty('bank_name');
    expect(firstUpdates).not.toHaveProperty('phone_encrypted');
    expect(firstUpdates).not.toHaveProperty('stage_name');

    await service.update('t1', 'u1', 'artist-1', { bank_name: null, birth_date: '' } as any);
    expect(repo.update.mock.calls[1][1]).toMatchObject({ bank_name: null, birth_date: null });
  });

  it('update() writes metadata-only fields into metadata, preserving the existing jsonb', async () => {
    const { service, repo } = makeService({ stage_name: 'X', metadata: { leadId: 'l1', gender: 'male' } });
    await service.update('t1', 'u1', 'artist-1', { genero: 'Feminino', tiktok_seguidores: 7 } as any);
    expect(repo.update.mock.calls[0][1]).toMatchObject({ metadata: { leadId: 'l1', gender: 'female', tiktok_followers: 7 } });
  });

  it('an EDIT from a pre-CZ-042 build never wipes data it could not read (empty lists/maps, false, default tipo_perfil)', () => {
    const oldBuildEdit = {
      nome_artistico: 'Novo Nome', tipo_perfil: 'independente', especialidades: [], relacionamentos: [],
      contatos_vinculados: [], distribuidoras_gerais: [], distribuidoras_selecionadas: {}, galeria_urls: [],
    };
    expect(canonicalizeArtistInput(oldBuildEdit, { update: true })).toEqual({ stage_name: 'Novo Nome' });
    // On create the same values are explicit choices and are kept.
    expect(canonicalizeArtistInput(oldBuildEdit)).toMatchObject({ profile_type: 'independent', specialties: [] });
  });
});
