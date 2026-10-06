/**
 * services/contacts.service.ts
 *
 * Real backend `/clients` (`clients` table, ClientsController/ClientsService
 * — apps/api/src/modules/clients). "Contact" and "Client" are the SAME
 * physical entity (a domain decision documented in
 * apps/api/src/database/migrations/20260719000010_RebuildClientsInCanonicalFormOrder.ts:
 * "Contact = Client" — `category` stores the relationship type:
 * CORPORATE_CLIENT/PARTNER/SUPPLIER/SERVICE_PROVIDER/INVESTOR/etc).
 *
 * SINGLE SOURCE OF TRUTH for the two contact translation boundaries (CZ-043):
 *   1. API wire (canonical snake_case = column names) ↔ internal `Contact`
 *      (camelCase) — `wireToContact`, `contactToCreateInput`,
 *      `contactToUpdateInput`. Every field goes to its own column; there is no
 *      `metadata`/"payloadOperacional" side channel, and a CPF/CNPJ travels
 *      ONLY in `cpf_cnpj` (the API stores it encrypted).
 *   2. Form values (ContactFormModal) ↔ `Contact` — `contactFormToContactInput`,
 *      `contactToFormValues` — used by the CRM > Contacts panel, the Leads
 *      page, MusicChat and the artist team section (TeamContactsCrm).
 *
 * `attachments` are the server-side `clients.attachments` list (read only
 * here); files are managed through /clients/:id/attachments.
 */
import type { Contact, ContactAttachment, ContactInput, Interaction } from "../types";
import type { ContactFormValues } from "../modals/ContactFormModal";
import { canonicalContactProfile } from "../constants/contact-classification";
import {
  clientsService,
  type ApiClient,
  type ClientWireInteraction,
  type CreateApiClientInput,
  type UpdateApiClientInput,
} from "./clients.service";

// ─── Wire → Contact ───────────────────────────────────────────────

const opt = (value: string | null | undefined): string | undefined =>
  value == null || value === "" ? undefined : value;

function wireToInteraction(item: ClientWireInteraction, index: number, contactId: string): Interaction {
  return {
    // Items written by this client always carry an id; the positional id only
    // keys an item persisted without one (the API makes `id` optional).
    id: item.id || `${contactId}-interaction-${index}`,
    type: item.type,
    date: item.date ?? "",
    time: item.time ?? "",
    description: item.description ?? "",
  };
}

export function wireToContact(c: ApiClient): Contact {
  return {
    id: c.id,
    personType: c.person_type,
    category: c.category ?? undefined,
    profile: c.profile ? canonicalContactProfile(c.profile) : opt(c.profile),
    name: c.name,
    photoUrl: opt(c.photo_url),
    individualName: opt(c.individual_name),
    legalName: opt(c.legal_name),
    tradeName: opt(c.trade_name),
    email: opt(c.email),
    phone: opt(c.phone),
    cpfCnpj: opt(c.cpf_cnpj),
    instagram: opt(c.instagram),
    jobTitle: opt(c.job_title),
    street: opt(c.street),
    streetNumber: opt(c.street_number),
    addressComplement: opt(c.address_complement),
    neighborhood: opt(c.neighborhood),
    city: opt(c.city),
    state: opt(c.state),
    zipCode: opt(c.zip_code),
    address: opt(c.address),
    priority: c.priority ?? undefined,
    responsibleName: opt(c.responsible_name),
    responsibleJobTitle: opt(c.responsible_job_title),
    responsibleEmail: opt(c.responsible_email),
    responsiblePhone: opt(c.responsible_phone),
    notes: opt(c.notes),
    interactions: Array.isArray(c.interactions)
      ? c.interactions.map((item, index) => wireToInteraction(item, index, c.id))
      : [],
    status: c.status,
    attachments: Array.isArray(c.attachments) ? (c.attachments as ContactAttachment[]) : [],
    createdAt: c.created_at,
    updatedAt: c.updated_at,
  };
}

// ─── Contact → wire ───────────────────────────────────────────────

/** An empty text field clears its column (`null`), never sends "" (e.g. `@IsEmail`). */
const text = (value: string | undefined): string | null => {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
};

function interactionToWire(item: Interaction): ClientWireInteraction {
  return { id: item.id, type: item.type, date: item.date, time: item.time, description: item.description };
}

