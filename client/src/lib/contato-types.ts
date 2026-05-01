/**
 * ARQUITETURA UNIFICADA DE CONTATOS - INDÚSTRIA MUSICAL
 * =======================================================
 * 
 * Hub estratégico de relacionamento para produtora / gravadora / editora
 * 
 * PRINCÍPIOS:
 * 1. Base unificada de contatos (CRM é a fonte da verdade)
 * 2. Categorização estratégica por tipo de relacionamento
 * 3. Um contato pode ter múltiplas subcategorias
 * 4. Campos adicionais por categoria
 * 5. Histórico completo de interações
 * 6. Vinculação a projetos, shows e lançamentos
 */

// ==================== CATEGORIAS ESTRATÉGICAS ====================

export type CategoriaContato =
  | "mercado_contratacao"      // Receita e Oportunidades
  | "industria_distribuicao"   // Relacionamentos estruturantes
  | "comunicacao_imprensa"     // Central de PR
  | "juridico_financeiro"      // Contatos sensíveis
  | "profissionais_criativos"  // Equipe expandida
  | "moda_estilo"              // Imagem pessoal
  | "producao_logistica"       // Infraestrutura
  | "servicos_pessoais";       // Apoio ao artista

export const CATEGORIAS_CONTATO: { value: CategoriaContato; label: string; descricao: string; icone: string }[] = [
  { value: "mercado_contratacao", label: "Mercado & Contratação", descricao: "Contratantes, casas de show, curadores", icone: "briefcase" },
  { value: "industria_distribuicao", label: "Indústria & Distribuição", descricao: "Distribuidoras, plataformas, editoras", icone: "disc" },
  { value: "comunicacao_imprensa", label: "Comunicação & Imprensa", descricao: "Mídia, blogs, rádios, curadoria", icone: "megaphone" },
  { value: "juridico_financeiro", label: "Jurídico & Financeiro", descricao: "Advogados, contadores", icone: "scale" },
  { value: "profissionais_criativos", label: "Profissionais Criativos", descricao: "Músicos, produtores, designers", icone: "palette" },
  { value: "moda_estilo", label: "Moda & Estilo", descricao: "Lojas, estilistas, maquiadores", icone: "shirt" },
  { value: "producao_logistica", label: "Produção & Logística", descricao: "Gráfica, segurança, transporte", icone: "truck" },
  { value: "servicos_pessoais", label: "Serviços Pessoais", descricao: "Saúde, bem-estar", icone: "heart" },
];

// ==================== SUBCATEGORIAS POR CATEGORIA ====================

export type SubcategoriaContato = string;

