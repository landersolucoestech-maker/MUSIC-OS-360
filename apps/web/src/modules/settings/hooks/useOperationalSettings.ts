import { useMemo, useState } from "react";
import { settingsService } from "@/modules/settings/services/settings.service";

export type OperationalListKind =
  | "lead_type"
  | "service_interest"
  | "lead_category"
  | "lead_status"
  | "lead_segment"
  | "contact_category"
  | "contact_pf_classification"
  | "contact_pj_classification"
  | "event_type"
  | "marketing_context"
  | "marketing_sector"
  | "marketing_task_type"
  | "briefing_service_type"
  | "creative_ai_setting";

export type OperationalListItem = {
  id: string;
  kind: OperationalListKind;
  name: string;
  slug: string;
  description: string;
  active: boolean;
  order: number;
  group?: string;
  metadata?: Record<string, unknown>;
};

export type OperationalOption = {
  value: string;
  label: string;
};

const nowIso = () => new Date().toISOString();

export const DEFAULT_LEAD_TYPES: OperationalListItem[] = [
  { id: "lead-artista-banda", kind: "lead_type", name: "Artista / Banda", slug: "artista_banda", description: "Artista solo, dupla, banda ou projeto musical.", active: true, order: 10, group: "Musical", metadata: { allowed_service_slugs: ["gestao_artistica", "producao_musical", "producao_audiovisual", "marketing_musical", "social_media", "design_grafico", "distribuicao_digital"] } },
  { id: "lead-contratante-show", kind: "lead_type", name: "Contratante de show", slug: "contratante_show", description: "Pessoa ou empresa buscando contratação artística.", active: true, order: 20, group: "Eventos", metadata: { allowed_service_slugs: ["show_booking"] } },
  { id: "lead-marca-empresa", kind: "lead_type", name: "Marca / Empresa", slug: "marca_empresa", description: "Empresa interessada em publicidade, licenciamento ou projeto comercial.", active: true, order: 30, group: "Corporativo" },
  { id: "lead-produtora-eventos", kind: "lead_type", name: "Produtora de eventos", slug: "produtora_eventos", description: "Produtora, promoter, festival ou organização de eventos.", active: true, order: 40, group: "Eventos" },
  { id: "lead-gravadora-selo", kind: "lead_type", name: "Gravadora / Selo", slug: "gravadora_selo", description: "Gravadora, selo, editora ou parceiro musical.", active: true, order: 50, group: "Musical" },
  { id: "lead-agencia", kind: "lead_type", name: "Agência", slug: "agencia", description: "Agência de publicidade, marketing, casting ou PR.", active: true, order: 60, group: "Comercial" },
  { id: "lead-influenciador", kind: "lead_type", name: "Influenciador", slug: "influenciador", description: "Criador de conteúdo, influencer ou personalidade digital.", active: true, order: 70, group: "Digital" },
];

