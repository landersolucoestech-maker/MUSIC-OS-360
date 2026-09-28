/**
 * contacts.service.test.ts
 *
 * Permanent guard (Phase 3 — real persistence of Contacts/Clients):
 * contacts.service.ts may NEVER again contain an in-memory data
 * mock. Before this phase, the file kept `let contacts = [...5 fictitious
 * seeds]` mutated at runtime — data disappeared on every reload and was
 * identical for every tenant.
 *
 * This test fails if the file contains those patterns again, and confirms
 * behaviorally that list/create/update/remove always delegate to
 * `clientsService` (real HTTP, `clients` table → `/clients` — see
 * clients.service.ts: "Contact" and "Client" are the same physical entity).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fs from "fs";
import * as path from "path";

const FILE_PATH = path.resolve(__dirname, "contacts.service.ts");
const SOURCE = fs.readFileSync(FILE_PATH, "utf8");

const FORBIDDEN_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  { name: "array de negócio module-level (let contacts =)", pattern: /let\s+contacts\s*=/ },
  { name: "delay simulado", pattern: /setTimeout\s*\(\s*resolve/ },
];

describe("contacts.service.ts — permanent guard against reintroducing a mock", () => {
  it("contains no business-data mock pattern", () => {
    const violations = FORBIDDEN_PATTERNS
      .filter(({ pattern }) => pattern.test(SOURCE))
      .map(({ name }) => name);
    expect(violations).toEqual([]);
  });

  it("imports and uses the real `clientsService` (no own contacts array)", () => {
    expect(SOURCE).toMatch(/from\s+["']\.\/clients\.service["']/);
    expect(SOURCE).not.toMatch(/:\s*Contact\[\]\s*=\s*\[/);
  });
});

vi.mock("./clients.service", () => ({
  clientsService: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
}));

import { clientsService, type ApiClient } from "./clients.service";
import {
  contactsService,
  contactFormToContactInput,
  contactToCreateInput,
  contactToFormValues,
  contactToUpdateInput,
  wireToContact,
} from "./contacts.service";
import type { ContactFormValues } from "../modals/ContactFormModal";

/** A full CZ-043 canonical `/clients` response row. */
const wireRow: ApiClient = {
  id: "c1",
  tenant_id: "t1",
  person_type: "company",
  category: "PARTNER",
  profile: "gravadora_selo",
  name: "Selo X",
  photo_url: "https://cdn/x.png",
  individual_name: null,
  legal_name: "Selo X Ltda",
  trade_name: "Selo X",
  email: "contato@selox.com",
  phone: "(11) 90000-0000",
  cpf_cnpj: "12.345.678/0001-90",
  instagram: "@selox",
  job_title: null,
  street: "Rua A",
  street_number: "10",
  address_complement: "Sala 2",
  neighborhood: "Centro",
  city: "São Paulo",
  state: "SP",
  zip_code: "01000-000",
  address: "Rua A, 10 - Sala 2 / Centro · São Paulo - SP · CEP 01000-000",
  priority: "strategic",
  responsible_name: "Ana",
  responsible_job_title: "A&R",
  responsible_email: "ana@selox.com",
  responsible_phone: "(11) 91111-1111",
  attachments: [],
  notes: "Parceiro antigo",
  interactions: [
    { id: "i1", type: "meeting", date: "2026-09-01", time: "14:30", description: "Reunião de pauta" },
  ],
  status: "active",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-02T00:00:00.000Z",
  created_by: "u1",
  updated_by: "u1",
};

/** Every pre-CZ-043 key that must never be sent again. */
const LEGACY_KEYS = [
  "metadata", "payloadOperacional", "type", "document", "zipCode", "responsible", "avatarUrl",
  "nome", "tipo_pessoa", "categoria", "perfil", "foto", "razao_social", "nome_fantasia", "nome_pf",
  "funcao", "logradouro", "numero", "complemento", "bairro", "cidade", "estado", "cep",
  "endereco_completo", "prioridade_contato", "responsavel_nome", "responsavel_cargo",
  "responsavel_email", "responsavel_telefone", "telefone", "observacoes", "interacoes", "cpf", "cnpj",
];

