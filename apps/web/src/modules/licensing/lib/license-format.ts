import { LicenseStatus, statusLabelPtBr } from "@music-os-360/types";
import type { BadgeVariant } from "@/shared/ui/badge";
import type { Currency, License } from "@/modules/licensing/types/licensing.types";
import type { Work } from "@/modules/catalog/types/catalog.types";

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
 */
export function formatRemuneration(l: Pick<License, "remuneration_type" | "currency" | "amount" | "percentage">): string {
  const type = l.remuneration_type;
  const currency = (l.currency ?? "BRL") as Currency;
  const amount = Number(l.amount ?? 0);
  const pct = Number(l.percentage ?? 0);

  if (type === "PERCENTAGE") return `${pct}%`;
  if (type === "FIXED_PLUS_PERCENTAGE") return `${formatMoney(amount, currency)} + ${pct}%`;
  return formatMoney(amount, currency);
}

export { CURRENCY_SYMBOL };

function joinNames(v: string | string[] | null | undefined): string {
  if (!v) return "";
  if (Array.isArray(v)) return v.filter(Boolean).join(", ");
  return v;
}

/** Derives the artist(s) of a work: linked artist → composers. */
export function workArtistLabel(work: Work | undefined | null): string {
  if (!work) return "";
  const linked = (work as { artist?: { stage_name?: string | null } | null }).artist?.stage_name;
  if (linked) return linked;
  return joinNames(work.composer_names ?? work.composer_name);
}

/** License type codes (persisted) and their PT-BR labels. */
export const LICENSE_TYPE_OPTIONS = [
  { value: "sync_tv", label: "Sync TV" },
  { value: "sync_cinema", label: "Sync Cinema" },
  { value: "sync_advertising", label: "Sync Publicidade" },
  { value: "sync_games", label: "Sync Games" },
  { value: "sync_digital", label: "Sync Digital" },
  { value: "master_use", label: "Master Use" },
  { value: "mechanical", label: "Mecânica" },
] as const;

/** Target media codes (persisted) and their PT-BR labels. */
export const TARGET_MEDIA_OPTIONS = [
  { value: "free_tv", label: "TV Aberta" },
  { value: "pay_tv", label: "TV Fechada" },
  { value: "cinema", label: "Cinema" },
  { value: "streaming", label: "Streaming" },
  { value: "social_media", label: "Redes Sociais" },
  { value: "digital_advertising", label: "Publicidade Digital" },
  { value: "games", label: "Games" },
  { value: "other", label: "Outro" },
] as const;

/** Territory codes (persisted) and their PT-BR labels. */
export const TERRITORY_OPTIONS = [
  { value: "brazil", label: "Brasil" },
  { value: "latin_america", label: "América Latina" },
  { value: "worldwide", label: "Mundial" },
  { value: "united_states", label: "Estados Unidos" },
  { value: "europe", label: "Europa" },
  { value: "asia", label: "Ásia" },
] as const;

const optionLabel = (options: ReadonlyArray<{ value: string; label: string }>, v: string | null | undefined): string =>
  v ? (options.find((o) => o.value === v)?.label ?? "Valor não reconhecido") : "—";

export const mediaLabel = (v: string | null | undefined): string => optionLabel(TARGET_MEDIA_OPTIONS, v);
export const typeLabel = (v: string | null | undefined): string => optionLabel(LICENSE_TYPE_OPTIONS, v);
export const territoryLabel = (v: string | null | undefined): string => optionLabel(TERRITORY_OPTIONS, v);

/** LicenseStatus values offered by the form, in display order. */
export const LICENSE_STATUS_VALUES: LicenseStatus[] = [
  LicenseStatus.NEGOTIATION, LicenseStatus.PROPOSAL, LicenseStatus.ACTIVE, LicenseStatus.EXPIRED, LicenseStatus.PENDING,
];

const STATUS_VARIANT: Record<string, BadgeVariant> = {
  active: "success", negotiation: "warning", proposal: "info", expired: "danger", pending: "neutral",
};

export function licenseStatusLabel(status?: string | null): string {
  if (!status) return "—";
  return statusLabelPtBr("license", status) ?? "Status não reconhecido";
}

export function licenseStatusVariant(status?: string | null): BadgeVariant {
  return (status && STATUS_VARIANT[status]) || "neutral";
}