export const DEFAULT_SERVICE_INTERESTS: OperationalListItem[] = [
  { id: "service-show-booking", kind: "service_interest", name: "Contratação artística", slug: "show_booking", description: "Contratação artística, apresentação, pocket show ou DJ set.", active: true, order: 10, group: "Eventos", metadata: { operational_type: "EVENT_SERVICE" } },
  { id: "service-gestao-artistica", kind: "service_interest", name: "Gestão Artística", slug: "gestao_artistica", description: "Gestão de carreira, posicionamento, agenda e operação artística.", active: true, order: 20, group: "Gestão", metadata: { operational_type: "PRODUCTION_SERVICE" } },
  { id: "service-producao-musical", kind: "service_interest", name: "Produção Musical", slug: "producao_musical", description: "Produção completa, beat, arranjo ou gravação musical.", active: true, order: 25, group: "Produção", metadata: { operational_type: "PRODUCTION_SERVICE" } },
  { id: "service-mixagem", kind: "service_interest", name: "Mixagem", slug: "mixagem", description: "Mixagem de faixas, stems ou projeto musical.", active: true, order: 30, group: "Produção", metadata: { operational_type: "PRODUCTION_SERVICE" } },
  { id: "service-masterizacao", kind: "service_interest", name: "Masterização", slug: "masterizacao", description: "Masterização para streaming, vídeo, CD, vinil ou plataformas digitais.", active: true, order: 40, group: "Produção", metadata: { operational_type: "PRODUCTION_SERVICE" } },
  { id: "service-distribuicao-digital", kind: "service_interest", name: "Distribuição Digital", slug: "distribuicao_digital", description: "Distribuição em DSPs, metadados, release e monetização.", active: true, order: 50, group: "Distribuição", metadata: { operational_type: "PRODUCTION_SERVICE" } },
  { id: "service-marketing-musical", kind: "service_interest", name: "Marketing Musical", slug: "marketing_musical", description: "Campanhas, social media, tráfego pago e estratégia de lançamento.", active: true, order: 60, group: "Marketing", metadata: { operational_type: "PRODUCTION_SERVICE" } },
  { id: "service-social-media", kind: "service_interest", name: "Social media", slug: "social_media", description: "Gestão de conteúdo, calendário editorial, publicações e redes sociais.", active: true, order: 70, group: "Marketing", metadata: { operational_type: "PRODUCTION_SERVICE" } },
  { id: "service-producao-audiovisual", kind: "service_interest", name: "Audiovisual", slug: "producao_audiovisual", description: "Videoclipe, visualizer, aftermovie, conteúdo ou audiovisual.", active: true, order: 80, group: "Audiovisual", metadata: { operational_type: "PRODUCTION_SERVICE" } },
  { id: "service-design-grafico", kind: "service_interest", name: "Design Gráfico", slug: "design_grafico", description: "Capa, identidade visual, social media, motion ou material gráfico.", active: true, order: 90, group: "Design", metadata: { operational_type: "PRODUCTION_SERVICE" } },
  { id: "service-licenciamento", kind: "service_interest", name: "Licenciamento", slug: "licenciamento", description: "Sync, publicidade, uso de obra, marca ou projeto audiovisual.", active: true, order: 90, group: "Direitos", metadata: { operational_type: "PRODUCTION_SERVICE" } },
  { id: "service-consultoria", kind: "service_interest", name: "Consultoria", slug: "consultoria", description: "Mentoria, consultoria musical, carreira, marketing ou tecnologia.", active: true, order: 100, group: "Consultoria", metadata: { operational_type: "PRODUCTION_SERVICE" } },
  { id: "service-outro", kind: "service_interest", name: "Outro", slug: "outro", description: "Serviço personalizado ou ainda não classificado.", active: true, order: 999, group: "Geral" },
];

export const DEFAULT_LEAD_CATEGORIES: OperationalListItem[] = [
  { id: "lead-category-artista", kind: "lead_category", name: "Artista / Banda", slug: "artista_banda", description: "Lead de artista, banda ou projeto musical.", active: true, order: 10, group: "Leads" },
  { id: "lead-category-contratante", kind: "lead_category", name: "Contratante de show", slug: "contratante_show", description: "Contratante, produtor ou casa de evento.", active: true, order: 20, group: "Leads" },
  { id: "lead-category-marca", kind: "lead_category", name: "Marca / Empresa", slug: "marca_empresa", description: "Empresa interessada em projeto comercial.", active: true, order: 30, group: "Leads" },
  { id: "lead-category-agencia", kind: "lead_category", name: "Agência", slug: "agencia", description: "Agência, produtora ou parceiro comercial.", active: true, order: 40, group: "Leads" },
];

