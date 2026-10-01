import { forwardRef, useImperativeHandle, useMemo, useState } from "react";
import { runBulkAction, reportBulkResult } from "@/shared/hooks/useBulkAction";
import { getExpectedUpdatedAt } from "@/shared/hooks/useConcurrencyConflict";
import { Input } from "@/shared/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { ContactsTable } from "./ContactsTable";
import { useContacts } from "../hooks/useContacts";
import { contactFormToContactInput, contactToFormValues } from "../services/contacts.service";
import { ContactFormModal, type ContactFormValues } from "../modals/ContactFormModal";
import { ContactViewModal } from "../modals/ContactViewModal";
import type { Contact, ContactType } from "../types";

// ─────────────────────────────────────────────
// Quick filters by category
// ─────────────────────────────────────────────
type TypeFilter =
  | "all"
  | "clients"
  | "partners"
  | "suppliers"
  | "contractors"
  | "providers";

const FILTERS: ReadonlyArray<{ value: TypeFilter; label: string; types: ContactType[] }> = [
  { value: "all",          label: "Todos",        types: [] },
  { value: "clients",      label: "Clientes",     types: ["CORPORATE_CLIENT"] },
  { value: "partners",     label: "Parceiros",    types: ["PARTNER"] },
  { value: "suppliers",    label: "Fornecedores", types: ["SUPPLIER"] },
  // ✅ "BRAND" removed — it does not exist in ContactType
  { value: "contractors",  label: "Contratantes", types: ["CORPORATE_CLIENT"] },
  { value: "providers",    label: "Prestadores",  types: ["SERVICE_PROVIDER"] },
];

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────
export type ContactsPanelHandle = {
  openCreate: () => void;
};

export const ContactsPanel = forwardRef<ContactsPanelHandle, Record<string, never>>(
  function ContactsPanel(_, ref) {
    const { contacts, isLoading, createContact, updateContact, deleteContact } = useContacts();

    const [filter, setFilter]         = useState<TypeFilter>("all");
    const [search, setSearch]         = useState("");
    const [viewContact, setViewContact] = useState<Contact | null>(null);
    const [editContact, setEditContact] = useState<Contact | null>(null);
    const [formOpen, setFormOpen]       = useState(false);

    // ── Filter ──────────────────────────────────
    const filtered = useMemo(() => {
      const cfg  = FILTERS.find((f) => f.value === filter)!;
      const term = search.trim().toLowerCase();
      return contacts.filter((c) => {
        if (cfg.types.length > 0 && (!c.category || !cfg.types.includes(c.category))) return false;
        if (!term) return true;
        const haystack = [c.name, c.legalName, c.tradeName, c.email, c.phone, c.city]
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

    async function handleFormSubmit(values: ContactFormValues) {
      const data = contactFormToContactInput(values);

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
      <div className="space-y-5" data-testid="contacts-panel">
        {/* Search bar + filter */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center rounded-lg bg-muted/30 p-3">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, empresa, e-mail, telefone ou cidade"
            className="h-8 flex-1 text-sm"
            data-testid="contacts-search"
          />
          <Select value={filter} onValueChange={(v) => setFilter(v as TypeFilter)}>
            <SelectTrigger className="h-8 w-auto min-w-[140px] text-sm" data-testid="contacts-filter-type">
              <SelectValue placeholder="Filtrar por tipo" />
            </SelectTrigger>
            <SelectContent>
              {FILTERS.map((f) => (
                <SelectItem key={f.value} value={f.value} data-testid={`filter-${f.value}`}>
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
          <p className="text-sm italic text-muted-foreground" data-testid="contacts-empty">
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
          initialValue={editContact ? contactToFormValues(editContact) : null}
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
