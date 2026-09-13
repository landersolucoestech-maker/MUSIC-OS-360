import { useEffect, useMemo, useState } from "react";
import { contactsService } from "../services";
import { clientsService, type ApiClient, type CreateApiClientInput, type UpdateApiClientInput } from "../services/clients.service";
import type { Cliente, ClienteInsert, ClientSegment, ClienteUpdate, Contact } from "../types";

export type { Cliente, ClienteInsert, ClienteUpdate, ClientSegment, Contact };

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

/** Mapeia a resposta real de `/clients` (ClientsService.mapClient) para o
 * view-model `Cliente` consumido pelos formulários de contratos/agenda/
 * financeiro/nota fiscal/dashboard. */
function apiClientToCliente(c: ApiClient): Cliente {
  const isPF = c.tipo_pessoa === "pessoa_fisica";
  const enderecoCompleto = c.endereco_completo ?? c.address ?? null;
  return {
    id: c.id,
    nome: c.nome ?? c.name,
    razao_social: c.razao_social ?? null,
    email: c.email ?? null,
    telefone: c.phone ?? null,
    empresa: c.razao_social ?? c.nome_fantasia ?? null,
    cidade: c.cidade ?? null,
    estado: c.estado ?? null,
    endereco: enderecoCompleto,
    endereco_completo: enderecoCompleto,
    cep: c.cep ?? null,
    status: c.status ?? null,
    cpf: isPF ? c.document ?? null : null,
    cnpj: !isPF ? c.document ?? null : null,
    cpf_cnpj: c.document ?? null,
    tipo_pessoa: c.tipo_pessoa ?? null,
    responsavel: c.responsavel_nome ?? null,
    observacoes: c.observacoes ?? null,
    type: c.tipo_pessoa ?? null,
    segmento: c.categoria ?? null,
  };
}

function clienteInsertToApiInput(data: ClienteInsert): CreateApiClientInput {
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

function clienteUpdateToApiInput(data: ClienteUpdate): UpdateApiClientInput {
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
 * Clientes reais (tabela `clients`, backend `/clients`) — usado por
 * contratos, agenda, financeiro, nota fiscal e dashboard para selecionar/
 * exibir o cliente de um registro. Não deve ser confundido com Contatos do
 * CRM (useContacts/useSimpleContacts acima) — são entidades físicas
 * distintas; ver Parte 79 para o modelo canônico completo.
 */
export function useClientes() {
  const [apiClientes, setApiClientes] = useState<ApiClient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  async function refresh() {
    setIsLoading(true);
    try {
      setApiClientes(await clientsService.list());
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

  const clientes = useMemo(() => apiClientes.map(apiClientToCliente), [apiClientes]);

  return {
    clientes,
    isLoading,
    error,
    refetch: refresh,
    addCliente: {
      mutate: (data: ClienteInsert, options?: { onSuccess?: () => void }) =>
        void clientsService.create(clienteInsertToApiInput(data)).then(async (created) => { await refresh(); return created; }).then(options?.onSuccess),
      mutateAsync: async (data: ClienteInsert) => {
        const created = await clientsService.create(clienteInsertToApiInput(data));
        await refresh();
        return created;
      },
    },
    updateCliente: {
      mutate: (data: ClienteUpdate & { id: string }, options?: { onSuccess?: () => void }) =>
        void clientsService.update(data.id, clienteUpdateToApiInput(data)).then(async () => { await refresh(); }).then(options?.onSuccess),
      mutateAsync: async (data: ClienteUpdate & { id: string }) => {
        const updated = await clientsService.update(data.id, clienteUpdateToApiInput(data));
        await refresh();
        return updated;
      },
    },
    deleteCliente: {
      mutate: (id: string, options?: { onSuccess?: () => void }) =>
        void clientsService.remove(id).then(async () => { await refresh(); }).then(options?.onSuccess),
      mutateAsync: async (id: string) => {
        await clientsService.remove(id);
        await refresh();
      },
    },
  };
}
