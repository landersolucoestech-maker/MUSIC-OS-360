/**
 * services/contacts.service.ts
 *
 * Backend real `/clients` (tabela `clients`, ClientsController/ClientsService
 * — apps/api/src/modules/clients). "Contato" e "Cliente" são a MESMA entidade
 * física (decisão de domínio documentada em
 * apps/api/src/database/migrations/20260719000010_RebuildClientsInCanonicalFormOrder.ts:
 * "Contato = Cliente" — `categoria` guarda o tipo de relacionamento:
 * CORPORATE_CLIENT/PARTNER/SUPPLIER/SERVICE_PROVIDER/INVESTOR/etc).
 *
 * Substitui a implementação anterior, que mantinha um array em memória com 5
 * contatos fictícios (nomes de exemplo fixos) e nunca chamava a API. Também
 * substitui o módulo backend
 * `/contacts` (ContactsController/ContactsService) descoberto nesta Parte
 * como código morto: a tabela física `contacts` foi removida por uma
 * migration de limpeza (`DropOrphanContactsSatelliteTables`, presente apenas
 * no stash local pré-existente) sem que o código correspondente fosse
 * removido — todo POST/PATCH real ali falha com
 * `relation "contacts" does not exist`. Nunca foi notado porque o frontend
 * sempre usou este mock.
 *
 * `attachments`/`tags`/`website`/`linkedArtistId`/`timeline` não têm coluna
 * física equivalente em `clients` — sempre vazios/undefined na leitura, nunca
 * enviados na escrita, em vez de fabricar dado inexistente. `priority` É uma
 * coluna real (`prioridade_contato`) — lida/escrita normalmente abaixo.
 */
import type { Contact } from "../types";
import type { ContatoFormPayload } from "../modals/ContatoFormModal";
import { clientsService, type ApiClient, type CreateApiClientInput } from "./clients.service";

function fromApi(c: ApiClient): Contact {
  return {
    id: c.id,
    name: c.nome ?? c.name,
    companyName: c.razao_social ?? c.nome_fantasia ?? undefined,
    contactType: (c.categoria ?? "OTHER") as Contact["contactType"],
    documentType: c.tipo_pessoa === "pessoa_fisica" ? "CPF" : "CNPJ",
    documentNumber: c.document ?? undefined,
    phone: c.phone ?? undefined,
    whatsapp: c.phone ?? undefined,
    email: c.email ?? undefined,
    instagram: c.instagram ?? undefined,
    address: c.endereco_completo ?? c.address ?? undefined,
    city: c.cidade ?? undefined,
    state: c.estado ?? undefined,
    country: "Brasil",
    zipCode: c.cep ?? undefined,
    responsible: c.responsavel_nome ?? undefined,
    notes: c.observacoes ?? undefined,
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
 * Converte o payload emitido pelo `ContatoFormModal` no objeto de criação/edição
 * de um `Contact`. Fonte ÚNICA de verdade para essa transformação — usada tanto
 * pelo painel CRM > Contatos quanto pelo vínculo de contatos no cadastro de
 * artista (EquipeContatosCRM), evitando lógica duplicada.
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
