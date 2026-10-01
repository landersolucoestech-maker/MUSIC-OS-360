/**
 * modules/reports/i18n/field-labels.pt-br.ts
 *
 * PHASE 2 — the SINGLE, centralized and MANDATORY pt-BR label layer.
 *
 * Absolute rule: the technical key is infrastructure, the label is product. No text
 * visible to the user may originate from an automatic transformation of a technical key
 * (humanizeKey/startCase/…). Label resolution is EXPLICIT and fails fast
 * when missing — breaking the build is better than displaying English.
 *
 * Canonical keys in camelCase. `normalizeFieldKey` converts snake_case,
 * kebab-case and PascalCase to the canonical form before the lookup.
 *
 * Readers: a key is looked up only through `tryGetFieldLabelPtBr` /
 * `getFieldLabelPtBr` by (a) entity-metadata column names, (b) report contract ids
 * (export/import headers, sort/filter copy), (c) request field names rendered by
 * core/pipes/validation-messages (DTO/zod property names, including deprecated
 * request aliases). Keys whose technical name is Portuguese (legacy) must say which
 * reader keeps them alive with a trailing `// reader: <kinds>` comment, where kinds
 * are `entity-column`, `report-contract` and `request-field`; field-labels.readers.spec.ts
 * verifies the claim. A Portuguese-named key that no reader reaches is dead and is removed.
 */

