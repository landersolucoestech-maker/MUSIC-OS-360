/**
 * work-options.ts — canonical vocabulary of the works contract (CZ-039).
 *
 * Every persisted/wire value here is the technical English value the API
 * stores and returns; every `label` is the PT-BR text the end user sees.
 * Components render labels only through these maps — never a raw value.
 */
import { LANGUAGE_LABELS, LANGUAGE_LABEL_BY_VALUE } from "@/constants/languages";

// ── Participant role (work_participants.role) ────────────────────────────────

export const WORK_PARTICIPANT_ROLES = [
  "publisher",
  "administrator",
  "composer_author",
  "translator",
  "unspecified",
] as const;

export type WorkParticipantRole = (typeof WORK_PARTICIPANT_ROLES)[number];

export const WORK_PARTICIPANT_ROLE_LABELS: Readonly<Record<WorkParticipantRole, string>> = {
  publisher: "Editor",
  administrator: "Administrador",
  composer_author: "Compositor/Autor",
  translator: "Tradutor",
  unspecified: "Não informado",
};

/** Roles offered in the participant select of the work form (in display order). */
export const WORK_PARTICIPANT_ROLE_OPTIONS: ReadonlyArray<{ value: WorkParticipantRole; label: string }> = (
  ["publisher", "administrator", "composer_author", "translator"] as const
).map((value) => ({ value, label: WORK_PARTICIPANT_ROLE_LABELS[value] }));

export function isWorkParticipantRole(value: unknown): value is WorkParticipantRole {
  return typeof value === "string" && (WORK_PARTICIPANT_ROLES as readonly string[]).includes(value);
}

/**
 * PT-BR label of a participant role. A value outside the contract (the API
 * keeps unknown legacy roles verbatim) is shown as "Não informado" — the raw
 * technical value is never displayed.
 */
export function workParticipantRoleLabel(role: unknown): string {
  return isWorkParticipantRole(role)
    ? WORK_PARTICIPANT_ROLE_LABELS[role]
    : WORK_PARTICIPANT_ROLE_LABELS.unspecified;
}

// ── Work origin (works.work_origin) ──────────────────────────────────────────

export const WORK_ORIGINS = ["original", "reference"] as const;

export type WorkOrigin = (typeof WORK_ORIGINS)[number];

/** Short PT-BR labels (filters). */
export const WORK_ORIGIN_LABELS: Readonly<Record<WorkOrigin, string>> = {
  original: "Autoral",
  reference: "Referência",
};

/** Long PT-BR labels (badges and the origin selector). */
export const WORK_ORIGIN_BADGE_LABELS: Readonly<Record<WorkOrigin, string>> = {
  original: "Obra Autoral",
  reference: "Obra por Referência",
};

export function isWorkOrigin(value: unknown): value is WorkOrigin {
  return typeof value === "string" && (WORK_ORIGINS as readonly string[]).includes(value);
}

// ── AI usage level (works.ai_usage_level) ────────────────────────────────────

export const WORK_AI_USAGE_LEVELS = ["full", "partial"] as const;

export type WorkAiUsageLevel = (typeof WORK_AI_USAGE_LEVELS)[number];

export const WORK_AI_USAGE_LEVEL_LABELS: Readonly<Record<WorkAiUsageLevel, string>> = {
  full: "Totalmente",
  partial: "Parcialmente",
};

export function isWorkAiUsageLevel(value: unknown): value is WorkAiUsageLevel {
  return typeof value === "string" && (WORK_AI_USAGE_LEVELS as readonly string[]).includes(value);
}

// ── Status (works.status) — options of the work form select ─────────────────

export const WORK_STATUS_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: "under_review", label: "Em Análise" },
  { value: "pending", label: "Pendente" },
  { value: "registered", label: "Registrado" },
  { value: "rejected", label: "Rejeitado" },
];

// ── List filters (GET /works query values) ───────────────────────────────────

/** `ecad` query value of GET /works. */
export type WorkEcadFilter = "with_code" | "without_code";

/** `project_id` query value meaning "work without a linked project". */
export const WORK_PROJECT_FILTER_NONE = "none";

// ── Language (works.language — ISO 639 code) ─────────────────────────────────

/**
 * ISO 639 code persisted in `works.language` -> its PT-BR label. The labels are
 * exactly the texts of constants/languages.ts (pinned by work-options.test.ts);
 * `zxx` = no linguistic content (instrumental), `und` = undetermined ("Outro"),
 * `mul` = multiple languages.
 */
export const WORK_LANGUAGE_LABEL_BY_CODE: Readonly<Record<string, string>> = {
  de: "Alemão",
  am: "Amárico",
  ar: "Árabe",
  bn: "Bengali",
  yue: "Cantonês",
  zh: "Chinês Mandarim",
  ko: "Coreano",
  da: "Dinamarquês",
  es: "Espanhol",
  fil: "Filipino",
  fi: "Finlandês",
  fr: "Francês",
  el: "Grego",
  he: "Hebraico",
  hi: "Hindi",
  nl: "Holandês",
  id: "Indonésio",
  en: "Inglês",
  zxx: "Instrumental (Sem Letra)",
  yo: "Iorubá",
  it: "Italiano",
  ja: "Japonês",
  la: "Latim",
  ms: "Malaio",
  mul: "Multilíngue",
  no: "Norueguês",
  fa: "Persa",
  pl: "Polonês",
  pt: "Português",
  pa: "Punjabi",
  ru: "Russo",
  sw: "Suaíli",
  sv: "Sueco",
  th: "Tailandês",
  ta: "Tamil",
  te: "Telugu",
  tr: "Turco",
  uk: "Ucraniano",
  ur: "Urdu",
  vi: "Vietnamita",
  zu: "Zulu",
  und: "Outro",
};

const WORK_LANGUAGE_CODE_BY_LABEL: ReadonlyMap<string, string> = new Map(
  Object.entries(WORK_LANGUAGE_LABEL_BY_CODE).map(([code, label]) => [label, code]),
);

/**
 * Language select options: value = ISO code, label = PT-BR text, in the order of
 * constants/languages. A label added there without an ISO code here fails loudly.
 */
export const WORK_LANGUAGE_OPTIONS: ReadonlyArray<{ value: string; label: string }> = LANGUAGE_LABELS.map((label) => {
  const code = WORK_LANGUAGE_CODE_BY_LABEL.get(label);
  if (!code) throw new Error(`work-options: language label "${label}" has no ISO 639 code`);
  return { value: code, label };
});

/** PT-BR label of a language code; null when the code is not in the catalog (never the raw code). */
export function workLanguageLabel(code: unknown): string | null {
  if (typeof code !== "string" || !code) return null;
  return Object.prototype.hasOwnProperty.call(WORK_LANGUAGE_LABEL_BY_CODE, code) ? WORK_LANGUAGE_LABEL_BY_CODE[code] : null;
}

/**
 * ISO code of a project track language. Projects persist the language slug of
 * constants/languages.ts (e.g. "portugues"); null when the slug is unknown.
 */
export function workLanguageCodeFromProjectLanguage(slug: unknown): string | null {
  if (typeof slug !== "string" || !slug) return null;
  const label = LANGUAGE_LABEL_BY_VALUE[slug];
  return label ? (WORK_LANGUAGE_CODE_BY_LABEL.get(label) ?? null) : null;
}
