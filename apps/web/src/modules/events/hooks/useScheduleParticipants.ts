import { useMemo } from "react";
import { useEntityLookup, useEntityById } from "@/shared/hooks/useEntityLookup";
import { useContacts } from "@/modules/crm-relationships/hooks/useContacts";
import { contactTypeOptions, labelFor } from "@/modules/crm-relationships/constants";
import { useUsers } from "@/modules/settings/hooks/useUsers";

export type ScheduleParticipantSource = "artist" | "employee" | "user" | "contact";

export type ScheduleParticipant = {
  source: ScheduleParticipantSource;
  id: string;
  label: string;
  email?: string;
  phone?: string;
  category?: string;
};

/** Artist row as returned by /artists (canonical CZ-042 keys). */
interface ArtistLookup {
  id: string;
  stage_name?: string | null;
  email?: string | null;
  phone?: string | null;
}

interface EmployeeLookup {
  id: string;
  name?: string | null;
  full_name?: string | null;
  email?: string | null;
  telefone?: string | null;
  departamento?: string | null;
}

export const scheduleParticipantKey = (participant: Pick<ScheduleParticipant, "source" | "id">) =>
  `${participant.source}:${participant.id}`;

export function normalizeScheduleParticipants(value: unknown): ScheduleParticipant[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const record = item as Partial<ScheduleParticipant>;
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
    .filter(Boolean) as ScheduleParticipant[];
}

export function summarizeScheduleParticipants(participants: ScheduleParticipant[]) {
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
export function useScheduleParticipants(search: string = "", pendingArtistId?: string | null) {
  const { items: artistItems } = useEntityLookup<ArtistLookup>({ table: "artistas", search, pageSize: 20 });
  const { items: employeeItems } = useEntityLookup<EmployeeLookup>({ table: "funcionarios", search, pageSize: 20 });
  const { entity: pendingArtist } = useEntityById<ArtistLookup>("artistas", pendingArtistId);
  const { users: users = [] } = useUsers();
  const { contacts = [] } = useContacts();

  const participants = useMemo<ScheduleParticipant[]>(() => {
    const artistSource: ArtistLookup[] =
      pendingArtist && !artistItems.some((a) => a.id === pendingArtist.id)
        ? [...artistItems, pendingArtist]
        : artistItems;

    const artistOptions = artistSource.map((artist) => ({
      source: "artist" as const,
      id: String(artist.id),
      label: String(artist.stage_name || "Sem nome"),
      email: artist.email ? String(artist.email) : undefined,
      phone: artist.phone ? String(artist.phone) : undefined,
      category: "Artista",
    }));

    const employeeOptions = employeeItems.map((employee) => ({
      source: "employee" as const,
      id: String(employee.id),
      label: String(employee.name || employee.full_name || employee.email || "Sem nome"),
      email: employee.email ? String(employee.email) : undefined,
      phone: employee.telefone ? String(employee.telefone) : undefined,
      category: employee.departamento ? String(employee.departamento) : "Funcionario",
    }));

    const userOptions = (users as any[]).map((user) => ({
      source: "user" as const,
      id: String(user.id),
      label: String(user.full_name || user.nome || user.email || "Sem nome"),
      email: user.email ? String(user.email) : undefined,
      phone: user.phone ? String(user.phone) : undefined,
      category: user.cargo ? String(user.cargo) : "Usuario",
    }));

    const contactOptions = contacts.map((contact) => ({
      source: "contact" as const,
      id: contact.id,
      label: contact.name || contact.legalName || contact.email || "Sem nome",
      email: contact.email,
      phone: contact.phone,
      category: contact.category ? labelFor(contactTypeOptions, contact.category) : "Contato",
    }));

    const byKey = new Map<string, ScheduleParticipant>();
    [...artistOptions, ...employeeOptions, ...userOptions, ...contactOptions].forEach((participant) => {
      if (!participant.id || !participant.label) return;
      byKey.set(scheduleParticipantKey(participant), participant);
    });
    return [...byKey.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [artistItems, employeeItems, pendingArtist, users, contacts]);

  const getParticipantByKey = (key: string) =>
    participants.find((participant) => scheduleParticipantKey(participant) === key);

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