/**
 * Canonical column payload of the fields PRESENT in `data` (a partial update
 * sends only what changed). Never emits `metadata`, `status` (update-only) or
 * any pre-CZ-043 key.
 */
function contactFieldsToWire(data: Partial<ContactInput>): Partial<CreateApiClientInput> {
  const wire: Partial<CreateApiClientInput> = {};
  if (data.name !== undefined) wire.name = data.name.trim();
  if (data.personType !== undefined) wire.person_type = data.personType;
  if ("category" in data) wire.category = data.category ?? null;
  if ("profile" in data) wire.profile = text(data.profile);
  if ("photoUrl" in data) wire.photo_url = text(data.photoUrl);
  if ("individualName" in data) wire.individual_name = text(data.individualName);
  if ("legalName" in data) wire.legal_name = text(data.legalName);
  if ("tradeName" in data) wire.trade_name = text(data.tradeName);
  if ("email" in data) wire.email = text(data.email);
  if ("phone" in data) wire.phone = text(data.phone);
  if ("cpfCnpj" in data) wire.cpf_cnpj = text(data.cpfCnpj);
  if ("instagram" in data) wire.instagram = text(data.instagram);
  if ("jobTitle" in data) wire.job_title = text(data.jobTitle);
  if ("street" in data) wire.street = text(data.street);
  if ("streetNumber" in data) wire.street_number = text(data.streetNumber);
  if ("addressComplement" in data) wire.address_complement = text(data.addressComplement);
  if ("neighborhood" in data) wire.neighborhood = text(data.neighborhood);
  if ("city" in data) wire.city = text(data.city);
  if ("state" in data) wire.state = text(data.state);
  if ("zipCode" in data) wire.zip_code = text(data.zipCode);
  if ("address" in data) wire.address = text(data.address);
  if ("priority" in data) wire.priority = data.priority ?? null;
  if ("responsibleName" in data) wire.responsible_name = text(data.responsibleName);
  if ("responsibleJobTitle" in data) wire.responsible_job_title = text(data.responsibleJobTitle);
  if ("responsibleEmail" in data) wire.responsible_email = text(data.responsibleEmail);
  if ("responsiblePhone" in data) wire.responsible_phone = text(data.responsiblePhone);
  if ("notes" in data) wire.notes = text(data.notes);
  if (data.interactions !== undefined) wire.interactions = data.interactions.map(interactionToWire);
  return wire;
}

/** POST /clients body. `status` is not accepted on create (the row starts active). */
export function contactToCreateInput(data: ContactInput): CreateApiClientInput {
  return { ...contactFieldsToWire(data), name: data.name.trim() };
}

/** PATCH /clients/:id body — only the fields present in `data`, plus `status`. */
export function contactToUpdateInput(data: Partial<ContactInput>, expectedUpdatedAt?: string): UpdateApiClientInput {
  const wire: UpdateApiClientInput = contactFieldsToWire(data);
  if (data.status !== undefined) wire.status = data.status;
  if (expectedUpdatedAt !== undefined) wire.expectedUpdatedAt = expectedUpdatedAt;
  return wire;
}

// ─── Form values ↔ Contact ───────────────────────────────────────

/** Display name: individual name, or trade name falling back to legal name. */
export function deriveContactName(values: Pick<ContactFormValues, "personType" | "individualName" | "tradeName" | "legalName">): string {
  return values.personType === "individual"
    ? values.individualName
    : values.tradeName || values.legalName;
}

/** One-line formatted address stored in `clients.address`. */
export function buildFullAddress(values: Pick<ContactFormValues, "street" | "streetNumber" | "addressComplement" | "neighborhood" | "city" | "state" | "zipCode">): string {
  const line1 = [values.street, values.streetNumber].filter(Boolean).join(", ");
  const line2 = [line1, values.addressComplement].filter(Boolean).join(" - ");
  const base = [line2, values.neighborhood].filter(Boolean).join(" / ");
  const cityState = [values.city, values.state].filter(Boolean).join(" - ");
  const zip = values.zipCode ? `CEP ${values.zipCode}` : "";
  return [base, cityState, zip].filter(Boolean).join(" · ");
}

