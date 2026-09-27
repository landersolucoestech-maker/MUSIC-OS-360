import { useEffect, useMemo, useState } from "react";
import { contactsService } from "../services";
import { clientsService, type ApiClient, type CreateApiClientInput, type UpdateApiClientInput } from "../services/clients.service";
import type { Client, ClientInsert, ClientSegment, ClientUpdate, Contact } from "../types";

export type { Client as Cliente, ClientInsert as ClienteInsert, ClientUpdate as ClienteUpdate, ClientSegment, Contact };

export function useContacts(enabled = true) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoading, setIsLoading] = useState(enabled);
  const [error, setError] = useState<Error | null>(null);

  async function refresh() {
    setIsLoading(true);
    try {
      setContacts(await contactsService.list());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (enabled) void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return {
    contacts,
    isLoading,
    error,
    metrics: useMemo(() => ({
      total: contacts.length,
      strategic: contacts.filter((contact) => contact.priority === "strategic").length,
      active: contacts.filter((contact) => contact.status === "active" || contact.status === "favorite").length,
      withAttachments: contacts.filter((contact) => (contact.attachments?.length ?? 0) > 0).length,
    }), [contacts]),
    createContact: async (data: Parameters<typeof contactsService.create>[0]) => {
      const created = await contactsService.create(data);
      await refresh();
      return created;
    },
    updateContact: async (id: string, data: Partial<Contact>, expectedUpdatedAt?: string) => {
      await contactsService.update(id, data, expectedUpdatedAt);
      await refresh();
    },
    deleteContact: async (id: string) => {
      await contactsService.remove(id);
      await refresh();
    },
    refetch: refresh,
  };
}

export function useSimpleContacts() {
  const { contacts, isLoading } = useContacts();

  return {
    contacts: useMemo(() => contacts.map((contact) => ({ id: contact.id, name: contact.name })), [contacts]),
    isLoading,
    error: null,
  };
}

/** Maps the real `/clients` response (ClientsService.mapClient) to the
 * `Cliente` view model consumed by the contracts/calendar/
 * finance/invoice/dashboard forms. */
function apiClientToClient(c: ApiClient): Client {
  const isPF = c.type === "pessoa_fisica";
  const address = c.address ?? null;
  return {
    id: c.id,
    nome: c.name,
    razao_social: c.razao_social ?? null,
    email: c.email ?? null,
    telefone: c.phone ?? null,
    empresa: c.razao_social ?? c.nome_fantasia ?? null,
    cidade: c.city ?? null,
    estado: c.state ?? null,
    endereco: address,
    endereco_completo: address,
    cep: c.cep ?? null,
    status: c.status ?? null,
    cpf: isPF ? c.document ?? null : null,
    cnpj: !isPF ? c.document ?? null : null,
    cpf_cnpj: c.document ?? null,
    tipo_pessoa: c.type ?? null,
    responsavel: c.responsavel_nome ?? null,
    observacoes: c.notes ?? null,
    type: c.type ?? null,
    segmento: c.category ?? null,
  };
}

function clientInsertToApiInput(data: ClientInsert): CreateApiClientInput {
  const cnpj = data.cnpj ?? (data.tipo_pessoa === "pessoa_juridica" || data.tipo_pessoa === "juridica" ? data.cpf_cnpj : undefined);
  const cpf = data.cpf ?? (data.tipo_pessoa === "pessoa_fisica" || data.tipo_pessoa === "fisica" ? data.cpf_cnpj : undefined);
  return {
    name: data.nome,
    type: cnpj ? "company" : "person",
    category: data.segmento ?? undefined,
    email: data.email ?? undefined,
    phone: data.telefone ?? undefined,
    document: cnpj ?? cpf ?? data.cpf_cnpj ?? undefined,
    address: data.endereco ?? undefined,
  };
}

function clientUpdateToApiInput(data: ClientUpdate): UpdateApiClientInput {
  return {
    name: data.nome,
    category: data.segmento ?? undefined,
    email: data.email ?? undefined,
    phone: data.telefone ?? undefined,
    document: data.cnpj ?? data.cpf ?? data.cpf_cnpj ?? undefined,
    address: data.endereco ?? undefined,
  };
}

/**
 * Real clients (`clients` table, backend `/clients`) — used by
 * contracts, calendar, finance, invoices and the dashboard to select/
 * display a record's client. Must not be confused with CRM Contacts
 * (useContacts/useSimpleContacts above) — they are distinct physical
 * entities; see Part 79 for the full canonical model.
 */
export function useClients() {
  const [apiClients, setApiClients] = useState<ApiClient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  async function refresh() {
    setIsLoading(true);
    try {
      setApiClients(await clientsService.list());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const clients = useMemo(() => apiClients.map(apiClientToClient), [apiClients]);

  return {
    clients,
    isLoading,
    error,
    refetch: refresh,
    addClient: {
      mutate: (data: ClientInsert, options?: { onSuccess?: () => void }) =>
        void clientsService.create(clientInsertToApiInput(data)).then(async (created) => { await refresh(); return created; }).then(options?.onSuccess),
      mutateAsync: async (data: ClientInsert) => {
        const created = await clientsService.create(clientInsertToApiInput(data));
        await refresh();
        return created;
      },
    },
    updateClient: {
      mutate: (data: ClientUpdate & { id: string }, options?: { onSuccess?: () => void }) =>
        void clientsService.update(data.id, clientUpdateToApiInput(data)).then(async () => { await refresh(); }).then(options?.onSuccess),
      mutateAsync: async (data: ClientUpdate & { id: string }) => {
        const updated = await clientsService.update(data.id, clientUpdateToApiInput(data));
        await refresh();
        return updated;
      },
    },
    deleteClient: {
      mutate: (id: string, options?: { onSuccess?: () => void }) =>
        void clientsService.remove(id).then(async () => { await refresh(); }).then(options?.onSuccess),
      mutateAsync: async (id: string) => {
        await clientsService.remove(id);
        await refresh();
      },
    },
  };
}
