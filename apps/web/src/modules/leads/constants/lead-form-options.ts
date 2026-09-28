export type Option<T extends string = string> = { value: T; label: string };

export const LEAD_TYPE_OPTIONS = [
  { value: "artist_or_band",         label: "Artista/Banda"          },
  { value: "show_booker",      label: "Contratante de Show"    },
  { value: "artist_manager",  label: "Empresário Artístico"   },
  { value: "record_label",        label: "Gravadora/Selo"         },
  { value: "brand_or_company",         label: "Marca/Empresa"          },
  { value: "blog",                  label: "Blog"                   },
  { value: "event_producer",     label: "Produtora de Eventos"   },
  { value: "influencer",         label: "Influenciador"          },
  { value: "other",                label: "Outros"                 },
] as const satisfies ReadonlyArray<Option>;

export type LeadType = (typeof LEAD_TYPE_OPTIONS)[number]["value"];

export const SERVICES_OPTIONS = [
  { value: "artist_management",   label: "Agenciamento e Gestão"    },
  { value: "artist_booking",  label: "Contratação de Artistas"  },
  { value: "digital_distribution",  label: "Distribuição Digital"     },
  { value: "music_production",      label: "Produção Musical"         },
  { value: "music_editing",        label: "Edição Musical"           },
  { value: "audiovisual_production",  label: "Produção Audiovisual"     },
  { value: "digital_marketing",     label: "Marketing Digital"        },
  { value: "influencer_marketing",  label: "Marketing de Influência"  },
  { value: "music_licensing", label: "Licenciamento Musical"    },
  { value: "sync_licensing",         label: "Sincronização"            },
  { value: "catalog_management",       label: "Gestão de Catálogo"       },
  { value: "career_strategy",   label: "Estratégia de Carreira"   },
  { value: "image_management",         label: "Gestão de Imagem"         },
  { value: "event_production",      label: "Produção de Eventos"      },
  { value: "event_promotion",    label: "Divulgação de Eventos"    },
  { value: "commercial_partnerships",  label: "Parcerias Comerciais"     },
  { value: "influencers",       label: "Influenciadores"          },
  { value: "website_creation",         label: "Criação de Sites"         },
  { value: "consulting",           label: "Consultoria"              },
] as const satisfies ReadonlyArray<Option>;

export type ServiceLead = (typeof SERVICES_OPTIONS)[number]["value"];

// Lead type value with special handling (free-text services).
export const LEAD_TYPE_OTHER: LeadType = "other";

export const SERVICES_BY_LEAD_TYPE: Record<LeadType, ReadonlyArray<ServiceLead>> = {
  artist_or_band: [
    "artist_management",
    "music_production",
    "music_editing",
    "audiovisual_production",
    "digital_marketing",
    "website_creation",
    "consulting",
  ],
  show_booker: [
    "artist_booking",
    "event_production",
    "audiovisual_production",
    "event_promotion",
    "commercial_partnerships",
    "website_creation",
    "consulting",
  ],
  artist_manager: [
    "artist_booking",
    "artist_management",
    "music_production",
    "music_editing",
    "audiovisual_production",
    "digital_marketing",
    "career_strategy",
    "consulting",
  ],
  record_label: [
    "digital_distribution",
    "digital_marketing",
    "music_production",
    "music_editing",
    "catalog_management",
    "website_creation",
    "consulting",
  ],
  brand_or_company: [
    "artist_booking",
    "music_production",
    "music_licensing",
    "audiovisual_production",
    "digital_marketing",
    "event_production",
    "influencers",
    "website_creation",
    "consulting",
  ],
  blog: [
    "digital_marketing",
    "audiovisual_production",
    "music_licensing",
    "sync_licensing",
    "website_creation",
    "consulting",
  ],
  event_producer: [
    "artist_booking",
    "music_production",
    "audiovisual_production",
    "event_promotion",
    "commercial_partnerships",
    "website_creation",
    "consulting",
  ],
  influencer: [
    "influencer_marketing",
    "audiovisual_production",
    "commercial_partnerships",
    "image_management",
    "event_production",
    "website_creation",
    "consulting",
  ],
  // "Outros": no predefined list — services entered as free text.
  other: [],
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
  { value: "referral",        label: "Indicação"         },
  { value: "whatsapp",         label: "WhatsApp"          },
  { value: "event",           label: "Evento"            },
  { value: "partnership",         label: "Parceria"          },
  { value: "active_prospecting", label: "Prospecção ativa"  },
  { value: "phone",         label: "Telefone"          },
  { value: "email",            label: "E-mail"             },
  { value: "other",            label: "Outro"             },
  // Written by the public artist application form (API), never offered in the lead form.
  { value: "public_artist_application", label: "Cadastro público de artista" },
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
  { value: "high",  label: "Alta"  },
  { value: "medium", label: "Média" },
  { value: "low", label: "Baixa" },
] as const satisfies ReadonlyArray<Option>;