export const SUBCATEGORIAS_POR_CATEGORIA: Record<CategoriaContato, { value: string; label: string }[]> = {
  mercado_contratacao: [
    { value: "casa_show", label: "Casa de Show" },
    { value: "produtor_eventos", label: "Produtor de Eventos" },
    { value: "prefeitura", label: "Prefeitura / Secretaria" },
    { value: "curador_festival", label: "Curador de Festival" },
    { value: "curador_edital", label: "Curador de Edital" },
    { value: "parceiro_estrategico", label: "Parceiro Estratégico" },
    { value: "patrocinador", label: "Patrocinador" },
    { value: "agencia_booking", label: "Agência de Booking" },
  ],
  industria_distribuicao: [
    { value: "distribuidora", label: "Distribuidora" },
    { value: "plataforma_digital", label: "Plataforma Digital" },
    { value: "editora_parceira", label: "Editora Parceira" },
    { value: "agregador", label: "Agregador" },
    { value: "gestao_coletiva", label: "Sociedade de Gestão Coletiva" },
    { value: "gravadora", label: "Gravadora" },
    { value: "selo", label: "Selo" },
  ],
  comunicacao_imprensa: [
    { value: "jornalista", label: "Jornalista" },
    { value: "blog", label: "Blog / Portal" },
    { value: "radio", label: "Rádio" },
    { value: "tv", label: "TV" },
    { value: "podcast", label: "Podcast" },
    { value: "curador_playlist", label: "Curador de Playlist" },
    { value: "influenciador", label: "Influenciador" },
    { value: "assessoria", label: "Assessoria de Imprensa" },
  ],
  juridico_financeiro: [
    { value: "advogado_entretenimento", label: "Advogado (Entretenimento)" },
    { value: "advogado_trabalhista", label: "Advogado (Trabalhista)" },
    { value: "advogado_tributario", label: "Advogado (Tributário)" },
    { value: "contador", label: "Contador" },
    { value: "consultor_financeiro", label: "Consultor Financeiro" },
  ],
  profissionais_criativos: [
    { value: "musico", label: "Músico" },
    { value: "dancarino", label: "Dançarino" },
    { value: "produtor_artistico", label: "Produtor Artístico" },
    { value: "fotografo", label: "Fotógrafo" },
    { value: "videomaker", label: "Videomaker" },
    { value: "editor_video", label: "Editor de Vídeo" },
    { value: "designer", label: "Designer Gráfico" },
    { value: "social_media", label: "Gestor de Redes Sociais" },
    { value: "trafego", label: "Gestor de Tráfego" },
    { value: "compositor", label: "Compositor" },
    { value: "arranjador", label: "Arranjador" },
    { value: "letrista", label: "Letrista" },
  ],
  moda_estilo: [
    { value: "loja_roupa", label: "Loja de Roupa" },
    { value: "loja_acessorios", label: "Loja de Acessórios" },
    { value: "costureira", label: "Costureira / Estilista" },
    { value: "salao_beleza", label: "Salão de Beleza" },
    { value: "maquiador", label: "Maquiador(a)" },
    { value: "barbeiro", label: "Barbeiro" },
    { value: "personal_stylist", label: "Personal Stylist" },
  ],
  producao_logistica: [
    { value: "grafica", label: "Gráfica" },
    { value: "seguranca", label: "Segurança" },
    { value: "motorista", label: "Motorista" },
    { value: "transporte", label: "Empresa de Transporte" },
    { value: "loja_equipamentos", label: "Loja de Equipamentos" },
    { value: "tecnico_som", label: "Técnico de Som" },
    { value: "tecnico_luz", label: "Técnico de Luz" },
    { value: "cenografia", label: "Cenografia" },
    { value: "locacao_equipamentos", label: "Locação de Equipamentos" },
  ],
  servicos_pessoais: [
    { value: "dentista", label: "Dentista" },
    { value: "medico", label: "Médico" },
    { value: "fisioterapeuta", label: "Fisioterapeuta" },
    { value: "nutricionista", label: "Nutricionista" },
    { value: "psicologo", label: "Psicólogo" },
    { value: "personal_trainer", label: "Personal Trainer" },
  ],
};

// ==================== PAPÉIS DO CONTATO (Legado - mantido para compatibilidade) ====================

export type PapelContato = 
  | "cliente"
  | "fornecedor"
  | "artista"
  | "parceiro"
  | "aluno"
  | "representante"
  | "midia"
  | "distribuidor"
  | "licenciado"
  | "influenciador"
  | "contratante"
  | "produtor"
  | "compositor"
  | "musico"
  | "tecnico"
  | "assessoria";