// Slugs alinhados 1:1 ao enum real LeadStatus (@music-os-360/types) e ao
// workflow apps/api/src/core/workflow/definitions/leads.workflow.ts — os
// slugs anteriores (novo_lead/proposta_enviada) não existem no backend;
// qualquer PATCH /leads com esses valores era rejeitado por @IsIn(STATUSES).
// 2026-09-10: LeadStatus foi renomeado para inglês (NOVO->NEW, CONTATO->CONTACTED,
// EM_CONTATO->IN_CONTACT, QUALIFICADO->QUALIFIED, PROPOSTA->PROPOSAL,
// NEGOCIACAO->NEGOTIATION, FECHADO->CLOSED, PERDIDO->LOST, INATIVO->INACTIVE) —
// os slugs abaixo são o valor físico realmente gravado em leads.status via
// LeadFormModal/InternalCRMFields; mantidos em sincronia com o enum canônico.
export const DEFAULT_LEAD_STATUSES: OperationalListItem[] = [
  { id: "lead-status-novo", kind: "lead_status", name: "Novo", slug: "new", description: "Lead recebido e ainda não qualificado.", active: true, order: 10, group: "Pipeline" },
  { id: "lead-status-contato", kind: "lead_status", name: "Contato", slug: "contacted", description: "Primeiro contato realizado.", active: true, order: 20, group: "Pipeline" },
  { id: "lead-status-em-contato", kind: "lead_status", name: "Em contato", slug: "in_contact", description: "Contato em andamento.", active: true, order: 30, group: "Pipeline" },
  { id: "lead-status-qualificado", kind: "lead_status", name: "Qualificado", slug: "qualified", description: "Lead validado comercialmente.", active: true, order: 40, group: "Pipeline" },
  { id: "lead-status-proposta", kind: "lead_status", name: "Proposta", slug: "proposal", description: "Proposta comercial enviada.", active: true, order: 50, group: "Pipeline" },
  { id: "lead-status-negociacao", kind: "lead_status", name: "Negociação", slug: "negotiation", description: "Em negociação de termos.", active: true, order: 60, group: "Pipeline" },
  { id: "lead-status-fechado", kind: "lead_status", name: "Fechado", slug: "closed", description: "Negócio fechado.", active: true, order: 70, group: "Pipeline" },
  { id: "lead-status-perdido", kind: "lead_status", name: "Perdido", slug: "lost", description: "Oportunidade perdida.", active: true, order: 80, group: "Pipeline" },
  { id: "lead-status-inativo", kind: "lead_status", name: "Inativo/Arquivado", slug: "inactive", description: "Arquivado sem movimentação.", active: true, order: 90, group: "Pipeline" },
];

export const DEFAULT_LEAD_SEGMENTS: OperationalListItem[] = [
  { id: "lead-segment-musical", kind: "lead_segment", name: "Musical", slug: "musical", description: "Artistas, selos, editoras e gravadoras.", active: true, order: 10, group: "Segmentos" },
  { id: "lead-segment-eventos", kind: "lead_segment", name: "Eventos", slug: "eventos", description: "Shows, casas, festivais e contratantes.", active: true, order: 20, group: "Segmentos" },
  { id: "lead-segment-corporativo", kind: "lead_segment", name: "Corporativo", slug: "corporativo", description: "Marcas, empresas e agências.", active: true, order: 30, group: "Segmentos" },
];

export const DEFAULT_CONTACT_CATEGORIES: OperationalListItem[] = [
  { id: "contact-category-partner", kind: "contact_category", name: "Parceiro", slug: "PARTNER", description: "Contato parceiro do negócio.", active: true, order: 10, group: "Contatos" },
  { id: "contact-category-supplier", kind: "contact_category", name: "Fornecedor", slug: "SUPPLIER", description: "Fornecedor ou prestador recorrente.", active: true, order: 20, group: "Contatos" },
  { id: "contact-category-artist", kind: "contact_category", name: "Artista/Banda", slug: "ARTIST_BAND", description: "Contato artístico.", active: true, order: 30, group: "Contatos" },
  { id: "contact-category-other", kind: "contact_category", name: "Outro", slug: "OTHER", description: "Categoria genérica para contato.", active: true, order: 999, group: "Contatos" },
];

