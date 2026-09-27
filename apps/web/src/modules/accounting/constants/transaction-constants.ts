
import type { TransactionEntityLink } from "@/modules/accounting/types/accounting.types";

// ==================== TYPES ====================

export interface TransactionFormData {
  /** Managerial links (P&L) — mandatory ≥1. Multiple ones with allocation. */
  entityLinks: TransactionEntityLink[];
  // General data
  tipoTransacao: string;
  tipoCliente: string;
  category: string;
  subcategoria: string;
  description: string;
  amount: string;
  dataTransacao: string;
  status: string;
  observacao: string;
  
  // Links
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
  
  // Specific fields
  itemInvestimento: string;
  motivoViagem: string;
  advertisingName: string;
  
  // Payment
  formaPagamento: string;
  tipoPagamento: string;
  quantidadeParcelas: string;
  intervaloParcelas: string;
  dataPrimeiraParcela: string;
  
  // Attachment
  anexoUrl: string;
  anexoNome: string;
}

export const initialFormData: TransactionFormData = {
  entityLinks: [],
  tipoTransacao: "",
  tipoCliente: "",
  category: "",
  subcategoria: "",
  description: "",
  amount: "",
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
  advertisingName: "",
  
  formaPagamento: "",
  tipoPagamento: "avista",
  quantidadeParcelas: "",
  intervaloParcelas: "mensal",
  dataPrimeiraParcela: "",
  
  anexoUrl: "",
  anexoNome: "",
};

// ==================== TRANSACTION TYPES ====================

export const transactionTypes = [
  { value: "receita", label: "Receita" },
  { value: "despesa", label: "Despesa" },
  { value: "investimento", label: "Investimento" },
  { value: "imposto", label: "Imposto" },
  { value: "transferencia", label: "Transferência" },
];

// ==================== CLIENT TYPES ====================

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

// ==================== PAYMENT METHODS ====================

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

// ==================== EXPENSE - COMPANY ====================

export const companyExpenseCategories = [
  { value: "servicos", label: "Serviços" },
  { value: "produtos", label: "Produtos" },
  { value: "administrativo", label: "Administrativo" },
  { value: "marketing", label: "Marketing" },
  { value: "viagens", label: "Viagens" },
  { value: "suporte-financeiro", label: "Suporte Financeiro" },
];

// ==================== EXPENSE - PERSON ====================

export const individualExpenseCategories = [
  { value: "remuneracao", label: "Remuneração" },
  { value: "servicos-pf", label: "Serviços Pessoa Física" },
  { value: "reembolso", label: "Reembolso" },
];

// Compensation subcategories (person)
export const individualCompensationTypes = [
  { value: "salario", label: "Salário" },
  { value: "pro-labore", label: "Pró-labore" },
  { value: "pagamento-diaria", label: "Pagamento por diária" },
  { value: "hora-extra", label: "Hora extra" },
  { value: "comissao", label: "Comissão" },
  { value: "bonus-premiacao", label: "Bônus / Premiação" },
];

// Individual (natural person) services subcategories (person)
export const individualServiceTypes = [
  { value: "freelancer", label: "Freelancer" },
  { value: "prestador-autonomo", label: "Prestador autônomo" },
  { value: "consultoria", label: "Consultoria" },
];

// Reimbursement subcategories (Person)
export const individualReimbursementTypes = [
  { value: "reembolso-transporte", label: "Reembolso de transporte" },
  { value: "reembolso-alimentacao", label: "Reembolso de alimentação" },
  { value: "reembolso-hospedagem", label: "Reembolso de hospedagem" },
  { value: "reembolso-materiais", label: "Reembolso de materiais" },
];

// ==================== SERVICES (expense) ====================

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

// Services that require artist + project (mandatory)
export const expenseServicesRequiringArtistAndProject = [
  "design-grafico",
  "producao-audiovisual",
  "licenciamento-obras",
  "direitos-autorais",
  "fotografia-audiovisual",
  "sampling-clearance",
];

// ==================== MARKETING (Expense) ====================

export const marketingExpenseTypes = [
  { value: "marketing-trafego-pr", label: "Marketing / Tráfego / PR" },
  { value: "anuncios", label: "Anúncios" },
  { value: "brindes-promocionais", label: "Brindes promocionais" },
];

