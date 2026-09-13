/**
 * Itens padrão da taxonomia operacional (Leads, Contatos, Eventos, Marketing,
 * Briefing). Fonte canônica usada pelo bootstrap idempotente de novos tenants
 * (OperationalListsService.list) e pela migration que semeia os tenants já
 * existentes (20260713000001_CreateOperationalListItems).
 *
 * Conteúdo portado 1:1 de DEFAULT_OPERATIONAL_LISTS em
 * apps/web/src/modules/settings/hooks/useOperationalSettings.ts — mesma
 * fonte de negócio, duplicada apenas porque backend (Node) e frontend
 * (browser) são runtimes distintos que não compartilham módulo TS.
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
  { kind: 'lead_type', name: 'Artista / Banda', slug: 'artista_banda', description: 'Artista solo, dupla, banda ou projeto musical.', active: true, order: 10, group: 'Musical', metadata: { allowed_service_slugs: ['gestao_artistica', 'producao_musical', 'producao_audiovisual', 'marketing_musical', 'social_media', 'design_grafico', 'distribuicao_digital'] } },
  { kind: 'lead_type', name: 'Contratante de show', slug: 'contratante_show', description: 'Pessoa ou empresa buscando contratação artística.', active: true, order: 20, group: 'Eventos', metadata: { allowed_service_slugs: ['show_booking'] } },
  { kind: 'lead_type', name: 'Marca / Empresa', slug: 'marca_empresa', description: 'Empresa interessada em publicidade, licenciamento ou projeto comercial.', active: true, order: 30, group: 'Corporativo' },
  { kind: 'lead_type', name: 'Produtora de eventos', slug: 'produtora_eventos', description: 'Produtora, promoter, festival ou organização de eventos.', active: true, order: 40, group: 'Eventos' },
  { kind: 'lead_type', name: 'Gravadora / Selo', slug: 'gravadora_selo', description: 'Gravadora, selo, editora ou parceiro musical.', active: true, order: 50, group: 'Musical' },
  { kind: 'lead_type', name: 'Agência', slug: 'agencia', description: 'Agência de publicidade, marketing, casting ou PR.', active: true, order: 60, group: 'Comercial' },
  { kind: 'lead_type', name: 'Influenciador', slug: 'influenciador', description: 'Criador de conteúdo, influencer ou personalidade digital.', active: true, order: 70, group: 'Digital' },

  // ── service_interest ─────────────────────────────────────────────────────
  { kind: 'service_interest', name: 'Contratação artística', slug: 'show_booking', description: 'Contratação artística, apresentação, pocket show ou DJ set.', active: true, order: 10, group: 'Eventos', metadata: { operational_type: 'EVENT_SERVICE' } },
  { kind: 'service_interest', name: 'Gestão Artística', slug: 'gestao_artistica', description: 'Gestão de carreira, posicionamento, agenda e operação artística.', active: true, order: 20, group: 'Gestão', metadata: { operational_type: 'PRODUCTION_SERVICE' } },
  { kind: 'service_interest', name: 'Produção Musical', slug: 'producao_musical', description: 'Produção completa, beat, arranjo ou gravação musical.', active: true, order: 25, group: 'Produção', metadata: { operational_type: 'PRODUCTION_SERVICE' } },
  { kind: 'service_interest', name: 'Mixagem', slug: 'mixagem', description: 'Mixagem de faixas, stems ou projeto musical.', active: true, order: 30, group: 'Produção', metadata: { operational_type: 'PRODUCTION_SERVICE' } },
  { kind: 'service_interest', name: 'Masterização', slug: 'masterizacao', description: 'Masterização para streaming, vídeo, CD, vinil ou plataformas digitais.', active: true, order: 40, group: 'Produção', metadata: { operational_type: 'PRODUCTION_SERVICE' } },
  { kind: 'service_interest', name: 'Distribuição Digital', slug: 'distribuicao_digital', description: 'Distribuição em DSPs, metadados, release e monetização.', active: true, order: 50, group: 'Distribuição', metadata: { operational_type: 'PRODUCTION_SERVICE' } },
  { kind: 'service_interest', name: 'Marketing Musical', slug: 'marketing_musical', description: 'Campanhas, social media, tráfego pago e estratégia de lançamento.', active: true, order: 60, group: 'Marketing', metadata: { operational_type: 'PRODUCTION_SERVICE' } },
  { kind: 'service_interest', name: 'Social media', slug: 'social_media', description: 'Gestão de conteúdo, calendário editorial, publicações e redes sociais.', active: true, order: 70, group: 'Marketing', metadata: { operational_type: 'PRODUCTION_SERVICE' } },
  { kind: 'service_interest', name: 'Audiovisual', slug: 'producao_audiovisual', description: 'Videoclipe, visualizer, aftermovie, conteúdo ou audiovisual.', active: true, order: 80, group: 'Audiovisual', metadata: { operational_type: 'PRODUCTION_SERVICE' } },
  { kind: 'service_interest', name: 'Design Gráfico', slug: 'design_grafico', description: 'Capa, identidade visual, social media, motion ou material gráfico.', active: true, order: 90, group: 'Design', metadata: { operational_type: 'PRODUCTION_SERVICE' } },
  { kind: 'service_interest', name: 'Licenciamento', slug: 'licenciamento', description: 'Sync, publicidade, uso de obra, marca ou projeto audiovisual.', active: true, order: 90, group: 'Direitos', metadata: { operational_type: 'PRODUCTION_SERVICE' } },
  { kind: 'service_interest', name: 'Consultoria', slug: 'consultoria', description: 'Mentoria, consultoria musical, carreira, marketing ou tecnologia.', active: true, order: 100, group: 'Consultoria', metadata: { operational_type: 'PRODUCTION_SERVICE' } },
  { kind: 'service_interest', name: 'Outro', slug: 'outro', description: 'Serviço personalizado ou ainda não classificado.', active: true, order: 999, group: 'Geral' },

  // ── lead_category ────────────────────────────────────────────────────────
  { kind: 'lead_category', name: 'Artista / Banda', slug: 'artista_banda', description: 'Lead de artista, banda ou projeto musical.', active: true, order: 10, group: 'Leads' },
  { kind: 'lead_category', name: 'Contratante de show', slug: 'contratante_show', description: 'Contratante, produtor ou casa de evento.', active: true, order: 20, group: 'Leads' },
  { kind: 'lead_category', name: 'Marca / Empresa', slug: 'marca_empresa', description: 'Empresa interessada em projeto comercial.', active: true, order: 30, group: 'Leads' },
  { kind: 'lead_category', name: 'Agência', slug: 'agencia', description: 'Agência, produtora ou parceiro comercial.', active: true, order: 40, group: 'Leads' },

  // ── lead_status ──────────────────────────────────────────────────────────
  { kind: 'lead_status', name: 'Novo lead', slug: 'novo_lead', description: 'Lead recebido e ainda não qualificado.', active: true, order: 10, group: 'Pipeline' },
  { kind: 'lead_status', name: 'Qualificado', slug: 'qualificado', description: 'Lead validado comercialmente.', active: true, order: 20, group: 'Pipeline' },
  { kind: 'lead_status', name: 'Em contato', slug: 'em_contato', description: 'Contato em andamento.', active: true, order: 30, group: 'Pipeline' },
  { kind: 'lead_status', name: 'Proposta enviada', slug: 'proposta_enviada', description: 'Proposta comercial enviada.', active: true, order: 40, group: 'Pipeline' },
  { kind: 'lead_status', name: 'Fechado', slug: 'fechado', description: 'Negócio fechado.', active: true, order: 50, group: 'Pipeline' },
  { kind: 'lead_status', name: 'Perdido', slug: 'perdido', description: 'Oportunidade perdida.', active: true, order: 60, group: 'Pipeline' },

  // ── lead_segment ─────────────────────────────────────────────────────────
  { kind: 'lead_segment', name: 'Musical', slug: 'musical', description: 'Artistas, selos, editoras e gravadoras.', active: true, order: 10, group: 'Segmentos' },
  { kind: 'lead_segment', name: 'Eventos', slug: 'eventos', description: 'Shows, casas, festivais e contratantes.', active: true, order: 20, group: 'Segmentos' },
  { kind: 'lead_segment', name: 'Corporativo', slug: 'corporativo', description: 'Marcas, empresas e agências.', active: true, order: 30, group: 'Segmentos' },

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
  { kind: 'event_type', name: 'Sessões de Estúdio', slug: 'sessoes_estudio', description: 'Gravações, sessões de estúdio e acompanhamento musical.', active: true, order: 10, group: 'Agenda', metadata: { backend_type: 'recording' } },
  { kind: 'event_type', name: 'Ensaios', slug: 'ensaios', description: 'Ensaios artísticos, técnicos ou de banda.', active: true, order: 20, group: 'Agenda', metadata: { backend_type: 'recording' } },
  { kind: 'event_type', name: 'Sessões de Fotos', slug: 'sessoes_fotos', description: 'Sessões fotográficas, capa e material promocional.', active: true, order: 30, group: 'Agenda', metadata: { backend_type: 'other' } },
  { kind: 'event_type', name: 'Shows', slug: 'shows', description: 'Shows, apresentações e eventos ao vivo.', active: true, order: 40, group: 'Agenda', metadata: { backend_type: 'show' } },
  { kind: 'event_type', name: 'Entrevistas', slug: 'entrevistas', description: 'Entrevistas, imprensa e pautas editoriais.', active: true, order: 50, group: 'Agenda', metadata: { backend_type: 'interview' } },
  { kind: 'event_type', name: 'Podcasts', slug: 'podcasts', description: 'Participações em podcasts e videocasts.', active: true, order: 60, group: 'Agenda', metadata: { backend_type: 'interview' } },
  { kind: 'event_type', name: 'Programas de TV', slug: 'programas_tv', description: 'Programas de TV, gravações e entrevistas televisivas.', active: true, order: 70, group: 'Agenda', metadata: { backend_type: 'interview' } },
  { kind: 'event_type', name: 'Rádio', slug: 'radio', description: 'Entrevistas, divulgação e execuções em rádio.', active: true, order: 80, group: 'Agenda', metadata: { backend_type: 'interview' } },
  { kind: 'event_type', name: 'Produção de Conteúdo', slug: 'producao_conteudo', description: 'Conteúdos digitais, captações e ações promocionais.', active: true, order: 90, group: 'Agenda', metadata: { backend_type: 'other' } },
  { kind: 'event_type', name: 'Reuniões', slug: 'reunioes', description: 'Reuniões internas, comerciais ou operacionais.', active: true, order: 100, group: 'Agenda', metadata: { backend_type: 'meeting' } },

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
