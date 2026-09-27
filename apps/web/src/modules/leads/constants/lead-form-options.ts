export type Option<T extends string = string> = { value: T; label: string };

export const LEAD_TYPE_OPTIONS = [
  { value: "artista_banda",         label: "Artista/Banda"          },
  { value: "contratante_show",      label: "Contratante de Show"    },
  { value: "empresario_artistico",  label: "Empresário Artístico"   },
  { value: "gravadora_selo",        label: "Gravadora/Selo"         },
  { value: "marca_empresa",         label: "Marca/Empresa"          },
  { value: "blog",                  label: "Blog"                   },
  { value: "produtora_eventos",     label: "Produtora de Eventos"   },
  { value: "influenciador",         label: "Influenciador"          },
  { value: "outros",                label: "Outros"                 },
] as const satisfies ReadonlyArray<Option>;

export type LeadType = (typeof LEAD_TYPE_OPTIONS)[number]["value"];

export const SERVICES_OPTIONS = [
  { value: "agenciamento_gestao",   label: "Agenciamento e Gestão"    },
  { value: "contratacao_artistas",  label: "Contratação de Artistas"  },
  { value: "distribuicao_digital",  label: "Distribuição Digital"     },
  { value: "producao_musical",      label: "Produção Musical"         },
  { value: "edicao_musical",        label: "Edição Musical"           },
  { value: "producao_audiovisual",  label: "Produção Audiovisual"     },
  { value: "marketing_digital",     label: "Marketing Digital"        },
  { value: "marketing_influencia",  label: "Marketing de Influência"  },
  { value: "licenciamento_musical", label: "Licenciamento Musical"    },
  { value: "sincronizacao",         label: "Sincronização"            },
  { value: "gestao_catalogo",       label: "Gestão de Catálogo"       },
  { value: "estrategia_carreira",   label: "Estratégia de Carreira"   },
  { value: "gestao_imagem",         label: "Gestão de Imagem"         },
  { value: "producao_eventos",      label: "Produção de Eventos"      },
  { value: "divulgacao_eventos",    label: "Divulgação de Eventos"    },
  { value: "parcerias_comerciais",  label: "Parcerias Comerciais"     },
  { value: "influenciadores",       label: "Influenciadores"          },
  { value: "criacao_sites",         label: "Criação de Sites"         },
  { value: "consultoria",           label: "Consultoria"              },
] as const satisfies ReadonlyArray<Option>;

export type ServiceLead = (typeof SERVICES_OPTIONS)[number]["value"];

// Lead type value with special handling (free-text services).
export const LEAD_TYPE_OTHER: LeadType = "outros";

export const SERVICES_BY_LEAD_TYPE: Record<LeadType, ReadonlyArray<ServiceLead>> = {
  artista_banda: [
    "agenciamento_gestao",
    "producao_musical",
    "edicao_musical",
    "producao_audiovisual",
    "marketing_digital",
    "criacao_sites",
    "consultoria",
  ],
  contratante_show: [
    "contratacao_artistas",
    "producao_eventos",
    "producao_audiovisual",
    "divulgacao_eventos",
    "parcerias_comerciais",
    "criacao_sites",
    "consultoria",
  ],
  empresario_artistico: [
    "contratacao_artistas",
    "agenciamento_gestao",
    "producao_musical",
    "edicao_musical",
    "producao_audiovisual",
    "marketing_digital",
    "estrategia_carreira",
    "consultoria",
  ],
  gravadora_selo: [
    "distribuicao_digital",
    "marketing_digital",
    "producao_musical",
    "edicao_musical",
    "gestao_catalogo",
    "criacao_sites",
    "consultoria",
  ],
  marca_empresa: [
    "contratacao_artistas",
    "producao_musical",
    "licenciamento_musical",
    "producao_audiovisual",
    "marketing_digital",
    "producao_eventos",
    "influenciadores",
    "criacao_sites",
    "consultoria",
  ],
  blog: [
    "marketing_digital",
    "producao_audiovisual",
    "licenciamento_musical",
    "sincronizacao",
    "criacao_sites",
    "consultoria",
  ],
  produtora_eventos: [
    "contratacao_artistas",
    "producao_musical",
    "producao_audiovisual",
    "divulgacao_eventos",
    "parcerias_comerciais",
    "criacao_sites",
    "consultoria",
  ],
  influenciador: [
    "marketing_influencia",
    "producao_audiovisual",
    "parcerias_comerciais",
    "gestao_imagem",
    "producao_eventos",
    "criacao_sites",
    "consultoria",
  ],
  // "Outros": no predefined list — services entered as free text.
  outros: [],
};

