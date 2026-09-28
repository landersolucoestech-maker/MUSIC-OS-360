
import { formatCategoryLabel } from "@/shared/lib/category-labels";
import type {
  TransactionCounterpartyType,
  TransactionEntityLink,
  TransactionInstallmentInterval,
  TransactionPaymentMethod,
  TransactionPaymentType,
  TransactionType,
} from "@/modules/accounting/types/accounting.types";

// ==================== TYPES ====================

/**
 * Transaction form state. Identifiers are the canonical English names of the
 * CZ-041 wire contract (camelCase request keys); values of the option-backed
 * fields (transactionType, counterpartyType, paymentMethod, paymentType,
 * installmentInterval) are the canonical English wire values. Category and
 * subcategory keep their current slug values (taxonomy decision pending).
 */
export interface TransactionFormData {
  /** Managerial links (P&L) — mandatory ≥1. Multiple ones with allocation. */
  entityLinks: TransactionEntityLink[];
  // General data
  transactionType: string;
  counterpartyType: string;
  category: string;
  subcategory: string;
  description: string;
  amount: string;
  transactionDate: string;
  status: string;
  notes: string;

  // Links
  artistId: string;
  projectId: string;
  contractId: string;
  eventId: string;
  counterpartyName: string;
  taxAuthority: string;
  /** Form-only: which link the selected category rule asks for (see financialRules.utils linkValueByLabel). */
  linkType?: string;
  costCenter?: string;
  referenceMonth?: string;
  sourceBankAccount?: string;
  destinationBankAccount?: string;

  // Specific fields
  investmentItem: string;
  travelReason: string;
  advertisingName: string;

  // Payment
  paymentMethod: string;
  paymentType: string;
  installmentCount: string;
  installmentInterval: string;
  firstInstallmentDate: string;

  // Attachment
  attachmentUrl: string;
  attachmentName: string;
}

export const initialFormData: TransactionFormData = {
  entityLinks: [],
  transactionType: "",
  counterpartyType: "",
  category: "",
  subcategory: "",
  description: "",
  amount: "",
  transactionDate: "",
  status: "pending",
  notes: "",

  artistId: "",
  projectId: "",
  contractId: "",
  eventId: "",
  counterpartyName: "",
  taxAuthority: "",
  linkType: "",
  costCenter: "",
  referenceMonth: "",
  sourceBankAccount: "",
  destinationBankAccount: "",

  investmentItem: "",
  travelReason: "",
  advertisingName: "",

  paymentMethod: "",
  paymentType: "upfront",
  installmentCount: "",
  installmentInterval: "monthly",
  firstInstallmentDate: "",

  attachmentUrl: "",
  attachmentName: "",
};

// ==================== TRANSACTION TYPES ====================

export const transactionTypes: { value: TransactionType; label: string }[] = [
  { value: "revenue", label: "Receita" },
  { value: "expense", label: "Despesa" },
  { value: "investment", label: "Investimento" },
  { value: "tax", label: "Imposto" },
  { value: "transfer", label: "Transferência" },
];

// ==================== COUNTERPARTY TYPES ====================

