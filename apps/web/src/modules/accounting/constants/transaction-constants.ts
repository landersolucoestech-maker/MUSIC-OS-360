
import type { TransactionEntityLink } from "@/modules/accounting/types/accounting.types";

// ==================== TIPOS ====================

export interface TransactionFormData {
  /** Vínculos gerenciais (P&L) — obrigatório ≥1. Múltiplos com rateio. */
  entityLinks: TransactionEntityLink[];
  // Dados gerais
  tipoTransacao: string;
  tipoCliente: string;
  categoria: string;
  subcategoria: string;
  descricao: string;
  valor: string;
  dataTransacao: string;
  status: string;
  observacao: string;
  
  // Vinculações
  artistaVinculado: string;
  projetoVinculado: string;
  contratoVinculado: string;
  eventoVinculado: string;
  fornecedorCliente: string;
  orgaoArrecadador: string;
  tipoVinculacao?: string;
  centroCusto?: string;
  competencia?: string;
  contaOrigem?: string;
  contaDestino?: string;
  
  // Campos específicos
  itemInvestimento: string;
  motivoViagem: string;
  nomePublicidade: string;
  
  // Pagamento
  formaPagamento: string;
  tipoPagamento: string;
  quantidadeParcelas: string;
  intervaloParcelas: string;
  dataPrimeiraParcela: string;
  
  // Anexo
  anexoUrl: string;
  anexoNome: string;
}

export const initialFormData: TransactionFormData = {
  entityLinks: [],
  tipoTransacao: "",
  tipoCliente: "",
  categoria: "",
  subcategoria: "",
  descricao: "",
  valor: "",
  dataTransacao: "",
  status: "pending",
  observacao: "",
  
  artistaVinculado: "",
  projetoVinculado: "",
  contratoVinculado: "",
  eventoVinculado: "",
  fornecedorCliente: "",
  orgaoArrecadador: "",
  tipoVinculacao: "",
  centroCusto: "",
  competencia: "",
  contaOrigem: "",
  contaDestino: "",
  
  itemInvestimento: "",
  motivoViagem: "",
  nomePublicidade: "",
  
  formaPagamento: "",
  tipoPagamento: "avista",
  quantidadeParcelas: "",
  intervaloParcelas: "mensal",
  dataPrimeiraParcela: "",
  
  anexoUrl: "",
  anexoNome: "",
};

// ==================== TIPOS DE TRANSAÇÃO ====================

export const transactionTypes = [
  { value: "receita", label: "Receita" },
  { value: "despesa", label: "Despesa" },
  { value: "investimento", label: "Investimento" },
  { value: "imposto", label: "Imposto" },
  { value: "transferencia", label: "Transferência" },
];

// ==================== TIPOS DE CLIENTE ====================

export const clientTypes = [
  { value: "empresa", label: "Empresa" },
  { value: "artista", label: "Artista" },
  { value: "pessoa", label: "Pessoa" },
];

export const clientTypesForRevenue = [
  { value: "empresa", label: "Empresa" },
  { value: "artista", label: "Artista" },
  { value: "pessoa", label: "Pessoa" },
];

// ==================== STATUS ====================

// "aprovado"/"atrasado" removed: zero backend consumer ever branched on them
// (no service, no query, no migration) — dead decorative options, never
// really wired to any TransactionStatus semantics. "pago" DOES have real
// backend consumers (transactions.service.ts PAID_STATUSES,
// analytics.service.ts KPI queries) so it was translated, not dropped:
// "pago" -> "paid" (now a real TransactionStatus member).
export const transactionStatusOptions = [
  { value: "pending", label: "Pendente" },
  { value: "paid", label: "Pago" },
  { value: "cancelled", label: "Cancelado" },
];

// ==================== FORMAS DE PAGAMENTO ====================

export const paymentMethods = [
  { value: "pix", label: "PIX" },
  { value: "ted", label: "TED" },
  { value: "boleto", label: "Boleto" },
  { value: "cartao-credito", label: "Cartão de Crédito" },
  { value: "cartao-debito", label: "Cartão de Débito" },
  { value: "dinheiro", label: "Dinheiro" },
  { value: "cheque", label: "Cheque" },
];