export function getServicesForLeadType(
  type: LeadType | "" | undefined,
): ReadonlyArray<Option> {
  if (!type) return [];
  const slugs = SERVICES_BY_LEAD_TYPE[type as LeadType] ?? [];
  return slugs
    .map((slug) => SERVICES_OPTIONS.find((o) => o.value === slug))
    .filter((o): o is (typeof SERVICES_OPTIONS)[number] => Boolean(o));
}

export const LEAD_SOURCE_OPTIONS = [
  { value: "website",          label: "Site"           },
  { value: "instagram",        label: "Instagram"         },
  { value: "facebook",         label: "Facebook"          },
  { value: "google_ads",       label: "Google Ads"        },
  { value: "instagram_ads",    label: "Instagram Ads"     },
  { value: "facebook_ads",     label: "Facebook Ads"      },
  { value: "google_search",    label: "Google Search"     },
  { value: "indicacao",        label: "Indicação"         },
  { value: "whatsapp",         label: "WhatsApp"          },
  { value: "evento",           label: "Evento"            },
  { value: "parceria",         label: "Parceria"          },
  { value: "prospeccao_ativa", label: "Prospecção ativa"  },
  { value: "telefone",         label: "Telefone"          },
  { value: "email",            label: "E-mail"             },
  { value: "outro",            label: "Outro"             },
] as const satisfies ReadonlyArray<Option>;

export type LeadSource = (typeof LEAD_SOURCE_OPTIONS)[number]["value"];

// Aligned 1:1 with the real LeadStatus enum (@music-os-360/types) and the workflow
// apps/api/src/core/workflow/definitions/leads.workflow.ts — the previous list
// (novo_lead/proposta_enviada/follow_up/confirmado/arquivado) did not exist on the
// backend; any PATCH with those values was rejected by @IsIn(STATUSES).
export const STATUS_LEAD_OPTIONS = [
  { value: "new",         label: "Novo"           },
  { value: "contacted",   label: "Contato"        },
  { value: "in_contact",  label: "Em contato"     },
  { value: "qualified",   label: "Qualificado"    },
  { value: "proposal",    label: "Proposta"       },
  { value: "negotiation", label: "Negociação"     },
  { value: "closed",      label: "Fechado"        },
  { value: "lost",        label: "Perdido"        },
  { value: "inactive",    label: "Inativo/Arquivado" },
] as const satisfies ReadonlyArray<Option>;

export type StatusLead = (typeof STATUS_LEAD_OPTIONS)[number]["value"];

export const PRIORITY_OPTIONS = [
  { value: "alta",  label: "Alta"  },
  { value: "media", label: "Média" },
  { value: "baixa", label: "Baixa" },
] as const satisfies ReadonlyArray<Option>;

export type Priority = (typeof PRIORITY_OPTIONS)[number]["value"];

export const EVENT_TYPE_OPTIONS = [
  { value: "aniversario",   label: "Aniversário"   },
  { value: "casamento",     label: "Casamento"     },
  { value: "casa_noturna",  label: "Casa noturna"  },
  { value: "show_publico",  label: "Show público"  },
  { value: "corporativo",   label: "Corporativo"   },
] as const satisfies ReadonlyArray<Option>;

export type EventType = (typeof EVENT_TYPE_OPTIONS)[number]["value"];

export const BR_STATES = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA",
  "MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN",
  "RS","RO","RR","SC","SP","SE","TO",
] as const;

export type BrState = (typeof BR_STATES)[number];

export const LEAD_TYPE_INFLUENCER: LeadType = "influenciador";
export const LEAD_TYPE_MANAGER:    LeadType = "empresario_artistico";
