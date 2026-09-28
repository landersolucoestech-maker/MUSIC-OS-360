/**
 * CZ-042 — the artist API wire contract (canonical snake_case keys) is the
 * only shape read from / sent to /artists. These tests pin:
 *   - every canonical key is read and written (incl. nested item keys);
 *   - no pre-CZ-042 Portuguese key is ever sent, nor read as a fallback;
 *   - wire → Artist → wire is lossless;
 *   - option values are canonical English and every label is PT-BR, with a
 *     PT-BR fallback (never the raw value) for unknown values.
 */
import { describe, it, expect } from "vitest";
import {
  wireToArtist,
  artistToWirePayload,
  profileTypeLabel,
  relationshipTypeLabel,
  genderLabel,
  specialtyLabel,
  normalizeProfileType,
  normalizeSpecialty,
  normalizeGender,
  PROFILE_TYPE_LABELS,
  RELATIONSHIP_TYPE_LABELS,
  SPECIALTY_LABELS,
  GENDER_LABELS,
  type ArtistWireRecord,
} from "./artist.mapper";

const WIRE: ArtistWireRecord = {
  id: "art-1",
  stage_name: "MC Teste",
  full_name: "Fulano de Tal",
  status: "signed",
  registration_status: "active",
  music_genre: "Funk",
  email: "mc@teste.com",
  phone: "(11) 90000-0000",
  cpf_cnpj: "123.456.789-00",
  photo_url: "https://cdn/x/foto.png",
  notes: "Bio",
  contract_id: "c-1",
  artist_slug: "mc-teste",
  music_tags: ["funk", "trap"],
  career_stage: "emergente",
  relationships: [
    {
      type: "record_label",
      name: "Gravadora X",
      phone: "(11) 1111-1111",
      email: "label@x.com",
      office: "SP",
      crc: "123",
      responsibles: [{ name: "Ana", phone: "(11) 2222-2222", email: "ana@x.com" }],
      distributors: [{ id: "outros", email: "d@x.com", customName: "Minha Distro" }],
    },
  ],
  spotify_url: "https://open.spotify.com/artist/4ZzZzZzZzZzZzZzZzZzZzZ",
  spotify_listeners: 1000,
  youtube_url: "https://www.youtube.com/@mc",
  youtube_subscribers: 200,
  deezer_url: "https://deezer.com/artist/1",
  deezer_fans: 30,
  apple_music_url: "https://music.apple.com/artist/1",
  apple_music_albums: 4,
  soundcloud_url: "https://soundcloud.com/mc",
  soundcloud_followers: 50,
  instagram_url: "https://instagram.com/mc",
  instagram_followers: 60,
  tiktok_url: "https://tiktok.com/@mc",
  tiktok_followers: 70,
  gender: "female",
  birth_date: "1990-01-01",
  rg: "12.345.678-9",
  address: "Rua A, 1",
  bank_name: "Nubank",
  bank_branch: "0001",
  bank_account: "12345-6",
  pix_key: "mc@teste.com",
  account_holder: "Fulano de Tal",
  specialties: ["dj_producer", "songwriter"],
  profile_type: "record_label",
  agent_id: "ag-1",
  agent_name: "Empresário Y",
  agent_phone: "(11) 3333-3333",
  agent_email: "ag@y.com",
  record_label_id: "rl-1",
  record_label_name: "Gravadora X",
  record_label_phone: "(11) 1111-1111",
  record_label_email: "label@x.com",
  record_label_contact_id: "rc-1",
  record_label_contact_name: "Ana",
  record_label_contact_phone: "(11) 2222-2222",
  record_label_contact_email: "ana@x.com",
  selected_distributors: { onerpm: true },
  distributor_emails: { onerpm: "s@onerpm.com" },
  company_selected_distributors: { distrokid: true },
  company_distributor_emails: { distrokid: "s@dk.com" },
  personal_documents_url: "https://cdn/x/doc.pdf",
  press_kit_url: "https://cdn/x/press.pdf",
  internal_notes: "interna",
  gallery_urls: ["https://cdn/x/g1.png"],
  manager_name: "Manager Z",
  manager_contact: "z@z.com",
  executive_producer: "Prod",
  booking_agency: "Booking",
  partner_label: "Parceira",
  documents: [{ name: "contrato.pdf", url: "https://cdn/x/c.pdf" }],
  general_distributors: [{ id: "outros", email: "g@x.com", customName: "Outra" }],
  linked_contacts: [{ contactId: "ct-1", distributors: [{ id: "onerpm", email: "l@x.com" }] }],
  team_contacts: [
    { name: "Bia", category: "booker", phone: "(11) 4444-4444", email: "bia@x.com", distributors: [] },
  ],
  created_at: "2026-09-01T00:00:00.000Z",
  updated_at: "2026-09-02T00:00:00.000Z",
};

