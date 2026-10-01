/**
 * Default items of the operational taxonomy (Leads, Contacts, Events, Marketing,
 * Briefing). Canonical source used by the idempotent bootstrap of new tenants
 * (OperationalListsService.list) and by the migration that seeds the already
 * existing tenants (20260713000001_CreateOperationalListItems).
 *
 * Content ported 1:1 from DEFAULT_OPERATIONAL_LISTS in
 * apps/web/src/modules/settings/hooks/useOperationalSettings.ts — same
 * business source, duplicated only because the backend (Node) and the frontend
 * (browser) are distinct runtimes that do not share a TS module (a spec asserts
 * the (kind, slug, name) triples are identical).
 *
 * `slug` is the canonical English machine value, `name` the pt-BR display label
 * (see operational-list-vocabulary.ts for the legacy Portuguese slugs, the
 * deferred marketing kinds and the stable keys).
 */
export interface OperationalListItemDefault {
  kind: string;
  name: string;
  slug: string;
  description: string;
  active: boolean;
  order: number;
  group?: string;
  metadata?: Record<string, unknown>;
}

export const OPERATIONAL_LIST_DEFAULTS: OperationalListItemDefault[] = [
  // ── lead_type ────────────────────────────────────────────────────────────
  { kind: 'lead_type', name: 'Artista / Banda', slug: 'artist_or_band', description: 'Artista solo, dupla, banda ou projeto musical.', active: true, order: 10, group: 'Musical', metadata: { allowed_service_slugs: ['artist_management', 'music_production', 'audiovisual_production', 'music_marketing', 'social_media', 'graphic_design', 'digital_distribution'] } },
  { kind: 'lead_type', name: 'Contratante de show', slug: 'show_booker', description: 'Pessoa ou empresa buscando contratação artística.', active: true, order: 20, group: 'Eventos', metadata: { allowed_service_slugs: ['show_booking'] } },
  { kind: 'lead_type', name: 'Marca / Empresa', slug: 'brand_or_company', description: 'Empresa interessada em publicidade, licenciamento ou projeto comercial.', active: true, order: 30, group: 'Corporativo' },
  { kind: 'lead_type', name: 'Produtora de eventos', slug: 'event_producer', description: 'Produtora, promoter, festival ou organização de eventos.', active: true, order: 40, group: 'Eventos' },
  { kind: 'lead_type', name: 'Gravadora / Selo', slug: 'record_label', description: 'Gravadora, selo, editora ou parceiro musical.', active: true, order: 50, group: 'Musical' },
  { kind: 'lead_type', name: 'Agência', slug: 'agency', description: 'Agência de publicidade, marketing, casting ou PR.', active: true, order: 60, group: 'Comercial' },
  { kind: 'lead_type', name: 'Influenciador', slug: 'influencer', description: 'Criador de conteúdo, influencer ou personalidade digital.', active: true, order: 70, group: 'Digital' },

  // ── service_interest ─────────────────────────────────────────────────────
  { kind: 'service_interest', name: 'Contratação artística', slug: 'show_booking', description: 'Contratação artística, apresentação, pocket show ou DJ set.', active: true, order: 10, group: 'Eventos', metadata: { operational_type: 'EVENT_SERVICE' } },
  { kind: 'service_interest', name: 'Gestão Artística', slug: 'artist_management', description: 'Gestão de carreira, posicionamento, agenda e operação artística.', active: true, order: 20, group: 'Gestão', metadata: { operational_type: 'PRODUCTION_SERVICE' } },
  { kind: 'service_interest', name: 'Produção Musical', slug: 'music_production', description: 'Produção completa, beat, arranjo ou gravação musical.', active: true, order: 25, group: 'Produção', metadata: { operational_type: 'PRODUCTION_SERVICE' } },
  { kind: 'service_interest', name: 'Mixagem', slug: 'mixing', description: 'Mixagem de faixas, stems ou projeto musical.', active: true, order: 30, group: 'Produção', metadata: { operational_type: 'PRODUCTION_SERVICE' } },
  { kind: 'service_interest', name: 'Masterização', slug: 'mastering', description: 'Masterização para streaming, vídeo, CD, vinil ou plataformas digitais.', active: true, order: 40, group: 'Produção', metadata: { operational_type: 'PRODUCTION_SERVICE' } },
  { kind: 'service_interest', name: 'Distribuição Digital', slug: 'digital_distribution', description: 'Distribuição em DSPs, metadados, release e monetização.', active: true, order: 50, group: 'Distribuição', metadata: { operational_type: 'PRODUCTION_SERVICE' } },
  { kind: 'service_interest', name: 'Marketing Musical', slug: 'music_marketing', description: 'Campanhas, social media, tráfego pago e estratégia de lançamento.', active: true, order: 60, group: 'Marketing', metadata: { operational_type: 'PRODUCTION_SERVICE' } },
  { kind: 'service_interest', name: 'Social media', slug: 'social_media', description: 'Gestão de conteúdo, calendário editorial, publicações e redes sociais.', active: true, order: 70, group: 'Marketing', metadata: { operational_type: 'PRODUCTION_SERVICE' } },
  { kind: 'service_interest', name: 'Audiovisual', slug: 'audiovisual_production', description: 'Videoclipe, visualizer, aftermovie, conteúdo ou audiovisual.', active: true, order: 80, group: 'Audiovisual', metadata: { operational_type: 'PRODUCTION_SERVICE' } },
  { kind: 'service_interest', name: 'Design Gráfico', slug: 'graphic_design', description: 'Capa, identidade visual, social media, motion ou material gráfico.', active: true, order: 90, group: 'Design', metadata: { operational_type: 'PRODUCTION_SERVICE' } },
  { kind: 'service_interest', name: 'Licenciamento', slug: 'licensing', description: 'Sync, publicidade, uso de obra, marca ou projeto audiovisual.', active: true, order: 90, group: 'Direitos', metadata: { operational_type: 'PRODUCTION_SERVICE' } },
  { kind: 'service_interest', name: 'Consultoria', slug: 'consulting', description: 'Mentoria, consultoria musical, carreira, marketing ou tecnologia.', active: true, order: 100, group: 'Consultoria', metadata: { operational_type: 'PRODUCTION_SERVICE' } },
  { kind: 'service_interest', name: 'Outro', slug: 'other', description: 'Serviço personalizado ou ainda não classificado.', active: true, order: 999, group: 'Geral' },

  // ── lead_category ────────────────────────────────────────────────────────
  { kind: 'lead_category', name: 'Artista / Banda', slug: 'artist_or_band', description: 'Lead de artista, banda ou projeto musical.', active: true, order: 10, group: 'Leads' },
  { kind: 'lead_category', name: 'Contratante de show', slug: 'show_booker', description: 'Contratante, produtor ou casa de evento.', active: true, order: 20, group: 'Leads' },
  { kind: 'lead_category', name: 'Marca / Empresa', slug: 'brand_or_company', description: 'Empresa interessada em projeto comercial.', active: true, order: 30, group: 'Leads' },
  { kind: 'lead_category', name: 'Agência', slug: 'agency', description: 'Agência, produtora ou parceiro comercial.', active: true, order: 40, group: 'Leads' },

  // ── lead_status ──────────────────────────────────────────────────────────
  // The slugs ARE the LeadStatus enum (packages/types): the physical value of
  // leads.status (CHECK 20260910000016, IsIn in the lead DTO) and what the web
  // pipeline writes. The pre-OL1 seed (novo_lead/proposta_enviada/...) never
  // matched a value the backend accepts.
  { kind: 'lead_status', name: 'Novo', slug: 'new', description: 'Lead recebido e ainda não qualificado.', active: true, order: 10, group: 'Pipeline' },
  { kind: 'lead_status', name: 'Contato', slug: 'contacted', description: 'Primeiro contato realizado.', active: true, order: 20, group: 'Pipeline' },
  { kind: 'lead_status', name: 'Em contato', slug: 'in_contact', description: 'Contato em andamento.', active: true, order: 30, group: 'Pipeline' },
  { kind: 'lead_status', name: 'Qualificado', slug: 'qualified', description: 'Lead validado comercialmente.', active: true, order: 40, group: 'Pipeline' },
  { kind: 'lead_status', name: 'Proposta', slug: 'proposal', description: 'Proposta comercial enviada.', active: true, order: 50, group: 'Pipeline' },
  { kind: 'lead_status', name: 'Negociação', slug: 'negotiation', description: 'Em negociação de termos.', active: true, order: 60, group: 'Pipeline' },
  { kind: 'lead_status', name: 'Fechado', slug: 'closed', description: 'Negócio fechado.', active: true, order: 70, group: 'Pipeline' },
  { kind: 'lead_status', name: 'Perdido', slug: 'lost', description: 'Oportunidade perdida.', active: true, order: 80, group: 'Pipeline' },
  { kind: 'lead_status', name: 'Inativo/Arquivado', slug: 'inactive', description: 'Arquivado sem movimentação.', active: true, order: 90, group: 'Pipeline' },

  // ── lead_segment ─────────────────────────────────────────────────────────
  { kind: 'lead_segment', name: 'Musical', slug: 'music', description: 'Artistas, selos, editoras e gravadoras.', active: true, order: 10, group: 'Segmentos' },
  { kind: 'lead_segment', name: 'Eventos', slug: 'events', description: 'Shows, casas, festivais e contratantes.', active: true, order: 20, group: 'Segmentos' },
  { kind: 'lead_segment', name: 'Corporativo', slug: 'corporate', description: 'Marcas, empresas e agências.', active: true, order: 30, group: 'Segmentos' },

  // ── contact_category ─────────────────────────────────────────────────────
  { kind: 'contact_category', name: 'Parceiro', slug: 'PARTNER', description: 'Contato parceiro do negócio.', active: true, order: 10, group: 'Contatos' },
  { kind: 'contact_category', name: 'Fornecedor', slug: 'SUPPLIER', description: 'Fornecedor ou prestador recorrente.', active: true, order: 20, group: 'Contatos' },
  { kind: 'contact_category', name: 'Artista/Banda', slug: 'ARTIST_BAND', description: 'Contato artístico.', active: true, order: 30, group: 'Contatos' },
  { kind: 'contact_category', name: 'Outro', slug: 'OTHER', description: 'Categoria genérica para contato.', active: true, order: 999, group: 'Contatos' },

  // ── contact_pf_classification ────────────────────────────────────────────
  { kind: 'contact_pf_classification', name: 'Agente Artístico', slug: 'ARTIST_AGENT', description: 'Pessoa física que atua como agente artístico.', active: true, order: 10, group: 'Pessoa Física' },
  { kind: 'contact_pf_classification', name: 'Assessoria de Imprensa', slug: 'PRESS_OFFICE', description: 'Profissional de imprensa ou PR.', active: true, order: 20, group: 'Pessoa Física' },
  { kind: 'contact_pf_classification', name: 'Videomaker', slug: 'VIDEOMAKER', description: 'Profissional de vídeo.', active: true, order: 30, group: 'Pessoa Física' },
  { kind: 'contact_pf_classification', name: 'Outro', slug: 'OTHER', description: 'Classificação genérica.', active: true, order: 999, group: 'Pessoa Física' },

  // ── contact_pj_classification ────────────────────────────────────────────
  { kind: 'contact_pj_classification', name: 'Agência de Marketing', slug: 'MARKETING_AGENCY', description: 'Empresa ou agência de marketing.', active: true, order: 10, group: 'Pessoa Jurídica' },
  { kind: 'contact_pj_classification', name: 'Casa de Show', slug: 'VENUE', description: 'Local de apresentação ou evento.', active: true, order: 20, group: 'Pessoa Jurídica' },
  { kind: 'contact_pj_classification', name: 'Fornecedor', slug: 'SUPPLIER', description: 'Fornecedor ou prestador PJ.', active: true, order: 30, group: 'Pessoa Jurídica' },
  { kind: 'contact_pj_classification', name: 'Outro', slug: 'OTHER', description: 'Classificação genérica.', active: true, order: 999, group: 'Pessoa Jurídica' },

  // ── event_type ───────────────────────────────────────────────────────────
  { kind: 'event_type', name: 'Sessões de Estúdio', slug: 'studio_sessions', description: 'Gravações, sessões de estúdio e acompanhamento musical.', active: true, order: 10, group: 'Agenda', metadata: { backend_type: 'recording' } },
  { kind: 'event_type', name: 'Ensaios', slug: 'rehearsals', description: 'Ensaios artísticos, técnicos ou de banda.', active: true, order: 20, group: 'Agenda', metadata: { backend_type: 'recording' } },
  { kind: 'event_type', name: 'Sessões de Fotos', slug: 'photo_shoots', description: 'Sessões fotográficas, capa e material promocional.', active: true, order: 30, group: 'Agenda', metadata: { backend_type: 'other' } },
  { kind: 'event_type', name: 'Shows', slug: 'shows', description: 'Shows, apresentações e eventos ao vivo.', active: true, order: 40, group: 'Agenda', metadata: { backend_type: 'show' } },
  { kind: 'event_type', name: 'Entrevistas', slug: 'interviews', description: 'Entrevistas, imprensa e pautas editoriais.', active: true, order: 50, group: 'Agenda', metadata: { backend_type: 'interview' } },
  { kind: 'event_type', name: 'Podcasts', slug: 'podcasts', description: 'Participações em podcasts e videocasts.', active: true, order: 60, group: 'Agenda', metadata: { backend_type: 'interview' } },
  { kind: 'event_type', name: 'Programas de TV', slug: 'tv_shows', description: 'Programas de TV, gravações e entrevistas televisivas.', active: true, order: 70, group: 'Agenda', metadata: { backend_type: 'interview' } },
  { kind: 'event_type', name: 'Rádio', slug: 'radio', description: 'Entrevistas, divulgação e execuções em rádio.', active: true, order: 80, group: 'Agenda', metadata: { backend_type: 'interview' } },
  { kind: 'event_type', name: 'Produção de Conteúdo', slug: 'content_production', description: 'Conteúdos digitais, captações e ações promocionais.', active: true, order: 90, group: 'Agenda', metadata: { backend_type: 'other' } },
  { kind: 'event_type', name: 'Reuniões', slug: 'meetings', description: 'Reuniões internas, comerciais ou operacionais.', active: true, order: 100, group: 'Agenda', metadata: { backend_type: 'meeting' } },

  // ── marketing_context ────────────────────────────────────────────────────
  { kind: 'marketing_context', name: 'Projeto Musical', slug: 'projeto_musical', description: 'Tarefas vinculadas a lançamentos, obras ou projetos musicais.', active: true, order: 10, group: 'Tarefas' },
  { kind: 'marketing_context', name: 'Artista', slug: 'artista', description: 'Tarefas vinculadas ao artista.', active: true, order: 20, group: 'Tarefas' },
  { kind: 'marketing_context', name: 'Empresa', slug: 'empresa', description: 'Tarefas corporativas ou institucionais.', active: true, order: 30, group: 'Tarefas' },

  // ── marketing_sector ─────────────────────────────────────────────────────
  { kind: 'marketing_sector', name: 'Design', slug: 'Design', description: 'Criação visual, capas e peças gráficas.', active: true, order: 10, group: 'Setores' },
  { kind: 'marketing_sector', name: 'Audiovisual', slug: 'Audiovisual', description: 'Vídeo, fotografia e captação.', active: true, order: 20, group: 'Setores' },
  { kind: 'marketing_sector', name: 'Marketing', slug: 'Marketing', description: 'Estratégia, tráfego e campanhas.', active: true, order: 30, group: 'Setores' },
  { kind: 'marketing_sector', name: 'Comunicação', slug: 'Comunicação', description: 'Copy, releases e comunicação.', active: true, order: 40, group: 'Setores' },

  // ── marketing_task_type ──────────────────────────────────────────────────
  { kind: 'marketing_task_type', name: 'Design', slug: 'design', description: 'Tarefa de design.', active: true, order: 10, group: 'Tipos' },
  { kind: 'marketing_task_type', name: 'Campanha', slug: 'campanha', description: 'Tarefa de campanha.', active: true, order: 20, group: 'Tipos' },
  { kind: 'marketing_task_type', name: 'Copywriting', slug: 'copywriting', description: 'Tarefa de texto ou copy.', active: true, order: 30, group: 'Tipos' },
  { kind: 'marketing_task_type', name: 'Audiovisual', slug: 'audiovisual', description: 'Tarefa audiovisual.', active: true, order: 40, group: 'Tipos' },

  // ── briefing_service_type ────────────────────────────────────────────────
  { kind: 'briefing_service_type', name: 'Campanha', slug: 'campanha', description: 'Briefing de campanha.', active: true, order: 10, group: 'Briefings' },
  { kind: 'briefing_service_type', name: 'Conteúdo', slug: 'conteudo', description: 'Briefing de conteúdo.', active: true, order: 20, group: 'Briefings' },
  { kind: 'briefing_service_type', name: 'Design', slug: 'design', description: 'Briefing de design.', active: true, order: 30, group: 'Briefings' },
  { kind: 'briefing_service_type', name: 'Audiovisual', slug: 'audiovisual', description: 'Briefing audiovisual.', active: true, order: 40, group: 'Briefings' },

  // ── creative_ai_setting ──────────────────────────────────────────────────
  { kind: 'creative_ai_setting', name: 'Planejamento', slug: 'planning', description: 'Parâmetros para planejamento de campanha e lançamento.', active: true, order: 10, group: 'IA Criativa' },
  { kind: 'creative_ai_setting', name: 'Pitching', slug: 'pitching', description: 'Parâmetros de pitching e posicionamento.', active: true, order: 20, group: 'IA Criativa' },
  { kind: 'creative_ai_setting', name: 'Ideias', slug: 'ideas', description: 'Parâmetros para geração de ideias criativas.', active: true, order: 30, group: 'IA Criativa' },
];
