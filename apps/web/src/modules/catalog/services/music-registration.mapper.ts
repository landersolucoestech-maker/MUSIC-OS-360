export interface ParticipantForm {
  id: string;
  name: string;
  classeFuncao: string;
  link: string;
  percentual: string;
}

export interface PhonogramParticipant {
  id: string;
  name: string;
  percentual: string;
}

export interface ParticipationCategory {
  produtorFonografico: PhonogramParticipant[];
  interprete: PhonogramParticipant[];
  musicoAcompanhante: PhonogramParticipant[];
}

export interface DurationTextParts {
  min: string;
  seg: string;
}

export interface IsrcParts {
  pais: string;
  registrante: string;
  ano: string;
  designacao: string;
}

const STATUS_DB_TO_SELECT: Record<string, string> = {
  under_review: "em_análise",
  pending: "pendente",
  registered: "registrado",
  rejected: "rejeitado",
};

const STATUS_SELECT_TO_DB: Record<string, string> = {
  em_análise: "under_review",
  "em_analise": "under_review",
  "em análise": "under_review",
  "em analise": "under_review",
  pendente: "pending",
  registrado: "registered",
  rejeitado: "rejected",
  analise: "under_review",
};

export function dbStatusToSelect(value: unknown): string {
  if (typeof value !== "string") return "";
  const key = value.toLowerCase().trim();
  if (!key) return "";
  return STATUS_DB_TO_SELECT[key] ?? key;
}

export function normalizeStatusForDb(value: unknown): string {
  if (typeof value !== "string") return "pending";
  const key = value.toLowerCase().trim();
  if (!key) return "pending";
  return STATUS_SELECT_TO_DB[key] ?? key;
}

export function parseDurationText(value: unknown): DurationTextParts {
  if (typeof value !== "string" || !value.trim()) {
    return { min: "", seg: "" };
  }
  const parts = value.trim().split(":").map((p) => p.trim());
  // Accept HH:MM:SS or MM:SS
  let minRaw = "";
  let segRaw = "";
  if (parts.length === 3) {
    const h = parseInt(parts[0], 10) || 0;
    const m = parseInt(parts[1], 10) || 0;
    minRaw = String(h * 60 + m);
    segRaw = parts[2];
  } else if (parts.length === 2) {
    minRaw = parts[0];
    segRaw = parts[1];
  } else {
    return { min: "", seg: "" };
  }
  const minNum = parseInt(minRaw, 10);
  const segNum = parseInt(segRaw, 10);
  return {
    min: Number.isFinite(minNum) ? String(minNum) : "",
    seg: Number.isFinite(segNum) ? String(segNum) : "",
  };
}

export function formatDurationText(min: string | number, seg: string | number): string | null {
  const m = Number(min) || 0;
  const s = Number(seg) || 0;
  if (!min && !seg) return null;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function parseIsrc(value: unknown): IsrcParts {
  const empty: IsrcParts = { pais: "BR", registrante: "", ano: "", designacao: "" };
  if (typeof value !== "string" || !value.trim()) return empty;
  // Accept "BR-XXX-YY-NNNNN" or "BRXXXYYNNNNN"
  const trimmed = value.trim();
  if (trimmed.includes("-")) {
    const parts = trimmed.split("-").map((p) => p.trim());
    return {
      pais: parts[0] || "BR",
      registrante: parts[1] || "",
      ano: parts[2] || "",
      designacao: parts[3] || "",
    };
  }
  const compact = trimmed.replace(/\s+/g, "");
  if (compact.length >= 12) {
    return {
      pais: compact.slice(0, 2),
      registrante: compact.slice(2, 5),
      ano: compact.slice(5, 7),
      designacao: compact.slice(7, 12),
    };
  }
  return empty;
}

export function joinIsrc(parts: IsrcParts): string | null {
  const cleaned = [parts.pais, parts.registrante, parts.ano, parts.designacao]
    .map((p) => (p || "").trim())
    .filter(Boolean);
  return cleaned.length === 4 ? cleaned.join("-") : null;
}

function normalizeStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((v) => typeof v === "string" && v.trim()).map((v) => (v as string).trim());
  }
  if (typeof value === "string" && value.trim()) {
    return value
      .split(/[,;]/)
      .map((v) => v.trim())
      .filter(Boolean);
  }
  return [];
}