export const DEFAULT_CONTACT_PF_CLASSIFICATIONS: OperationalListItem[] = [
  { id: "contact-pf-artist-agent", kind: "contact_pf_classification", name: "Agente Artístico", slug: "ARTIST_AGENT", description: "Pessoa física que atua como agente artístico.", active: true, order: 10, group: "Pessoa Física" },
  { id: "contact-pf-press", kind: "contact_pf_classification", name: "Assessoria de Imprensa", slug: "PRESS_OFFICE", description: "Profissional de imprensa ou PR.", active: true, order: 20, group: "Pessoa Física" },
  { id: "contact-pf-videomaker", kind: "contact_pf_classification", name: "Videomaker", slug: "VIDEOMAKER", description: "Profissional de vídeo.", active: true, order: 30, group: "Pessoa Física" },
  { id: "contact-pf-other", kind: "contact_pf_classification", name: "Outro", slug: "OTHER", description: "Classificação genérica.", active: true, order: 999, group: "Pessoa Física" },
];

export const DEFAULT_CONTACT_PJ_CLASSIFICATIONS: OperationalListItem[] = [
  { id: "contact-pj-agency", kind: "contact_pj_classification", name: "Agência de Marketing", slug: "MARKETING_AGENCY", description: "Empresa ou agência de marketing.", active: true, order: 10, group: "Pessoa Jurídica" },
  { id: "contact-pj-venue", kind: "contact_pj_classification", name: "Casa de Show", slug: "VENUE", description: "Local de apresentação ou evento.", active: true, order: 20, group: "Pessoa Jurídica" },
  { id: "contact-pj-supplier", kind: "contact_pj_classification", name: "Fornecedor", slug: "SUPPLIER", description: "Fornecedor ou prestador PJ.", active: true, order: 30, group: "Pessoa Jurídica" },
  { id: "contact-pj-other", kind: "contact_pj_classification", name: "Outro", slug: "OTHER", description: "Classificação genérica.", active: true, order: 999, group: "Pessoa Jurídica" },
];

export const DEFAULT_EVENT_TYPES: OperationalListItem[] = [
  { id: "event-type-studio", kind: "event_type", name: "Sessões de Estúdio", slug: "sessoes_estudio", description: "Gravações, sessões de estúdio e acompanhamento musical.", active: true, order: 10, group: "Agenda", metadata: { backend_type: "recording" } },
  { id: "event-type-rehearsal", kind: "event_type", name: "Ensaios", slug: "ensaios", description: "Ensaios artísticos, técnicos ou de banda.", active: true, order: 20, group: "Agenda", metadata: { backend_type: "recording" } },
  { id: "event-type-photos", kind: "event_type", name: "Sessões de Fotos", slug: "sessoes_fotos", description: "Sessões fotográficas, capa e material promocional.", active: true, order: 30, group: "Agenda", metadata: { backend_type: "other" } },
  { id: "event-type-shows", kind: "event_type", name: "Shows", slug: "shows", description: "Shows, apresentações e eventos ao vivo.", active: true, order: 40, group: "Agenda", metadata: { backend_type: "show" } },
  { id: "event-type-interviews", kind: "event_type", name: "Entrevistas", slug: "entrevistas", description: "Entrevistas, imprensa e pautas editoriais.", active: true, order: 50, group: "Agenda", metadata: { backend_type: "interview" } },
  { id: "event-type-podcasts", kind: "event_type", name: "Podcasts", slug: "podcasts", description: "Participações em podcasts e videocasts.", active: true, order: 60, group: "Agenda", metadata: { backend_type: "interview" } },
  { id: "event-type-tv", kind: "event_type", name: "Programas de TV", slug: "programas_tv", description: "Programas de TV, gravações e entrevistas televisivas.", active: true, order: 70, group: "Agenda", metadata: { backend_type: "interview" } },
  { id: "event-type-radio", kind: "event_type", name: "Rádio", slug: "radio", description: "Entrevistas, divulgação e execuções em rádio.", active: true, order: 80, group: "Agenda", metadata: { backend_type: "interview" } },
  { id: "event-type-content", kind: "event_type", name: "Produção de Conteúdo", slug: "producao_conteudo", description: "Conteúdos digitais, captações e ações promocionais.", active: true, order: 90, group: "Agenda", metadata: { backend_type: "other" } },
  { id: "event-type-meetings", kind: "event_type", name: "Reuniões", slug: "reunioes", description: "Reuniões internas, comerciais ou operacionais.", active: true, order: 100, group: "Agenda", metadata: { backend_type: "meeting" } },
];

