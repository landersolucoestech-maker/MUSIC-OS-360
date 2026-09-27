import type { LeadClientType, LeadServiceType } from "../types";
import { STATUS_LEAD_OPTIONS } from "./lead-form-options";

export const leadClientTypeOptions: Array<{ value: LeadClientType; label: string }> = [
  { value: "artist",        label: "Artista ou projeto musical" },
  { value: "label",         label: "Selo ou gravadora"          },
  { value: "company",       label: "Empresa"                    },
  { value: "agency",        label: "Agência"                    },
  { value: "eventProducer", label: "Produtora de eventos"       },
  { value: "venue",         label: "Casa de show ou espaço de eventos"      },
  { value: "brand",         label: "Marca"                      },
  { value: "creator",       label: "Creator ou influenciador"   },
  { value: "other",         label: "Outro"                      },
];

export const leadServiceTypeOptions: Array<{ value: LeadServiceType; label: string }> = [
  { value: "producaoMusical",     label: "Produção musical"        },
  { value: "mixagem",             label: "Mixagem"                 },
  { value: "masterizacao",        label: "Masterização"            },
  { value: "distribuicaoDigital", label: "Distribuição digital"    },
  { value: "marketingMusical",    label: "Marketing digital"       },
  { value: "videoclipe",          label: "Videoclipe"              },
  { value: "fotografia",          label: "Fotografia"              },
  { value: "show",                label: "Show"                    },
  { value: "producaoEvento",      label: "Produção de evento"      },
  { value: "gestaoArtistica",     label: "Gestão artística"        },
  { value: "registroAutoral",     label: "Registro autoral"        },
  { value: "licenciamento",       label: "Licenciamento"           },
  { value: "designGrafico",       label: "Design gráfico"          },
  { value: "desenvolvimentoSite", label: "Desenvolvimento de site" },
  { value: "trafegoPago",         label: "Tráfego pago"            },
  { value: "consultoria",         label: "Consultoria"             },
];

/**
 * Re-exports STATUS_LEAD_OPTIONS as leadStatusOptions to keep
 * compatibility with legacy components that import from this barrel.
 * Single source of truth: constants/lead-form-options.ts
 */
export { STATUS_LEAD_OPTIONS as leadStatusOptions };

export const uploadRules = {
  maxSize:    25 * 1024 * 1024,
  mimeTypes:  ["application/pdf", "image/png", "image/jpeg", "image/webp", "video/mp4"],
  extensions: [".pdf", ".png", ".jpg", ".jpeg", ".webp", ".mp4"],
};

export function optionLabel<T extends string>(
  options: ReadonlyArray<{ readonly value: T; readonly label: string }>,
  value?: T | string,
) {
  return options.find((o) => o.value === value)?.label ?? String(value ?? "-");
}