/**
 * Converts the values emitted by `ContactFormModal` into a Contact create/edit
 * input. The CPF (individual) or CNPJ (company) goes only to `cpfCnpj`.
 */
export function contactFormToContactInput(values: ContactFormValues): ContactInput {
  const isIndividual = values.personType === "individual";
  return {
    personType: values.personType,
    category: (values.category || undefined) as Contact["category"],
    profile: values.profile,
    name: deriveContactName(values),
    photoUrl: values.photoUrl,
    individualName: values.individualName,
    legalName: values.legalName,
    tradeName: values.tradeName,
    email: values.email,
    phone: values.phone,
    cpfCnpj: isIndividual ? values.cpf : values.cnpj,
    instagram: values.instagram,
    jobTitle: values.jobTitle,
    street: values.street,
    streetNumber: values.streetNumber,
    addressComplement: values.addressComplement,
    neighborhood: values.neighborhood,
    city: values.city,
    state: values.state,
    zipCode: values.zipCode,
    address: buildFullAddress(values),
    priority: values.priority,
    responsibleName: values.responsibleName,
    responsibleJobTitle: values.responsibleJobTitle,
    responsibleEmail: values.responsibleEmail,
    responsiblePhone: values.responsiblePhone,
    notes: values.notes,
    interactions: values.interactions,
    status: values.status,
    attachments: values.attachments,
  };
}

/** Pre-fills the edit form from a stored Contact (columns only). */
export function contactToFormValues(contact: Contact): Partial<ContactFormValues> {
  const isIndividual = contact.personType === "individual";
  return {
    personType: contact.personType,
    individualName: contact.individualName ?? (isIndividual ? contact.name : ""),
    cpf: isIndividual ? contact.cpfCnpj ?? "" : "",
    jobTitle: contact.jobTitle ?? "",
    instagram: contact.instagram ?? "",
    photoUrl: contact.photoUrl ?? "",
    legalName: contact.legalName ?? (!isIndividual ? contact.name : ""),
    tradeName: contact.tradeName ?? "",
    cnpj: !isIndividual ? contact.cpfCnpj ?? "" : "",
    category: contact.category ?? "",
    profile: contact.profile ?? "",
    email: contact.email ?? "",
    phone: contact.phone ?? "",
    zipCode: contact.zipCode ?? "",
    street: contact.street ?? "",
    streetNumber: contact.streetNumber ?? "",
    addressComplement: contact.addressComplement ?? "",
    neighborhood: contact.neighborhood ?? "",
    city: contact.city ?? "",
    state: contact.state ?? "",
    status: contact.status,
    ...(contact.priority ? { priority: contact.priority } : {}),
    responsibleName: contact.responsibleName ?? "",
    responsibleEmail: contact.responsibleEmail ?? "",
    responsiblePhone: contact.responsiblePhone ?? "",
    responsibleJobTitle: contact.responsibleJobTitle ?? "",
    interactions: contact.interactions,
    attachments: contact.attachments ?? [],
    notes: contact.notes ?? "",
  };
}

// ─── Service ──────────────────────────────────────────────────────

export interface ContactListResult {
  items: Contact[];
  /** Real backend total. */
  total: number;
  /** true when the sweep hit its safety ceiling before covering `total`. */
  truncated: boolean;
}

export const contactsService = {
  /** Every contact of the tenant (full paged sweep — see clientsService.listAll). */
  async list(): Promise<ContactListResult> {
    const { items, total, truncated } = await clientsService.listAll();
    return {
      items: items.map(wireToContact).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
      total,
      truncated,
    };
  },
  async listSimple(): Promise<{ id: string; name: string }[]> {
    const { items: contacts } = await contactsService.list();
    return contacts
      .map((contact) => ({ id: contact.id, name: contact.name }))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }));
  },
  async create(data: ContactInput): Promise<Contact> {
    const created = await clientsService.create(contactToCreateInput(data));
    return wireToContact(created);
  },
  async update(id: string, data: Partial<ContactInput>, expectedUpdatedAt?: string): Promise<Contact> {
    const updated = await clientsService.update(id, contactToUpdateInput(data, expectedUpdatedAt));
    return wireToContact(updated);
  },
  async remove(id: string): Promise<void> {
    await clientsService.remove(id);
  },
};