export const paymentTypes = [
  { value: "avista", label: "À vista" },
  { value: "parcelado", label: "Parcelado" },
];

export const installmentIntervals = [
  { value: "mensal", label: "Mensal" },
  { value: "quinzenal", label: "Quinzenal" },
  { value: "semanal", label: "Semanal" },
];

// ==================== DESPESA - EMPRESA ====================

export const companyExpenseCategories = [
  { value: "servicos", label: "Serviços" },
  { value: "produtos", label: "Produtos" },
  { value: "administrativo", label: "Administrativo" },
  { value: "marketing", label: "Marketing" },
  { value: "viagens", label: "Viagens" },
  { value: "suporte-financeiro", label: "Suporte Financeiro" },
];

// ==================== DESPESA - PESSOA ====================

export const individualExpenseCategories = [
  { value: "remuneracao", label: "Remuneração" },
  { value: "servicos-pf", label: "Serviços Pessoa Física" },
  { value: "reembolso", label: "Reembolso" },
];

// Subcategorias Remuneração (Pessoa)
export const individualCompensationTypes = [
  { value: "salario", label: "Salário" },
  { value: "pro-labore", label: "Pró-labore" },
  { value: "pagamento-diaria", label: "Pagamento por diária" },
  { value: "hora-extra", label: "Hora extra" },
  { value: "comissao", label: "Comissão" },
  { value: "bonus-premiacao", label: "Bônus / Premiação" },
];

// Subcategorias Serviços Pessoa Física (Pessoa)
export const individualServiceTypes = [
  { value: "freelancer", label: "Freelancer" },
  { value: "prestador-autonomo", label: "Prestador autônomo" },
  { value: "consultoria", label: "Consultoria" },
];

// Subcategorias Reembolso (Pessoa)
export const individualReimbursementTypes = [
  { value: "reembolso-transporte", label: "Reembolso de transporte" },
  { value: "reembolso-alimentacao", label: "Reembolso de alimentação" },
  { value: "reembolso-hospedagem", label: "Reembolso de hospedagem" },
  { value: "reembolso-materiais", label: "Reembolso de materiais" },
];

// ==================== SERVIÇOS (Despesa) ====================

export const expenseServiceTypes = [
  { value: "design-grafico", label: "Design gráfico" },
  { value: "producao-audiovisual", label: "Produção audiovisual" },
  { value: "licenciamento-obras", label: "Licenciamento de obras" },
  { value: "direitos-autorais", label: "Direitos autorais" },
  { value: "fotografia-audiovisual", label: "Fotografia / Audiovisual" },
  { value: "sampling-clearance", label: "Sampling clearance" },
  { value: "assessoria-juridica", label: "Assessoria jurídica" },
  { value: "contabil-fiscal", label: "Contábil / Fiscal" },
  { value: "ti-desenvolvimento-saas", label: "TI / Desenvolvimento / SaaS" },
];

// Serviços que exigem Artista + Projeto (obrigatórios)
export const expenseServicesRequiringArtistAndProject = [
  "design-grafico",
  "producao-audiovisual",
  "licenciamento-obras",
  "direitos-autorais",
  "fotografia-audiovisual",
  "sampling-clearance",
];

// ==================== MARKETING (Despesa) ====================

export const marketingExpenseTypes = [
  { value: "marketing-trafego-pr", label: "Marketing / Tráfego / PR" },
  { value: "anuncios", label: "Anúncios" },
  { value: "brindes-promocionais", label: "Brindes promocionais" },
];

// Marketing: Artista obrigatório, Projeto opcional

// ==================== VIAGENS (Despesa) ====================

export const travelExpenseTypes = [
  { value: "passagens", label: "Passagens" },
  { value: "hospedagem", label: "Hospedagem" },
  { value: "alimentacao", label: "Alimentação" },
  { value: "transporte", label: "Transporte" },
  { value: "locacao-equipamentos", label: "Locação de equipamentos" },
];

// Viagens: Artista obrigatório + Motivo da viagem obrigatório

// ==================== PRODUTOS (Despesa) ====================

