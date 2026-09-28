import { useEffect, useMemo, useState } from "react";
import { contactsService } from "../services";
import { clientsService, type ApiClient, type CreateApiClientInput, type UpdateApiClientInput } from "../services/clients.service";
import type { Contact, ContactInput } from "../types";

export type { Contact };

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
      active: contacts.filter((contact) => contact.status === "active").length,
      withAttachments: contacts.filter((contact) => (contact.attachments?.length ?? 0) > 0).length,
    }), [contacts]),
    createContact: async (data: ContactInput) => {
      const created = await contactsService.create(data);
      await refresh();
      return created;
    },
    updateContact: async (id: string, data: Partial<ContactInput>, expectedUpdatedAt?: string) => {
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

/**
 * Raw `/clients` rows (CZ-043 canonical wire contract) + record-level
 * mutations taking the canonical request body (e.g. the artist form creates
 * the artist's client record). The CRM view model is useContacts() above —
 * the same `clients` table, mapped to `Contact`.
 */
export function useClients() {
  const [clients, setClients] = useState<ApiClient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  async function refresh() {
    setIsLoading(true);
    try {
      setClients(await clientsService.list());
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

  return {
    clients,
    isLoading,
    error,
    refetch: refresh,
    addClient: {
      mutate: (data: CreateApiClientInput, options?: { onSuccess?: () => void }) =>
        void clientsService.create(data).then(async (created) => { await refresh(); return created; }).then(options?.onSuccess),
      mutateAsync: async (data: CreateApiClientInput) => {
        const created = await clientsService.create(data);
        await refresh();
        return created;
      },
    },
    updateClient: {
      mutate: ({ id, ...data }: UpdateApiClientInput & { id: string }, options?: { onSuccess?: () => void }) =>
        void clientsService.update(id, data).then(async () => { await refresh(); }).then(options?.onSuccess),
      mutateAsync: async ({ id, ...data }: UpdateApiClientInput & { id: string }) => {
        const updated = await clientsService.update(id, data);
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