export const DEFAULT_MARKETING_CONTEXTS: OperationalListItem[] = [
  { id: "marketing-context-projeto", kind: "marketing_context", name: "Projeto Musical", slug: "projeto_musical", description: "Tarefas vinculadas a lançamentos, obras ou projetos musicais.", active: true, order: 10, group: "Tarefas" },
  { id: "marketing-context-artista", kind: "marketing_context", name: "Artista", slug: "artista", description: "Tarefas vinculadas ao artista.", active: true, order: 20, group: "Tarefas" },
  { id: "marketing-context-empresa", kind: "marketing_context", name: "Empresa", slug: "empresa", description: "Tarefas corporativas ou institucionais.", active: true, order: 30, group: "Tarefas" },
];

export const DEFAULT_MARKETING_SECTORS: OperationalListItem[] = [
  { id: "marketing-sector-design", kind: "marketing_sector", name: "Design", slug: "Design", description: "Criação visual, capas e peças gráficas.", active: true, order: 10, group: "Setores" },
  { id: "marketing-sector-audiovisual", kind: "marketing_sector", name: "Audiovisual", slug: "Audiovisual", description: "Vídeo, fotografia e captação.", active: true, order: 20, group: "Setores" },
  { id: "marketing-sector-marketing", kind: "marketing_sector", name: "Marketing", slug: "Marketing", description: "Estratégia, tráfego e campanhas.", active: true, order: 30, group: "Setores" },
  { id: "marketing-sector-comunicacao", kind: "marketing_sector", name: "Comunicação", slug: "Comunicação", description: "Copy, releases e comunicação.", active: true, order: 40, group: "Setores" },
];

export const DEFAULT_MARKETING_TASK_TYPES: OperationalListItem[] = [
  { id: "marketing-task-design", kind: "marketing_task_type", name: "Design", slug: "design", description: "Tarefa de design.", active: true, order: 10, group: "Tipos" },
  { id: "marketing-task-campanha", kind: "marketing_task_type", name: "Campanha", slug: "campanha", description: "Tarefa de campanha.", active: true, order: 20, group: "Tipos" },
  { id: "marketing-task-copy", kind: "marketing_task_type", name: "Copywriting", slug: "copywriting", description: "Tarefa de texto ou copy.", active: true, order: 30, group: "Tipos" },
  { id: "marketing-task-video", kind: "marketing_task_type", name: "Audiovisual", slug: "audiovisual", description: "Tarefa audiovisual.", active: true, order: 40, group: "Tipos" },
];

export const DEFAULT_BRIEFING_SERVICE_TYPES: OperationalListItem[] = [
  { id: "briefing-service-campanha", kind: "briefing_service_type", name: "Campanha", slug: "campanha", description: "Briefing de campanha.", active: true, order: 10, group: "Briefings" },
  { id: "briefing-service-conteudo", kind: "briefing_service_type", name: "Conteúdo", slug: "conteudo", description: "Briefing de conteúdo.", active: true, order: 20, group: "Briefings" },
  { id: "briefing-service-design", kind: "briefing_service_type", name: "Design", slug: "design", description: "Briefing de design.", active: true, order: 30, group: "Briefings" },
  { id: "briefing-service-audiovisual", kind: "briefing_service_type", name: "Audiovisual", slug: "audiovisual", description: "Briefing audiovisual.", active: true, order: 40, group: "Briefings" },
];

export const DEFAULT_CREATIVE_AI_SETTINGS: OperationalListItem[] = [
  { id: "creative-ai-planning", kind: "creative_ai_setting", name: "Planejamento", slug: "planning", description: "Parâmetros para planejamento de campanha e lançamento.", active: true, order: 10, group: "IA Criativa" },
  { id: "creative-ai-pitching", kind: "creative_ai_setting", name: "Pitching", slug: "pitching", description: "Parâmetros de pitching e posicionamento.", active: true, order: 20, group: "IA Criativa" },
  { id: "creative-ai-ideas", kind: "creative_ai_setting", name: "Ideias", slug: "ideas", description: "Parâmetros para geração de ideias criativas.", active: true, order: 30, group: "IA Criativa" },
];