export const expenseProductTypes = [
  { value: "equipamentos", label: "Equipamentos" },
  { value: "merchandising", label: "Merchandising" },
  { value: "cenografia-pirotecnia", label: "Cenografia / Pirotecnia" },
];

// Equipamentos e Merchandising: apenas Artista obrigatório
// Cenografia/Pirotecnia: Artista obrigatório + Evento/Show obrigatório
export const expenseProductsRequiringEvent = ["cenografia-pirotecnia"];

// ==================== ADMINISTRATIVO (Despesa) ====================

export const administrativeExpenseTypes = [
  { value: "aluguel", label: "Aluguel" },
  { value: "agua", label: "Água" },
  { value: "luz", label: "Luz" },
  { value: "internet", label: "Internet" },
  { value: "telefonia", label: "Telefonia" },
  { value: "correios-logistica", label: "Correios / Logística" },
  { value: "taxas-bancarias", label: "Taxas bancárias" },
  { value: "impostos", label: "Impostos" },
  { value: "juros", label: "Juros" },
  { value: "multas", label: "Multas" },
  { value: "iof", label: "IOF" },
  { value: "tarifas-plataformas", label: "Tarifas de plataformas" },
];

// ==================== DESPESA - ARTISTA ====================

export const artistExpenseCategories = [
  { value: "caches", label: "Cachês" },
  { value: "suporte-financeiro", label: "Suporte Financeiro" },
];

// Subcategorias de Cachês (Artista)
export const artistFeeTypes = [
  { value: "show-evento", label: "Show / Evento" },
  { value: "publicidade", label: "Publicidade" },
];

// ==================== RECEITA - EMPRESA (e Pessoa usa as mesmas) ====================
// SINCRONIZADO COM: src/lib/financial-items-types.ts -> FINANCIAL_CATEGORIES

export const companyRevenueCategories = [
  { value: "receitas-musicais", label: "Receitas Musicais" },
  { value: "servicos", label: "Serviços" },
  { value: "produtos", label: "Produtos" },
  { value: "receitas-contratuais", label: "Receitas Contratuais" },
  { value: "receitas-internas", label: "Receitas Internas" },
];

// Subcategorias Receitas Musicais
// SINCRONIZADO COM: src/lib/financial-items-types.ts -> SUBCATEGORIAS_RECEITAS_MUSICAIS
export const musicRevenueTypes = [
  { value: "participacao-show-evento", label: "Participação em Show/Evento" },
  { value: "venda-show-fechado", label: "Venda de Show Fechado" },
  { value: "direitos-autorais", label: "Direitos Autorais" },
  { value: "direitos-conexos", label: "Direitos Conexos" },
  { value: "external-rights-streaming", label: "Recebimentos externos de streaming" },
  { value: "licenciamento-obra", label: "Licenciamento de Obra" },
  { value: "licenciamento-fonograma", label: "Licenciamento de Fonograma" },
  { value: "sincronizacao", label: "Sincronização" },
  { value: "venda-beats", label: "Venda de Beats" },
];

// Receitas musicais com Artista + Projeto
export const musicRevenueRequiringArtistAndProject = [
  "direitos-autorais",
  "direitos-conexos",
  "external-rights-streaming",
  "licenciamento-obra",
  "licenciamento-fonograma",
  "sincronizacao",
  "venda-beats",
];

// Receitas musicais apenas com Artista (sem projeto)
export const musicRevenueRequiringArtistOnly = [
  "participacao-show-evento",
  "venda-show-fechado",
];

// Subcategorias Serviços (Receita)
// SINCRONIZADO COM: src/lib/financial-items-types.ts -> SUBCATEGORIAS_SERVICOS
export const revenueServiceTypes = [
  { value: "producao-musical", label: "Produção Musical" },
  { value: "producao-audiovisual", label: "Produção Audiovisual" },
  { value: "marketing-divulgacao", label: "Marketing / Divulgação" },
  { value: "design-grafico", label: "Design Gráfico" },
  { value: "criacao-site", label: "Criação de Site" },
  { value: "gestao-redes-sociais", label: "Gestão de Redes Sociais" },
  { value: "trafego-pago", label: "Tráfego Pago" },
  { value: "consultoria", label: "Consultoria" },
  { value: "gravacao-estudio", label: "Gravação em Estúdio" },
  { value: "mixagem", label: "Mixagem" },
  { value: "masterizacao", label: "Masterização" },
  { value: "sessao-producao", label: "Sessão de Produção" },
  { value: "ensaio", label: "Ensaio" },
  { value: "locacao-estudio", label: "Locação de Estúdio" },
  { value: "locacao-equipamentos", label: "Locação de Equipamentos" },
];

