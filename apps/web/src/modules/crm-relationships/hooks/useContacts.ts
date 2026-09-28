import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { QUERY_KEYS } from "@/shared/lib/query-config";
import { contactsService } from "../services";
import { clientsService, type ApiClient, type CreateApiClientInput, type UpdateApiClientInput } from "../services/clients.service";
import type { Contact, ContactInput } from "../types";

export type { Contact };

/** Both views read the same `clients` table: a write through either invalidates both. */
const CONTACTS_QUERY_KEY = [...QUERY_KEYS.CLIENTS, "contacts", "all"];
const CLIENTS_QUERY_KEY = [...QUERY_KEYS.CLIENTS, "raw", "all"];
const EMPTY_CONTACTS: Contact[] = [];
const EMPTY_CLIENTS: ApiClient[] = [];

function invalidateClientQueries(queryClient: QueryClient): Promise<void> {
  return queryClient.invalidateQueries({ queryKey: [...QUERY_KEYS.CLIENTS] });
}

/**
 * CRM contacts (the tenant's `clients`, mapped to `Contact`). TanStack Query:
 * one shared cache for every consumer (CRM list, Vision360, schedule
 * participants, leads…) instead of one hand-rolled fetch per component; the
 * list is a full paged sweep, never the API's default first page.
 */
export function useContacts(enabled = true) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: CONTACTS_QUERY_KEY,
    queryFn: () => contactsService.list(),
    enabled,
  });
  const contacts = useMemo(() => query.data?.items ?? EMPTY_CONTACTS, [query.data]);
  const invalidate = () => invalidateClientQueries(queryClient);

  return {
    contacts,
    isLoading: enabled && query.isLoading,
    error: (query.error as Error | null) ?? null,
    /** true when the sweep hit its safety ceiling: the list/metrics are partial. */
    truncated: query.data?.truncated ?? false,
    total: query.data?.total ?? 0,
    metrics: useMemo(() => ({
      total: query.data?.total ?? contacts.length,
      strategic: contacts.filter((contact) => contact.priority === "strategic").length,
      active: contacts.filter((contact) => contact.status === "active").length,
      withAttachments: contacts.filter((contact) => (contact.attachments?.length ?? 0) > 0).length,
    }), [contacts, query.data?.total]),
    createContact: async (data: ContactInput) => {
      const created = await contactsService.create(data);
      await invalidate();
      return created;
    },
    updateContact: async (id: string, data: Partial<ContactInput>, expectedUpdatedAt?: string) => {
      await contactsService.update(id, data, expectedUpdatedAt);
      await invalidate();
    },
    deleteContact: async (id: string) => {
      await contactsService.remove(id);
      await invalidate();
    },
    refetch: async () => { await query.refetch(); },
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

/**
 * Raw `/clients` rows (CZ-043 canonical wire contract) + record-level
 * mutations taking the canonical request body (e.g. the artist form creates
 * the artist's client record). The CRM view model is useContacts() above —
 * the same `clients` table, mapped to `Contact`.
 */
export function useClients() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: CLIENTS_QUERY_KEY,
    queryFn: () => clientsService.listAll(),
  });
  const invalidate = () => invalidateClientQueries(queryClient);

  const addClient = useMutation({
    mutationFn: (data: CreateApiClientInput) => clientsService.create(data),
    onSuccess: invalidate,
  });
  const updateClient = useMutation({
    mutationFn: ({ id, ...data }: UpdateApiClientInput & { id: string }) => clientsService.update(id, data),
    onSuccess: invalidate,
  });
  const deleteClient = useMutation({
    mutationFn: (id: string) => clientsService.remove(id),
    onSuccess: invalidate,
  });

  return {
    clients: query.data?.items ?? EMPTY_CLIENTS,
    isLoading: query.isLoading,
    error: (query.error as Error | null) ?? null,
    truncated: query.data?.truncated ?? false,
    refetch: async () => { await query.refetch(); },
    addClient,
    updateClient,
    deleteClient,
  };
}