const CANONICAL_BODY_KEYS = new Set([
  "name", "person_type", "category", "profile", "photo_url", "individual_name", "legal_name",
  "trade_name", "email", "phone", "cpf_cnpj", "instagram", "job_title", "street", "street_number",
  "address_complement", "neighborhood", "city", "state", "zip_code", "address", "priority",
  "responsible_name", "responsible_job_title", "responsible_email", "responsible_phone", "notes",
  "interactions",
]);

/** Values the form emits for a company contact. */
const companyForm: ContactFormValues = {
  personType: "company",
  individualName: "",
  cpf: "111.111.111-11",
  jobTitle: "",
  instagram: "@selox",
  photoUrl: "",
  legalName: "Selo X Ltda",
  tradeName: "Selo X",
  cnpj: "12.345.678/0001-90",
  category: "PARTNER",
  profile: "gravadora_selo",
  email: "",
  phone: "(11) 90000-0000",
  zipCode: "01000-000",
  street: "Rua A",
  streetNumber: "10",
  addressComplement: "Sala 2",
  neighborhood: "Centro",
  city: "São Paulo",
  state: "SP",
  status: "inactive",
  priority: "high",
  responsibleName: "Ana",
  responsibleEmail: "ana@selox.com",
  responsiblePhone: "(11) 91111-1111",
  responsibleJobTitle: "A&R",
  interactions: [{ id: "i1", type: "call", date: "2026-09-01", time: "09:15", description: "Primeiro contato" }],
  attachments: [],
  notes: "Observação",
};

describe("CZ-043 wire mapping — /clients canonical contract", () => {
  it("wireToContact reads every canonical column (no metadata fallback)", () => {
    const contact = wireToContact(wireRow);
    expect(contact).toMatchObject({
      id: "c1",
      personType: "company",
      category: "PARTNER",
      profile: "gravadora_selo",
      name: "Selo X",
      photoUrl: "https://cdn/x.png",
      legalName: "Selo X Ltda",
      tradeName: "Selo X",
      email: "contato@selox.com",
      phone: "(11) 90000-0000",
      cpfCnpj: "12.345.678/0001-90",
      instagram: "@selox",
      street: "Rua A",
      streetNumber: "10",
      addressComplement: "Sala 2",
      neighborhood: "Centro",
      city: "São Paulo",
      state: "SP",
      zipCode: "01000-000",
      priority: "strategic",
      responsibleName: "Ana",
      responsibleJobTitle: "A&R",
      responsibleEmail: "ana@selox.com",
      responsiblePhone: "(11) 91111-1111",
      notes: "Parceiro antigo",
      status: "active",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
    });
    expect(contact.interactions).toEqual([
      { id: "i1", type: "meeting", date: "2026-09-01", time: "14:30", description: "Reunião de pauta" },
    ]);
    expect(contact).not.toHaveProperty("payloadOperacional");
    expect(contact).not.toHaveProperty("metadata");
  });

  it("does not resurrect a legacy metadata copy even if a stale server still sent one", () => {
    const stale = { ...wireRow, metadata: { cpf: "999.999.999-99", razao_social: "Outro" } } as ApiClient;
    const contact = wireToContact(stale);
    expect(JSON.stringify(contact)).not.toContain("999.999.999-99");
    expect(contact.legalName).toBe("Selo X Ltda");
  });

  it("wire → Contact → form → Contact → wire is lossless on every column", () => {
    const contact = wireToContact(wireRow);
    const values = { ...companyForm, ...contactToFormValues(contact) } as ContactFormValues;
    const body = contactToCreateInput(contactFormToContactInput(values));
    const { id: _id, tenant_id: _t, attachments: _a, status: _s, created_at: _c, updated_at: _u, created_by: _cb, updated_by: _ub, individual_name: _in, ...expected } = wireRow;
    expect(body).toEqual({ ...expected, individual_name: null });
  });

  it("form → create body: canonical keys only, CPF/CNPJ only in cpf_cnpj, no metadata, no status", () => {
    const body = contactToCreateInput(contactFormToContactInput(companyForm)) as unknown as Record<string, unknown>;

    for (const key of Object.keys(body)) expect(CANONICAL_BODY_KEYS.has(key)).toBe(true);
    for (const key of LEGACY_KEYS) expect(body).not.toHaveProperty(key);
    expect(body).not.toHaveProperty("status");

    expect(body.person_type).toBe("company");
    expect(body.name).toBe("Selo X");
    // The company CNPJ goes to cpf_cnpj; the individual CPF left in the form is never sent.
    expect(body.cpf_cnpj).toBe("12.345.678/0001-90");
    expect(JSON.stringify(body)).not.toContain("111.111.111-11");
    // An empty text field clears the column instead of sending "" (API @IsEmail).
    expect(body.email).toBeNull();
    expect(body.interactions).toEqual([
      { id: "i1", type: "call", date: "2026-09-01", time: "09:15", description: "Primeiro contato" },
    ]);
  });

  it("individual: name/individual_name from the form, CPF in cpf_cnpj (CNPJ never sent)", () => {
    const body = contactToCreateInput(contactFormToContactInput({
      ...companyForm,
      personType: "individual",
      individualName: "Maria Souza",
    })) as unknown as Record<string, unknown>;
    expect(body.person_type).toBe("individual");
    expect(body.name).toBe("Maria Souza");
    expect(body.individual_name).toBe("Maria Souza");
    expect(body.cpf_cnpj).toBe("111.111.111-11");
    expect(JSON.stringify(body)).not.toContain("12.345.678/0001-90");
  });

  it("update body carries status and expectedUpdatedAt, still no legacy key", () => {
    const body = contactToUpdateInput(contactFormToContactInput(companyForm), "2026-01-02T00:00:00.000Z") as unknown as Record<string, unknown>;
    expect(body.status).toBe("inactive");
    expect(body.expectedUpdatedAt).toBe("2026-01-02T00:00:00.000Z");
    for (const key of LEGACY_KEYS) expect(body).not.toHaveProperty(key);
  });

  it("the source never writes a metadata/payloadOperacional side channel", () => {
    expect(SOURCE).not.toMatch(/\bmetadata\s*[:=]/);
    expect(SOURCE).not.toMatch(/payloadOperacional\s*:/);
  });
});

