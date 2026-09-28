// CRM interaction vocabulary shared within the crm-relationships module.
// Canonical `clients.interactions` item shape and type VALUES (CZ-043 — the
// same English vocabulary as the leads interactions); the PT-BR label is the
// only thing a user ever sees.

export const INTERACTION_TYPE_OPTIONS = [
  { value: "call",      label: "Ligação"    },
  { value: "whatsapp",  label: "WhatsApp"   },
  { value: "email",     label: "E-mail"     },
  { value: "meeting",   label: "Reunião"    },
  { value: "proposal",  label: "Proposta"   },
  { value: "follow_up", label: "Follow-up"  },
  { value: "note",      label: "Observação" },
] as const;

export type InteractionType = (typeof INTERACTION_TYPE_OPTIONS)[number]["value"];

/**
 * One CRM interaction — `type` is an INTERACTION_TYPE_OPTIONS value (the API
 * validates it on write; a stored value outside the catalog is shown through
 * interactionTypeLabel()'s PT-BR fallback), `date` is YYYY-MM-DD, `time` HH:MM.
 */
export type Interaction = {
  id: string;
  type: string;
  date: string;
  time: string;
  description: string;
};

/** PT-BR label shown for an interaction type outside the catalog (never the raw value). */
export const UNKNOWN_INTERACTION_TYPE_LABEL = "Tipo não identificado";

export function interactionTypeLabel(value: string): string {
  return INTERACTION_TYPE_OPTIONS.find((option) => option.value === value)?.label ?? UNKNOWN_INTERACTION_TYPE_LABEL;
}