export function workToParticipants(work: any): ParticipantForm[] {
  if (!work) return [];
  // Legacy: caller may already have prebuilt participantes
  if (Array.isArray(work.participantes) && work.participantes.length > 0) {
    return work.participantes.map((p: any) => ({
      id: p.id || crypto.randomUUID(),
      name: p.name ?? "",
      classeFuncao: p.classeFuncao ?? "",
      link: p.link ?? "",
      percentual: p.percentual ?? "",
    }));
  }
  const composers = normalizeStringArray(work.compositores);
  const letristas = normalizeStringArray(work.letristas);
  const out: ParticipantForm[] = [];
  for (const name of composers) {
    out.push({
      id: crypto.randomUUID(),
      name,
      classeFuncao: "compositor/autor",
      link: "",
      percentual: "",
    });
  }
  for (const name of letristas) {
    out.push({
      id: crypto.randomUUID(),
      name,
      classeFuncao: "tradutor",
      link: "",
      percentual: "",
    });
  }
  return out;
}

export function participantsToComposersLyricists(
  participants: ParticipantForm[],
): { compositores: string[] | null; letristas: string[] | null } {
  const composers = participants
    .filter((p) => p.classeFuncao?.toLowerCase() === "compositor/autor" && p.name.trim())
    .map((p) => p.name.trim());
  const letristas = participants
    .filter((p) => p.classeFuncao?.toLowerCase() === "tradutor" && p.name.trim())
    .map((p) => p.name.trim());
  return {
    compositores: composers.length > 0 ? composers : null,
    letristas: letristas.length > 0 ? letristas : null,
  };
}

export function workTitle(work: any): string {
  if (!work) return "";
  return (work.title as string) ?? (work.titulo as string) ?? "";
}

// ── IAElement interface ───────────────────────────────────────────────────────

export interface WorkAiElement {
  ferramenta: string;
  prompt: string;
}

// ── Canonical field readers (handle both snake_case and camelCase) ────────────

export function workOtherTitles(work: unknown): string[] {
  if (!work || typeof work !== "object") return [];
  const r = work as Record<string, unknown>;
  return normalizeStringArray(r["outros_titulos"] ?? r["outrosTitulos"]);
}

export function workRelatedReferences(work: unknown): string[] {
  if (!work || typeof work !== "object") return [];
  const r = work as Record<string, unknown>;
  return normalizeStringArray(r["referencias_conexas"] ?? r["referenciasConexas"]);
}

export function workFullLyrics(work: unknown): string {
  if (!work || typeof work !== "object") return "";
  const r = work as Record<string, unknown>;
  const v = r["letra_completa"] ?? r["letraCompleta"];
  return typeof v === "string" ? v : "";
}

export function workCreatedByAi(work: unknown): "sim" | "nao" {
  if (!work || typeof work !== "object") return "nao";
  const r = work as Record<string, unknown>;
  if (r["criada_por_ia"] === true || r["criadaPorIA"] === "sim") return "sim";
  return "nao";
}

export function workTypeAiValue(work: unknown): string {
  if (!work || typeof work !== "object") return "";
  const r = work as Record<string, unknown>;
  const v = r["tipo_ia"] ?? r["tipoIA"];
  return typeof v === "string" ? v : "";
}

function readIAElement(r: Record<string, unknown>, snakeKey: string, camelKey: string): WorkAiElement {
  const raw = r[snakeKey] ?? r[camelKey];
  if (!raw || typeof raw !== "object") return { ferramenta: "", prompt: "" };
  const obj = raw as Record<string, unknown>;
  return {
    ferramenta: typeof obj["ferramenta"] === "string" ? obj["ferramenta"] : "",
    prompt: typeof obj["prompt"] === "string" ? obj["prompt"] : "",
  };
}