const PRE_CZ042_KEYS = [
  "nome_artistico", "nome_civil", "status_cadastro", "foto_url", "galeria_urls", "especialidades",
  "documentos_pessoais_url", "presskit_url", "data_nascimento", "endereco", "telefone", "banco",
  "agencia", "conta", "chave_pix", "titular_conta", "tipo_perfil", "slug_artistico", "tags_musicais",
  "fase_carreira", "relacionamentos", "empresario_id", "empresario_nome", "gravadora_nome",
  "gravadora_responsavel_nome", "distribuidoras_selecionadas", "distribuidoras_emails",
  "distribuidoras_empresa_selecionadas", "distribuidoras_empresa_emails", "distribuidoras_gerais",
  "contatos_vinculados", "contatos_equipe", "notas_internas", "manager_nome", "manager_contato",
  "produtor_executivo", "agencia_booking", "label_parceira", "contrato_id", "genero",
  "spotify_ouvintes", "youtube_inscritos", "deezer_fas", "apple_music_albuns_url",
  "soundcloud_seguidores_url", "instagram_seguidores", "tiktok_seguidores",
];

const PT_NESTED_KEYS = ["nome", "telefone", "escritorio", "responsaveis", "distribuidoras", "nomeCustom", "categoria"];

function collectKeys(value: unknown, out: Set<string> = new Set()): Set<string> {
  if (Array.isArray(value)) value.forEach((v) => collectKeys(v, out));
  else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      out.add(k);
      collectKeys(v, out);
    }
  }
  return out;
}

describe("artist wire boundary (CZ-042 canonical contract)", () => {
  it("reads every canonical key into the internal model", () => {
    const a = wireToArtist(WIRE);
    expect(a.stageName).toBe("MC Teste");
    expect(a.fullName).toBe("Fulano de Tal");
    expect(a.registrationStatus).toBe("active");
    expect(a.phone).toBe("(11) 90000-0000");
    expect(a.taxId).toBe("123.456.789-00");
    expect(a.photoUrl).toBe("https://cdn/x/foto.png");
    expect(a.artistSlug).toBe("mc-teste");
    expect(a.specialties).toEqual(["dj_producer", "songwriter"]);
    expect(a.profileType).toBe("record_label");
    expect(a.gender).toBe("female");
    expect(a.bankName).toBe("Nubank");
    expect(a.agentName).toBe("Empresário Y");
    expect(a.recordLabelContactName).toBe("Ana");
    expect(a.companySelectedDistributors).toEqual({ distrokid: true });
    expect(a.managerName).toBe("Manager Z");
    expect(a.managerContact).toBe("z@z.com");
    expect(a.appleMusicAlbums).toBe(4);
    expect(a.soundcloudFollowers).toBe(50);
    expect(a.documents).toEqual([{ name: "contrato.pdf", url: "https://cdn/x/c.pdf" }]);
    expect(a.relationships).toEqual([
      {
        type: "record_label",
        name: "Gravadora X",
        phone: "(11) 1111-1111",
        email: "label@x.com",
        office: "SP",
        crc: "123",
        responsibles: [{ name: "Ana", phone: "(11) 2222-2222", email: "ana@x.com" }],
        distributors: [{ id: "outros", email: "d@x.com", customName: "Minha Distro" }],
      },
    ]);
    expect(a.generalDistributors).toEqual([{ id: "outros", email: "g@x.com", customName: "Outra" }]);
    expect(a.linkedContacts).toEqual([{ contactId: "ct-1", distributors: [{ id: "onerpm", email: "l@x.com" }] }]);
    expect(a.teamContacts).toEqual([
      { name: "Bia", category: "booker", phone: "(11) 4444-4444", email: "bia@x.com", distributors: [] },
    ]);
  });

  it("does not leak raw wire keys into the internal model", () => {
    const keys = Object.keys(wireToArtist(WIRE));
    for (const k of keys) expect(k).not.toMatch(/_(?!at$)/); // only created_at/updated_at/user_id keep snake_case
  });

  it("never reads a pre-CZ-042 Portuguese key as a fallback", () => {
    const legacy = {
      id: "art-2",
      nome_artistico: "Nome Antigo",
      nome_civil: "Civil Antigo",
      tipo_perfil: "gravadora",
      telefone: "(11) 0000-0000",
      genero: "Masculino",
      especialidades: ["produtor"],
    } as unknown as ArtistWireRecord;
    const a = wireToArtist(legacy);
    expect(a.stageName).toBe("");
    expect(a.fullName).toBeUndefined();
    expect(a.profileType).toBeUndefined();
    expect(a.phone).toBeUndefined();
    expect(a.gender).toBeUndefined();
    expect(a.specialties).toBeUndefined();
    expect(collectKeys(a)).not.toContain("nome_artistico");
  });

  it("round-trips wire → Artist → wire losslessly", () => {
    const back = artistToWirePayload(wireToArtist(WIRE));
    const { id: _id, created_at: _c, updated_at: _u, ...expected } = WIRE;
    expect(back).toEqual(expected);
  });

  it("sends only canonical keys — no Portuguese key at any depth, no camelCase top-level key", () => {
    const body = artistToWirePayload(wireToArtist(WIRE));
    const all = collectKeys(body);
    for (const k of PRE_CZ042_KEYS) expect(all).not.toContain(k);
    for (const k of PT_NESTED_KEYS) expect(all).not.toContain(k);
    for (const k of Object.keys(body)) expect(k).toMatch(/^[a-z0-9_]+$/);
  });

  it("a partial update emits only the touched keys and forwards expectedUpdatedAt", () => {
    const body = artistToWirePayload({ stageName: "Novo", agentName: null, expectedUpdatedAt: "2026-09-02T00:00:00.000Z" });
    expect(body).toEqual({ stage_name: "Novo", agent_name: null, expectedUpdatedAt: "2026-09-02T00:00:00.000Z" });
  });

  it("preserves explicit null for list fields (clearing), and omits absent ones", () => {
    expect(artistToWirePayload({ relationships: null, linkedContacts: null })).toEqual({
      relationships: null,
      linked_contacts: null,
    });
  });
});

