import { useMemo } from "react";
import { useEntityLookup, useEntityById } from "@/shared/hooks/useEntityLookup";
import { useContacts } from "@/modules/crm-relationships/hooks/useContacts";
import { useUsers } from "@/modules/settings/hooks/useUsuarios";

export type AgendaParticipantSource = "artist" | "employee" | "user" | "contact";

export type AgendaParticipant = {
  source: AgendaParticipantSource;
  id: string;
  label: string;
  email?: string;
  phone?: string;
  category?: string;
};

interface ArtistLookup {
  id: string;
  nome_artistico?: string | null;
  nome?: string | null;
  email?: string | null;
  telefone?: string | null;
}

interface EmployeeLookup {
  id: string;
  name?: string | null;
  full_name?: string | null;
  email?: string | null;
  telefone?: string | null;
  departamento?: string | null;
}

export const agendaParticipantKey = (participant: Pick<AgendaParticipant, "source" | "id">) =>
  `${participant.source}:${participant.id}`;

export function normalizeAgendaParticipants(value: unknown): AgendaParticipant[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const record = item as Partial<AgendaParticipant>;
      if (!record?.source || !record.id || !record.label) return null;
      if (!["artist", "employee", "user", "contact"].includes(record.source)) return null;
      return {
        source: record.source,
        id: String(record.id),
        label: String(record.label),
        email: record.email ? String(record.email) : undefined,
        phone: record.phone ? String(record.phone) : undefined,
        category: record.category ? String(record.category) : undefined,
      };
    })
    .filter(Boolean) as AgendaParticipant[];
}

export function summarizeAgendaParticipants(participants: AgendaParticipant[]) {
  if (participants.length === 0) return "";
  if (participants.length <= 2) return participants.map((participant) => participant.label).join(", ");
  return `${participants[0].label}, ${participants[1].label} +${participants.length - 2}`;
}

/**
 * Task J — it used to fetch the whole artist/employee table (useArtistas/
 * useFuncionarios, capped at 50 records/tenant) to build the event's
 * participant list. It now uses real server-side search (useEntityLookup)
 * for the artist and employee slices — `search` is passed by the
 * component (search input in the dropdown), and `pendingArtistId` ensures the
 * artist already linked to the event (legacy `artista` field) always resolves,
 * even outside the current search/pagination window (useEntityById).
 *
 * usuarios/contacts are not part of this migration's scope (hooks outside the
 * list of 8 flagged in Task J) — kept as they were.
 */
export function useAgendaParticipants(search: string = "", pendingArtistId?: string | null) {
  const { items: artistItems } = useEntityLookup<ArtistLookup>({ table: "artistas", search, pageSize: 20 });
  const { items: employeeItems } = useEntityLookup<EmployeeLookup>({ table: "funcionarios", search, pageSize: 20 });
  const { entity: pendingArtist } = useEntityById<ArtistLookup>("artistas", pendingArtistId);
  const { users: users = [] } = useUsers();
  const { contacts = [] } = useContacts();

  const participants = useMemo<AgendaParticipant[]>(() => {
    const artistSource: ArtistLookup[] =
      pendingArtist && !artistItems.some((a) => a.id === pendingArtist.id)
        ? [...artistItems, pendingArtist]
        : artistItems;

    const artistOptions = artistSource.map((artist) => ({
      source: "artist" as const,
      id: String(artist.id),
      label: String(artist.nome_artistico || artist.nome || artist.id),
      email: artist.email ? String(artist.email) : undefined,
      phone: artist.telefone ? String(artist.telefone) : undefined,
      category: "Artista",
    }));

    const employeeOptions = employeeItems.map((employee) => ({
      source: "employee" as const,
      id: String(employee.id),
      label: String(employee.name || employee.full_name || employee.email || employee.id),
      email: employee.email ? String(employee.email) : undefined,
      phone: employee.telefone ? String(employee.telefone) : undefined,
      category: employee.departamento ? String(employee.departamento) : "Funcionario",
    }));

    const userOptions = (users as any[]).map((user) => ({
      source: "user" as const,
      id: String(user.id),
      label: String(user.full_name || user.nome || user.email || user.id),
      email: user.email ? String(user.email) : undefined,
      phone: user.phone ? String(user.phone) : undefined,
      category: user.cargo ? String(user.cargo) : "Usuario",
    }));

    const contactOptions = (contacts as any[]).map((contact) => ({
      source: "contact" as const,
      id: String(contact.id),
      label: String(contact.name || contact.nome || contact.companyName || contact.email || contact.id),
      email: contact.email ? String(contact.email) : undefined,
      phone: contact.phone || contact.whatsapp ? String(contact.phone || contact.whatsapp) : undefined,
      category: contact.contactType || contact.category ? String(contact.contactType || contact.category) : "Contato",
    }));

    const byKey = new Map<string, AgendaParticipant>();
    [...artistOptions, ...employeeOptions, ...userOptions, ...contactOptions].forEach((participant) => {
      if (!participant.id || !participant.label) return;
      byKey.set(agendaParticipantKey(participant), participant);
    });
    return [...byKey.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [artistItems, employeeItems, pendingArtist, users, contacts]);

  const getParticipantByKey = (key: string) =>
    participants.find((participant) => agendaParticipantKey(participant) === key);

  const getArtistParticipantById = (id?: string | null) =>
    id ? participants.find((participant) => participant.source === "artist" && participant.id === id) : undefined;

  return {
    participants,
    getParticipantByKey,
    getArtistParticipantById,
    /** Only changes when the legacy artist (pendingArtistId) resolves — use it instead
     * of `participants` as the dependency of hydration effects, since
     * `participants` changes on every search typed in the picker. */
    pendingArtist,
  };
}