describe("contactsService — always delegates to the real clientsService (no local state)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("list() calls clientsService.list() and maps the API shape to Contact", async () => {
    vi.mocked(clientsService.list).mockResolvedValue([wireRow]);

    const result = await contactsService.list();

    expect(clientsService.list).toHaveBeenCalled();
    expect(result).toEqual([
      expect.objectContaining({ id: "c1", name: "Selo X", category: "PARTNER", personType: "company" }),
    ]);
  });

  it("create() delegates to clientsService.create(...) without generating an id locally", async () => {
    vi.mocked(clientsService.create).mockResolvedValue({ ...wireRow, id: "server-id" });

    const result = await contactsService.create(contactFormToContactInput(companyForm));

    expect(clientsService.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Selo X", category: "PARTNER", person_type: "company" }),
    );
    expect(result.id).toBe("server-id");
  });

  it("update() sends only changed fields (partial payload passed to clientsService)", async () => {
    vi.mocked(clientsService.update).mockResolvedValue(wireRow);

    await contactsService.update("c1", { notes: "nova observação" });

    const sentPayload = vi.mocked(clientsService.update).mock.calls[0][1] as Record<string, unknown>;
    expect(sentPayload).toEqual({ notes: "nova observação" });
  });

  it("remove() delegates to clientsService.remove(id)", async () => {
    vi.mocked(clientsService.remove).mockResolvedValue(undefined as never);
    await contactsService.remove("c1");
    expect(clientsService.remove).toHaveBeenCalledWith("c1");
  });

  it("propagates clientsService errors without masking (no local success fallback)", async () => {
    vi.mocked(clientsService.list).mockRejectedValue(new Error("network down"));
    await expect(contactsService.list()).rejects.toThrow("network down");
  });
});