// Marketing: artist mandatory, project optional

// ==================== TRAVEL (Expense) ====================

export const travelExpenseTypes = [
  { value: "passagens", label: "Passagens" },
  { value: "hospedagem", label: "Hospedagem" },
  { value: "alimentacao", label: "Alimentação" },
  { value: "transporte", label: "Transporte" },
  { value: "locacao-equipamentos", label: "Locação de equipamentos" },
];

// Travel: artist mandatory + travel reason mandatory

// ==================== PRODUCTS (Expense) ====================

export const expenseProductTypes = [
  { value: "equipamentos", label: "Equipamentos" },
  { value: "merchandising", label: "Merchandising" },
  { value: "cenografia-pirotecnia", label: "Cenografia / Pirotecnia" },
];

// Equipment and merchandising: only the artist is mandatory
// Set design/pyrotechnics: artist mandatory + event/show mandatory
export const expenseProductsRequiringEvent = ["cenografia-pirotecnia"];

// ==================== ADMINISTRATIVE (Expense) ====================

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

// ==================== EXPENSE - ARTIST ====================

export const artistExpenseCategories = [
  { value: "caches", label: "Cachês" },
  { value: "suporte-financeiro", label: "Suporte Financeiro" },
];

// Performance fee subcategories (artist)
export const artistFeeTypes = [
  { value: "show-evento", label: "Show / Evento" },
  { value: "publicidade", label: "Publicidade" },
];

// ==================== REVENUE - COMPANY (the person counterparty uses the same) ====================
// KEPT IN SYNC WITH: src/lib/financial-items-types.ts -> FINANCIAL_CATEGORIES

export const companyRevenueCategories = [
  { value: "receitas-musicais", label: "Receitas Musicais" },
  { value: "servicos", label: "Serviços" },
  { value: "produtos", label: "Produtos" },
  { value: "receitas-contratuais", label: "Receitas Contratuais" },
  { value: "receitas-internas", label: "Receitas Internas" },
];

// Music revenue subcategories
// KEPT IN SYNC WITH: src/lib/financial-items-types.ts -> SUBCATEGORIAS_RECEITAS_MUSICAIS
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

// Music revenues with artist + project
export const musicRevenueRequiringArtistAndProject = [
  "direitos-autorais",
  "direitos-conexos",
  "external-rights-streaming",
  "licenciamento-obra",
  "licenciamento-fonograma",
  "sincronizacao",
  "venda-beats",
];

// Music revenues with the artist only (no project)
export const musicRevenueRequiringArtistOnly = [
  "participacao-show-evento",
  "venda-show-fechado",
];

// Services subcategories (revenue)
// KEPT IN SYNC WITH: src/lib/financial-items-types.ts -> SUBCATEGORIAS_SERVICOS
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

// Services (revenue) with artist + project
// KEPT IN SYNC WITH: src/lib/financial-items-types.ts -> SUBCATEGORIAS_SERVICOS (requiresArtist + requiresProject)
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

// Services (revenue) with the artist only (no mandatory project)
// KEPT IN SYNC WITH: src/lib/financial-items-types.ts -> SUBCATEGORIAS_SERVICOS (requiresArtist: true, requiresProject: false)
export const revenueServicesRequiringArtistOnly = [
  "criacao-site",
  "gestao-redes-sociais",
  "ensaio",
];

// Products subcategories (revenue)
// KEPT IN SYNC WITH: src/lib/financial-items-types.ts -> SUBCATEGORIAS_PRODUTOS
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

// Contractual revenue subcategories
// KEPT IN SYNC WITH: src/lib/financial-items-types.ts -> SUBCATEGORIAS_CONTRATUAIS
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

// ==================== REVENUE - ARTIST ====================

export const artistRevenueCategories = [
  { value: "cache-show", label: "Cachê de show" },
  { value: "recebimentos externos de direitos", label: "Recebimentos externos de direitos" },
  { value: "direitos-autorais", label: "Direitos autorais" },
  { value: "licenciamento", label: "Licenciamento" },
  { value: "adiantamento", label: "Adiantamento" },
  { value: "outros", label: "Outros" },
];

// ==================== INVESTMENT ====================