export function workAiHarmony(work: unknown): WorkAiElement {
  if (!work || typeof work !== "object") return { ferramenta: "", prompt: "" };
  return readIAElement(work as Record<string, unknown>, "ia_harmonia", "iaHarmonia");
}

export function workAiMelody(work: unknown): WorkAiElement {
  if (!work || typeof work !== "object") return { ferramenta: "", prompt: "" };
  return readIAElement(work as Record<string, unknown>, "ia_melodia", "iaMelodia");
}

export function workAiLyrics(work: unknown): WorkAiElement {
  if (!work || typeof work !== "object") return { ferramenta: "", prompt: "" };
  return readIAElement(work as Record<string, unknown>, "ia_letra", "iaLetra");
}

// ── Export transform helpers ─────────────────────────────────────────────────

export function exportInstrumental(r: Record<string, unknown>): string {
  return r["instrumental"] === "sim" || r["instrumental"] === true ? "Sim" : "Não";
}

// ── Normalize helpers (canonical source: shared/lib/normalize.ts) ────────────
// Re-exported for backward-compat with callers that import from this file.
export { normalizeStr, normalizeBool } from "@/shared/lib/normalize";

// ── Obra: form fields interface + readers ────────────────────────────────────

export interface WorkFormFields {
  title: string;
  situacao: string;
  generoMusical: string;
  idioma: string;
  duracaoMin: string;
  duracaoSeg: string;
  instrumental: string;
  codEcad: string;
  codEntidade: string;
  iswc: string;
  criadaPorIA: "sim" | "nao";
  tipoIA: string;
  iaHarmonia: WorkAiElement;
  iaMelodia: WorkAiElement;
  iaLetra: WorkAiElement;
  participantes: ParticipantForm[];
  outrosTitulos: string[];
  referenciasConexas: string[];
  letraCompleta: string;
  artistId: string;
}

/** DB record → form field initial values (single source of truth for useEffect) */
export function workToFormFields(work: any): WorkFormFields {
  const dur = parseDurationText(work?.duration_text);
  return {
    title: workTitle(work),
    situacao: dbStatusToSelect(work?.status),
    generoMusical: work?.music_genre?.toLowerCase() || "",
    idioma: work?.idioma || "",
    duracaoMin: work?.duracaoMin ?? dur.min,
    duracaoSeg: work?.duracaoSeg ?? dur.seg,
    instrumental: work?.instrumental || "nao",
    codEcad: work?.cod_ecad ?? work?.codEcad ?? "",
    codEntidade: work?.cod_entidade ?? work?.codEntidade ?? "",
    iswc: work?.iswc || "",
    criadaPorIA: workCreatedByAi(work),
    tipoIA: workTypeAiValue(work),
    iaHarmonia: workAiHarmony(work),
    iaMelodia: workAiMelody(work),
    iaLetra: workAiLyrics(work),
    participantes: workToParticipants(work),
    outrosTitulos: workOtherTitles(work),
    referenciasConexas: workRelatedReferences(work),
    letraCompleta: workFullLyrics(work),
    artistId: work?.artist_id ?? "",
  };
}

export interface FormToWorkInput {
  title: string;
  generoMusical: string;
  idioma: string;
  iswc: string;
  codEcad: string;
  codEntidade: string;
  duracaoMin: string;
  duracaoSeg: string;
  instrumental: string;
  criadaPorIA: "sim" | "nao";
  tipoIA: string;
  iaHarmonia: WorkAiElement;
  iaMelodia: WorkAiElement;
  iaLetra: WorkAiElement;
  outrosTitulos: string[];
  referenciasConexas: string[];
  letraCompleta: string;
  participantes: ParticipantForm[];
  situacao: string;
  projectId: string | null;
  artistId: string | null;
  tipoObra: string;
  orgId: string;
}

