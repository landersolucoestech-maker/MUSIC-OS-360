// ============================================================================
// TeamContactsCRM — the "Equipe / Contatos" section of artist create/edit.
// ----------------------------------------------------------------------------
// Replaces the old manual fields (name/category/phone/email) with LINKS to
// contacts already registered in the CRM (CRM > Contatos), which is the single
// source. The artist stores only the reference (`contactId`); the displayed
// data (name, category, phone, email) is resolved dynamically from the CRM, so
// any CRM change is reflected here automatically — no duplication.
//
// `distribuidoras` are data of the artist↔contact RELATION (not of the contact)
// and only appear when the contact's CRM category is Empresário / Gravadora /
// Editora — preserving the existing distributors behavior.
// ============================================================================

import { useMemo, useState } from "react";
import { Link2, Plus, Search, X } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Checkbox } from "@/shared/ui/checkbox";
import { useContacts } from "@/modules/crm-relationships/hooks/useContacts";
import { contactFormToContactInput } from "@/modules/crm-relationships/services/contacts.service";
import { ContactFormModal, type ContactFormValues } from "@/modules/crm-relationships/modals/ContactFormModal";
import { contactTypeOptions, labelFor } from "@/modules/crm-relationships/constants";
import type { Contact } from "@/modules/crm-relationships/types";
import { isOtherDistributorId } from "@/modules/artist/lib/distributor-id";
import type { DistributorEntry } from "@/modules/artist/types/artist.types";

// ─── Types ────────────────────────────────────────────────────────

export type { DistributorEntry };

export interface LinkedContactForm {
  contactId: string;
  distributors: DistributorEntry[];
}

interface TeamContactsCRMProps {
  value: LinkedContactForm[];
  onChange: (next: LinkedContactForm[]) => void;
}

// ─── Constants ───────────────────────────────────────────────────

const DISTRIBUTORS_OPTIONS = [
  { id: "onerpm", label: "ONErpm" },
  { id: "distrokid", label: "DistroKid" },
  { id: "30por1", label: "30 Por 1" },
  { id: "symphonic", label: "Symphonic" },
  { id: "musicpro", label: "MusicPro" },
  { id: "somvibe", label: "Somvibe" },
  { id: "other", label: "Outros" },
];

// CRM categories (Contact.category) that keep the distributors section:
// artist manager, record label and music publisher.
const DISTRIBUTOR_CONTACT_TYPES = new Set<Contact["category"]>([
  "ARTIST_MANAGER",
  "LABEL_RECORD",
  "MUSIC_PUBLISHER",
]);

// ─── Component ───────────────────────────────────────────────────