describe("artist option values (canonical) ↔ PT-BR labels", () => {
  it("label maps are keyed by the canonical contract values", () => {
    expect(Object.keys(PROFILE_TYPE_LABELS)).toEqual(["independent", "managed", "record_label", "publisher"]);
    expect(Object.keys(RELATIONSHIP_TYPE_LABELS)).toEqual([
      "agent", "record_label", "publisher", "booker", "legal", "finance", "accountant", "press_office",
    ]);
    expect(Object.keys(SPECIALTY_LABELS)).toEqual(["dj", "dj_producer", "songwriter", "performer", "producer"]);
    expect(Object.keys(GENDER_LABELS)).toEqual(["male", "female"]);
  });

  it("maps known values to PT-BR labels", () => {
    expect(profileTypeLabel("managed")).toBe("Com empresário");
    expect(relationshipTypeLabel("press_office")).toBe("Assessoria de Imprensa");
    expect(relationshipTypeLabel("agent")).toBe("Empresário");
    expect(specialtyLabel("songwriter")).toBe("Compositor/Autor");
    expect(genderLabel("female")).toBe("Feminino");
  });

  it("unknown or legacy values fall back to PT-BR copy, never the raw value", () => {
    const cases: Array<[(v: unknown) => string, string]> = [
      [profileTypeLabel, "com_empresario"],
      [relationshipTypeLabel, "empresario"],
      [specialtyLabel, "dj_produtor"],
      [genderLabel, "Masculino_x"],
    ];
    for (const [fn, raw] of cases) {
      const label = fn(raw);
      expect(label).not.toBe(raw);
      expect(label).not.toMatch(/_/);
    }
    expect(profileTypeLabel("")).toBe("Perfil não reconhecido");
    expect(genderLabel(null)).toBe("Não informado");
  });

  it("normalizers accept canonical values, PT-BR labels and pre-CZ-042 spreadsheet values", () => {
    expect(normalizeProfileType("record_label")).toBe("record_label");
    expect(normalizeProfileType("Com editora")).toBe("publisher");
    expect(normalizeProfileType("com_empresario")).toBe("managed");
    expect(normalizeProfileType("")).toBe("independent");
    expect(normalizeSpecialty("DJ/Produtor")).toBe("dj_producer");
    expect(normalizeSpecialty("interprete")).toBe("performer");
    expect(normalizeSpecialty("nada")).toBe("");
    expect(normalizeGender("Masculino")).toBe("male");
    expect(normalizeGender("female")).toBe("female");
    expect(normalizeGender("x")).toBe("");
  });
});
