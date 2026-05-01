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
  analise: "em_análise",
  pendente: "pendente",
  registrado: "registrado",
  rejeitado: "rejeitado",
};

const STATUS_SELECT_TO_DB: Record<string, string> = {
  em_análise: "analise",
  "em_analise": "analise",
  "em análise": "analise",
  "em analise": "analise",
  pendente: "pendente",
  registrado: "registrado",
  rejeitado: "rejeitado",
  analise: "analise",
};

export function dbStatusToSelect(value: unknown): string {
  if (typeof value !== "string") return "";
  const key = value.toLowerCase().trim();
  if (!key) return "";
  return STATUS_DB_TO_SELECT[key] ?? key;
}

export function normalizeStatusForDb(value: unknown): string {
  if (typeof value !== "string") return "pendente";
  const key = value.toLowerCase().trim();
  if (!key) return "pendente";
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

export function obraTitulo(obra: any): string {
  if (!obra) return "";
  return (obra.titulo as string) ?? (obra.title as string) ?? "";
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