export const DEFAULT_OPERATIONAL_LISTS = [
  ...DEFAULT_LEAD_TYPES,
  ...DEFAULT_SERVICE_INTERESTS,
  ...DEFAULT_LEAD_CATEGORIES,
  ...DEFAULT_LEAD_STATUSES,
  ...DEFAULT_LEAD_SEGMENTS,
  ...DEFAULT_CONTACT_CATEGORIES,
  ...DEFAULT_CONTACT_PF_CLASSIFICATIONS,
  ...DEFAULT_CONTACT_PJ_CLASSIFICATIONS,
  ...DEFAULT_EVENT_TYPES,
  ...DEFAULT_MARKETING_CONTEXTS,
  ...DEFAULT_MARKETING_SECTORS,
  ...DEFAULT_MARKETING_TASK_TYPES,
  ...DEFAULT_BRIEFING_SERVICE_TYPES,
  ...DEFAULT_CREATIVE_AI_SETTINGS,
];

export const DEFAULT_OPERATIONAL_LISTS_BY_KIND: Record<OperationalListKind, OperationalListItem[]> = {
  lead_type: DEFAULT_LEAD_TYPES,
  service_interest: DEFAULT_SERVICE_INTERESTS,
  lead_category: DEFAULT_LEAD_CATEGORIES,
  lead_status: DEFAULT_LEAD_STATUSES,
  lead_segment: DEFAULT_LEAD_SEGMENTS,
  contact_category: DEFAULT_CONTACT_CATEGORIES,
  contact_pf_classification: DEFAULT_CONTACT_PF_CLASSIFICATIONS,
  contact_pj_classification: DEFAULT_CONTACT_PJ_CLASSIFICATIONS,
  event_type: DEFAULT_EVENT_TYPES,
  marketing_context: DEFAULT_MARKETING_CONTEXTS,
  marketing_sector: DEFAULT_MARKETING_SECTORS,
  marketing_task_type: DEFAULT_MARKETING_TASK_TYPES,
  briefing_service_type: DEFAULT_BRIEFING_SERVICE_TYPES,
  creative_ai_setting: DEFAULT_CREATIVE_AI_SETTINGS,
};

function nextId(kind: OperationalListKind) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeSlug(kind: OperationalListKind, value: string) {
  if (kind === "marketing_sector") return value.trim();
  const slug = slugify(value);
  if (
    kind === "contact_category" ||
    kind === "contact_pf_classification" ||
    kind === "contact_pj_classification"
  ) {
    return slug.toUpperCase();
  }
  return slug;
}

function sortItems(items: OperationalListItem[]) {
  return [...items].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
}

function activeOptions(items: OperationalListItem[], fallback: OperationalListItem[]): OperationalOption[] {
  const active = sortItems(items).filter((item) => item.active);
  return (active.length > 0 ? active : fallback).map((item) => ({ value: item.slug, label: item.name }));
}

function withDefaultMetadata(items: OperationalListItem[]) {
  const defaultsBySlug = new Map(DEFAULT_OPERATIONAL_LISTS.map((item) => [`${item.kind}:${item.slug}`, item]));
  return items.map((item) => {
    const defaultItem = defaultsBySlug.get(`${item.kind}:${item.slug}`);
    const migratedName = item.kind === "service_interest" && item.slug === "show_booking" && item.name === "Show / Booking"
      ? "Contratação artística"
      : item.name;
    if (!defaultItem?.metadata) return { ...item, name: migratedName };
    return {
      ...item,
      name: migratedName,
      metadata: {
        ...defaultItem.metadata,
        ...(item.metadata ?? {}),
      },
    };
  });
}

function mergeWithDefaults(items: OperationalListItem[]) {
  const existingKeys = new Set(items.map((item) => `${item.kind}:${item.slug}`));
  const missingDefaults = DEFAULT_OPERATIONAL_LISTS.filter((item) => !existingKeys.has(`${item.kind}:${item.slug}`));
  return withDefaultMetadata([...items, ...missingDefaults]);
}