export const PAPEIS_CONTATO: { value: PapelContato; label: string; categoria: string }[] = [
  // Comercial
  { value: "cliente", label: "Cliente", categoria: "Comercial" },
  { value: "fornecedor", label: "Fornecedor", categoria: "Comercial" },
  { value: "parceiro", label: "Parceiro de Negócios", categoria: "Comercial" },
  { value: "contratante", label: "Contratante de Shows", categoria: "Comercial" },
  { value: "licenciado", label: "Licenciado", categoria: "Comercial" },
  { value: "distribuidor", label: "Distribuidor", categoria: "Comercial" },
  
  // Criativo
  { value: "artista", label: "Artista", categoria: "Criativo" },
  { value: "compositor", label: "Compositor", categoria: "Criativo" },
  { value: "produtor", label: "Produtor Musical", categoria: "Criativo" },
  { value: "musico", label: "Músico", categoria: "Criativo" },
  
  // Serviços
  { value: "tecnico", label: "Técnico", categoria: "Serviços" },
  { value: "representante", label: "Representante/Agente", categoria: "Serviços" },
  { value: "assessoria", label: "Assessoria de Imprensa", categoria: "Serviços" },
  
  // Educacional
  { value: "aluno", label: "Aluno", categoria: "Educacional" },
  
  // Marketing
  { value: "midia", label: "Veículo de Mídia", categoria: "Marketing" },
  { value: "influenciador", label: "Influenciador", categoria: "Marketing" },
];

export const PAPEIS_POR_CATEGORIA = PAPEIS_CONTATO.reduce((acc, papel) => {
  if (!acc[papel.categoria]) acc[papel.categoria] = [];
  acc[papel.categoria].push(papel);
  return acc;
}, {} as Record<string, typeof PAPEIS_CONTATO>);

// ==================== TIPO PESSOA ====================

export type TipoPessoa = "pessoa_fisica" | "pessoa_juridica";

export const TIPOS_PESSOA: { value: TipoPessoa; label: string }[] = [
  { value: "pessoa_fisica", label: "Pessoa Física" },
  { value: "pessoa_juridica", label: "Pessoa Jurídica" },
];

// ==================== ORIGEM DO CONTATO ====================

export type OrigemContato = 
  | "site"
  | "indicacao"
  | "instagram"
  | "facebook"
  | "linkedin"
  | "youtube"
  | "tiktok"
  | "evento"
  | "feira"
  | "cold_call"
  | "email_marketing"
  | "spotify"
  | "whatsapp"
  | "outro";

export const ORIGENS_CONTATO: { value: OrigemContato; label: string }[] = [
  { value: "site", label: "Site" },
  { value: "indicacao", label: "Indicação" },
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "youtube", label: "YouTube" },
  { value: "tiktok", label: "TikTok" },
  { value: "spotify", label: "Spotify" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "evento", label: "Evento" },
  { value: "feira", label: "Feira/Conferência" },
  { value: "cold_call", label: "Prospecção Ativa" },
  { value: "email_marketing", label: "Email Marketing" },
  { value: "outro", label: "Outro" },
];

// ==================== STATUS DO RELACIONAMENTO ====================

export type StatusRelacionamento = 
  | "prospect"
  | "ativo"
  | "inativo"
  | "bloqueado"
  | "arquivado";

export const STATUS_RELACIONAMENTO: { value: StatusRelacionamento; label: string; color: string }[] = [
  { value: "prospect", label: "Em Prospecção", color: "bg-blue-500" },
  { value: "ativo", label: "Ativo", color: "bg-green-500" },
  { value: "inativo", label: "Inativo", color: "bg-slate-500" },
  { value: "bloqueado", label: "Bloqueado", color: "bg-red-500" },
  { value: "arquivado", label: "Arquivado", color: "bg-zinc-500" },
];

// ==================== TEMPERATURA (PARA VENDAS) ====================

export type TemperaturaLead = "frio" | "morno" | "quente";

export const TEMPERATURAS_LEAD: { value: TemperaturaLead; label: string; color: string }[] = [
  { value: "frio", label: "Frio", color: "bg-blue-500" },
  { value: "morno", label: "Morno", color: "bg-amber-500" },
  { value: "quente", label: "Quente", color: "bg-red-500" },
];

// ==================== PRIORIDADE ====================

export type Prioridade = "baixa" | "media" | "alta" | "urgente";

