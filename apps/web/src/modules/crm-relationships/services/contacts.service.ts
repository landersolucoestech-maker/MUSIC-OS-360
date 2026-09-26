/**
 * services/contacts.service.ts
 *
 * Real backend `/clients` (`clients` table, ClientsController/ClientsService
 * — apps/api/src/modules/clients). "Contact" and "Client" are the SAME
 * physical entity (a domain decision documented in
 * apps/api/src/database/migrations/20260719000010_RebuildClientsInCanonicalFormOrder.ts:
 * "Contact = Client" — `categoria` stores the relationship type:
 * CORPORATE_CLIENT/PARTNER/SUPPLIER/SERVICE_PROVIDER/INVESTOR/etc).
 *
 * Replaces the previous implementation, which kept an in-memory array with 5
 * fictitious contacts (fixed sample names) and never called the API. It also
 * replaces the backend module
 * `/contacts` (ContactsController/ContactsService) discovered in this Part
 * as dead code: the physical `contacts` table was removed by a
 * cleanup migration (`DropOrphanContactsSatelliteTables`, present only
 * in a pre-existing local stash) without the corresponding code being
 * removed — every real POST/PATCH there fails with
 * `relation "contacts" does not exist`. It was never noticed because the frontend
 * always used this mock.
 *
 * `attachments`/`tags`/`website`/`linkedArtistId`/`timeline` have no equivalent
 * physical column in `clients` — always empty/undefined on read, never
 * sent on write, instead of fabricating nonexistent data. `priority` IS a
 * real column (`prioridade_contato`) — read/written normally below.
 */
import type { Contact } from "../types";
import type { ContatoFormPayload } from "../modals/ContatoFormModal";
import { clientsService, type ApiClient, type CreateApiClientInput } from "./clients.service";

function fromApi(c: ApiClient): Contact {
  return {
    id: c.id,
    name: c.name,
    companyName: c.razao_social ?? c.nome_fantasia ?? undefined,
    contactType: (c.category ?? "OTHER") as Contact["contactType"],
    documentType: c.type === "pessoa_fisica" ? "CPF" : "CNPJ",
    documentNumber: c.document ?? undefined,
    phone: c.phone ?? undefined,
    whatsapp: c.phone ?? undefined,
    email: c.email ?? undefined,
    instagram: c.instagram ?? undefined,
    address: c.address ?? undefined,
    city: c.city ?? undefined,
    state: c.state ?? undefined,
    country: "Brasil",
    zipCode: c.cep ?? undefined,
    responsible: c.responsavel_nome ?? undefined,
    notes: c.notes ?? undefined,
    tags: [],
    status: (c.status ?? "active") as Contact["status"],
    priority: (c.prioridade_contato ?? "medium") as Contact["priority"],
    payloadOperacional: c.metadata ?? {},
    attachments: Array.isArray(c.attachments) ? (c.attachments as Contact["attachments"]) : [],
    timeline: [],
    createdAt: c.created_at,
    updatedAt: c.updated_at,
  };
}

function toApiInput(data: Partial<Omit<Contact, "id" | "createdAt" | "updatedAt">>): CreateApiClientInput & Record<string, unknown> {
  const isCompany = data.documentType === "CNPJ" || !!data.companyName;
  const payload: CreateApiClientInput & Record<string, unknown> = {
    name: data.name ?? "",
  };
  if (data.contactType !== undefined) payload.category = data.contactType;
  if (data.documentType !== undefined || data.companyName !== undefined) payload.type = isCompany ? "company" : "person";
  if (data.email !== undefined) payload.email = data.email;
  if (data.phone !== undefined || data.whatsapp !== undefined) payload.phone = data.phone ?? data.whatsapp;
  if (data.documentNumber !== undefined) payload.document = data.documentNumber;
  if (data.address !== undefined) payload.address = data.address;
  if (data.city !== undefined) payload.city = data.city;
  if (data.state !== undefined) payload.state = data.state;
  if (data.instagram !== undefined) payload.instagram = data.instagram;
  if (data.zipCode !== undefined) payload.zipCode = data.zipCode;
  if (data.responsible !== undefined) payload.responsible = data.responsible;
  if (data.notes !== undefined) payload.notes = data.notes;
  if (data.priority !== undefined) payload.priority = data.priority;
  if (data.payloadOperacional !== undefined) payload.metadata = data.payloadOperacional;
  return payload;
}

/**
 * Converts the payload emitted by `ContatoFormModal` into the create/edit object
 * of a `Contact`. The SINGLE source of truth for that transformation — used both
 * by the CRM > Contacts panel and by the contact link in the artist
 * registration (EquipeContatosCRM), avoiding duplicated logic.
 */
export function contatoPayloadToContactData(
  payload: ContatoFormPayload,
): Omit<Contact, "id" | "createdAt" | "updatedAt"> {
  const isIndividual = payload.tipo_pessoa === "pessoa_fisica";
  return {
    name: isIndividual ? payload.nome_pf || "" : payload.razao_social || "",
    companyName: !isIndividual ? payload.razao_social : undefined,
    contactType: (payload.categoria || "OTHER") as Contact["contactType"],
    documentType: isIndividual ? "CPF" : "CNPJ",
    documentNumber: isIndividual ? payload.cpf : payload.cnpj,
    phone: payload.telefone,
    whatsapp: payload.telefone,
    email: payload.email,
    instagram: payload.instagram || undefined,
    address: payload.endereco_completo,
    city: payload.cidade,
    state: payload.estado,
    country: "Brasil",
    zipCode: payload.cep,
    responsible: payload.responsavel_nome,
    notes: payload.observacoes,
    tags: [],
    status: (payload.status_contato || "active") as Contact["status"],
    priority: (payload.prioridade_contato || "medium") as Contact["priority"],
    payloadOperacional: {
      tipo_pessoa: payload.tipo_pessoa,
      perfil: payload.perfil ?? "",
      cpf: payload.cpf,
      cnpj: payload.cnpj,
      razao_social: payload.razao_social,
      nome_fantasia: payload.nome_fantasia,
      funcao: payload.funcao,
      foto: payload.foto,
      cep: payload.cep,
      logradouro: payload.logradouro,
      numero: payload.numero,
      complemento: payload.complemento,
      bairro: payload.bairro,
      responsavel_nome: payload.responsavel_nome,
      responsavel_email: payload.responsavel_email,
      responsavel_telefone: payload.responsavel_telefone,
      responsavel_cargo: payload.responsavel_cargo,
      interacoes: payload.interacoes,
    },
    attachments: payload.attachments ?? [],
    timeline: [],
  };
}

export const contactsService = {
  async list(): Promise<Contact[]> {
    const clients = await clientsService.list();
    return clients.map(fromApi).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },
  async listSimple(): Promise<{ id: string; name: string }[]> {
    const contacts = await contactsService.list();
    return contacts
      .map((contact) => ({ id: contact.id, name: contact.name }))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }));
  },
  async create(data: Omit<Contact, "id" | "createdAt" | "updatedAt">): Promise<Contact> {
    const created = await clientsService.create(toApiInput(data));
    return fromApi(created);
  },
  async update(id: string, data: Partial<Contact>, expectedUpdatedAt?: string): Promise<Contact> {
    const updated = await clientsService.update(id, { ...toApiInput(data), expectedUpdatedAt });
    return fromApi(updated);
  },
  async remove(id: string): Promise<void> {
    await clientsService.remove(id);
  },
};
