/**
 * category-labels — PT-BR (presentation) formatting of technical categories/identifiers.
 * NEVER displays an underscore: matches the dictionary (correct accents) or,
 * as a fallback, replaces `_` with a space and applies Title Case. Does not change internal values.
 */

const CATEGORY_LABELS: Record<string, string> = {
  // ── Financeiro ────────────────────────────────────────────────────────────────
  "recebimentos externos de direitos": "Recebimentos externos de direitos",
  recebimentos_externos_de_direitos: "Recebimentos externos de direitos",
  cache: "Cachê de Shows",
  "cachê": "Cachê de Shows",
  licenciamento: "Licenciamento",
  licenciamento_musical: "Licenciamento Musical",
  distribuicao: "Distribuição",
  distribuicao_digital: "Distribuição Digital",
  patrocinio: "Patrocínio",
  adiantamento_artista: "Adiantamento a Artista",
  producao_musical: "Produção Musical",
  marketing: "Marketing",
  marketing_digital: "Marketing Digital",
  marketing_offline: "Marketing Offline",
  marketing_influencia: "Marketing de Influência",
  juridico: "Honorários Jurídicos",
  administrativo: "Administrativo",
  folha_pagamento: "Folha de Pagamento",
  producao_audiovisual: "Produção Audiovisual",
  infraestrutura: "Infraestrutura",
  software: "Software",
  seguros: "Seguros",
  producao: "Produção",
  shows: "Shows",
  operacional: "Operacional",
  // ── Contracts / services (CST) ──────────────────────────────────────────────────
  empresariamento: "Empresariamento",
  suporte_financeiro: "Suporte Financeiro",
  gestao: "Gestão",
  gestao_carreira: "Gestão de Carreira",
  gestao_artistica: "Gestão Artística",
  gestao_imagem: "Gestão de Imagem",
  gestao_catalogo: "Gestão de Catálogo",
  agenciamento: "Agenciamento",
  agenciamento_gestao: "Agenciamento e Gestão",
  edicao: "Edição",
  edicao_musical: "Edição Musical",
  publicidade: "Publicidade",
  parceria: "Parceria",
  parcerias: "Parcerias",
  parcerias_comerciais: "Parcerias Comerciais",
  exclusividade: "Exclusividade",
  gravacao: "Gravação",
  gravacao_distribuicao: "Gravação e Distribuição",
  cessao_direitos: "Cessão de Direitos",
  direitos_autorais: "Direitos Autorais",
  registro_obras: "Registro de Obras",
  registro_autoral: "Registro Autoral",
  arrecadacao_autoral: "Arrecadação Autoral",
  administracao_editorial: "Administração Editorial",
  sincronizacao: "Sincronização",
  estrategia_carreira: "Estratégia de Carreira",
  // ── Project / marketing / content ────────────────────────────────────────────────
  sessao_fotos: "Sessão de Fotos",
  conteudo_lancamento: "Conteúdo de Lançamento",
  videoclipe: "Videoclipe",
  producao_eventos: "Produção de Eventos",
  contratacao_artistas: "Contratação de Artistas",
  eventos_corporativos: "Eventos Corporativos",
  campanhas_artistas: "Campanhas de Artistas",
  divulgacao_eventos: "Divulgação de Eventos",
  projetos_especiais: "Projetos Especiais",
  atendimento_personalizado: "Atendimento Personalizado",
  criacao_sites: "Criação de Sites",
  desenvolvimento_site: "Desenvolvimento de Site",
  consultoria: "Consultoria",
  influenciadores: "Influenciadores",
  outros: "Outros",
  outro: "Outro",
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
  const key = raw.toLowerCase();
  if (CATEGORY_LABELS[key]) return CATEGORY_LABELS[key];
  if (CATEGORY_LABELS[raw]) return CATEGORY_LABELS[raw];
  // Fallback: removes underscores and applies Title Case (guarantees no "_").
  return titleCase(raw.replace(/_/g, " "));
}