export const PRIORIDADES: { value: Prioridade; label: string; color: string }[] = [
  { value: "baixa", label: "Baixa", color: "bg-slate-500" },
  { value: "media", label: "Média", color: "bg-amber-500" },
  { value: "alta", label: "Alta", color: "bg-orange-500" },
  { value: "urgente", label: "Urgente", color: "bg-red-500" },
];

// ==================== TIPO DE PARCERIA ====================

export type TipoParceria = "pago" | "permuta" | "patrocinio" | "cortesia" | "comissao";

export const TIPOS_PARCERIA: { value: TipoParceria; label: string }[] = [
  { value: "pago", label: "Pago" },
  { value: "permuta", label: "Permuta" },
  { value: "patrocinio", label: "Patrocínio" },
  { value: "cortesia", label: "Cortesia" },
  { value: "comissao", label: "Comissão" },
];

// ==================== TAGS INTELIGENTES ====================

export const TAGS_SUGERIDAS: { value: string; label: string; categoria: string }[] = [
  // Confiança
  { value: "fornecedor_confiavel", label: "Fornecedor Confiável", categoria: "Confiança" },
  { value: "alto_impacto", label: "Alto Impacto de Imagem", categoria: "Confiança" },
  { value: "pontual", label: "Pontual", categoria: "Confiança" },
  { value: "recomendado", label: "Recomendado", categoria: "Confiança" },
  
  // Comercial
  { value: "alto_ticket", label: "Alto Ticket", categoria: "Comercial" },
  { value: "prioritario", label: "Prioritário", categoria: "Comercial" },
  { value: "contrato_ativo", label: "Contrato Ativo", categoria: "Comercial" },
  { value: "festival", label: "Festival", categoria: "Comercial" },
  
  // Operacional
  { value: "permuta", label: "Permuta", categoria: "Operacional" },
  { value: "emergencial", label: "Emergencial", categoria: "Operacional" },
  { value: "exclusivo", label: "Exclusivo", categoria: "Operacional" },
  
  // Atenção
  { value: "atencao", label: "Atenção Especial", categoria: "Atenção" },
  { value: "devedor", label: "Devedor", categoria: "Atenção" },
  { value: "problema_anterior", label: "Problema Anterior", categoria: "Atenção" },
];

// ==================== INTERFACE DO CONTATO UNIFICADO ====================

export interface Contato {
  id: string;
  
  // Identificação
  nome: string;
  nomeArtistico?: string;
  tipoPessoa: TipoPessoa;
  
  // Nova categorização estratégica
  categoria?: CategoriaContato;
  subcategorias?: string[];
  
  // Papéis (legado - multi-seleção)
  papeis: PapelContato[];
  
  // Contato
  email?: string;
  telefone?: string;
  whatsapp?: string;
  instagram?: string;
  linkedin?: string;
  youtube?: string;
  tiktok?: string;
  spotify?: string;
  site?: string;
  
  // Documentação
  cpfCnpj?: string;
  inscricaoEstadual?: string;
  
  // Empresa (se PJ ou se trabalha em uma)
  empresa?: string;
  cargo?: string;
  
  // Endereço
  endereco?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
  pais?: string;
  
  // CRM - Relacionamento
  origem?: OrigemContato;
  statusRelacionamento: StatusRelacionamento;
  temperatura?: TemperaturaLead;
  prioridade?: Prioridade;
  responsavelId?: string;
  responsavelNome?: string;
  
  // Pipeline de Vendas (se aplicável)
  etapaPipeline?: string;
  valorPotencial?: number;
  
  // Campos específicos por categoria
  // Mercado & Contratação
  historicoPropostas?: number;
  valoresPraticados?: string;
  ultimaNegociacao?: string;
  
  // Indústria & Distribuição
  tipoContrato?: string;
  vigenciaContrato?: string;
  percentuais?: string;
  linkPainel?: string;
  