export const counterpartyTypes: { value: TransactionCounterpartyType; label: string }[] = [
  { value: "company", label: "Empresa" },
  { value: "artist", label: "Artista" },
  { value: "individual", label: "Pessoa" },
  { value: "government", label: "Governo" },
  { value: "own_account", label: "Conta Própria" },
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

export const paymentMethods: { value: TransactionPaymentMethod; label: string }[] = [
  { value: "pix", label: "PIX" },
  { value: "ted", label: "TED" },
  { value: "boleto", label: "Boleto" },
  { value: "credit_card", label: "Cartão de Crédito" },
  { value: "debit_card", label: "Cartão de Débito" },
  { value: "cash", label: "Dinheiro" },
  { value: "check", label: "Cheque" },
];

export const paymentTypes: { value: TransactionPaymentType; label: string }[] = [
  { value: "upfront", label: "À vista" },
  { value: "installments", label: "Parcelado" },
];

export const installmentIntervals: { value: TransactionInstallmentInterval; label: string }[] = [
  { value: "monthly", label: "Mensal" },
  { value: "biweekly", label: "Quinzenal" },
  { value: "weekly", label: "Semanal" },
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
  { value: "direitos-autorais", label: "Direitos autorais" },
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
  { value: "producao-audiovisual", label: "Produção audiovisual" },
  { value: "marketing-divulgacao", label: "Marketing / Divulgação" },
  { value: "design-grafico", label: "Design gráfico" },
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
  { value: "locacao-equipamentos", label: "Locação de equipamentos" },
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
  { value: "internet", label: "Internet" },
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
  counterpartyType: string
): { value: string; label: string }[] => {
  if (transactionType === "tax") return taxCategories;
  if (transactionType === "transfer") return transferCategories;
  if (transactionType === "investment") return investmentCategories;

  // Company
  if (counterpartyType === "company") {
    if (transactionType === "expense") return companyExpenseCategories;
    if (transactionType === "revenue") return companyRevenueCategories;
  }

  // The individual counterparty has specific expense categories
  if (counterpartyType === "individual") {
    if (transactionType === "expense") return individualExpenseCategories;
    if (transactionType === "revenue") return companyRevenueCategories;
  }

  // The artist counterparty has specific categories
  if (counterpartyType === "artist") {
    if (transactionType === "expense") return artistExpenseCategories;
    if (transactionType === "revenue") return artistRevenueCategories;
  }

  return [];
};

export const getSubcategoriesForCategory = (
  transactionType: string,
  counterpartyType: string,
  category: string
): { value: string; label: string }[] => {
  // Artist + Expense
  if (counterpartyType === "artist" && transactionType === "expense") {
    if (category === "caches") return artistFeeTypes;
    return [];
  }

  // Company
  if (counterpartyType === "company") {
    if (transactionType === "expense") {
      switch (category) {
        case "servicos": return expenseServiceTypes;
        case "produtos": return expenseProductTypes;
        case "administrativo": return administrativeExpenseTypes;
        case "marketing": return marketingExpenseTypes;
        case "viagens": return travelExpenseTypes;
        default: return [];
      }
    }

    if (transactionType === "revenue") {
      switch (category) {
        case "receitas-musicais": return musicRevenueTypes;
        case "servicos": return revenueServiceTypes;
        case "produtos": return revenueProductTypes;
        case "receitas-contratuais": return contractualRevenueTypes;
        default: return [];
      }
    }
  }

  // The individual counterparty has specific expense subcategories
  if (counterpartyType === "individual") {
    if (transactionType === "expense") {
      switch (category) {
        case "remuneracao": return individualCompensationTypes;
        case "servicos-pf": return individualServiceTypes;
        case "reembolso": return individualReimbursementTypes;
        default: return [];
      }
    }

    if (transactionType === "revenue") {
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
export const isServiceRequiringArtistAndProject = (subcategory: string): boolean => {
  return expenseServicesRequiringArtistAndProject.includes(subcategory);
};

// Checks whether an expense product requires an event
export const isProductRequiringEvent = (subcategory: string): boolean => {
  return expenseProductsRequiringEvent.includes(subcategory);
};

// Checks whether a music revenue requires artist + project
export const isMusicRevenueRequiringArtistAndProject = (subcategory: string): boolean => {
  return musicRevenueRequiringArtistAndProject.includes(subcategory);
};

// Checks whether a revenue service requires artist + project
export const isRevenueServiceRequiringArtistAndProject = (subcategory: string): boolean => {
  return revenueServicesRequiringArtistAndProject.includes(subcategory);
};

// Checks whether a revenue service requires only the artist
export const isRevenueServiceRequiringArtistOnly = (subcategory: string): boolean => {
  return revenueServicesRequiringArtistOnly.includes(subcategory);
};


// ==================== DISPLAY LABELS (category / subcategory values) ====================

/**
 * Every option list whose `value` can be stored in transactions.category /
 * subcategory by the slug-based taxonomy (historical rows and the visibility
 * rules in financial-form-rules). Each slug has exactly ONE PT-BR label
 * across all lists (guarded by transaction-constants.labels.test.ts).
 */
export const TRANSACTION_CATEGORY_OPTION_LISTS: ReadonlyArray<ReadonlyArray<{ value: string; label: string }>> = [
  companyExpenseCategories, individualExpenseCategories, individualCompensationTypes, individualServiceTypes,
  individualReimbursementTypes, expenseServiceTypes, marketingExpenseTypes, travelExpenseTypes, expenseProductTypes,
  administrativeExpenseTypes, artistExpenseCategories, artistFeeTypes, companyRevenueCategories, musicRevenueTypes,
  revenueServiceTypes, revenueProductTypes, contractualRevenueTypes, artistRevenueCategories, investmentCategories,
  investmentEquipmentItems, investmentInfrastructureItems, investmentTechnologyItems, investmentMarketingItems,
  investmentTrainingItems, taxCategories, transferCategories,
];

/** Top-level category lists (the values a list filter by `category` can match). */
const TOP_LEVEL_CATEGORY_LISTS: ReadonlyArray<ReadonlyArray<{ value: string; label: string }>> = [
  companyExpenseCategories, individualExpenseCategories, artistExpenseCategories, companyRevenueCategories,
  artistRevenueCategories, investmentCategories, taxCategories, transferCategories,
];

/**
 * Stored business data (taxonomy decision pending — canonical map
 * BLK-TRANSACTION-CATEGORY-TAXONOMY); the UI never shows the raw slug.
 */
const CATEGORY_LABEL_BY_SLUG: ReadonlyMap<string, string> = new Map(
  TRANSACTION_CATEGORY_OPTION_LISTS.flatMap((options) => options.map((o) => [o.value, o.label] as const)),
);

/** A slug is lowercase ASCII with `-`/`_`; anything else is display text. */
const SLUG_PATTERN = /^[a-z0-9_-]+$/;

/**
 * PT-BR label of a stored category/subcategory value:
 * - a taxonomy slug → its single form label;
 * - display text written by the category-rule store (transaction form) or by
 *   the server keyword rules (financial_categories.name) → shown as stored,
 *   it already is the PT-BR name the user chose;
 * - a slug outside every list (older import/seed data) → the shared finance
 *   dictionary / humanized fallback (never the raw slug).
 */
export function transactionCategoryLabel(value: string | null | undefined): string {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return "Sem categoria";
  const slugLabel = CATEGORY_LABEL_BY_SLUG.get(text);
  if (slugLabel) return slugLabel;
  if (!SLUG_PATTERN.test(text)) return text;
  // Taxonomy slugs separate words with "-"; the shared dictionary/humanizer keys use "_".
  return formatCategoryLabel(text.replace(/-/g, "_"));
}

/** Suffix that tells a taxonomy slug apart from rule text with the same label. */
export const LEGACY_CATEGORY_SUFFIX = " (classificação anterior)";

/**
 * Category filter options for the transactions list: every value the form and
 * the rules can write —
 * - `ruleCategories`: categories of the category-rule store (what the
 *   transaction form writes) and names of the tenant's financial categories
 *   (what the server keyword rules write);
 * - every top-level taxonomy slug (historical rows, OFX placeholder "outros").
 * The API filters by exact value, so a slug whose label equals a rule
 * category is kept as its own option, marked with LEGACY_CATEGORY_SUFFIX.
 */
export function buildTransactionCategoryFilterOptions(
  ruleCategories: ReadonlyArray<string | null | undefined> = [],
): Array<{ value: string; label: string }> {
  const byValue = new Map<string, string>();
  for (const raw of ruleCategories) {
    const value = typeof raw === "string" ? raw.trim() : "";
    if (value && !byValue.has(value)) byValue.set(value, transactionCategoryLabel(value));
  }
  const ruleLabels = new Set(Array.from(byValue.values()).map((label) => label.toLocaleLowerCase("pt-BR")));
  for (const options of TOP_LEVEL_CATEGORY_LISTS) {
    for (const option of options) {
      if (byValue.has(option.value)) continue;
      const collides = ruleLabels.has(option.label.toLocaleLowerCase("pt-BR"));
      byValue.set(option.value, collides ? `${option.label}${LEGACY_CATEGORY_SUFFIX}` : option.label);
    }
  }
  return Array.from(byValue, ([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
}
