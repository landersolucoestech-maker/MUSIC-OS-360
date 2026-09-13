// ============================================================================
// TeamContactsCRM — seção "Equipe / Contatos" do cadastro/edição de artista.
// ----------------------------------------------------------------------------
// Substitui os antigos campos manuais (Nome/Categoria/Telefone/E-mail) por
// VÍNCULOS com contatos já cadastrados no CRM (CRM > Contatos), que é a fonte
// única. O artista armazena apenas a referência (`contactId`); os dados exibidos
// (nome, categoria, telefone, e-mail) são resolvidos dinamicamente do CRM, então
// qualquer alteração no CRM reflete automaticamente aqui — sem duplicação.
//
// As `distribuidoras` são dado da RELAÇÃO artista↔contato (não do contato) e só
// aparecem quando a categoria do contato no CRM for Empresário / Gravadora /
// Editora — preservando o comportamento de distribuidoras já existente.
// ============================================================================

import { useMemo, useState } from "react";
import { Link2, Plus, Search, X } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Checkbox } from "@/shared/ui/checkbox";
import { useContacts } from "@/modules/crm-relationships/hooks/useContacts";
import { contatoPayloadToContactData } from "@/modules/crm-relationships/services/contacts.service";
import { ContatoFormModal, type ContatoFormPayload } from "@/modules/crm-relationships/modals/ContatoFormModal";
import { contactTypeOptions, labelFor } from "@/modules/crm-relationships/constants";
import type { Contact } from "@/modules/crm-relationships/types";
import type { DistributorEntry } from "@/modules/artist/types/artist.types";

// ─── Tipos ────────────────────────────────────────────────────────

export type { DistributorEntry };

export interface LinkedContactForm {
  contactId: string;
  distributors: DistributorEntry[];
}

interface TeamContactsCRMProps {
  value: LinkedContactForm[];
  onChange: (next: LinkedContactForm[]) => void;
}

// ─── Constantes ───────────────────────────────────────────────────

const DISTRIBUTORS_OPTIONS = [
  { id: "onerpm", label: "ONErpm" },
  { id: "distrokid", label: "DistroKid" },
  { id: "30por1", label: "30 Por 1" },
  { id: "symphonic", label: "Symphonic" },
  { id: "musicpro", label: "MusicPro" },
  { id: "somvibe", label: "Somvibe" },
  { id: "outros", label: "Outros" },
];

// Categorias do CRM (contactType) que mantêm a seção de Distribuidoras:
// Empresário Artístico, Gravadora/Selo e Editora Musical.
const DISTRIBUTOR_CONTACT_TYPES = new Set<Contact["contactType"]>([
  "ARTIST_MANAGER",
  "LABEL_RECORD",
  "MUSIC_PUBLISHER",
]);

