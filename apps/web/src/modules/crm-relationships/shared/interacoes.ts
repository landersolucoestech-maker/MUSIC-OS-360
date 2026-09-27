// Interaction types and constants shared within the crm-relationships module.
// Previously imported from @/modules/leads/modals/LeadFormModal (an incorrect cross dependency).

export const TIPO_INTERACAO_OPTIONS = [
  { value: "ligacao",    label: "Ligação"    },
  { value: "whatsapp",   label: "WhatsApp"   },
  { value: "email",      label: "E-mail"      },
  { value: "reuniao",    label: "Reunião"    },
  { value: "proposta",   label: "Proposta"   },
  { value: "follow_up",  label: "Follow-up"  },
  { value: "observacao", label: "Observação" },
] as const;

export type TipoInteracao = (typeof TIPO_INTERACAO_OPTIONS)[number]["value"];

export type Interacao = {
  id: string;
  type: string;
  data: string;
  horario: string;
  descricao: string;
};
