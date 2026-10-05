import { hasOwnKey } from "@/shared/lib/own-property";
/**
 * category-labels — PT-BR (presentation) formatting of technical categories/identifiers.
 * NEVER displays an underscore: matches the dictionary (correct accents) or,
 * as a fallback, replaces `_` with a space and applies Title Case. Does not change internal values.
 */

const CATEGORY_LABELS: Record<string, string> = {
  // ── Finance ─────────────────────────────────────────────────────────────────────
  external_rights_receipts: "Recebimentos externos de direitos",
  "recebimentos externos de direitos": "Recebimentos externos de direitos",
  cache: "Cachê de Shows",
  distribuicao: "Distribuição",
  producao_musical: "Produção Musical",
  marketing: "Marketing",
  marketing_digital: "Marketing Digital",
  marketing_offline: "Marketing Offline",
  juridico: "Honorários Jurídicos",
  producao_audiovisual: "Produção Audiovisual",
  software: "Software",
  producao: "Produção",
  shows: "Shows",
  // ── Contracts / services (CST) ──────────────────────────────────────────────────
  gestao: "Gestão",
  edicao: "Edição",
  gravacao: "Gravação",
  // Canonical English ids of the platform-owned contract categories (legacy slugs above/below).
  recording: "Gravação",
  rights_assignment: "Cessão de Direitos",
  production: "Produção",
  exclusivity: "Exclusividade",
  advertising: "Publicitário",
  semantic: "Semântico (IA)",
  distribution: "Distribuição",
  licensing: "Licenciamento",
  management: "Gestão",
  other: "Outros",
  publicitario: "Publicitário",
  semantico: "Semântico (IA)",
  cessao_direitos: "Cessão de Direitos",
  // ── Project / marketing / content ────────────────────────────────────────────────
};

/** PT-BR Title Case keeping connectors lowercase. */
function titleCase(text: string): string {
  const minor = new Set(["de", "da", "do", "das", "dos", "e", "a", "o", "em", "para", "com"]);
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((word, i) => {
      const lower = word.toLowerCase();
      if (i > 0 && minor.has(lower)) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

/**
 * Converts a category value (enum/slug) into the PT-BR display label.
 * Presentation only — does not change the persisted value.
 */
export function formatCategoryLabel(value: unknown): string {
  if (value == null || value === "") return "—";
  const raw = String(value).trim();
  // Accent-blind lookup: a stored "cachê" resolves to the unaccented slug key.
  const key = raw.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (hasOwnKey(CATEGORY_LABELS, key)) return CATEGORY_LABELS[key];
  if (hasOwnKey(CATEGORY_LABELS, raw)) return CATEGORY_LABELS[raw];
  // Fallback: removes underscores and applies Title Case (guarantees no "_").
  return titleCase(raw.replace(/_/g, " "));
}
