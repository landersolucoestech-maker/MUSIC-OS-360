// Interaction types and constants shared within the crm-relationships module.
// Previously imported from @/modules/leads/modals/LeadFormModal (an incorrect cross dependency).

export const INTERACTION_TYPE_OPTIONS = [
  { value: "ligacao",    label: "Ligação"    },
  { value: "whatsapp",   label: "WhatsApp"   },
  { value: "email",      label: "E-mail"      },
  { value: "reuniao",    label: "Reunião"    },
  { value: "proposta",   label: "Proposta"   },
  { value: "follow_up",  label: "Follow-up"  },
  { value: "observacao", label: "Observação" },
] as const;

export type InteractionType = (typeof INTERACTION_TYPE_OPTIONS)[number]["value"];

export type Interaction = {
  id: string;
  type: string;
  data: string;
  horario: string;
  descricao: string;
};