// ─── Componente ───────────────────────────────────────────────────

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

  // Resultados da busca: contatos do CRM ainda não vinculados.
  const searchResults = useMemo(() => {
    const term = search.trim().toLowerCase();
    return contacts
      .filter((c) => !linkedIds.has(c.id))
      .filter((c) => {
        if (!term) return true;
        const categoria = labelFor(contactTypeOptions, c.contactType);
        const haystack = [c.name, c.companyName, categoria, c.email, c.phone, c.whatsapp]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(term);
      })
      .slice(0, 8);
  }, [contacts, linkedIds, search]);

  // ── Vínculos ────────────────────────────────────────────────────
  function addLink(contactId: string) {
    if (linkedIds.has(contactId)) return;
    onChange([...value, { contactId, distributors: [] }]);
    setSearch("");
    setSearchOpen(false);
  }

  function removeLink(contactId: string) {
    onChange(value.filter((v) => v.contactId !== contactId));
  }

  // ── Distribuidoras (por vínculo) ────────────────────────────────
  function updateDistributors(contactId: string, dists: DistributorEntry[]) {
    onChange(value.map((v) => (v.contactId === contactId ? { ...v, distributors: dists } : v)));
  }

  function toggleDistributor(contactId: string, distId: string, checked: boolean) {
    const link = value.find((v) => v.contactId === contactId);
    if (!link) return;
    const next = checked
      ? [...link.distributors, { id: distId, email: "", customName: distId === "outros" ? "" : undefined }]
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

  // ── Novo Contato (cria no CRM e vincula automaticamente) ────────
  async function handleNewContact(payload: ContatoFormPayload) {
    const created = await createContact(contatoPayloadToContactData(payload));
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
            data-testid="button-vincular-contato-crm"
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
            data-testid="button-novo-contato-crm"
          >
            <Plus className="h-3 w-3" />
            Novo Contato
          </Button>
        </div>
      </div>

      {/* Busca de contatos do CRM */}
      {searchOpen && (
        <div className="space-y-2 rounded-lg border bg-muted/10 p-3" data-testid="crm-contato-search">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar contato do CRM por nome, categoria, telefone ou e-mail…"
              className="h-8 pl-7 text-sm"
              data-testid="input-crm-contato-search"
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
                  data-testid={`crm-contato-result-${c.id}`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{c.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {labelFor(contactTypeOptions, c.contactType)}
                      {(c.phone || c.whatsapp) ? ` · ${c.phone || c.whatsapp}` : ""}
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

      {/* Equipe Vinculada */}
      {value.length === 0 ? (
        <p className="rounded-lg border border-dashed py-4 text-center text-xs text-muted-foreground">
          Nenhum contato vinculado. Use "Vincular Contato do CRM" ou "Novo Contato".
        </p>
      ) : (
        <div className="space-y-2" data-testid="equipe-vinculada">
          {value.map((link) => {
            const contact = contactById.get(link.contactId);
            const showDistribuidoras = contact ? DISTRIBUTOR_CONTACT_TYPES.has(contact.contactType) : false;

            return (
              <div
                key={link.contactId}
                className="rounded-lg border bg-muted/20 p-3"
                data-testid={`contato-vinculado-${link.contactId}`}
              >
                <div className="flex items-start justify-between gap-2">
                  {contact ? (
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold">{contact.name}</span>
                        <span className="rounded bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                          {labelFor(contactTypeOptions, contact.contactType)}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                        {(contact.phone || contact.whatsapp) && (
                          <span>{contact.phone || contact.whatsapp}</span>
                        )}
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
                    data-testid={`button-remover-vinculo-${link.contactId}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>

                {/* Distribuidoras — apenas para Empresário / Gravadora / Editora */}
                {showDistribuidoras && (
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

                            {isChecked && dist.id === "outros" && (
                              <div className="ml-6 space-y-1.5">
                                <Input
                                  value={entry?.customName ?? ""}
                                  onChange={(e) =>
                                    updateDistributorField(link.contactId, dist.id, { customName: e.target.value })
                                  }
                                  placeholder="Nome da distribuidora…"
                                  className="h-7 text-xs"
                                  data-testid={`input-dist-nome-custom-${link.contactId}`}
                                />
                                {(entry?.customName ?? "").trim().length > 0 && (
                                  <Input
                                    value={entry?.email ?? ""}
                                    onChange={(e) =>
                                      updateDistributorField(link.contactId, dist.id, { email: e.target.value })
                                    }
                                    type="email"
                                    placeholder="Email de share…"
                                    className="h-7 text-xs"
                                    data-testid={`input-dist-email-share-${link.contactId}-${dist.id}`}
                                  />
                                )}
                              </div>
                            )}

                            {isChecked && dist.id !== "outros" && (
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

      {/* Modal de criação de contato no CRM */}
      <ContatoFormModal
        open={newContactOpen}
        mode="create"
        onOpenChange={setNewContactOpen}
        onSubmit={handleNewContact}
      />
    </div>
  );
}
