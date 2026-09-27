/**
 * work-registry-fields.util.ts
 *
 * Naming-mission audit (2026-09-20/21) proved WorkEntity's Registry Fields
 * (language/is_instrumental/duration_seconds/ai_used/ai_tools/ai_prompts/
 * alternative_titles, migration 20260601000001_RegistryFieldsPhase1) are
 * NEVER populated by the real write path — ObraFormModal writes only the
 * Portuguese "one column per form field" set (idioma/instrumental/
 * criada_por_ia/duration_text/outros_titulos/ia_harmonia/ia_melodia/
 * ia_letra), and society-payload-builder.service.ts's buildWorkPayload()
 * reads only the Registry Fields — every ABRAMUS/ECAD work submission has
 * shipped these fields null even when the user filled the equivalent PT
 * field. This derives the Registry Fields from the PT fields on every
 * write, so the two finally agree.
 */

const LANGUAGE_LABEL_TO_ISO: Record<string, string> = {
  // ISO 639-1 (two-letter) where one exists.
  'Alemão': 'de',
  'Amárico': 'am',
  'Árabe': 'ar',
  'Bengali': 'bn',
  'Chinês Mandarim': 'zh',
  'Coreano': 'ko',
  'Dinamarquês': 'da',
  'Espanhol': 'es',
  'Finlandês': 'fi',
  'Francês': 'fr',
  'Grego': 'el',
  'Hebraico': 'he',
  'Hindi': 'hi',
  'Holandês': 'nl',
  'Indonésio': 'id',
  'Inglês': 'en',
  'Iorubá': 'yo',
  'Italiano': 'it',
  'Japonês': 'ja',
  'Latim': 'la',
  'Malaio': 'ms',
  'Norueguês': 'no',
  'Persa': 'fa',
  'Polonês': 'pl',
  'Português': 'pt',
  'Punjabi': 'pa',
  'Russo': 'ru',
  'Suaíli': 'sw',
  'Sueco': 'sv',
  'Tailandês': 'th',
  'Tamil': 'ta',
  'Telugu': 'te',
  'Turco': 'tr',
  'Ucraniano': 'uk',
  'Urdu': 'ur',
  'Vietnamita': 'vi',
  'Zulu': 'zu',
  // No ISO 639-1 (two-letter) code exists for these -- ISO 639-2/3 used
  // instead, still an official standard code, not a heuristic guess.
  'Cantonês': 'yue', // ISO 639-3
  'Filipino': 'fil', // ISO 639-2
  'Multilíngue': 'mul', // ISO 639-2 "multiple languages"
  // Not real languages -- "Instrumental (Sem Letra)" duplicates the
  // separate `instrumental`/`is_instrumental` field; "Outro" has no
  // determinate code. Both map to `null` (no language recorded) rather
  // than an invented code.
  'Instrumental (Sem Letra)': '',
  'Outro': '',
};

/** `idioma` (PT label, e.g. "Português") -> ISO 639 code for `language` (varchar(10)). */
export function mapIdiomaToLanguageCode(idioma: string | null | undefined): string | null {
  if (!idioma) return null;
  const code = LANGUAGE_LABEL_TO_ISO[idioma];
  return code || null;
}

/** `instrumental` ('sim'|'nao') -> `is_instrumental` (boolean). */
export function mapInstrumentalToBoolean(instrumental: string | null | undefined): boolean | null {
  if (instrumental === 'sim') return true;
  if (instrumental === 'nao') return false;
  return null;
}

/**
 * `duration_text` ("MM:SS", the only format the write path ever produces --
 * see apps/web/.../registro-musicas.mapper.ts's formatDurationText; parsing
 * also accepts "HH:MM:SS" for defensiveness, matching that same file's
 * parseDurationText read side) -> `duration_seconds` (integer).
 */
export function parseDurationTextToSeconds(durationText: string | null | undefined): number | null {
  if (typeof durationText !== 'string' || !durationText.trim()) return null;
  const parts = durationText.trim().split(':').map((p) => parseInt(p, 10));
  if (parts.some((p) => Number.isNaN(p))) return null;
  if (parts.length === 2) {
    const [min, sec] = parts;
    return min * 60 + sec;
  }
  if (parts.length === 3) {
    const [hour, min, sec] = parts;
    return hour * 3600 + min * 60 + sec;
  }
  return null;
}

type IaElement = { ferramenta?: string; prompt?: string } | null | undefined;

/** ia_harmonia/ia_melodia/ia_letra ({ferramenta,prompt}|null) -> ai_tools/ai_prompts (string[]). */
export function deriveAiToolsAndPrompts(
  iaHarmonia: IaElement,
  iaMelodia: IaElement,
  aiLyrics: IaElement,
): { ai_tools: string[]; ai_prompts: string[] } {
  const elements = [iaHarmonia, iaMelodia, aiLyrics];
  const ai_tools = elements
    .map((e) => e?.ferramenta)
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 0);
  const ai_prompts = elements
    .map((e) => e?.prompt)
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 0);
  return { ai_tools, ai_prompts };
}

export interface WorkRegistrySourceFields {
  idioma?: string | null;
  instrumental?: string | null;
  criada_por_ia?: boolean | null;
  duration_text?: string | null;
  outros_titulos?: unknown[] | null;
  letra_completa?: string | null;
  ia_harmonia?: IaElement;
  ia_melodia?: IaElement;
  ia_letra?: IaElement;
}

export interface WorkRegistryDerivedFields {
  language: string | null;
  is_instrumental: boolean | null;
  duration_seconds: number | null;
  ai_used: boolean | null;
  ai_tools: string[];
  ai_prompts: string[];
  alternative_titles: unknown[] | null;
  // `lyrics` (Registry Fields Phase 1) had zero writers/readers of its own --
  // society-payload-builder.service.ts's buildWorkPayload() doesn't include
  // it either. `letra_completa` is the live, actually-used field (form +
  // ObraViewModal). Mirrored here rather than dropped so the Registry
  // Fields report section (report-form-contracts.ts's ro('lyrics')) shows
  // real data instead of a permanently-null column.
  lyrics: string | null;
}

/**
 * Derives every Registry Field from a FULLY MERGED view of the PT source
 * fields (caller merges the incoming patch over the current entity so a
 * partial update -- e.g. changing only `idioma` -- still derives correct
 * ai_tools/ai_prompts/etc. from the unchanged sibling fields, not from
 * `undefined`).
 */
export function deriveWorkRegistryFields(merged: WorkRegistrySourceFields): WorkRegistryDerivedFields {
  const { ai_tools, ai_prompts } = deriveAiToolsAndPrompts(
    merged.ia_harmonia,
    merged.ia_melodia,
    merged.ia_letra,
  );
  return {
    language: mapIdiomaToLanguageCode(merged.idioma),
    is_instrumental: mapInstrumentalToBoolean(merged.instrumental),
    duration_seconds: parseDurationTextToSeconds(merged.duration_text),
    ai_used: merged.criada_por_ia ?? null,
    ai_tools,
    ai_prompts,
    alternative_titles: Array.isArray(merged.outros_titulos) ? merged.outros_titulos : null,
    lyrics: merged.letra_completa ?? null,
  };
}