// Serviços (Receita) com Artista + Projeto
// SINCRONIZADO COM: src/lib/financial-items-types.ts -> SUBCATEGORIAS_SERVICOS (requiresArtist + requiresProject)
export const revenueServicesRequiringArtistAndProject = [
  "producao-musical",
  "producao-audiovisual",
  "marketing-divulgacao",
  "design-grafico",
  "trafego-pago",
  "gravacao-estudio",
  "mixagem",
  "masterizacao",
  "sessao-producao",
];

// Serviços (Receita) apenas com Artista (sem projeto obrigatório)
// SINCRONIZADO COM: src/lib/financial-items-types.ts -> SUBCATEGORIAS_SERVICOS (requiresArtist: true, requiresProject: false)
export const revenueServicesRequiringArtistOnly = [
  "criacao-site",
  "gestao-redes-sociais",
  "ensaio",
];

// Subcategorias Produtos (Receita)
// SINCRONIZADO COM: src/lib/financial-items-types.ts -> SUBCATEGORIAS_PRODUTOS
export const revenueProductTypes = [
  { value: "venda-merchandising", label: "Venda de Merchandising" },
  { value: "venda-produtos-fisicos", label: "Venda de Produtos Físicos" },
  { value: "venda-produtos-digitais", label: "Venda de Produtos Digitais" },
  { value: "venda-nfts", label: "Venda de NFTs / Ativos Digitais" },
  { value: "beats-avulsos", label: "Beats Avulsos" },
  { value: "pack-beats", label: "Pack de Beats" },
  { value: "sample-packs", label: "Sample Packs" },
  { value: "presets-plugins", label: "Presets / Plugins" },
];

// Subcategorias Receitas Contratuais
// SINCRONIZADO COM: src/lib/financial-items-types.ts -> SUBCATEGORIAS_CONTRATUAIS
export const contractualRevenueTypes = [
  { value: "repasse-contrato", label: "Repasse de Contrato" },
  { value: "comissao", label: "Comissão" },
  { value: "fee-administrativo", label: "Fee Administrativo" },
  { value: "reembolso-recebido", label: "Reembolso Recebido" },
  { value: "multa-contratual", label: "Multa Contratual" },
  { value: "bonus-incentivo", label: "Bônus / Incentivo" },
  { value: "patrocinio", label: "Patrocínio" },
  { value: "apoio-cultural", label: "Apoio Cultural / Incentivo Fiscal" },
];

// ==================== RECEITA - ARTISTA ====================

export const artistRevenueCategories = [
  { value: "cache-show", label: "Cachê de show" },
  { value: "recebimentos externos de direitos", label: "Recebimentos externos de direitos" },
  { value: "direitos-autorais", label: "Direitos autorais" },
  { value: "licenciamento", label: "Licenciamento" },
  { value: "adiantamento", label: "Adiantamento" },
  { value: "outros", label: "Outros" },
];

// ==================== INVESTIMENTO ====================

export const investmentCategories = [
  { value: "equipamentos", label: "Equipamentos" },
  { value: "infraestrutura", label: "Infraestrutura" },
  { value: "tecnologia", label: "Tecnologia" },
  { value: "marketing", label: "Marketing" },
  { value: "formacao", label: "Formação / Capacitação" },
];

// Itens por categoria de Investimento
export const investmentEquipmentItems = [
  { value: "microfone", label: "Microfone" },
  { value: "fone-ouvido", label: "Fone de ouvido" },
  { value: "mesa-som", label: "Mesa de som" },
  { value: "monitor-referencia", label: "Monitor de referência" },
  { value: "interface-audio", label: "Interface de áudio" },
  { value: "instrumento-musical", label: "Instrumento musical" },
  { value: "camera", label: "Câmera" },
  { value: "iluminacao", label: "Iluminação" },
  { value: "computador", label: "Computador / Notebook" },
  { value: "acessorios", label: "Acessórios" },
  { value: "outros", label: "Outros" },
];