  // Comunicação & Imprensa
  veiculo?: string;
  alcanceEstimado?: string;
  tipoMidia?: string;
  
  // Profissionais Criativos
  cacheMedio?: number;
  disponibilidade?: string;
  avaliacaoInterna?: number; // 1-5
  projetosRealizados?: number;
  
  // Moda & Estilo
  tipoParceria?: TipoParceria;
  artistasAtendidos?: string[];
  condicoesEspeciais?: string;
  
  // Produção & Logística
  tipoServico?: string;
  capacidadeTecnica?: string;
  regiaoAtendimento?: string;
  
  // Datas
  dataCriacao: string;
  dataUltimaInteracao?: string;
  proximaAcao?: string;
  dataProximaAcao?: string;
  
  // Observações
  tags?: string[];
  notas?: string;
  observacoesEstrategicas?: string;
  
  // Foto
  fotoUrl?: string;
  
  // Vinculações
  artistasVinculados?: string[];
  projetosVinculados?: string[];
  contratosVinculados?: string[];
}

// ==================== INTERAÇÕES (HISTÓRICO) ====================

export type TipoInteracao = 
  | "ligacao"
  | "email"
  | "whatsapp"
  | "reuniao"
  | "visita"
  | "proposta"
  | "contrato"
  | "pagamento"
  | "suporte"
  | "feedback"
  | "release"
  | "briefing"
  | "outro";

export const TIPOS_INTERACAO: { value: TipoInteracao; label: string }[] = [
  { value: "ligacao", label: "Ligação" },
  { value: "email", label: "Email" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "reuniao", label: "Reunião" },
  { value: "visita", label: "Visita" },
  { value: "proposta", label: "Proposta Enviada" },
  { value: "contrato", label: "Contrato" },
  { value: "pagamento", label: "Pagamento" },
  { value: "suporte", label: "Suporte" },
  { value: "feedback", label: "Feedback" },
  { value: "release", label: "Release Enviado" },
  { value: "briefing", label: "Briefing" },
  { value: "outro", label: "Outro" },
];

export interface Interacao {
  id: string;
  contatoId: string;
  tipo: TipoInteracao;
  data: string;
  descricao: string;
  responsavelId?: string;
  responsavelNome?: string;
  arquivos?: string[];
}

// ==================== OPORTUNIDADE (VENDAS) ====================

export type StatusOportunidade = 
  | "qualificacao"
  | "proposta"
  | "negociacao"
  | "fechamento"
  | "ganha"
  | "perdida";

export const STATUS_OPORTUNIDADE: { value: StatusOportunidade; label: string; color: string }[] = [
  { value: "qualificacao", label: "Qualificação", color: "bg-blue-500" },
  { value: "proposta", label: "Proposta", color: "bg-purple-500" },
  { value: "negociacao", label: "Negociação", color: "bg-amber-500" },
  { value: "fechamento", label: "Fechamento", color: "bg-orange-500" },
  { value: "ganha", label: "Ganha", color: "bg-green-500" },
  { value: "perdida", label: "Perdida", color: "bg-red-500" },
];

export interface Oportunidade {
  id: string;
  contatoId: string;
  titulo: string;
  descricao?: string;
  valor: number;
  probabilidade: number;
  valorPonderado?: number;
  status: StatusOportunidade;
  motivoPerda?: string;
  responsavelId?: string;
  dataCriacao: string;
  dataPrevisaoFechamento?: string;
  dataFechamento?: string;
  propostaIds?: string[];
  contratoId?: string;
  notas?: string;
}

// ==================== HELPERS ====================

export function filtrarContatosPorPapel(contatos: Contato[], papel: PapelContato): Contato[] {
  return contatos.filter(c => c.papeis.includes(papel));
}

export function filtrarContatosPorPapeis(contatos: Contato[], papeis: PapelContato[]): Contato[] {
  return contatos.filter(c => c.papeis.some(p => papeis.includes(p)));
}

