import { forwardRef, useImperativeHandle, useMemo, useState } from "react";
import { runBulkAction, reportBulkResult } from "@/shared/hooks/useBulkAction";
import { getExpectedUpdatedAt } from "@/shared/hooks/useConcurrencyConflict";
import { Input } from "@/shared/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { ContactsTable } from "./ContactsTable";
import { useContacts } from "../hooks/useContacts";
import { contactPayloadToContactData } from "../services/contacts.service";
import { ContactFormModal, type ContactFormPayload } from "../modals/ContactFormModal";
import { ContactViewModal } from "../modals/ContactViewModal";
import type { Contact, ContactType } from "../types";

// ─────────────────────────────────────────────
// Quick filters by category
// ─────────────────────────────────────────────
type TypeFilter =
  | "todos"
  | "clientes"
  | "parceiros"
  | "fornecedores"
  | "contratantes"
  | "prestadores";

const FILTERS: ReadonlyArray<{ value: TypeFilter; label: string; types: ContactType[] }> = [
  { value: "todos",        label: "Todos",        types: [] },
  { value: "clientes",     label: "Clientes",     types: ["CORPORATE_CLIENT"] },
  { value: "parceiros",    label: "Parceiros",    types: ["PARTNER"] },
  { value: "fornecedores", label: "Fornecedores", types: ["SUPPLIER"] },
  // ✅ "BRAND" removed — it does not exist in ContactType
  { value: "contratantes", label: "Contratantes", types: ["CORPORATE_CLIENT"] },
  { value: "prestadores",  label: "Prestadores",  types: ["SERVICE_PROVIDER"] },
];

