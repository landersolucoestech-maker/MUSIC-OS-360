import type { Currency, Licenca } from "@/modules/licensing/types/licensing.types";
import type { Obra } from "@/modules/catalog/types/catalog.types";

const CURRENCY_SYMBOL: Record<Currency, string> = { BRL: "R$", USD: "US$", EUR: "€" };

/** Formats a monetary amount with the currency symbol (R$/US$/€) and pt-BR separators. */
export function formatMoney(amount: number, currency: Currency = "BRL"): string {
  const n = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
  return `${CURRENCY_SYMBOL[currency]} ${n}`;
}

export function formatLicensingDate(value?: string | Date | null): string | null {
  if (!value) return null;

  if (typeof value === "string") {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return `${match[3]}-${match[2]}-${match[1]}`;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

/**
 * Formats the license compensation according to its type:
 * FIXED → "R$ 5.000,00" · PERCENTAGE → "15%" · FIXED_PLUS_PERCENTAGE → "US$ 1.000,00 + 10%".
 * Falls back to the legacy `valor` field when there is no structured compensation.
 */
export function formatRemuneration(l: Pick<Licenca, "remuneration_type" | "currency" | "amount" | "percentage" | "valor">): string {
  const type = l.remuneration_type;
  const currency = (l.currency ?? "BRL") as Currency;
  const amount = l.amount ?? l.valor ?? 0;
  const pct = l.percentage ?? 0;

  if (type === "PERCENTAGE") return `${pct}%`;
  if (type === "FIXED_PLUS_PERCENTAGE") return `${formatMoney(amount, currency)} + ${pct}%`;
  if (type === "FIXED") return formatMoney(amount, currency);
  // Old rows without remuneration_type
  return formatMoney(l.valor ?? 0, currency);
}

export { CURRENCY_SYMBOL };

function joinNames(v: string | string[] | null | undefined): string {
  if (!v) return "";
  if (Array.isArray(v)) return v.filter(Boolean).join(", ");
  return v;
}

/** Derives the artist(s) of a work: linked artist → performers → composers. */
export function obraArtistaLabel(obra: Obra | undefined | null): string {
  if (!obra) return "";
  const linked = (obra as { artistas?: { nome_artistico?: string | null } | null }).artistas?.nome_artistico;
  if (linked) return linked;
  const interpretes = joinNames((obra as { interpretes?: string | string[] | null }).interpretes);
  if (interpretes) return interpretes;
  return joinNames(obra.compositores ?? obra.compositor);
}

/** Readable labels for the target media (snake_case values from the form). */
export const MIDIA_LABEL: Record<string, string> = {
  tv_aberta: "TV Aberta",
  tv_fechada: "TV Fechada",
  cinema: "Cinema",
  streaming: "Streaming",
  redes_sociais: "Redes Sociais",
  publicidade_digital: "Publicidade Digital",
  games: "Games",
  outro: "Outro",
};

export const midiaLabel = (v: string | null | undefined): string =>
  v ? (MIDIA_LABEL[v] ?? v.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())) : "—";

/** Readable labels for the license type. */
export const TIPO_LABEL: Record<string, string> = {
  sync_tv: "Sync TV",
  sync_cinema: "Sync Cinema",
  sync_publicidade: "Sync Publicidade",
  sync_games: "Sync Games",
  sync_digital: "Sync Digital",
  master_use: "Master Use",
  mecanica: "Mecânica",
};

export const tipoLabel = (v: string | null | undefined): string =>
  v ? (TIPO_LABEL[v] ?? v.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())) : "—";