export function filtrarContatosPorCategoria(contatos: Contato[], categoria: CategoriaContato): Contato[] {
  return contatos.filter(c => c.categoria === categoria);
}

export function getContatosClientes(contatos: Contato[]): Contato[] {
  const papeisCliente: PapelContato[] = ["cliente", "contratante", "licenciado", "aluno"];
  return filtrarContatosPorPapeis(contatos, papeisCliente);
}

export function getContatosFornecedores(contatos: Contato[]): Contato[] {
  const papeisFornecedor: PapelContato[] = ["fornecedor", "tecnico", "assessoria", "representante"];
  return filtrarContatosPorPapeis(contatos, papeisFornecedor);
}

export function getContatosArtistas(contatos: Contato[]): Contato[] {
  const papeisArtista: PapelContato[] = ["artista", "compositor", "produtor", "musico"];
  return filtrarContatosPorPapeis(contatos, papeisArtista);
}

export function getContatosVendas(contatos: Contato[]): Contato[] {
  return contatos.filter(c => 
    c.statusRelacionamento === "prospect" || 
    c.temperatura || 
    c.valorPotencial
  );
}

export function podeGerarReceita(contato: Contato): boolean {
  const papeisReceita: PapelContato[] = ["cliente", "contratante", "licenciado", "aluno", "distribuidor"];
  return contato.papeis.some(p => papeisReceita.includes(p));
}

export function podeGerarDespesa(contato: Contato): boolean {
  const papeisDespesa: PapelContato[] = [
    "fornecedor", "artista", "compositor", "musico", "produtor", 
    "tecnico", "assessoria", "representante"
  ];
  return contato.papeis.some(p => papeisDespesa.includes(p));
}

export function getCategoriaLabel(categoria: CategoriaContato): string {
  return CATEGORIAS_CONTATO.find(c => c.value === categoria)?.label || categoria;
}

export function getSubcategoriasLabel(categoria: CategoriaContato, subcategorias: string[]): string[] {
  const subs = SUBCATEGORIAS_POR_CATEGORIA[categoria] || [];
  return subcategorias.map(s => subs.find(sub => sub.value === s)?.label || s);
}

// ==================== CATEGORIAS FINANCEIRAS ====================