/** Form state → DB payload (both snake_case and camelCase keys for compatibility) */
export function formToWorkPayload(input: FormToWorkInput): Record<string, unknown> {
  const { compositores: composers, letristas } = participantsToComposersLyricists(
    input.participantes,
  );
  const durationText = formatDurationText(input.duracaoMin, input.duracaoSeg);
  const iaH =
    input.iaHarmonia.ferramenta || input.iaHarmonia.prompt
      ? input.iaHarmonia
      : null;
  const iaM =
    input.iaMelodia.ferramenta || input.iaMelodia.prompt
      ? input.iaMelodia
      : null;
  const iaL =
    input.iaLetra.ferramenta || input.iaLetra.prompt ? input.iaLetra : null;
  const outros = input.outrosTitulos.filter(Boolean);
  const refs = input.referenciasConexas.filter(Boolean);
  // One key per form field (snake_case = exact physical column name).
  // org_id is not a form field: the tenant comes from the API's authenticated context.
  return {
    title: input.title.trim(),
    music_genre: input.generoMusical || null,
    idioma: input.idioma || null,
    iswc: input.iswc || null,
    cod_ecad: input.codEcad || null,
    cod_entidade: input.codEntidade || null,
    duration_text: durationText,
    instrumental: input.instrumental || null,
    criada_por_ia: input.criadaPorIA === "sim",
    tipo_ia: input.tipoIA || null,
    ia_harmonia: iaH,
    ia_melodia: iaM,
    ia_letra: iaL,
    outros_titulos: outros.length > 0 ? outros : null,
    referencias_conexas: refs.length > 0 ? refs : null,
    letra_completa: input.letraCompleta || null,
    participantes: input.participantes.length > 0 ? input.participantes : null,
    status: normalizeStatusForDb(input.situacao),
    compositores: composers,
    letristas,
    project_id: input.projectId ?? null,
    artist_id: input.artistId ?? null,
    tipo_obra: input.tipoObra,
  };
}

// ── Fonograma: form fields interface + readers ───────────────────────────────

export interface PhonogramFormFields {
  codEcad: string;
  codEntidade: string;
  agregadora: string;
  isrcPais: string;
  isrcRegistrante: string;
  isrcAno: string;
  isrcDesignacao: string;
  criadaPorIA: boolean;
  emissao: string;
  gravacaoOriginal: string;
  lancamento: string;
  duracaoMin: string;
  duracaoSeg: string;
  instrumental: boolean;
  generoMusical: string;
  classificacao: string;
  midia: string;
  nacional: boolean;
  pubSimultanea: boolean;
  status: string;
  paisOrigem: string;
  paisPublicacao: string;
  title: string;
  gravadora: string;
  notes: string;
}

/** DB record → fonograma form field initial values */
export function phonogramToFormFields(f: any): PhonogramFormFields {
  const dur  = parseDurationText(f?.duration_text);
  const isrc = parseIsrc(f?.isrc);
  const ps   = (v: unknown): string => {
    if (v !== undefined && v !== null && v !== "") return String(v);
    return "";
  };
  const pb = (...vals: unknown[]): boolean => {
    for (const v of vals) if (v === true || v === false) return Boolean(v);
    return false;
  };
  return {
    codEcad: ps(f?.cod_ecad ?? f?.codEcad),
    codEntidade: ps(f?.cod_entidade ?? f?.codEntidade),
    agregadora: ps(f?.agregadora ?? f?.gravadora),
    isrcPais: ps(f?.isrc_pais ?? f?.isrcPais) || isrc.pais || "BR",
    isrcRegistrante: ps(f?.isrc_registrante ?? f?.isrcRegistrante) || isrc.registrante,
    isrcAno: ps(f?.isrc_ano ?? f?.isrcAno) || isrc.ano,
    isrcDesignacao: ps(f?.isrc_designacao ?? f?.isrcDesignacao) || isrc.designacao,
    criadaPorIA: pb(f?.criadaPorIA, f?.criada_por_ia),
    emissao: ps(f?.emissao),
    gravacaoOriginal: ps(f?.gravacaoOriginal ?? f?.gravacao_original ?? f?.data_registro),
    lancamento: ps(f?.lancamento ?? f?.data_lancamento),
    duracaoMin: ps(f?.duracaoMin ?? f?.duracao_min) || dur.min,
    duracaoSeg: ps(f?.duracaoSeg ?? f?.duracao_seg) || dur.seg,
    instrumental: pb(f?.instrumental),
    generoMusical: ps(f?.music_genre ?? f?.generoMusical),
    classificacao: ps(f?.classificacao),
    midia: ps(f?.midia),
    nacional: pb(f?.nacional) !== false ? (pb(f?.nacional) ?? true) : false,
    pubSimultanea: pb(f?.pubSimultanea ?? f?.pub_simultanea),
    status: dbStatusToSelect(ps(f?.status)),
    paisOrigem: ps(f?.paisOrigem ?? f?.pais_origem),
    paisPublicacao: ps(f?.paisPublicacao ?? f?.pais_publicacao),
    title: ps(f?.title),
    gravadora: ps(f?.gravadora),
    notes: ps(f?.notes),
  };
}