/** Canonical dictionary (camelCase → pt-BR). Single source of truth for the labels. */
export const FIELD_LABELS_PT_BR = {
  // ── Identity / person ───────────────────────────────────────────────────────
  name: 'Nome',
  nome: 'Nome', // reader: report-contract request-field
  fullName: 'Nome completo',
  nomeArtistico: 'Nome artístico', // reader: request-field
  nomeCivil: 'Nome civil', // reader: request-field
  legalName: 'Razão social',
  razaoSocial: 'Razão social', // reader: request-field
  tradeName: 'Nome fantasia',
  companyName: 'Empresa',
  empresa: 'Empresa', // reader: request-field
  responsible: 'Responsável',
  department: 'Departamento',
  linkedUserId: 'Usuário vinculado',
  terminatedAt: 'Data de demissão',
  hiredAt: 'Data de admissão',
  salary: 'Salário',
  contractType: 'Tipo de contrato',
  responsavel: 'Responsável', // reader: request-field
  titularConta: 'Titular da conta', // reader: request-field

  // ── Contact ─────────────────────────────────────────────────────────────────
  contactType: 'Tipo de contato',
  documentType: 'Tipo de documento',
  documentNumber: 'Número do documento',
  cpfCnpj: 'CPF/CNPJ', // reader: report-contract request-field
  rg: 'RG', // reader: entity-column report-contract request-field
  phone: 'Telefone',
  telefone: 'Telefone', // reader: request-field
  whatsapp: 'WhatsApp',
  email: 'E-mail',
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  twitter: 'Twitter',
  website: 'Site',

  // ── Address ─────────────────────────────────────────────────────────────────
  address: 'Endereço',
  endereco: 'Endereço', // reader: request-field
  city: 'Cidade',
  cidade: 'Cidade', // reader: request-field
  state: 'Estado',
  estado: 'Estado', // reader: request-field
  country: 'País',
  zipCode: 'CEP',
  cep: 'CEP', // reader: request-field

  // ── Content / CRM ───────────────────────────────────────────────────────────
  notes: 'Observações',
  observacao: 'Observação', // reader: request-field
  notasInternas: 'Notas internas', // reader: request-field
  internalNotes: 'Notas internas',
  description: 'Descrição',
  descricao: 'Descrição', // reader: request-field
  content: 'Conteúdo',
  tags: 'Etiquetas',
  status: 'Situação',
  priority: 'Prioridade',
  prioridade: 'Prioridade', // reader: request-field
  timeline: 'Histórico',
  attachments: 'Anexos',
  title: 'Título',
  funcao: 'Função', // reader: request-field

  // ── Artistas / streaming ────────────────────────────────────────────────────
  musicGenre: 'Gênero musical',
  faseCarreira: 'Fase da carreira', // reader: request-field
  dataNascimento: 'Data de nascimento', // reader: request-field
  // The artist team's career manager (manager_name/manager_contact) — distinct
  // from the agent ("Empresário", agent_*). managerNome/managerContato keep the
  // pre-CZ-042 headers for deprecated keys and old spreadsheets.
  managerName: 'Nome do gestor de carreira',
  managerNome: 'Nome do empresário', // reader: request-field
  managerContact: 'Contato do gestor de carreira',
  managerContato: 'Contato do empresário', // reader: request-field
  produtorExecutivo: 'Produtor executivo', // reader: request-field
  agenciaBooking: 'Agência de booking', // reader: request-field
  labelParceira: 'Selo parceiro', // reader: request-field
  signingPlatform: 'Plataforma de assinatura',
  spotifyUrl: 'Link do Spotify',
  youtubeUrl: 'Link do YouTube',
  soundcloudUrl: 'Link do SoundCloud',
  appleMusicUrl: 'Link do Apple Music',
  deezerUrl: 'Link do Deezer',
  fotoUrl: 'Foto', // reader: request-field
  presskitUrl: 'Press kit',
  documentosPessoaisUrl: 'Documentos pessoais', // reader: request-field
  galeriaUrls: 'Galeria', // reader: request-field
  spotifyOuvintes: 'Ouvintes no Spotify', // reader: request-field
  youtubeInscritos: 'Inscritos no YouTube', // reader: request-field
  instagramSeguidores: 'Seguidores no Instagram', // reader: request-field
  tiktokSeguidores: 'Seguidores no TikTok', // reader: request-field
  instagramUrl: 'Link do Instagram',
  tiktokUrl: 'Link do TikTok',
  templateId: 'Template do contrato',
  appleMusicAlbunsUrl: 'Álbuns no Apple Music', // reader: request-field
  soundcloudSeguidoresUrl: 'Seguidores no SoundCloud', // reader: request-field
  deezerFas: 'Fãs no Deezer', // reader: request-field
  tagsMusicais: 'Etiquetas musicais', // reader: request-field
  tipoPerfil: 'Tipo de perfil', // reader: request-field
  relacionamentos: 'Relacionamentos', // reader: request-field
  contatosEquipe: 'Contatos da equipe', // reader: request-field
  contatosVinculados: 'Contatos vinculados', // reader: request-field
  distribuidorasSelecionadas: 'Distribuidoras selecionadas', // reader: request-field
  distribuidorasGerais: 'Distribuidoras gerais', // reader: request-field
  distribuidorasEmails: 'E-mails das distribuidoras', // reader: request-field
  distribuidorasEmpresaSelecionadas: 'Distribuidoras da empresa', // reader: request-field
  distribuidorasEmpresaEmails: 'E-mails das distribuidoras (empresa)', // reader: request-field
  empresarioId: 'Empresário (ID)', // reader: request-field
  empresarioNome: 'Empresário', // reader: request-field
  empresarioEmail: 'E-mail do empresário', // reader: request-field
  empresarioTelefone: 'Telefone do empresário', // reader: request-field
  gravadoraId: 'Gravadora (ID)', // reader: request-field
  gravadoraNome: 'Gravadora', // reader: request-field
  gravadoraEmail: 'E-mail da gravadora', // reader: request-field
  gravadoraTelefone: 'Telefone da gravadora', // reader: request-field
  gravadoraResponsavelId: 'Responsável na gravadora (ID)', // reader: request-field
  gravadoraResponsavelNome: 'Responsável na gravadora', // reader: request-field
  gravadoraResponsavelEmail: 'E-mail do responsável na gravadora', // reader: request-field
  gravadoraResponsavelTelefone: 'Telefone do responsável na gravadora', // reader: request-field
  clientId: 'Cliente (ID)',
  workId: 'Obra (ID)',
  autentiqueDocId: 'Documento Autentique (ID)',
  cpf: 'CPF', // reader: report-contract request-field

  // ── Finance / contracts ─────────────────────────────────────────────────────
  numero: 'Número', // reader: request-field
  valor: 'Valor', // reader: request-field
  fixedValue: 'Valor Fixo',
  emissao: 'Emissão', // reader: request-field
  issueDate: 'Emissão',
  vencimento: 'Vencimento', // reader: request-field
  participacao: 'Participação', // reader: request-field
  participation: 'Participação',
  dataInicio: 'Data de início', // reader: request-field
  dataFim: 'Data de fim', // reader: request-field
  banco: 'Banco', // reader: request-field
  agencia: 'Agência', // reader: request-field
  conta: 'Conta', // reader: request-field
  chavePix: 'Chave Pix', // reader: request-field
  type: 'Tipo',
  // "clientType" serves leads.client_type (the lead's client type);
  // transactions.counterparty_type is the financial counterparty (CZ-041).
  clientType: 'Tipo de cliente',
  tipoPessoa: 'Tipo de pessoa', // reader: request-field
  serviceType: 'Tipo de serviço',
  financialModel: 'Modelo financeiro',
  requiresExternalRightsTerms: 'Exige termos de direitos externos',
  requiresFixedValue: 'Exige valor fixo',
  requiresAdvance: 'Exige adiantamento',
  requiresFinancialSupport: 'Exige apoio financeiro',
  allowInstallments: 'Permite parcelamento',
  defaultFinancialCategory: 'Categoria financeira padrão',
  headerImageUrl: 'Imagem de cabeçalho',
  footerImageUrl: 'Imagem de rodapé',
  financialCurrency: 'Moeda',
  financialPaymentFrequency: 'Frequência de pagamento',
  financialPenaltyPercentage: 'Percentual de multa',
  financialInterestPercentage: 'Percentual de juros',
  financialDueDays: 'Prazo de vencimento (dias)',

  // ── Extra bank/streaming fields ─────────────────────────────────────────────
  slugArtistico: 'Identificador público', // reader: request-field

  // ── Common technical fields (STEP 5) ────────────────────────────────────────
  createdAt: 'Criado em',
  updatedAt: 'Atualizado em',
  deletedAt: 'Excluído em',
  tenantId: 'Tenant',
  artistId: 'Artista',
  projectId: 'Projeto',
  releaseId: 'Lançamento',
  contractId: 'Contrato',
  contratoId: 'Contrato', // reader: request-field
  amount: 'Valor',
  amountDue: 'Valor devido',
  amountPaid: 'Valor pago',
  attemptCount: 'Tentativas de pagamento',
  currency: 'Moeda',
  dueDate: 'Data de vencimento',
  hostedInvoiceUrl: 'Link da fatura',
  invoicePdf: 'PDF da fatura',
  paidAt: 'Pago em',
  startsAt: 'Início',
  endsAt: 'Término',

  // ── Real columns of the 39 reportable entities (100% coverage) ──────────────
  abramusProtocol: 'Protocolo ABRAMUS',
  active: 'Ativo',
  actualCloseDate: 'Data real de fechamento',
  aiPrompts: 'Prompts de IA',
  aiTools: 'Ferramentas de IA',
  aiUsed: 'IA utilizada',
  allowAiSuggestions: 'Permitir sugestões de IA',
  allowManualUsage: 'Permitir uso manual',
  alternativeTitles: 'Títulos alternativos',
  approved: 'Aprovado',
  approvedAt: 'Aprovado em',
  approvedBy: 'Aprovado por',
  archived: 'Arquivado',
  archivedAt: 'Arquivado em',
  arquivoUrl: 'Arquivo', // reader: request-field
  artista: 'Artista', // reader: report-contract request-field
  assetType: 'Tipo de ativo',
  assignedTo: 'Responsável',
  autoGenerated: 'Gerado automaticamente',
  autoStage: 'Estágio automático',
  budgetActual: 'Orçamento real',
  budgetEstimated: 'Orçamento estimado',
  calculation_method: 'Método de cálculo',
  coverUrl: 'Capa',
  cargo: 'Cargo', // reader: request-field
  categoria: 'Categoria', // reader: request-field
  category: 'Categoria',
  categoryKind: 'Tipo de categoria',
  channel: 'Canal',
  cliente: 'Cliente', // reader: request-field
  coCompositores: 'Co-compositores', // reader: report-contract
  // Renamed from `codAbramus` (20260718000017) — code at any collective
  // management society (ABRAMUS/UBC/SOCINPRO/others), not only ABRAMUS.
  codEntidade: 'Código de Cadastro da Sociedade', // reader: request-field
  societyCode: 'Código de Cadastro da Sociedade',
  codEcad: 'Código ECAD',
  ecadCode: 'Código ECAD',
  code: 'Código',
  color: 'Cor',
  completedAt: 'Concluído em',
  compositor: 'Compositor', // reader: request-field
  composerName: 'Compositor',
  compositores: 'Compositores', // reader: report-contract request-field
  composerNames: 'Compositores',
  conditions: 'Condições',
  contactCount: 'Total de contatos',
  contentType: 'Tipo de conteúdo',
  conteudo: 'Conteúdo', // reader: request-field
  context: 'Contexto',
  copy: 'Texto',
  copyrightOwner: 'Titular do direito autoral',
  copyrightYear: 'Ano do direito autoral',
  countryOfRecording: 'País de gravação',
  cpfCnpjEncrypted: 'CPF/CNPJ (criptografado)', // reader: entity-column report-contract
  cpfEncrypted: 'CPF (criptografado)', // reader: entity-column report-contract
  createdBy: 'Criado por',
  currentVersion: 'Versão atual',
  data: 'Data',
  dataAdmissao: 'Data de admissão', // reader: request-field
  dataDemissao: 'Data de demissão', // reader: request-field
  dataEmissao: 'Data de emissão', // reader: request-field
  dataEntrada: 'Data de entrada', // reader: request-field
  dataLancamento: 'Data de lançamento', // reader: request-field
  deliveryDate: 'Data de entrega',
  deliveryNotes: 'Notas de entrega',
  departamento: 'Departamento', // reader: request-field
  dependencies: 'Dependências',
  depthLevel: 'Nível de profundidade',
  detentores: 'Detentores', // reader: report-contract
  director: 'Diretor',
  distributor: 'Distribuidora',
  documents: 'Documentos',
  durationSec: 'Duração (s)',
  durationSeconds: 'Duração (s)',
  durationText: 'Duração',
  editora: 'Editora', // reader: request-field
  publisherName: 'Editora',
  emailEncrypted: 'E-mail (criptografado)',
  especialidades: 'Especialidades', // reader: request-field
  exclusivo: 'Exclusivo', // reader: request-field
  exclusive: 'Exclusivo',
  expectedCloseDate: 'Data prevista de fechamento',
  externalReference: 'Referência externa',
  fields: 'Campos',
  fileUrl: 'Arquivo',
  files: 'Arquivos',
  format: 'Formato',
  genero: 'Gênero', // reader: request-field
  goals: 'Metas',
  gravadora: 'Gravadora', // reader: request-field
  recordLabelName: 'Gravadora',
  recordLabel: 'Gravadora',
  icon: 'Ícone',
  industry: 'Setor',
  interpretes: 'Intérpretes', // reader: report-contract request-field
  isActive: 'Ativo',
  isInstrumental: 'Instrumental',
  isrc: 'ISRC',
  iswc: 'ISWC',
  jobTitle: 'Cargo',
  kind: 'Tipo',
  language: 'Idioma',
  lastContactedAt: 'Último contato em',
  local: 'Local',
  venue: 'Local',
  lyrics: 'Letra',
  letra: 'Letra', // reader: report-contract request-field
  metadata: 'Metadados',
  metrics: 'Métricas',
  // Child sheet "Músicas do Projeto" (Part 87) — see
  // computed-fields/project-tracks.field.ts and report-form-contracts.ts
  // (PROJECTS_CONTRACT.childSheets).
  soloFeat: 'Solo/Feat',
  originalRemix: 'Original/Remix',
  audioUrl: 'Áudio',
  midiaDestino: 'Mídia de destino', // reader: request-field
  mimeType: 'Tipo de arquivo',
  moeda: 'Moeda', // reader: request-field
  motivo: 'Motivo', // reader: request-field
  numeroNotaFiscal: 'Número da nota fiscal', // reader: entity-column report-contract request-field
  objective: 'Objetivo',
  obraMusical: 'Obra musical', // reader: request-field
  orcamento: 'Orçamento', // reader: request-field
  budget: 'Orçamento',
  orgSlug: 'Identificador da organização',
  externalSource: 'Origem externa',
  externalSourceSyncedAt: 'Sincronizado em (origem externa)',
  owner: 'Proprietário',
  path: 'Caminho',
  periodo: 'Período', // reader: request-field
  phoneEncrypted: 'Telefone (criptografado)',
  pipelineStage: 'Estágio do funil',
  plataforma: 'Plataforma', // reader: request-field
  platform: 'Plataforma',
  dueAt: 'Prazo',
  probability: 'Probabilidade',
  producer: 'Produtor',
  productionCompany: 'Produtora',
  produtores: 'Produtores', // reader: report-contract request-field
  projeto: 'Projeto', // reader: request-field
  protected: 'Protegido',
  publicationError: 'Erro de publicação',
  publicationStatus: 'Situação da publicação',
  publishDate: 'Data de publicação',
  publishTime: 'Horário de publicação',
  published: 'Publicado',
  publishedAt: 'Publicado em',
  quantidade: 'Quantidade', // reader: request-field
  recordingDate: 'Data de gravação',
  registryStatus: 'Situação do registro',
  releaseDate: 'Data de lançamento',
  resolution: 'Resolução',
  resolvedAt: 'Resolvido em',
  salario: 'Salário', // reader: request-field
  scheduledFor: 'Agendado para',
  score: 'Pontuação',
  settings: 'Configurações',
  sizeBytes: 'Tamanho (bytes)',
  slaBreached: 'SLA violado',
  slaDeadline: 'Prazo do SLA',
  slaDueAt: 'Vencimento do SLA',
  slug: 'Identificador público',
  socialLinks: 'Redes sociais',
  sortOrder: 'Ordem',
  source: 'Origem',
  stage: 'Estágio',
  stageHistory: 'Histórico de estágios',
  startDate: 'Data de início',
  endDate: 'Data de fim',
  statusCadastro: 'Situação do cadastro', // reader: request-field
  subject: 'Assunto',
  submissionCount: 'Total de envios',
  systemCategory: 'Categoria do sistema',
  targetName: 'Nome do alvo',
  targetType: 'Tipo de alvo',
  taskKey: 'Chave da tarefa',
  territorio: 'Território', // reader: request-field
  thumbnailUrl: 'Miniatura',
  ticketNumber: 'Número do chamado',
  tipoContrato: 'Tipo de contrato', // reader: request-field
  tipoUso: 'Tipo de uso', // reader: request-field
  tomadorDocEncrypted: 'Documento do tomador (criptografado)', // reader: entity-column report-contract
  transactionTypes: 'Tipos de transação',
  treeOrder: 'Ordem na árvore',
  upc: 'UPC',
  updatedBy: 'Atualizado por',
  uploadedBy: 'Enviado por',
  url: 'Link',
  usageCount: 'Total de usos',
  unitPrice: 'Valor unitário',
  value: 'Valor',
  variables: 'Variáveis',
  version: 'Versão',
  versionTitle: 'Título da versão',
  versoes: 'Versões', // reader: request-field
  versions: 'Versões',
  // ── Work form fields (2026-07-12 rule) ──────────────────────────────────────
  idioma: 'Idioma', // reader: request-field
  instrumental: 'Instrumental',
  criadaPorIa: 'Criada por IA', // reader: request-field
  tipoIa: 'Tipo de IA', // reader: request-field
  aiUsageLevel: 'Tipo de IA',
  iaHarmonia: 'IA — Harmonia', // reader: request-field
  aiHarmony: 'IA — Harmonia',
  iaMelodia: 'IA — Melodia', // reader: request-field
  aiMelody: 'IA — Melodia',
  iaLetra: 'IA — Letra', // reader: request-field
  aiLyrics: 'IA — Letra',
  outrosTitulos: 'Outros títulos', // reader: request-field
  referenciasConexas: 'Referências conexas', // reader: request-field
  relatedReferences: 'Referências conexas',
  letraCompleta: 'Letra completa', // reader: request-field
  participantes: 'Participantes', // reader: request-field
  participants: 'Participantes',
  letristas: 'Letristas', // reader: request-field
  translatorNames: 'Tradutores',
  tipoObra: 'Tipo de obra', // reader: request-field
  workOrigin: 'Tipo de obra',
  // ── Phonogram form fields (2026-07-12 rule) ─────────────────────────────────
  agregadora: 'Agregadora', // reader: request-field
  aggregator: 'Agregadora',
  isrcPais: 'ISRC — País', // reader: request-field
  isrcCountryCode: 'ISRC — País',
  isrcRegistrante: 'ISRC — Registrante', // reader: request-field
  isrcRegistrantCode: 'ISRC — Registrante',
  isrcAno: 'ISRC — Ano', // reader: request-field
  isrcYear: 'ISRC — Ano',
  isrcDesignacao: 'ISRC — Designação', // reader: request-field
  isrcDesignationCode: 'ISRC — Designação',
  nacional: 'Nacional', // reader: request-field
  isNational: 'Nacional',
  pubSimultanea: 'Publicação simultânea', // reader: request-field
  isSimultaneousPublication: 'Publicação simultânea',
  gravacaoOriginal: 'Gravação original', // reader: request-field
  duracaoMin: 'Duração (minutos)', // reader: request-field
  duracaoSeg: 'Duração (segundos)', // reader: request-field
  midia: 'Mídia', // reader: request-field
  mediaType: 'Mídia',
  classificacao: 'Classificação', // reader: request-field
  recordingClassification: 'Classificação',
  paisOrigem: 'País de origem', // reader: request-field
  paisPublicacao: 'País de publicação', // reader: request-field
  publicationCountry: 'País de publicação',
  arquivoAudio: 'Arquivo de áudio', // reader: request-field
  audioFile: 'Arquivo de áudio',
  audioFileId: 'ID do arquivo de áudio',
  // ── Clients/Contacts (2026-07-12 rule: 1 column per field) ───────────────────
  individualName: 'Nome (pessoa física)',
  cnpj: 'CNPJ', // reader: request-field
  foto: 'Foto', // reader: request-field
  perfil: 'Perfil', // reader: request-field
  logradouro: 'Logradouro', // reader: request-field
  complemento: 'Complemento', // reader: request-field
  bairro: 'Bairro', // reader: request-field
  enderecoCompleto: 'Endereço completo', // reader: request-field
  prioridadeContato: 'Prioridade do contato', // reader: request-field
  responsavelNome: 'Nome do responsável', // reader: request-field
  responsavelEmail: 'E-mail do responsável', // reader: request-field
  responsavelTelefone: 'Telefone do responsável', // reader: request-field
  responsavelCargo: 'Cargo do responsável', // reader: request-field
  // clients (CZ-043: canonical column keys, same visible headers)
  personType: 'Tipo de pessoa',
  profile: 'Perfil',
  street: 'Logradouro',
  streetNumber: 'Número',
  addressComplement: 'Complemento',
  neighborhood: 'Bairro',
  responsibleName: 'Nome do responsável',
  responsibleEmail: 'E-mail do responsável',
  responsiblePhone: 'Telefone do responsável',
  responsibleJobTitle: 'Cargo do responsável',
  // ── Events (2026-07-12 rule: 1 column per field) ────────────────────────────
  contatoLocal: 'Contato do local', // reader: request-field
  venueContact: 'Contato do local',
  feeAmount: 'Valor do cachê',
  publicoEsperado: 'Público esperado', // reader: request-field
  expectedAttendance: 'Público esperado',
  // ── Invoices (2026-07-12 rule: 1 column per field) ──────────────────────────
  serie: 'Série', // reader: entity-column report-contract request-field
  tipoNota: 'Tipo de nota', // reader: entity-column report-contract request-field
  naturezaOperacao: 'Natureza da operação', // reader: entity-column report-contract request-field
  codigoServicoMunicipal: 'Código de serviço municipal', // reader: entity-column report-contract request-field
  codigoMunicipio: 'Código do município', // reader: entity-column report-contract request-field
  cfop: 'CFOP', // reader: entity-column report-contract request-field
  serviceDescription: 'Descrição dos serviços',
  tomadorCnpj: 'CNPJ do tomador', // reader: entity-column report-contract request-field
  tomadorRazaoSocial: 'Razão social do tomador', // reader: request-field
  tomadorInscricaoEstadual: 'Inscrição estadual do tomador', // reader: entity-column report-contract request-field
  tomadorInscricaoMunicipal: 'Inscrição municipal do tomador', // reader: entity-column report-contract request-field
  tomadorEmail: 'E-mail do tomador', // reader: entity-column report-contract request-field
  tomadorAddress: 'Endereço do tomador', // reader: entity-column report-contract request-field
  tomadorCity: 'Cidade do tomador', // reader: entity-column report-contract request-field
  tomadorUf: 'UF do tomador', // reader: entity-column report-contract request-field
  tomadorCep: 'CEP do tomador', // reader: entity-column report-contract request-field
  serviceAmount: 'Valor dos serviços',
  deductionsAmount: 'Valor das deduções',
  baseCalculo: 'Base de cálculo', // reader: entity-column report-contract request-field
  aliquotaIss: 'Alíquota de ISS', // reader: entity-column report-contract request-field
  issAmount: 'Valor do ISS', // reader: entity-column report-contract request-field
  issRetido: 'ISS retido', // reader: entity-column report-contract request-field
  pisAmount: 'Valor do PIS', // reader: entity-column report-contract request-field
  cofinsAmount: 'Valor do COFINS', // reader: entity-column report-contract request-field
  inssAmount: 'Valor do INSS', // reader: entity-column report-contract request-field
  irAmount: 'Valor do IR', // reader: entity-column report-contract request-field
  csllAmount: 'Valor do CSLL', // reader: entity-column report-contract request-field
  netAmount: 'Valor líquido',
  formaPagamento: 'Forma de pagamento', // reader: request-field
  condicaoPagamento: 'Condição de pagamento', // reader: request-field
  urlPdf: 'PDF da nota',
  // ── Licenses (2026-07-12 rule: 1 column per field) ──────────────────────────
  remunerationType: 'Tipo de remuneração',
  // ── Takedowns (2026-07-12 rule: 1 column per field) ─────────────────────────
  obraAfetada: 'Obra afetada', // reader: request-field
  urlInfracao: 'Link da infração', // reader: request-field
  evidencias: 'Evidências', // reader: request-field
  dataIdentificacao: 'Data de identificação', // reader: request-field
  // ── Financial transactions (CZ-041: 1 canonical column per field) ────────
  transactionType: 'Tipo de transação',
  counterpartyType: 'Tipo de cliente',
  subcategory: 'Subcategoria',
  referenceMonth: 'Competência',
  transactionDate: 'Data da transação',
  counterpartyName: 'Fornecedor/Cliente',
  taxAuthority: 'Órgão arrecadador',
  costCenter: 'Centro de custo',
  sourceBankAccount: 'Conta de origem',
  destinationBankAccount: 'Conta de destino',
  investmentItem: 'Item de investimento',
  travelReason: 'Motivo da viagem',
  advertisingName: 'Nome da publicidade',
  paymentType: 'Tipo de pagamento',
  installmentCount: 'Quantidade de parcelas',
  installmentInterval: 'Intervalo das parcelas',
  firstInstallmentDate: 'Data da primeira parcela',
  attachmentUrl: 'Link do anexo',
  attachmentName: 'Nome do anexo',
  // ── Audiovisual productions (migration AudiovisualProjectsFormFieldColumns
  // 20260718000012) and Releases — fields confirmed via
  // AudiovisualProjectFormModal.tsx / LancamentoViewModal.tsx (Part 50) ──────
  musicTitle: 'Título da música',
  artistName: 'Nome do artista',
  videomaker: 'Videomaker', // reader: request-field
  videographer: 'Videomaker',
  editor: 'Editor',
  shootingDate: 'Data da gravação',
  // Same concept as `local` (line above) — this table's technical key is
  // `location`, not `local`; label reused by the consistency rule.
  location: 'Local',
  captureStatus: 'Status da captação',
  editingStatus: 'Status da edição',
  approvalStatus: 'Status da aprovação',
  finalStatus: 'Status final',
  preReleaseDate: 'Data de pré-lançamento',
  // Same concept as `notes`/`observacoes` (above) — this table's technical
  // key is `observations`.
  observations: 'Observações',
  // Shared by audiovisual_projects and audiovisual_briefings — the production's
  // initial creative concept (script/aesthetics/references).
  concept: 'Conceito',
  isrcGlobal: 'ISRC Global',
  // Distinct from `copyrightOwner` (line above, "Titular do direito autoral")
  // — a different technical field, real label confirmed in LancamentoViewModal.
  copyright: 'Titular do copyright',

  // ── Part 89 — Monitoring (content_detections) ────────────────────────────────
  detectedTitle: 'Título detectado',
  detectedAt: 'Detectado em',

  // ── Part 89 — Distribution (releases) ───────────────────────────────────────
  schedule: 'Cronograma',
  variousArtists: 'Vários artistas',
  secondaryGenre: 'Gênero secundário',
  copyrightReleaseYear: 'Ano de copyright (lançamento)',
  copyrightRecordingYear: 'Ano de copyright (gravação)',
  additionalAlbumArtists: 'Artistas adicionais do álbum',
  isAlternateVersion: 'É versão alternativa',
  versionType: 'Tipo de versão',
  trackTitle: 'Nome',
  trackArtist: 'Artista',
  releaseTrackLanguage: 'Idioma da faixa',
  ownUpc: 'UPC próprio',
  territory: 'Território',
  releaseTime: 'Horário de lançamento',
  releaseTimezone: 'Fuso horário de lançamento',
  preOrder: 'Pré-venda',
  noPreviewsDuringPreOrder: 'Sem prévias durante a pré-venda',
  pricing: 'Precificação',
  versionCustomName: 'Descrição da versão customizada',
  aiAssistanceLevel: 'Nível de assistência de IA',
  explicit: 'Conteúdo explícito',

  // ── Part 89 — Shares ─────────────────────────────────────────────────────────
  // `percentual` (WorkParticipantEntity) remains — shares migrated to
  // holder/recipient/direction/percentage on 2026-09-13
  // (RenameSharePartyFieldsToEnglish), but the key is still live for
  // work participants.
  shareType: 'Tipo de share',
  percentual: 'Percentual', // reader: request-field
  percentage: 'Percentual',
  direction: 'Direção',
  holder: 'Detentor',
  recipient: 'Destinatário',
  // CZ-037: artista_project_id folded into artist_id (label `artistId`).
  externalArtistName: 'Artista externo',
  payer: 'Responsável pagador',
  payerContact: 'Contato do pagador',
  agreementSource: 'Origem do acordo',
  expectedAt: 'Data prevista',
  agreementNotes: 'Notas do acordo',
  agreementUrl: 'Link do documento',
  history: 'Histórico de versões',
  settledAmount: 'Valor liquidado',

  // ── Part 89 — Financial transactions / Invoice / Calendar ───────────────────
  eventId: 'Evento vinculado',
  codigoServico: 'Código do serviço', // reader: request-field
  totalAmount: 'Valor total',
  label: 'Nome',

  // ── Part 89 — CRM: Leads ────────────────────────────────────────────────────
  statusLead: 'Status do lead',
  uploads: 'Anexos',

  // ── Part 89 — Tasks (marketing_tasks) / Content calendar ────────────────────
  marketingProjectId: 'Projeto de marketing vinculado',
  sector: 'Setor',
  // inventory_items (CZ-032) — same headers as the pre-rename columns.
  quantity: 'Quantidade',
  storageLocation: 'Localização',
  responsiblePerson: 'Responsável',
  entryDate: 'Data de entrada',
  purchaseLocation: 'Local de compra',
  // leads (CZ-033) — same headers as the pre-rename keys.
  company: 'Empresa',
  leadType: 'Tipo de lead',
  service: 'Serviço',
  serviceArtistName: 'Nome do artista/banda',
  leadSource: 'Origem do lead',
  marketingCampaign: 'Campanha de marketing',
  nextFollowUpAt: 'Próximo follow-up',
  estimatedValue: 'Valor estimado',
  temperature: 'Temperatura',
  // takedowns (CZ-034) — same headers as the pre-rename columns.
  artist: 'Artista',
  affectedWork: 'Obra afetada',
  infringingUrl: 'Link da infração',
  reason: 'Motivo',
  identifiedAt: 'Data de identificação',
  evidence: 'Evidências',
  // licenses (CZ-035) — same headers as the pre-rename columns.
  workTitle: 'Obra musical',
  clientName: 'Cliente',
  projectName: 'Projeto',
  usageType: 'Tipo de uso',
  targetMedia: 'Mídia de destino',
  // invoices (CZ-036) — same headers as the pre-rename columns.
  invoiceNumber: 'Número',
  issuedAt: 'Data de emissão',
  tomadorLegalName: 'Razão social do tomador', // reader: entity-column report-contract request-field
  paymentMethod: 'Forma de pagamento',
  paymentTerms: 'Condição de pagamento',
  invoiceDueAt: 'Data de vencimento',
  serviceCode: 'Código do serviço',
  campaignId: 'Campanha',

  // ── Parte 89 — Briefing ──────────────────────────────────────────────────────
  owners: 'Responsáveis',
  audience: 'Público-alvo / personas',
  positioning: 'Posicionamento',
  tone: 'Tom de comunicação',
  requirements: 'Requisitos',
  creativeDirection: 'Direcionamento criativo',
  references: 'Referências',
  visualGuidelines: 'Diretrizes visuais',
  textGuidelines: 'Diretrizes textuais',
  market: 'Mercado / oportunidades',
  competitors: 'Concorrentes',
  trends: 'Tendências',
  channels: 'Canais',
  restrictions: 'Restrições',
  resources: 'Recursos disponíveis',
  expectations: 'Expectativas',
  deliverables: 'Entregáveis',
  executionPlan: 'Plano de ação operacional',
  aiRecommendations: 'Recomendações da IA',

  // Projects contract logical ids (header text unchanged; see PROJECTS_CONTRACT).
  projectType: 'Tipo de Lançamento',
  projectTitle: 'Nome do EP/Álbum',
  projectStatus: 'Status',
  // Events contract: starts_at is exported/imported under the historical "Data" header.
  eventDate: 'Data',
  // projects.tracks repeating group (CZ-031) — same headers as before.
  trackName: 'Nome da música',
  trackDurationMinutes: 'Duração — Minutos',
  trackDurationSeconds: 'Duração — Segundos',
  trackLanguage: 'Idioma da Música',
  composers: 'Compositores',
  performers: 'Intérpretes',
  producers: 'Produtores',
  audioFiles: 'Arquivos de Áudio (MP3/WAV)',

  // ── Artists (CZ-042: canonical English columns) — same headers as the
  // pre-rename keys, which stay above only while the deprecated request
  // aliases (artist-legacy-fields.ts) are accepted (their validation copy).
  // full_name is "Nome completo" (legalName stays "Razão social"); manager_* is
  // the team "Manager" and agent_* the "Empresário" (distinct fields).
  stageName: 'Nome artístico',
  registrationStatus: 'Situação do cadastro',
  photoUrl: 'Foto',
  galleryUrls: 'Galeria',
  specialties: 'Especialidades',
  personalDocumentsUrl: 'Documentos pessoais',
  pressKitUrl: 'Press kit',
  birthDate: 'Data de nascimento',
  bankName: 'Banco',
  bankBranch: 'Agência',
  bankAccount: 'Conta',
  pixKey: 'Chave Pix',
  accountHolder: 'Titular da conta',
  profileType: 'Tipo de perfil',
  artistSlug: 'Identificador público',
  musicTags: 'Etiquetas musicais',
  careerStage: 'Fase da carreira',
  relationships: 'Relacionamentos',
  agentId: 'Empresário (ID)',
  agentName: 'Empresário',
  agentPhone: 'Telefone do empresário',
  agentEmail: 'E-mail do empresário',
  recordLabelId: 'Gravadora (ID)',
  recordLabelPhone: 'Telefone da gravadora',
  recordLabelEmail: 'E-mail da gravadora',
  recordLabelContactId: 'Responsável na gravadora (ID)',
  recordLabelContactName: 'Responsável na gravadora',
  recordLabelContactPhone: 'Telefone do responsável na gravadora',
  recordLabelContactEmail: 'E-mail do responsável na gravadora',
  selectedDistributors: 'Distribuidoras selecionadas',
  distributorEmails: 'E-mails das distribuidoras',
  companySelectedDistributors: 'Distribuidoras da empresa',
  companyDistributorEmails: 'E-mails das distribuidoras (empresa)',
  generalDistributors: 'Distribuidoras gerais',
  linkedContacts: 'Contatos vinculados',
  teamContacts: 'Contatos da equipe',
  managerContactEncrypted: 'Contato do gestor de carreira (criptografado)',
  executiveProducer: 'Produtor executivo',
  bookingAgency: 'Agência de booking',
  partnerLabel: 'Selo parceiro',
  gender: 'Gênero',
  spotifyListeners: 'Ouvintes no Spotify',
  youtubeSubscribers: 'Inscritos no YouTube',
  deezerFans: 'Fãs no Deezer',
  appleMusicAlbums: 'Álbuns no Apple Music',
  soundcloudFollowers: 'Seguidores no SoundCloud',
  instagramFollowers: 'Seguidores no Instagram',
  tiktokFollowers: 'Seguidores no TikTok',

  // ── Part 89 — Accounting (computed report) ──────────────────────────────────
  revenue: 'Receitas',
  expenses: 'Despesas',
  result: 'Resultado',
  margin: 'Margem (%)',
} as const satisfies Record<string, string>;

