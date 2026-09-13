export interface ParticipanteForm {
  id: string;
  nome: string;
  classeFuncao: string;
  link: string;
  percentual: string;
}

export interface FonogramaParticipante {
  id: string;
  nome: string;
  percentual: string;
}

export interface ParticipacaoCategoria {
  produtorFonografico: FonogramaParticipante[];
  interprete: FonogramaParticipante[];
  musicoAcompanhante: FonogramaParticipante[];
}

export interface DuracaoParts {
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

export function parseDuracao(value: unknown): DuracaoParts {
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

export function formatDuracao(min: string | number, seg: string | number): string | null {
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

export function obraToParticipantes(obra: any): ParticipanteForm[] {
  if (!obra) return [];
  // Legacy: caller may already have prebuilt participantes
  if (Array.isArray(obra.participantes) && obra.participantes.length > 0) {
    return obra.participantes.map((p: any) => ({
      id: p.id || crypto.randomUUID(),
      nome: p.nome ?? "",
      classeFuncao: p.classeFuncao ?? "",
      link: p.link ?? "",
      percentual: p.percentual ?? "",
    }));
  }
  const compositores = normalizeStringArray(obra.compositores);
  const letristas = normalizeStringArray(obra.letristas);
  const out: ParticipanteForm[] = [];
  for (const nome of compositores) {
    out.push({
      id: crypto.randomUUID(),
      nome,
      classeFuncao: "compositor/autor",
      link: "",
      percentual: "",
    });
  }
  for (const nome of letristas) {
    out.push({
      id: crypto.randomUUID(),
      nome,
      classeFuncao: "tradutor",
      link: "",
      percentual: "",
    });
  }
  return out;
}

export function participantesToCompositoresLetristas(
  participantes: ParticipanteForm[],
): { compositores: string[] | null; letristas: string[] | null } {
  const compositores = participantes
    .filter((p) => p.classeFuncao?.toLowerCase() === "compositor/autor" && p.nome.trim())
    .map((p) => p.nome.trim());
  const letristas = participantes
    .filter((p) => p.classeFuncao?.toLowerCase() === "tradutor" && p.nome.trim())
    .map((p) => p.nome.trim());
  return {
    compositores: compositores.length > 0 ? compositores : null,
    letristas: letristas.length > 0 ? letristas : null,
  };
}

export function obraTitle(obra: any): string {
  if (!obra) return "";
  return (obra.title as string) ?? (obra.titulo as string) ?? "";
}

// ── IAElement interface ───────────────────────────────────────────────────────

export interface ObraIAElement {
  ferramenta: string;
  prompt: string;
}

// ── Canonical field readers (handle both snake_case and camelCase) ────────────

export function obraOutrosTitulos(obra: unknown): string[] {
  if (!obra || typeof obra !== "object") return [];
  const r = obra as Record<string, unknown>;
  return normalizeStringArray(r["outros_titulos"] ?? r["outrosTitulos"]);
}

export function obraReferenciasConexas(obra: unknown): string[] {
  if (!obra || typeof obra !== "object") return [];
  const r = obra as Record<string, unknown>;
  return normalizeStringArray(r["referencias_conexas"] ?? r["referenciasConexas"]);
}

export function obraLetraCompleta(obra: unknown): string {
  if (!obra || typeof obra !== "object") return "";
  const r = obra as Record<string, unknown>;
  const v = r["letra_completa"] ?? r["letraCompleta"];
  return typeof v === "string" ? v : "";
}

export function obraCriadaPorIA(obra: unknown): "sim" | "nao" {
  if (!obra || typeof obra !== "object") return "nao";
  const r = obra as Record<string, unknown>;
  if (r["criada_por_ia"] === true || r["criadaPorIA"] === "sim") return "sim";
  return "nao";
}

export function obraTipoIAValue(obra: unknown): string {
  if (!obra || typeof obra !== "object") return "";
  const r = obra as Record<string, unknown>;
  const v = r["tipo_ia"] ?? r["tipoIA"];
  return typeof v === "string" ? v : "";
}

function readIAElement(r: Record<string, unknown>, snakeKey: string, camelKey: string): ObraIAElement {
  const raw = r[snakeKey] ?? r[camelKey];
  if (!raw || typeof raw !== "object") return { ferramenta: "", prompt: "" };
  const obj = raw as Record<string, unknown>;
  return {
    ferramenta: typeof obj["ferramenta"] === "string" ? obj["ferramenta"] : "",
    prompt: typeof obj["prompt"] === "string" ? obj["prompt"] : "",
  };
}

export function obraIaHarmonia(obra: unknown): ObraIAElement {
  if (!obra || typeof obra !== "object") return { ferramenta: "", prompt: "" };
  return readIAElement(obra as Record<string, unknown>, "ia_harmonia", "iaHarmonia");
}

export function obraIaMelodia(obra: unknown): ObraIAElement {
  if (!obra || typeof obra !== "object") return { ferramenta: "", prompt: "" };
  return readIAElement(obra as Record<string, unknown>, "ia_melodia", "iaMelodia");
}

export function obraIaLetra(obra: unknown): ObraIAElement {
  if (!obra || typeof obra !== "object") return { ferramenta: "", prompt: "" };
  return readIAElement(obra as Record<string, unknown>, "ia_letra", "iaLetra");
}

// ── Export transform helpers ─────────────────────────────────────────────────

export function exportInstrumental(r: Record<string, unknown>): string {
  return r["instrumental"] === "sim" || r["instrumental"] === true ? "Sim" : "Não";
}

// ── Normalize helpers (canonical source: shared/lib/normalize.ts) ────────────
// Re-exported for backward-compat with callers that import from this file.
export { normalizeStr, normalizeBool } from "@/shared/lib/normalize";

// ── Obra: form fields interface + readers ────────────────────────────────────

export interface ObraFormFields {
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
  iaHarmonia: ObraIAElement;
  iaMelodia: ObraIAElement;
  iaLetra: ObraIAElement;
  participantes: ParticipanteForm[];
  outrosTitulos: string[];
  referenciasConexas: string[];
  letraCompleta: string;
  artistId: string;
}

/** DB record → form field initial values (single source of truth for useEffect) */
export function obraToFormFields(obra: any): ObraFormFields {
  const dur = parseDuracao(obra?.duracao);
  return {
    title: obraTitle(obra),
    situacao: dbStatusToSelect(obra?.status),
    generoMusical: obra?.genero?.toLowerCase() || "",
    idioma: obra?.idioma || "",
    duracaoMin: obra?.duracaoMin ?? dur.min,
    duracaoSeg: obra?.duracaoSeg ?? dur.seg,
    instrumental: obra?.instrumental || "nao",
    codEcad: obra?.cod_ecad ?? obra?.codEcad ?? "",
    codEntidade: obra?.cod_entidade ?? obra?.codEntidade ?? "",
    iswc: obra?.iswc || "",
    criadaPorIA: obraCriadaPorIA(obra),
    tipoIA: obraTipoIAValue(obra),
    iaHarmonia: obraIaHarmonia(obra),
    iaMelodia: obraIaMelodia(obra),
    iaLetra: obraIaLetra(obra),
    participantes: obraToParticipantes(obra),
    outrosTitulos: obraOutrosTitulos(obra),
    referenciasConexas: obraReferenciasConexas(obra),
    letraCompleta: obraLetraCompleta(obra),
    artistId: obra?.artist_id ?? "",
  };
}

export interface FormToObraInput {
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
  iaHarmonia: ObraIAElement;
  iaMelodia: ObraIAElement;
  iaLetra: ObraIAElement;
  outrosTitulos: string[];
  referenciasConexas: string[];
  letraCompleta: string;
  participantes: ParticipanteForm[];
  situacao: string;
  projectId: string | null;
  artistId: string | null;
  tipoObra: string;
  orgId: string;
}

/** Form state → DB payload (both snake_case and camelCase keys for compatibility) */
export function formToObraPayload(input: FormToObraInput): Record<string, unknown> {
  const { compositores, letristas } = participantesToCompositoresLetristas(
    input.participantes,
  );
  const duracao = formatDuracao(input.duracaoMin, input.duracaoSeg);
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
  // Uma chave por campo do formulário (snake_case = nome exato da coluna física).
  // org_id não é campo do form: o tenant vem do contexto autenticado da API.
  return {
    title: input.title.trim(),
    genero: input.generoMusical || null,
    idioma: input.idioma || null,
    iswc: input.iswc || null,
    cod_ecad: input.codEcad || null,
    cod_entidade: input.codEntidade || null,
    duracao,
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
    compositores,
    letristas,
    project_id: input.projectId ?? null,
    artist_id: input.artistId ?? null,
    tipo_obra: input.tipoObra,
  };
}

// ── Fonograma: form fields interface + readers ───────────────────────────────

export interface FonogramaFormFields {
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
  observacoes: string;
}

/** DB record → fonograma form field initial values */
export function fonogramaToFormFields(f: any): FonogramaFormFields {
  const dur  = parseDuracao(f?.duracao);
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
    generoMusical: ps(f?.generoMusical ?? f?.genero_musical),
    classificacao: ps(f?.classificacao),
    midia: ps(f?.midia),
    nacional: pb(f?.nacional) !== false ? (pb(f?.nacional) ?? true) : false,
    pubSimultanea: pb(f?.pubSimultanea ?? f?.pub_simultanea),
    status: dbStatusToSelect(ps(f?.status)),
    paisOrigem: ps(f?.paisOrigem ?? f?.pais_origem),
    paisPublicacao: ps(f?.paisPublicacao ?? f?.pais_publicacao),
    title: ps(f?.title),
    gravadora: ps(f?.gravadora),
    observacoes: ps(f?.observacoes),
  };
}

// ── Projeto → Obra seed ──────────────────────────────────────────────────────

/**
 * Converte um Projeto + primeira MusicaData em um objeto-semente que pode ser
 * passado diretamente para ObraFormModal como prop `obra`.
 *
 * Garante herança contextual: ao registrar uma Obra a partir de um Projeto
 * o formulário nasce pré-preenchido com todos os dados musicais do projeto
 * (título, gênero, idioma, duração, compositores, letra) e o artista do projeto.
 *
 * Fonte única de verdade para esta transformação. NÃO duplicar nos componentes.
 */
export function projetoToObraSeed(
  projeto: {
    id: string;
    title?: string | null;
    artist_id?: string | null;
    genero?: string | null;
  },
  musica?: {
    nome?: string;
    genero?: string;
    idioma?: string;
    duracaoMin?: string;
    duracaoSeg?: string;
    instrumental?: string;
    compositores?: string[];
    letra?: string;
  } | null,
): Record<string, unknown> {
  const participantes: ParticipanteForm[] = (musica?.compositores ?? [])
    .filter((nome): nome is string => Boolean(nome?.trim()))
    .map((nome) => ({
      id: crypto.randomUUID(),
      nome: nome.trim(),
      classeFuncao: "compositor/autor",
      link: "",
      percentual: "",
    }));

  const letraCompleta = musica?.letra || "";
  const genero = ((musica?.genero || projeto.genero || "").toLowerCase()) || null;

  return {
    project_id: projeto.id,
    artist_id: projeto.artist_id ?? null,
    title: musica?.nome?.trim() || projeto.title?.trim() || "",
    genero,
    idioma: musica?.idioma || null,
    duracaoMin: musica?.duracaoMin || "",
    duracaoSeg: musica?.duracaoSeg || "",
    instrumental: musica?.instrumental || "nao",
    participantes: participantes.length > 0 ? participantes : null,
    letra_completa: letraCompleta || null,
    letraCompleta: letraCompleta || null,
  };
}

export function fonogramaToParticipacao(fonograma: any): ParticipacaoCategoria {
  if (!fonograma) {
    return { produtorFonografico: [], interprete: [], musicoAcompanhante: [] };
  }
  // Legacy: caller may already have prebuilt participacao
  if (
    fonograma.participacao &&
    typeof fonograma.participacao === "object" &&
    !Array.isArray(fonograma.participacao)
  ) {
    const p = fonograma.participacao;
    return {
      produtorFonografico: Array.isArray(p.produtorFonografico) ? p.produtorFonografico : [],
      interprete: Array.isArray(p.interprete) ? p.interprete : [],
      musicoAcompanhante: Array.isArray(p.musicoAcompanhante) ? p.musicoAcompanhante : [],
    };
  }
  const produtores = normalizeStringArray(fonograma.produtores);
  return {
    produtorFonografico: produtores.map((nome) => ({
      id: crypto.randomUUID(),
      nome,
      percentual: "",
    })),
    interprete: [],
    musicoAcompanhante: [],
  };
}