// ── Project → Work seed ──────────────────────────────────────────────────────

/**
 * Converts a Project + its first MusicaData into a seed object that can be
 * passed directly to WorkFormModal as the `obra` prop.
 *
 * Guarantees contextual inheritance: when registering a Work from a Project
 * the form is born prefilled with all the project's musical data
 * (title, genre, language, duration, composers, lyrics) and the project's artist.
 *
 * Single source of truth for this transformation. Do NOT duplicate it in the components.
 */
export function projectToWorkSeed(
  project: {
    id: string;
    title?: string | null;
    artist_id?: string | null;
    music_genre?: string | null;
  },
  track?: {
    name?: string;
    genero?: string;
    idioma?: string;
    duracaoMin?: string;
    duracaoSeg?: string;
    instrumental?: string;
    compositores?: string[];
    letra?: string;
  } | null,
): Record<string, unknown> {
  const participants: ParticipantForm[] = (track?.compositores ?? [])
    .filter((composerName): composerName is string => Boolean(composerName?.trim()))
    .map((composerName) => ({
      id: crypto.randomUUID(),
      name: composerName.trim(),
      classeFuncao: "compositor/autor",
      link: "",
      percentual: "",
    }));

  const fullLyrics = track?.letra || "";
  const genre = ((track?.genero || project.music_genre || "").toLowerCase()) || null;

  return {
    project_id: project.id,
    artist_id: project.artist_id ?? null,
    title: track?.name?.trim() || project.title?.trim() || "",
    music_genre: genre,
    idioma: track?.idioma || null,
    duracaoMin: track?.duracaoMin || "",
    duracaoSeg: track?.duracaoSeg || "",
    instrumental: track?.instrumental || "nao",
    participantes: participants.length > 0 ? participants : null,
    letra_completa: fullLyrics || null,
    letraCompleta: fullLyrics || null,
  };
}

export function phonogramToParticipation(phonogram: any): ParticipationCategory {
  if (!phonogram) {
    return { produtorFonografico: [], interprete: [], musicoAcompanhante: [] };
  }
  // Legacy: caller may already have prebuilt participacao
  if (
    phonogram.participacao &&
    typeof phonogram.participacao === "object" &&
    !Array.isArray(phonogram.participacao)
  ) {
    const p = phonogram.participacao;
    return {
      produtorFonografico: Array.isArray(p.produtorFonografico) ? p.produtorFonografico : [],
      interprete: Array.isArray(p.interprete) ? p.interprete : [],
      musicoAcompanhante: Array.isArray(p.musicoAcompanhante) ? p.musicoAcompanhante : [],
    };
  }
  const producers = normalizeStringArray(phonogram.produtores);
  return {
    produtorFonografico: producers.map((producerName) => ({
      id: crypto.randomUUID(),
      name: producerName,
      percentual: "",
    })),
    interprete: [],
    musicoAcompanhante: [],
  };
}