export const CATEGORIAS_FINANCEIRAS = {
  receita: {
    label: "Receita",
    categorias: {
      "shows-eventos": {
        label: "Shows e Eventos",
        subcategorias: [
          { value: "cache-show", label: "Cachê de Show" },
          { value: "venda-ingressos", label: "Venda de Ingressos" },
          { value: "patrocinio-evento", label: "Patrocínio de Evento" },
        ]
      },
      "licenciamento": {
        label: "Licenciamento",
        subcategorias: [
          { value: "sync-tv", label: "Sync TV/Cinema" },
          { value: "sync-publicidade", label: "Sync Publicidade" },
          { value: "sync-games", label: "Sync Games" },
          { value: "licenca-uso", label: "Licença de Uso" },
        ]
      },
      "distribuicao": {
        label: "Distribuição Digital",
        subcategorias: [
          { value: "streaming", label: "Streaming" },
          { value: "download", label: "Download" },
          { value: "royalties-mecanicos", label: "Royalties Mecânicos" },
        ]
      },
      "direitos-autorais": {
        label: "Direitos Autorais",
        subcategorias: [
          { value: "ecad", label: "ECAD" },
          { value: "direitos-conexos", label: "Direitos Conexos" },
          { value: "publishing", label: "Publishing" },
        ]
      },
      "servicos-musicais": {
        label: "Serviços Musicais",
        subcategorias: [
          { value: "producao-musical", label: "Produção Musical" },
          { value: "mixagem", label: "Mixagem" },
          { value: "masterizacao", label: "Masterização" },
          { value: "arranjo", label: "Arranjo" },
          { value: "composicao", label: "Composição sob Demanda" },
        ]
      },
      "educacional": {
        label: "Educacional",
        subcategorias: [
          { value: "curso", label: "Curso" },
          { value: "workshop", label: "Workshop" },
          { value: "mentoria", label: "Mentoria" },
          { value: "consultoria", label: "Consultoria" },
        ]
      },
      "merchandising": {
        label: "Merchandising",
        subcategorias: [
          { value: "venda-produtos", label: "Venda de Produtos" },
          { value: "royalties-merch", label: "Royalties de Merchandising" },
        ]
      },
      "outros-receita": {
        label: "Outros",
        subcategorias: [
          { value: "outra-receita", label: "Outra Receita" },
        ]
      },
    }
  },
  despesa: {
    label: "Despesa",
    categorias: {
      "producao": {
        label: "Produção",
        subcategorias: [
          { value: "estudio", label: "Estúdio" },
          { value: "musicos-sessao", label: "Músicos de Sessão" },
          { value: "producao-musical", label: "Produção Musical" },
          { value: "mixagem", label: "Mixagem" },
          { value: "masterizacao", label: "Masterização" },
          { value: "equipamentos", label: "Equipamentos" },
        ]
      },
      "marketing": {
        label: "Marketing",
        subcategorias: [
          { value: "assessoria-imprensa", label: "Assessoria de Imprensa" },
          { value: "social-media", label: "Social Media" },
          { value: "ads", label: "Anúncios Pagos" },
          { value: "material-grafico", label: "Material Gráfico" },
          { value: "video-clipe", label: "Videoclipe" },
          { value: "foto", label: "Ensaio Fotográfico" },
        ]
      },
      "shows-eventos": {
        label: "Shows e Eventos",
        subcategorias: [
          { value: "cache-musicos", label: "Cachê de Músicos" },
          { value: "tecnica", label: "Equipe Técnica" },
          { value: "transporte", label: "Transporte" },
          { value: "hospedagem", label: "Hospedagem" },
          { value: "alimentacao", label: "Alimentação" },
          { value: "cenografia", label: "Cenografia" },
        ]
      },
      "juridico-contabil": {
        label: "Jurídico e Contábil",
        subcategorias: [
          { value: "advogado", label: "Advocacia" },
          { value: "contabilidade", label: "Contabilidade" },
          { value: "registro-marcas", label: "Registro de Marcas" },
        ]
      },
      "operacional": {
        label: "Operacional",
        subcategorias: [
          { value: "aluguel", label: "Aluguel" },
          { value: "condominio", label: "Condomínio" },
          { value: "energia", label: "Energia" },
          { value: "internet", label: "Internet/Telefone" },
          { value: "software", label: "Software/Assinaturas" },
          { value: "manutencao", label: "Manutenção" },
        ]
      },
      "pessoal": {
        label: "Pessoal",
        subcategorias: [
          { value: "salarios", label: "Salários" },
          { value: "pro-labore", label: "Pró-labore" },
          { value: "freelancers", label: "Freelancers" },
          { value: "beneficios", label: "Benefícios" },
        ]
      },
      "impostos-taxas": {
        label: "Impostos e Taxas",
        subcategorias: [
          { value: "imposto-renda", label: "Imposto de Renda" },
          { value: "inss", label: "INSS" },
          { value: "iss", label: "ISS" },
          { value: "taxas-bancarias", label: "Taxas Bancárias" },
        ]
      },
      "royalties-pagos": {
        label: "Royalties Pagos",
        subcategorias: [
          { value: "royalties-artista", label: "Royalties ao Artista" },
          { value: "royalties-compositor", label: "Royalties ao Compositor" },
          { value: "split-parceiros", label: "Split com Parceiros" },
        ]
      },
      "outros-despesa": {
        label: "Outros",
        subcategorias: [
          { value: "outra-despesa", label: "Outra Despesa" },
        ]
      },
    }
  }
};
