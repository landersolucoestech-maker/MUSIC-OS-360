export type Option<T extends string = string> = { value: T; label: string };

export const TIPO_LEAD_OPTIONS = [
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

export type TipoLead = (typeof TIPO_LEAD_OPTIONS)[number]["value"];

export const SERVICOS_OPTIONS = [
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

export type ServicoLead = (typeof SERVICOS_OPTIONS)[number]["value"];

// Valor de tipo de lead com tratamento especial (serviços em texto livre).
export const TIPO_LEAD_OUTROS: TipoLead = "outros";

export const SERVICOS_POR_TIPO_LEAD: Record<TipoLead, ReadonlyArray<ServicoLead>> = {
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
  // "Outros": sem lista pré-definida — serviços informados em texto livre.
  outros: [],
};

export function getServicosForTipoLead(
  type: TipoLead | "" | undefined,
): ReadonlyArray<Option> {
  if (!type) return [];
  const slugs = SERVICOS_POR_TIPO_LEAD[type as TipoLead] ?? [];
  return slugs
    .map((slug) => SERVICOS_OPTIONS.find((o) => o.value === slug))
    .filter((o): o is (typeof SERVICOS_OPTIONS)[number] => Boolean(o));
}

export const ORIGEM_LEAD_OPTIONS = [
  { value: "website",          label: "Website"           },
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
  { value: "email",            label: "Email"             },
  { value: "outro",            label: "Outro"             },
] as const satisfies ReadonlyArray<Option>;

export type OrigemLead = (typeof ORIGEM_LEAD_OPTIONS)[number]["value"];

// Alinhado 1:1 ao enum real LeadStatus (@music-os-360/types) e ao workflow
// apps/api/src/core/workflow/definitions/leads.workflow.ts — a lista anterior
// (novo_lead/proposta_enviada/follow_up/confirmado/arquivado) não existia no
// backend; qualquer PATCH com esses valores era rejeitado por @IsIn(STATUSES).
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

export const PRIORIDADE_OPTIONS = [
  { value: "alta",  label: "Alta"  },
  { value: "media", label: "Média" },
  { value: "baixa", label: "Baixa" },
] as const satisfies ReadonlyArray<Option>;

export type Prioridade = (typeof PRIORIDADE_OPTIONS)[number]["value"];

export const TIPO_EVENTO_OPTIONS = [
  { value: "aniversario",   label: "Aniversário"   },
  { value: "casamento",     label: "Casamento"     },
  { value: "casa_noturna",  label: "Casa noturna"  },
  { value: "show_publico",  label: "Show público"  },
  { value: "corporativo",   label: "Corporativo"   },
] as const satisfies ReadonlyArray<Option>;

export type TipoEvento = (typeof TIPO_EVENTO_OPTIONS)[number]["value"];

export const ESTADOS_BR = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA",
  "MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN",
  "RS","RO","RR","SC","SP","SE","TO",
] as const;

export type EstadoBR = (typeof ESTADOS_BR)[number];

export const TIPO_LEAD_INFLUENCIADOR: TipoLead = "influenciador";
export const TIPO_LEAD_EMPRESARIO:    TipoLead = "empresario_artistico";