export const investmentInfrastructureItems = [
  { value: "reforma-escritorio", label: "Reforma de escritório" },
  { value: "reforma-estudio", label: "Reforma de estúdio" },
  { value: "mobiliario", label: "Mobiliário" },
  { value: "tratamento-acustico", label: "Tratamento acústico" },
  { value: "ar-condicionado", label: "Ar condicionado" },
  { value: "eletrica", label: "Instalação elétrica" },
  { value: "internet", label: "Internet / Rede" },
  { value: "seguranca", label: "Segurança" },
  { value: "outros", label: "Outros" },
];

export const investmentTechnologyItems = [
  { value: "software-daw", label: "Software DAW" },
  { value: "plugins-vst", label: "Plugins / VST" },
  { value: "licenca-software", label: "Licença de software" },
  { value: "servicos-cloud", label: "Serviços de cloud" },
  { value: "streaming", label: "Plataforma de streaming" },
  { value: "armazenamento", label: "Armazenamento" },
  { value: "crm-erp", label: "CRM / ERP" },
  { value: "automacao", label: "Automação" },
  { value: "ia", label: "Inteligência Artificial" },
  { value: "outros", label: "Outros" },
];

export const investmentMarketingItems = [
  { value: "branding", label: "Branding" },
  { value: "website", label: "Website" },
  { value: "redes-sociais", label: "Redes sociais" },
  { value: "assessoria-imprensa", label: "Assessoria de imprensa" },
  { value: "material-promocional", label: "Material promocional" },
  { value: "evento-lancamento", label: "Evento de lançamento" },
  { value: "pesquisa-mercado", label: "Pesquisa de mercado" },
  { value: "fotografia", label: "Fotografia" },
  { value: "videoclipe", label: "Videoclipe" },
  { value: "outros", label: "Outros" },
];

export const investmentTrainingItems = [
  { value: "curso-producao", label: "Curso de produção musical" },
  { value: "curso-mixagem", label: "Curso de mixagem / masterização" },
  { value: "curso-gestao", label: "Curso de gestão" },
  { value: "curso-marketing", label: "Curso de marketing" },
  { value: "workshop", label: "Workshop" },
  { value: "mentoria", label: "Mentoria" },
  { value: "certificacao", label: "Certificação" },
  { value: "evento-networking", label: "Evento / Networking" },
  { value: "outros", label: "Outros" },
];

export const getInvestmentItemsByCategory = (categoria: string): { value: string; label: string }[] => {
  switch (categoria) {
    case "equipamentos": return investmentEquipmentItems;
    case "infraestrutura": return investmentInfrastructureItems;
    case "tecnologia": return investmentTechnologyItems;
    case "marketing": return investmentMarketingItems;
    case "formacao": return investmentTrainingItems;
    default: return [];
  }
};

// ==================== IMPOSTO ====================

export const taxCategories = [
  { value: "irrf", label: "IRRF" },
  { value: "inss", label: "INSS" },
  { value: "iss", label: "ISS" },
  { value: "pis", label: "PIS" },
  { value: "cofins", label: "COFINS" },
  { value: "csll", label: "CSLL" },
  { value: "icms", label: "ICMS" },
  { value: "simples-nacional", label: "Simples Nacional" },
  { value: "das", label: "DAS" },
  { value: "iptu", label: "IPTU" },
  { value: "ipva", label: "IPVA" },
  { value: "outros", label: "Outros" },
];

// ==================== TRANSFERÊNCIA ====================

export const transferCategories = [
  { value: "entre-contas", label: "Entre contas" },
  { value: "aplicacao", label: "Aplicação" },
  { value: "resgate", label: "Resgate" },
];


export const collectingAgencies = [
  { id: "1", nome: "Receita Federal" },
  { id: "2", nome: "Prefeitura Municipal" },
  { id: "3", nome: "INSS" },
  { id: "4", nome: "Secretaria da Fazenda" },
  { id: "5", nome: "SEFAZ Estadual" },
];


