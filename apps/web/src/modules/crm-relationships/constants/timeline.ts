// Client timeline (activity_logs, entity_type = 'client') — PT-BR labels for
// the canonical `action` values (CZ-043). Manual entries use
// ClientTimelineEntryType; created/updated/removed are recorded automatically
// by the API on client create/update/delete, attachment_uploaded/
// attachment_removed on attachment confirm/delete (clients.service.ts).

import type { ClientTimelineEntryType } from "../services/clients.service";

export const TIMELINE_ACTION_LABELS: Readonly<Record<ClientTimelineEntryType | "created" | "updated" | "removed" | "attachment_uploaded" | "attachment_removed", string>> = {
  note: "Nota",
  call: "Ligação",
  meeting: "Reunião",
  email: "E-mail",
  whatsapp: "WhatsApp",
  other: "Outro",
  created: "Cadastro",
  updated: "Atualização",
  removed: "Remoção",
  attachment_uploaded: "Anexo enviado",
  attachment_removed: "Anexo removido",
};

/** PT-BR label shown for an action outside the catalog (never the raw value). */
export const UNKNOWN_TIMELINE_ACTION_LABEL = "Evento";

export function timelineActionLabel(action: string): string {
  return Object.prototype.hasOwnProperty.call(TIMELINE_ACTION_LABELS, action)
    ? TIMELINE_ACTION_LABELS[action as keyof typeof TIMELINE_ACTION_LABELS]
    : UNKNOWN_TIMELINE_ACTION_LABEL;
}