export function TeamContactsCRM({ value, onChange }: TeamContactsCRMProps) {
  const { contacts, createContact } = useContacts();

  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [newContactOpen, setNewContactOpen] = useState(false);

  const linkedIds = useMemo(() => new Set(value.map((v) => v.contactId)), [value]);

  const contactById = useMemo(() => {
    const map = new Map<string, Contact>();
    for (const c of contacts) map.set(c.id, c);
    return map;
  }, [contacts]);

  // Search results: CRM contacts not linked yet.
  const searchResults = useMemo(() => {
    const term = search.trim().toLowerCase();
    return contacts
      .filter((c) => !linkedIds.has(c.id))
      .filter((c) => {
        if (!term) return true;
        const category = labelFor(contactTypeOptions, c.category);
        const haystack = [c.name, c.legalName, c.tradeName, category, c.email, c.phone]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(term);
      })
      .slice(0, 8);
  }, [contacts, linkedIds, search]);

  // ── Links ───────────────────────────────────────────────────────
  function addLink(contactId: string) {
    if (linkedIds.has(contactId)) return;
    onChange([...value, { contactId, distributors: [] }]);
    setSearch("");
    setSearchOpen(false);
  }

  function removeLink(contactId: string) {
    onChange(value.filter((v) => v.contactId !== contactId));
  }

  // ── Distributors (per link) ─────────────────────────────────────
  function updateDistributors(contactId: string, dists: DistributorEntry[]) {
    onChange(value.map((v) => (v.contactId === contactId ? { ...v, distributors: dists } : v)));
  }

  function toggleDistributor(contactId: string, distId: string, checked: boolean) {
    const link = value.find((v) => v.contactId === contactId);
    if (!link) return;
    const next = checked
      ? [...link.distributors, { id: distId, email: "", customName: isOtherDistributorId(distId) ? "" : undefined }]
      : link.distributors.filter((d) => d.id !== distId);
    updateDistributors(contactId, next);
  }

  function updateDistributorField(contactId: string, distId: string, patch: Partial<DistributorEntry>) {
    const link = value.find((v) => v.contactId === contactId);
    if (!link) return;
    updateDistributors(
      contactId,
      link.distributors.map((d) => (d.id === distId ? { ...d, ...patch } : d)),
    );
  }

  // ── New contact (creates it in the CRM and links it automatically) ──
  async function handleNewContact(values: ContactFormValues) {
    const created = await createContact(contactFormToContactInput(values));
    if (created?.id) addLink(created.id);
  }

  return (
    <div className="space-y-3 pt-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm text-muted-foreground">Equipe / Contatos</Label>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => setSearchOpen((v) => !v)}
            data-testid="button-link-crm-contact"
          >
            <Link2 className="h-3 w-3" />
            Vincular Contato do CRM
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => setNewContactOpen(true)}
            data-testid="button-new-crm-contact"
          >
            <Plus className="h-3 w-3" />
            Novo Contato
          </Button>
        </div>
      </div>

      {/* CRM contact search */}
      {searchOpen && (
        <div className="space-y-2 rounded-lg border bg-muted/10 p-3" data-testid="crm-contact-search">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar contato do CRM por nome, categoria, telefone ou e-mail…"
              className="h-8 pl-7 text-sm"
              data-testid="input-crm-contact-search"
            />
          </div>
          <div className="max-h-56 space-y-1 overflow-y-auto">
            {searchResults.length === 0 ? (
              <p className="py-3 text-center text-xs text-muted-foreground">
                Nenhum contato encontrado no CRM. Use "Novo Contato" para cadastrar.
              </p>
            ) : (
              searchResults.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => addLink(c.id)}
                  className="flex w-full items-center justify-between rounded-md border border-transparent px-2 py-1.5 text-left hover:border-border hover:bg-background"
                  data-testid={`crm-contact-result-${c.id}`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{c.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {labelFor(contactTypeOptions, c.category)}
                      {c.phone ? ` · ${c.phone}` : ""}
                      {c.email ? ` · ${c.email}` : ""}
                    </p>
                  </div>
                  <Plus className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* Linked team */}
      {value.length === 0 ? (
        <p className="rounded-lg border border-dashed py-4 text-center text-xs text-muted-foreground">
          Nenhum contato vinculado. Use "Vincular Contato do CRM" ou "Novo Contato".
        </p>
      ) : (
        <div className="space-y-2" data-testid="linked-team">
          {value.map((link) => {
            const contact = contactById.get(link.contactId);
            const showDistributors = contact ? DISTRIBUTOR_CONTACT_TYPES.has(contact.category) : false;

            return (
              <div
                key={link.contactId}
                className="rounded-lg border bg-muted/20 p-3"
                data-testid={`linked-contact-${link.contactId}`}
              >
                <div className="flex items-start justify-between gap-2">
                  {contact ? (
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold">{contact.name}</span>
                        <span className="rounded bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                          {labelFor(contactTypeOptions, contact.category)}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                        {contact.phone && <span>{contact.phone}</span>}
                        {contact.email && <span>{contact.email}</span>}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs italic text-destructive">
                      Contato indisponível (removido do CRM)
                    </p>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 shrink-0 p-0 text-muted-foreground hover:text-destructive"
                    onClick={() => removeLink(link.contactId)}
                    data-testid={`button-remove-link-${link.contactId}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>

                {/* Distributors — only for Empresário / Gravadora / Editora */}
                {showDistributors && (
                  <div className="mt-3 space-y-3 border-t border-border/40 pt-3">
                    <Label className="text-xs text-muted-foreground">Distribuidoras</Label>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                      {DISTRIBUTORS_OPTIONS.map((dist) => {
                        const entry = link.distributors.find((d) => d.id === dist.id);
                        const isChecked = !!entry;
                        return (
                          <div key={dist.id} className="space-y-1.5">
                            <div className="flex items-center gap-2">
                              <Checkbox
                                id={`dist-${link.contactId}-${dist.id}`}
                                checked={isChecked}
                                onCheckedChange={(checked) =>
                                  toggleDistributor(link.contactId, dist.id, !!checked)
                                }
                                data-testid={`checkbox-dist-${link.contactId}-${dist.id}`}
                              />
                              <Label
                                htmlFor={`dist-${link.contactId}-${dist.id}`}
                                className="cursor-pointer text-xs font-medium"
                              >
                                {dist.label}
                              </Label>
                            </div>

                            {isChecked && isOtherDistributorId(dist.id) && (
                              <div className="ml-6 space-y-1.5">
                                <Input
                                  value={entry?.customName ?? ""}
                                  onChange={(e) =>
                                    updateDistributorField(link.contactId, dist.id, { customName: e.target.value })
                                  }
                                  placeholder="Nome da distribuidora…"
                                  className="h-7 text-xs"
                                  data-testid={`input-dist-name-custom-${link.contactId}`}
                                />
                                {(entry?.customName ?? "").trim().length > 0 && (
                                  <Input
                                    value={entry?.email ?? ""}
                                    onChange={(e) =>
                                      updateDistributorField(link.contactId, dist.id, { email: e.target.value })
                                    }
                                    type="email"
                                    placeholder="E-mail de share…"
                                    className="h-7 text-xs"
                                    data-testid={`input-dist-email-share-${link.contactId}-${dist.id}`}
                                  />
                                )}
                              </div>
                            )}

                            {isChecked && !isOtherDistributorId(dist.id) && (
                              <div className="ml-6">
                                <Input
                                  value={entry?.email ?? ""}
                                  onChange={(e) =>
                                    updateDistributorField(link.contactId, dist.id, { email: e.target.value })
                                  }
                                  type="email"
                                  placeholder={`Email de share — ${dist.label}`}
                                  className="h-7 text-xs"
                                  data-testid={`input-dist-email-share-${link.contactId}-${dist.id}`}
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* CRM contact creation modal */}
      <ContactFormModal
        open={newContactOpen}
        mode="create"
        onOpenChange={setNewContactOpen}
        onSubmit={handleNewContact}
      />
    </div>
  );
}