export type Priority = (typeof PRIORITY_OPTIONS)[number]["value"];

export const TEMPERATURE_OPTIONS = [
  { value: "cold", label: "Frio"   },
  { value: "warm", label: "Morno"  },
  { value: "hot",  label: "Quente" },
] as const satisfies ReadonlyArray<Option>;

export const INTERACTION_TYPE_OPTIONS = [
  { value: "call",      label: "Ligação"    },
  { value: "whatsapp",  label: "WhatsApp"   },
  { value: "email",     label: "E-mail"     },
  { value: "meeting",   label: "Reunião"    },
  { value: "proposal",  label: "Proposta"   },
  { value: "follow_up", label: "Follow-up"  },
  { value: "note",      label: "Observação" },
] as const satisfies ReadonlyArray<Option>;

export const EVENT_TYPE_OPTIONS = [
  { value: "birthday",   label: "Aniversário"   },
  { value: "wedding",     label: "Casamento"     },
  { value: "nightclub",  label: "Casa noturna"  },
  { value: "public_show",  label: "Show público"  },
  { value: "corporate",   label: "Corporativo"   },
] as const satisfies ReadonlyArray<Option>;

export type EventType = (typeof EVENT_TYPE_OPTIONS)[number]["value"];

export const BR_STATES = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA",
  "MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN",
  "RS","RO","RR","SC","SP","SE","TO",
] as const;

export type BrState = (typeof BR_STATES)[number];

export const LEAD_TYPE_INFLUENCER: LeadType = "influencer";
export const LEAD_TYPE_MANAGER:    LeadType = "artist_manager";

// ─────────────────────────────────────────────
// Conditional rules per type + service combo
// ─────────────────────────────────────────────

export const EVENT_COMBOS: ReadonlyArray<{ type: string; service: string }> = [
  { type: "brand_or_company",        service: "corporate_events" },
  { type: "agency",              service: "event_production"     },
  { type: "agency",              service: "artist_booking" },
  { type: "event_producer",    service: "artist_booking" },
  { type: "show_booker",     service: "artist_booking" },
  { type: "show_booker",     service: "corporate_events" },
  { type: "artist_manager", service: "artist_booking" },
  { type: "artist_manager", service: "corporate_events" },
  { type: "influencer",        service: "event_production"     },
];

export const CAMPAIGN_COMBOS: ReadonlyArray<{ type: string; service: string }> = [
  { type: "brand_or_company", service: "artist_campaigns" },
  { type: "agency",       service: "artist_campaigns" },
];

export const ARTIST_EVENT_COMBOS: ReadonlyArray<{ type: string; service: string }> = [
  { type: "brand_or_company",        service: "corporate_events" },
  { type: "agency",              service: "event_production"     },
  { type: "agency",              service: "artist_booking" },
  { type: "event_producer",    service: "artist_booking" },
  { type: "show_booker",     service: "artist_booking" },
  { type: "show_booker",     service: "corporate_events" },
  { type: "artist_manager", service: "artist_booking" },
  { type: "artist_manager", service: "corporate_events" },
];

export const matchCombo = (
  list: ReadonlyArray<{ type: string; service: string }>,
  type: string,
  service: string,
) => list.some((c) => c.type === type && c.service === service);