export function useOperationalSettings() {
  const [items, setItems] = useState<OperationalListItem[]>(() => {
    const saved = settingsService.getOperationalLists() as OperationalListItem[];
    return saved.length > 0 ? mergeWithDefaults(saved) : DEFAULT_OPERATIONAL_LISTS;
  });

  const persist = (next: OperationalListItem[]) => {
    setItems(next);
    settingsService.saveOperationalLists(next as unknown as Record<string, unknown>[]);
  };

  const byKind = (kind: OperationalListKind) => sortItems(items.filter((item) => item.kind === kind));

  const leadTypeItems = useMemo(() => byKind("lead_type"), [items]);
  const serviceInterestItems = useMemo(() => byKind("service_interest"), [items]);

  const leadTypeOptions = useMemo(() => activeOptions(leadTypeItems, DEFAULT_LEAD_TYPES), [leadTypeItems]);
  const serviceInterestOptions = useMemo(() => activeOptions(serviceInterestItems, DEFAULT_SERVICE_INTERESTS), [serviceInterestItems]);

  const createItem = (kind: OperationalListKind, data: Partial<OperationalListItem>) => {
    const kindItems = byKind(kind);
    const name = String(data.name ?? "").trim();
    const slug = normalizeSlug(kind, String(data.slug || name));
    if (!name || !slug) return;
    const next: OperationalListItem = {
      id: nextId(kind),
      kind,
      name,
      slug,
      description: String(data.description ?? "").trim(),
      active: data.active ?? true,
      order: data.order ?? ((kindItems.at(-1)?.order ?? 0) + 10),
      group: data.group?.trim() || undefined,
      metadata: data.metadata ?? {},
    };
    persist([...items, next]);
  };

  const updateItem = (id: string, data: Partial<OperationalListItem>) => {
    persist(items.map((item) => {
      if (item.id !== id) return item;
      const name = data.name !== undefined ? String(data.name).trim() : item.name;
      return {
        ...item,
        ...data,
        name,
        slug: data.slug !== undefined ? normalizeSlug(item.kind, String(data.slug)) : item.slug,
        description: data.description !== undefined ? String(data.description).trim() : item.description,
        group: data.group !== undefined ? data.group?.trim() || undefined : item.group,
        metadata: data.metadata ?? item.metadata,
      };
    }));
  };

  const toggleItem = (id: string) => {
    persist(items.map((item) => item.id === id ? { ...item, active: !item.active } : item));
  };

  const removeItem = (id: string) => {
    persist(items.filter((item) => item.id !== id));
  };

  const moveItem = (id: string, direction: "up" | "down") => {
    const current = items.find((item) => item.id === id);
    if (!current) return;
    const kindItems = byKind(current.kind);
    const index = kindItems.findIndex((item) => item.id === id);
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    const swap = kindItems[swapIndex];
    if (!swap) return;
    persist(items.map((item) => {
      if (item.id === current.id) return { ...item, order: swap.order, updated_at: nowIso() } as OperationalListItem;
      if (item.id === swap.id) return { ...item, order: current.order, updated_at: nowIso() } as OperationalListItem;
      return item;
    }));
  };

  const resetDefaults = (kind?: OperationalListKind) => {
    if (!kind) {
      persist(DEFAULT_OPERATIONAL_LISTS);
      return;
    }
    const defaults = DEFAULT_OPERATIONAL_LISTS_BY_KIND[kind];
    persist([...items.filter((item) => item.kind !== kind), ...defaults]);
  };

  const getItemsByKind = (kind: OperationalListKind) => byKind(kind);
  const getOptionsByKind = (kind: OperationalListKind) =>
    activeOptions(byKind(kind), DEFAULT_OPERATIONAL_LISTS_BY_KIND[kind]);

  return {
    items,
    leadTypeItems,
    serviceInterestItems,
    leadTypeOptions,
    serviceInterestOptions,
    getItemsByKind,
    getOptionsByKind,
    createItem,
    updateItem,
    toggleItem,
    removeItem,
    moveItem,
    resetDefaults,
  };
}