export type FieldLabelKey = keyof typeof FIELD_LABELS_PT_BR;

/** Reverse map (pt-BR label → canonical key). The first key wins on a tie. */
export const FIELD_KEYS_BY_LABEL_PT_BR: Record<string, string> = (() => {
  const m: Record<string, string> = {};
  for (const [key, label] of Object.entries(FIELD_LABELS_PT_BR)) {
    const lk = label.toLowerCase();
    if (m[lk] === undefined) m[lk] = key;
  }
  return m;
})();

/**
 * Converts a technical key (snake_case, kebab-case, PascalCase, camelCase)
 * to the canonical camelCase form. Does NOT generate a label — only normalizes the format.
 */
export function normalizeFieldKey(fieldKey: string): string {
  const cleaned = String(fieldKey ?? '').trim();
  if (!cleaned) return '';
  if (/[_-]/.test(cleaned)) {
    const parts = cleaned.split(/[_-]+/).filter(Boolean);
    return (
      parts[0].toLowerCase() +
      parts.slice(1).map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join('')
    );
  }
  // camelCase already normalized, or PascalCase → camelCase.
  return cleaned.charAt(0).toLowerCase() + cleaned.slice(1);
}

/**
 * Resolves a field's pt-BR label. EXPLICIT and fail-fast: throws when the
 * label does not exist (no visual fallback). Use in UI, reports, export, import
 * and templates.
 */
export function getFieldLabelPtBr(fieldKey: string): string {
  const normalized = normalizeFieldKey(fieldKey);
  const label = (FIELD_LABELS_PT_BR as Record<string, string>)[normalized];
  if (!label) {
    throw new Error(`[i18n] Missing pt-BR label for field: ${fieldKey}`);
  }
  return label;
}

/** SAFE variant (does not throw) — for inventory/diagnostics. Returns null when missing. */
export function tryGetFieldLabelPtBr(fieldKey: string): string | null {
  const normalized = normalizeFieldKey(fieldKey);
  return (FIELD_LABELS_PT_BR as Record<string, string>)[normalized] ?? null;
}

/** Reverts a pt-BR label to the canonical key (import round-trip). */
export function fieldKeyForLabelPtBr(label: string): string | null {
  return FIELD_KEYS_BY_LABEL_PT_BR[String(label ?? '').trim().toLowerCase()] ?? null;
}