// ==================== HELPERS ====================

export const getCategoriesForTransactionType = (
  tipoTransacao: string,
  tipoCliente: string
): { value: string; label: string }[] => {
  if (tipoTransacao === "imposto") return taxCategories;
  if (tipoTransacao === "transferencia") return transferCategories;
  if (tipoTransacao === "investimento") return investmentCategories;

  // Empresa
  if (tipoCliente === "empresa") {
    if (tipoTransacao === "despesa") return companyExpenseCategories;
    if (tipoTransacao === "receita") return companyRevenueCategories;
  }

  // Pessoa tem categorias específicas para despesa
  if (tipoCliente === "pessoa") {
    if (tipoTransacao === "despesa") return individualExpenseCategories;
    if (tipoTransacao === "receita") return companyRevenueCategories;
  }

  // Artista tem categorias específicas
  if (tipoCliente === "artista") {
    if (tipoTransacao === "despesa") return artistExpenseCategories;
    if (tipoTransacao === "receita") return artistRevenueCategories;
  }

  return [];
};

export const getSubcategoriesForCategory = (
  tipoTransacao: string,
  tipoCliente: string,
  categoria: string
): { value: string; label: string }[] => {
  // Artista + Despesa
  if (tipoCliente === "artista" && tipoTransacao === "despesa") {
    if (categoria === "caches") return artistFeeTypes;
    return [];
  }

  // Empresa
  if (tipoCliente === "empresa") {
    if (tipoTransacao === "despesa") {
      switch (categoria) {
        case "servicos": return expenseServiceTypes;
        case "produtos": return expenseProductTypes;
        case "administrativo": return administrativeExpenseTypes;
        case "marketing": return marketingExpenseTypes;
        case "viagens": return travelExpenseTypes;
        default: return [];
      }
    }

    if (tipoTransacao === "receita") {
      switch (categoria) {
        case "receitas-musicais": return musicRevenueTypes;
        case "servicos": return revenueServiceTypes;
        case "produtos": return revenueProductTypes;
        case "receitas-contratuais": return contractualRevenueTypes;
        default: return [];
      }
    }
  }

  // Pessoa tem subcategorias específicas para despesa
  if (tipoCliente === "pessoa") {
    if (tipoTransacao === "despesa") {
      switch (categoria) {
        case "remuneracao": return individualCompensationTypes;
        case "servicos-pf": return individualServiceTypes;
        case "reembolso": return individualReimbursementTypes;
        default: return [];
      }
    }

    if (tipoTransacao === "receita") {
      switch (categoria) {
        case "receitas-musicais": return musicRevenueTypes;
        case "servicos": return revenueServiceTypes;
        case "produtos": return revenueProductTypes;
        case "receitas-contratuais": return contractualRevenueTypes;
        default: return [];
      }
    }
  }

  return [];
};


// ==================== REGRAS DE NEGÓCIO - VERIFICADORES ====================

// Verifica se serviço de despesa exige Artista + Projeto
export const isServiceRequiringArtistAndProject = (subcategoria: string): boolean => {
  return expenseServicesRequiringArtistAndProject.includes(subcategoria);
};

// Verifica se produto de despesa exige Evento
export const isProductRequiringEvent = (subcategoria: string): boolean => {
  return expenseProductsRequiringEvent.includes(subcategoria);
};

// Verifica se receita musical exige Artista + Projeto
export const isMusicRevenueRequiringArtistAndProject = (subcategoria: string): boolean => {
  return musicRevenueRequiringArtistAndProject.includes(subcategoria);
};

// Verifica se serviço de receita exige Artista + Projeto
export const isRevenueServiceRequiringArtistAndProject = (subcategoria: string): boolean => {
  return revenueServicesRequiringArtistAndProject.includes(subcategoria);
};

// Verifica se serviço de receita exige apenas Artista
export const isRevenueServiceRequiringArtistOnly = (subcategoria: string): boolean => {
  return revenueServicesRequiringArtistOnly.includes(subcategoria);
};

