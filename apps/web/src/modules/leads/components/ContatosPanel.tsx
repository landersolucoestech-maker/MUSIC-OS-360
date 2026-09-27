import { useMemo, useState } from "react";
import { Input } from "@/shared/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { ContatosTable } from "@/modules/crm-relationships/components/ContatosTable";
import { useContacts } from "@/modules/crm-relationships/hooks/useContacts";
import { ContatoFormModal, type ContatoFormPayload } from "@/modules/crm-relationships/modals/ContatoFormModal";
import { ContatoViewModal } from "@/modules/crm-relationships/modals/ContatoViewModal";
import type { Contact, ContactType } from "@/modules/crm-relationships/types";

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
  { value: "contratantes", label: "Contratantes", types: ["COMPANY", "BRAND", "CORPORATE_CLIENT"] },
  { value: "prestadores",  label: "Prestadores",  types: ["SERVICE_PROVIDER"] },
];

function contactToFormPayload(contact: Contact): Partial<ContatoFormPayload> {
  const po = (contact.payloadOperacional ?? {}) as Record<string, unknown>;
  const str = (k: string) => (typeof po[k] === "string" ? (po[k] as string) : "");

  const personType = (str("tipo_pessoa") || "pessoa_fisica") as "pessoa_fisica" | "pessoa_juridica";
  const isPF = personType === "pessoa_fisica";

  return {
    tipo_pessoa:          personType,
    nome_pf:              isPF ? contact.name : "",
    cpf:                  str("cpf"),
    funcao:               str("funcao"),
    foto:                 str("foto"),
    razao_social:         str("razao_social") || (!isPF ? contact.name : ""),
    nome_fantasia:        str("nome_fantasia"),
    cnpj:                 str("cnpj"),
    cargo_responsavel:    str("cargo_responsavel"),
    categoria:            contact.contactType ?? "OTHER",
    email:                contact.email  ?? "",
    telefone:             contact.whatsapp ?? contact.phone ?? "",
    cep:                  str("cep")  || contact.zipCode  || "",
    logradouro:           str("logradouro"),
    numero:               str("numero"),
    complemento:          str("complemento"),
    bairro:               str("bairro"),
    cidade:               contact.city  ?? "",
    estado:               contact.state ?? "",
    status_contato:       contact.status   ?? "active",
    prioridade_contato:   contact.priority ?? "medium",
    responsavel_nome:     str("responsavel_nome")     || contact.responsible || "",
    responsavel_email:    str("responsavel_email"),
    responsavel_telefone: str("responsavel_telefone"),
    responsavel_cargo:    str("responsavel_cargo"),
    interacoes:           Array.isArray(po.interacoes) ? (po.interacoes as never) : [],
    attachments:          contact.attachments ?? [],
    observacoes:          contact.notes ?? "",
    nome:                 contact.name,
    cpf_cnpj:             contact.documentNumber ?? "",
    endereco:             contact.address ?? "",
    endereco_completo:    contact.address ?? "",
    responsavel:          contact.responsible ?? "",
    status:               contact.status ?? "active",
    prioridade:           contact.priority ?? "medium",
  };
}

export function ContactsPanel() {
  const { contacts, isLoading, createContact, updateContact, deleteContact } = useContacts();

  const [filter, setFilter] = useState<TypeFilter>("todos");
  const [search, setSearch] = useState("");
  const [viewContact, setViewContact] = useState<Contact | null>(null);
  const [editContact, setEditContact] = useState<Contact | null>(null);
  const [formOpen, setFormOpen] = useState(false);

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

  async function handleFormSubmit(payload: ContatoFormPayload) {
    const data = {
      name:           payload.nome,
      companyName:    payload.tipo_pessoa === "pessoa_juridica" ? payload.razao_social : undefined,
      contactType:    (payload.categoria || "OTHER") as Contact["contactType"],
      documentType:   payload.tipo_pessoa === "pessoa_fisica" ? "CPF" : "CNPJ",
      documentNumber: payload.cpf_cnpj,
      phone:          payload.telefone,
      whatsapp:       payload.telefone,
      email:          payload.email,
      address:        payload.endereco_completo,
      city:           payload.cidade,
      state:          payload.estado,
      country:        "Brasil",
      zipCode:        payload.cep,
      responsible:    payload.responsavel,
      notes:          payload.observacoes,
      tags:           [],
      status:         (payload.status_contato  || "active")  as Contact["status"],
      priority:       (payload.prioridade_contato || "medium") as Contact["priority"],
      attachments:    payload.attachments ?? [],
      timeline:       [],
      payloadOperacional: {
        tipo_pessoa:          payload.tipo_pessoa,
        cpf:                  payload.cpf,
        cnpj:                 payload.cnpj,
        razao_social:         payload.razao_social,
        nome_fantasia:        payload.nome_fantasia,
        funcao:               payload.funcao,
        cargo_responsavel:    payload.cargo_responsavel,
        foto:                 payload.foto,
        cep:                  payload.cep,
        logradouro:           payload.logradouro,
        numero:               payload.numero,
        complemento:          payload.complemento,
        bairro:               payload.bairro,
        responsavel_nome:     payload.responsavel_nome,
        responsavel_email:    payload.responsavel_email,
        responsavel_telefone: payload.responsavel_telefone,
        responsavel_cargo:    payload.responsavel_cargo,
        interacoes:           payload.interacoes,
      },
    };

    if (editContact) {
      await updateContact(editContact.id, data);
    } else {
      await createContact(data);
    }
  }

  return (
    <div className="space-y-5" data-testid="contatos-panel">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome, empresa, e-mail, telefone ou cidade"
          className="h-8 flex-1"
          data-testid="contatos-search"
        />
        <Select value={filter} onValueChange={(v) => setFilter(v as TypeFilter)}>
          <SelectTrigger className="h-8 sm:w-56" data-testid="contatos-filtro-type">
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

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando contatos...</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm italic text-muted-foreground" data-testid="contatos-empty">
          Nenhum contato encontrado.
        </p>
      ) : (
        <ContatosTable
          contacts={filtered}
          onView={handleView}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      )}

      <ContatoViewModal
        open={viewContact !== null}
        onOpenChange={(next) => { if (!next) setViewContact(null); }}
        contact={viewContact}
        onEdit={(contact) => {
          setViewContact(null);
          setTimeout(() => { handleEdit(contact); }, 50);
        }}
      />

      <ContatoFormModal
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