// ─────────────────────────────────────────────
// Converts Contact → the initial ContatoFormPayload
// to fill the edit modal
// ─────────────────────────────────────────────
function contactToFormPayload(contact: Contact): Partial<ContactFormPayload> {
  const po = (contact.payloadOperacional ?? {}) as Record<string, unknown>;
  const str = (k: string) => (typeof po[k] === "string" ? (po[k] as string) : "");

  // Normalizes tipo_pessoa: accepts every legacy format and always returns
  // "pessoa_fisica" | "pessoa_juridica" — the only value ContactFormModal understands.
  const rawType = str("tipo_pessoa");
  const personType: "pessoa_fisica" | "pessoa_juridica" =
    rawType === "pessoa_juridica" ||
    rawType === "COMPANY" ||
    (contact as Record<string, unknown>)["entityType"] === "COMPANY"
      ? "pessoa_juridica"
      : "pessoa_fisica";

  const isIndividual = personType === "pessoa_fisica";

  return {
    // Entity
    tipo_pessoa: personType, // always "pessoa_fisica" | "pessoa_juridica"

    // Individual (natural person)
    nome_pf:           isIndividual ? contact.name : "",
    cpf:               str("cpf"),
    funcao:            str("funcao"),
    foto:              str("foto"),

    // Legal entity (company)
    razao_social:      !isIndividual ? contact.name : "",
    nome_fantasia:     str("nome_fantasia"),
    cnpj:              str("cnpj"),

    // Hierarchical classification
    categoria:         contact.contactType ?? "",
    perfil:            str("perfil"),
    instagram:         contact.instagram ?? "",
    email:             contact.email ?? "",
    telefone:          contact.whatsapp ?? contact.phone ?? "",

    // Address
    cep:               str("cep") || contact.zipCode || "",
    logradouro:        str("logradouro"),
    numero:            str("numero"),
    complemento:       str("complemento"),
    bairro:            str("bairro"),
    cidade:            contact.city ?? "",
    estado:            contact.state ?? "",

    // Classification
    status_contato:    contact.status ?? "active",
    prioridade_contato: contact.priority ?? "medium",

    // Responsible person
    responsavel_nome:     str("responsavel_nome") || contact.responsible || "",
    responsavel_email:    str("responsavel_email"),
    responsavel_telefone: str("responsavel_telefone"),
    // reads responsavel_cargo (current field) with a fallback to cargo_responsavel (legacy field)
    responsavel_cargo:    str("responsavel_cargo") || str("cargo_responsavel"),

    // History
    interacoes: Array.isArray(po.interacoes) ? (po.interacoes as never[]) : [],
    attachments: contact.attachments ?? [],

    // Notes
    observacoes: contact.notes ?? "",

    // Aliases legados
    nome:              contact.name,
    cpf_cnpj:          contact.documentNumber ?? "",
    endereco_completo: contact.address ?? "",
    responsavel:       contact.responsible ?? "",
  };
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────
export type ContactsPanelHandle = {
  openCreate: () => void;
};

export const ContactsPanel = forwardRef<ContactsPanelHandle, Record<string, never>>(
  function ContactsPanel(_, ref) {
    const { contacts, isLoading, createContact, updateContact, deleteContact } = useContacts();

    const [filter, setFilter]         = useState<TypeFilter>("todos");
    const [search, setSearch]         = useState("");
    const [viewContact, setViewContact] = useState<Contact | null>(null);
    const [editContact, setEditContact] = useState<Contact | null>(null);
    const [formOpen, setFormOpen]       = useState(false);

    // ── Filter ──────────────────────────────────
    const filtered = useMemo(() => {
      const cfg  = FILTERS.find((f) => f.value === filter)!;
      const term = search.trim().toLowerCase();
      return contacts.filter((c) => {
        if (cfg.types.length > 0 && !cfg.types.includes(c.contactType)) return false;
        if (!term) return true;
        const haystack = [c.name, c.companyName, c.email, c.phone, c.whatsapp, c.city]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(term);
      });
    }, [contacts, filter, search]);

    // ── Handlers ────────────────────────────────
    function handleView(contact: Contact) {
      setViewContact(contact);
    }

    function handleEdit(contact: Contact) {
      setEditContact(contact);
      setFormOpen(true);
    }

    async function handleDelete(contact: Contact) {
      await deleteContact(contact.id);
    }

    async function handleFormSubmit(payload: ContactFormPayload) {
      const data = contactPayloadToContactData(payload);

      if (editContact) {
        await updateContact(editContact.id, data, getExpectedUpdatedAt(editContact));
      } else {
        await createContact(data);
      }
    }

    useImperativeHandle(ref, () => ({
      openCreate: () => {
        setEditContact(null);
        setFormOpen(true);
      },
    }));

    return (
      <div className="space-y-5" data-testid="contatos-panel">
        {/* Search bar + filter */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center rounded-lg bg-muted/30 p-3">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, empresa, e-mail, telefone ou cidade"
            className="h-8 flex-1 text-sm"
            data-testid="contatos-search"
          />
          <Select value={filter} onValueChange={(v) => setFilter(v as TypeFilter)}>
            <SelectTrigger className="h-8 w-auto min-w-[140px] text-sm" data-testid="contatos-filtro-type">
              <SelectValue placeholder="Filtrar por tipo" />
            </SelectTrigger>
            <SelectContent>
              {FILTERS.map((f) => (
                <SelectItem key={f.value} value={f.value} data-testid={`filtro-${f.value}`}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando contatos...</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm italic text-muted-foreground" data-testid="contatos-empty">
            Nenhum contato encontrado.
          </p>
        ) : (
          <ContactsTable
            contacts={filtered}
            onView={handleView}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onBulkDelete={async (rows) => {
              const result = await runBulkAction(rows.map((c) => c.id), deleteContact);
              reportBulkResult(result, "excluído", "contato");
            }}
          />
        )}

        {/* View modal */}
        <ContactViewModal
          open={viewContact !== null}
          onOpenChange={(next) => { if (!next) setViewContact(null); }}
          contact={viewContact}
          onEdit={(contact) => {
            setViewContact(null);
            setTimeout(() => { handleEdit(contact); }, 50);
          }}
        />

        {/* Create / edit modal */}
        <ContactFormModal
          open={formOpen}
          mode={editContact ? "edit" : "create"}
          initialValue={editContact ? contactToFormPayload(editContact) : null}
          onOpenChange={(next) => {
            setFormOpen(next);
            if (!next) setEditContact(null);
          }}
          onSubmit={handleFormSubmit}
        />
      </div>
    );
  }
);