export const investmentCategories = [
  { value: "equipamentos", label: "Equipamentos" },
  { value: "infraestrutura", label: "Infraestrutura" },
  { value: "tecnologia", label: "Tecnologia" },
  { value: "marketing", label: "Marketing" },
  { value: "formacao", label: "Formação / Capacitação" },
];

// Items per Investment category
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
  { value: "website", label: "Site" },
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

export const getInvestmentItemsByCategory = (category: string): { value: string; label: string }[] => {
  switch (category) {
    case "equipamentos": return investmentEquipmentItems;
    case "infraestrutura": return investmentInfrastructureItems;
    case "tecnologia": return investmentTechnologyItems;
    case "marketing": return investmentMarketingItems;
    case "formacao": return investmentTrainingItems;
    default: return [];
  }
};

// ==================== TAX ====================

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

// ==================== TRANSFER ====================

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
  transactionType: string,
  clientType: string
): { value: string; label: string }[] => {
  if (transactionType === "imposto") return taxCategories;
  if (transactionType === "transferencia") return transferCategories;
  if (transactionType === "investimento") return investmentCategories;

  // Company
  if (clientType === "empresa") {
    if (transactionType === "despesa") return companyExpenseCategories;
    if (transactionType === "receita") return companyRevenueCategories;
  }

  // The person counterparty has specific expense categories
  if (clientType === "pessoa") {
    if (transactionType === "despesa") return individualExpenseCategories;
    if (transactionType === "receita") return companyRevenueCategories;
  }

  // The artist counterparty has specific categories
  if (clientType === "artista") {
    if (transactionType === "despesa") return artistExpenseCategories;
    if (transactionType === "receita") return artistRevenueCategories;
  }

  return [];
};

export const getSubcategoriesForCategory = (
  transactionType: string,
  clientType: string,
  category: string
): { value: string; label: string }[] => {
  // Artist + Expense
  if (clientType === "artista" && transactionType === "despesa") {
    if (category === "caches") return artistFeeTypes;
    return [];
  }

  // Company
  if (clientType === "empresa") {
    if (transactionType === "despesa") {
      switch (category) {
        case "servicos": return expenseServiceTypes;
        case "produtos": return expenseProductTypes;
        case "administrativo": return administrativeExpenseTypes;
        case "marketing": return marketingExpenseTypes;
        case "viagens": return travelExpenseTypes;
        default: return [];
      }
    }

    if (transactionType === "receita") {
      switch (category) {
        case "receitas-musicais": return musicRevenueTypes;
        case "servicos": return revenueServiceTypes;
        case "produtos": return revenueProductTypes;
        case "receitas-contratuais": return contractualRevenueTypes;
        default: return [];
      }
    }
  }

  // The person counterparty has specific expense subcategories
  if (clientType === "pessoa") {
    if (transactionType === "despesa") {
      switch (category) {
        case "remuneracao": return individualCompensationTypes;
        case "servicos-pf": return individualServiceTypes;
        case "reembolso": return individualReimbursementTypes;
        default: return [];
      }
    }

    if (transactionType === "receita") {
      switch (category) {
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


// ==================== BUSINESS RULES - CHECKERS ====================

// Checks whether an expense service requires artist + project
export const isServiceRequiringArtistAndProject = (subcategoria: string): boolean => {
  return expenseServicesRequiringArtistAndProject.includes(subcategoria);
};

// Checks whether an expense product requires an event
export const isProductRequiringEvent = (subcategoria: string): boolean => {
  return expenseProductsRequiringEvent.includes(subcategoria);
};

// Checks whether a music revenue requires artist + project
export const isMusicRevenueRequiringArtistAndProject = (subcategoria: string): boolean => {
  return musicRevenueRequiringArtistAndProject.includes(subcategoria);
};

// Checks whether a revenue service requires artist + project
export const isRevenueServiceRequiringArtistAndProject = (subcategoria: string): boolean => {
  return revenueServicesRequiringArtistAndProject.includes(subcategoria);
};

// Checks whether a revenue service requires only the artist
export const isRevenueServiceRequiringArtistOnly = (subcategoria: string): boolean => {
  return revenueServicesRequiringArtistOnly.includes(subcategoria);
};

