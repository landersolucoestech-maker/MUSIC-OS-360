
import { formatCategoryLabel } from "@/shared/lib/category-labels";
import {
  EXTERNAL_RIGHTS_RECEIPTS_CATEGORY,
  LEGACY_EXTERNAL_RIGHTS_RECEIPTS_CATEGORY,
  canonicalTransactionSlug,
} from "@/modules/accounting/constants/transaction-category-slugs";
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
 * subcategory option values are the canonical English taxonomy ids
 * (transaction-category-slugs.ts); the PT-BR text of each option is its display label
 * (the label registry below). Rows stored with a legacy slug are read through
 * canonicalTransactionSlug.
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
  { value: "services", label: "Serviços" },
  { value: "products", label: "Produtos" },
  { value: "administrative", label: "Administrativo" },
  { value: "marketing", label: "Marketing" },
  { value: "travel", label: "Viagens" },
  { value: "financial_support", label: "Suporte Financeiro" },
];

// ==================== EXPENSE - PERSON ====================

export const individualExpenseCategories = [
  { value: "compensation", label: "Remuneração" },
  { value: "individual_services", label: "Serviços Pessoa Física" },
  { value: "reimbursement", label: "Reembolso" },
];

// Compensation subcategories (person)
export const individualCompensationTypes = [
  { value: "salary", label: "Salário" },
  { value: "pro_labore", label: "Pró-labore" },
  { value: "daily_rate_payment", label: "Pagamento por diária" },
  { value: "overtime", label: "Hora extra" },
  { value: "commission", label: "Comissão" },
  { value: "bonus_award", label: "Bônus / Premiação" },
];

// Individual (natural person) services subcategories (person)
export const individualServiceTypes = [
  { value: "freelancer", label: "Freelancer" },
  { value: "independent_contractor", label: "Prestador autônomo" },
  { value: "consulting", label: "Consultoria" },
];

// Reimbursement subcategories (Person)
export const individualReimbursementTypes = [
  { value: "transport_reimbursement", label: "Reembolso de transporte" },
  { value: "meal_reimbursement", label: "Reembolso de alimentação" },
  { value: "lodging_reimbursement", label: "Reembolso de hospedagem" },
  { value: "materials_reimbursement", label: "Reembolso de materiais" },
];

// ==================== SERVICES (expense) ====================

export const expenseServiceTypes = [
  { value: "graphic_design", label: "Design gráfico" },
  { value: "audiovisual_production", label: "Produção audiovisual" },
  { value: "works_licensing", label: "Licenciamento de obras" },
  { value: "copyright", label: "Direitos autorais" },
  { value: "photography_audiovisual", label: "Fotografia / Audiovisual" },
  { value: "sampling_clearance", label: "Sampling clearance" },
  { value: "legal_advisory", label: "Assessoria jurídica" },
  { value: "accounting_tax", label: "Contábil / Fiscal" },
  { value: "it_development_saas", label: "TI / Desenvolvimento / SaaS" },
];

// Services that require artist + project (mandatory)
export const expenseServicesRequiringArtistAndProject = [
  "graphic_design",
  "audiovisual_production",
  "works_licensing",
  "copyright",
  "photography_audiovisual",
  "sampling_clearance",
];

// ==================== MARKETING (Expense) ====================

export const marketingExpenseTypes = [
  { value: "marketing_traffic_pr", label: "Marketing / Tráfego / PR" },
  { value: "ads", label: "Anúncios" },
  { value: "promotional_gifts", label: "Brindes promocionais" },
];

// Marketing: artist mandatory, project optional

// ==================== TRAVEL (Expense) ====================

export const travelExpenseTypes = [
  { value: "travel_tickets", label: "Passagens" },
  { value: "lodging", label: "Hospedagem" },
  { value: "meals", label: "Alimentação" },
  { value: "transport", label: "Transporte" },
  { value: "equipment_rental", label: "Locação de equipamentos" },
];

// Travel: artist mandatory + travel reason mandatory

// ==================== PRODUCTS (Expense) ====================

export const expenseProductTypes = [
  { value: "equipment", label: "Equipamentos" },
  { value: "merchandising", label: "Merchandising" },
  { value: "set_design_pyrotechnics", label: "Cenografia / Pirotecnia" },
];

// Equipment and merchandising: only the artist is mandatory
// Set design/pyrotechnics: artist mandatory + event/show mandatory
export const expenseProductsRequiringEvent = ["set_design_pyrotechnics"];

// ==================== ADMINISTRATIVE (Expense) ====================

export const administrativeExpenseTypes = [
  { value: "rent", label: "Aluguel" },
  { value: "water", label: "Água" },
  { value: "electricity", label: "Luz" },
  { value: "internet", label: "Internet" },
  { value: "telephony", label: "Telefonia" },
  { value: "postal_logistics", label: "Correios / Logística" },
  { value: "bank_fees", label: "Taxas bancárias" },
  { value: "taxes", label: "Impostos" },
  { value: "interest", label: "Juros" },
  { value: "fines", label: "Multas" },
  { value: "iof", label: "IOF" },
  { value: "platform_fees", label: "Tarifas de plataformas" },
];

// ==================== EXPENSE - ARTIST ====================

export const artistExpenseCategories = [
  { value: "performance_fees", label: "Cachês" },
  { value: "financial_support", label: "Suporte Financeiro" },
];

// Performance fee subcategories (artist)
export const artistFeeTypes = [
  { value: "show_event", label: "Show / Evento" },
  { value: "advertising", label: "Publicidade" },
];

// ==================== REVENUE - COMPANY (the person counterparty uses the same) ====================

export const companyRevenueCategories = [
  { value: "music_revenue", label: "Receitas Musicais" },
  { value: "services", label: "Serviços" },
  { value: "products", label: "Produtos" },
  { value: "contractual_revenue", label: "Receitas Contratuais" },
  { value: "receitas-internas", label: "Receitas Internas" },
];

// Music revenue subcategories
export const musicRevenueTypes = [
  { value: "show_event_participation", label: "Participação em Show/Evento" },
  { value: "closed_show_sale", label: "Venda de Show Fechado" },
  { value: "copyright", label: "Direitos autorais" },
  { value: "neighboring_rights", label: "Direitos Conexos" },
  { value: "external_rights_streaming", label: "Recebimentos externos de streaming" },
  { value: "work_licensing", label: "Licenciamento de Obra" },
  { value: "phonogram_licensing", label: "Licenciamento de Fonograma" },
  { value: "synchronization", label: "Sincronização" },
  { value: "beat_sales", label: "Venda de Beats" },
];

// Music revenues with artist + project
export const musicRevenueRequiringArtistAndProject = [
  "copyright",
  "neighboring_rights",
  "external_rights_streaming",
  "work_licensing",
  "phonogram_licensing",
  "synchronization",
  "beat_sales",
];

// Music revenues with the artist only (no project)
export const musicRevenueRequiringArtistOnly = [
  "show_event_participation",
  "closed_show_sale",
];

// Services subcategories (revenue)
export const revenueServiceTypes = [
  { value: "music_production", label: "Produção Musical" },
  { value: "audiovisual_production", label: "Produção audiovisual" },
  { value: "marketing_promotion", label: "Marketing / Divulgação" },
  { value: "graphic_design", label: "Design gráfico" },
  { value: "website_creation", label: "Criação de Site" },
  { value: "social_media_management", label: "Gestão de Redes Sociais" },
  { value: "paid_traffic", label: "Tráfego Pago" },
  { value: "consulting", label: "Consultoria" },
  { value: "studio_recording", label: "Gravação em Estúdio" },
  { value: "mixing", label: "Mixagem" },
  { value: "mastering", label: "Masterização" },
  { value: "production_session", label: "Sessão de Produção" },
  { value: "rehearsal", label: "Ensaio" },
  { value: "studio_rental", label: "Locação de Estúdio" },
  { value: "equipment_rental", label: "Locação de equipamentos" },
];

// Services (revenue) with artist + project
export const revenueServicesRequiringArtistAndProject = [
  "music_production",
  "audiovisual_production",
  "marketing_promotion",
  "graphic_design",
  "paid_traffic",
  "studio_recording",
  "mixing",
  "mastering",
  "production_session",
];

// Services (revenue) with the artist only (no mandatory project)
export const revenueServicesRequiringArtistOnly = [
  "website_creation",
  "social_media_management",
  "rehearsal",
];

// Products subcategories (revenue)
export const revenueProductTypes = [
  { value: "merchandise_sales", label: "Venda de Merchandising" },
  { value: "physical_product_sales", label: "Venda de Produtos Físicos" },
  { value: "digital_product_sales", label: "Venda de Produtos Digitais" },
  { value: "nft_digital_asset_sales", label: "Venda de NFTs / Ativos Digitais" },
  { value: "single_beats", label: "Beats Avulsos" },
  { value: "beat_packs", label: "Pack de Beats" },
  { value: "sample_packs", label: "Sample Packs" },
  { value: "presets_plugins", label: "Presets / Plugins" },
];

// Contractual revenue subcategories
export const contractualRevenueTypes = [
  { value: "repasse-contrato", label: "Repasse de Contrato" },
  { value: "commission", label: "Comissão" },
  { value: "administrative_fee", label: "Fee Administrativo" },
  { value: "reimbursement_received", label: "Reembolso Recebido" },
  { value: "contractual_fine", label: "Multa Contratual" },
  { value: "bonus_incentive", label: "Bônus / Incentivo" },
  { value: "sponsorship", label: "Patrocínio" },
  { value: "cultural_support", label: "Apoio Cultural / Incentivo Fiscal" },
];

// ==================== REVENUE - ARTIST ====================

/**
 * Canonical id of the artist-revenue category (API migration 20260930000017). Rows written
 * before the backfill hold the legacy phrase: read them through
 * `canonicalTransactionCategory`. The web only writes the canonical id.
 */
export { EXTERNAL_RIGHTS_RECEIPTS_CATEGORY, LEGACY_EXTERNAL_RIGHTS_RECEIPTS_CATEGORY };

/**
 * Canonical id of a stored category or subcategory: the external-rights phrase and
 * every legacy Portuguese taxonomy slug (TX1, migration 20260930000018) map to the
 * canonical English id; anything else (canonical ids, free text) is returned untouched.
 */
export function canonicalTransactionCategory(value: string): string {
  return canonicalTransactionSlug(value);
}

export const artistRevenueCategories = [
  { value: "show_fee", label: "Cachê de show" },
  { value: EXTERNAL_RIGHTS_RECEIPTS_CATEGORY, label: "Recebimentos externos de direitos" },
  { value: "copyright", label: "Direitos autorais" },
  { value: "licensing", label: "Licenciamento" },
  { value: "advance", label: "Adiantamento" },
  { value: "other", label: "Outros" },
];

// ==================== INVESTMENT ====================

export const investmentCategories = [
  { value: "equipment", label: "Equipamentos" },
  { value: "infrastructure", label: "Infraestrutura" },
  { value: "technology", label: "Tecnologia" },
  { value: "marketing", label: "Marketing" },
  { value: "training", label: "Formação / Capacitação" },
];

// Items per Investment category
export const investmentEquipmentItems = [
  { value: "microphone", label: "Microfone" },
  { value: "headphones", label: "Fone de ouvido" },
  { value: "mixing_console", label: "Mesa de som" },
  { value: "reference_monitor", label: "Monitor de referência" },
  { value: "audio_interface", label: "Interface de áudio" },
  { value: "musical_instrument", label: "Instrumento musical" },
  { value: "camera", label: "Câmera" },
  { value: "lighting", label: "Iluminação" },
  { value: "computer", label: "Computador / Notebook" },
  { value: "accessories", label: "Acessórios" },
  { value: "other", label: "Outros" },
];

export const investmentInfrastructureItems = [
  { value: "office_renovation", label: "Reforma de escritório" },
  { value: "studio_renovation", label: "Reforma de estúdio" },
  { value: "furniture", label: "Mobiliário" },
  { value: "acoustic_treatment", label: "Tratamento acústico" },
  { value: "air_conditioning", label: "Ar condicionado" },
  { value: "electrical_installation", label: "Instalação elétrica" },
  { value: "internet", label: "Internet" },
  { value: "security", label: "Segurança" },
  { value: "other", label: "Outros" },
];

export const investmentTechnologyItems = [
  { value: "daw_software", label: "Software DAW" },
  { value: "vst_plugins", label: "Plugins / VST" },
  { value: "software_license", label: "Licença de software" },
  { value: "cloud_services", label: "Serviços de cloud" },
  { value: "streaming", label: "Plataforma de streaming" },
  { value: "storage", label: "Armazenamento" },
  { value: "crm_erp", label: "CRM / ERP" },
  { value: "automation", label: "Automação" },
  { value: "ai", label: "Inteligência Artificial" },
  { value: "other", label: "Outros" },
];

export const investmentMarketingItems = [
  { value: "branding", label: "Branding" },
  { value: "website", label: "Site" },
  { value: "social_media", label: "Redes sociais" },
  { value: "press_relations", label: "Assessoria de imprensa" },
  { value: "promotional_material", label: "Material promocional" },
  { value: "launch_event", label: "Evento de lançamento" },
  { value: "market_research", label: "Pesquisa de mercado" },
  { value: "photography", label: "Fotografia" },
  { value: "music_video", label: "Videoclipe" },
  { value: "other", label: "Outros" },
];

export const investmentTrainingItems = [
  { value: "production_course", label: "Curso de produção musical" },
  { value: "mixing_mastering_course", label: "Curso de mixagem / masterização" },
  { value: "management_course", label: "Curso de gestão" },
  { value: "marketing_course", label: "Curso de marketing" },
  { value: "workshop", label: "Workshop" },
  { value: "mentoring", label: "Mentoria" },
  { value: "certification", label: "Certificação" },
  { value: "networking_event", label: "Evento / Networking" },
  { value: "other", label: "Outros" },
];

export const getInvestmentItemsByCategory = (category: string): { value: string; label: string }[] => {
  switch (canonicalTransactionSlug(category)) {
    case "equipment": return investmentEquipmentItems;
    case "infrastructure": return investmentInfrastructureItems;
    case "technology": return investmentTechnologyItems;
    case "marketing": return investmentMarketingItems;
    case "training": return investmentTrainingItems;
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
  { value: "simples_nacional", label: "Simples Nacional" },
  { value: "das", label: "DAS" },
  { value: "iptu", label: "IPTU" },
  { value: "ipva", label: "IPVA" },
  { value: "other", label: "Outros" },
];

// ==================== TRANSFER ====================

export const transferCategories = [
  { value: "between_accounts", label: "Entre contas" },
  { value: "investment_application", label: "Aplicação" },
  { value: "investment_redemption", label: "Resgate" },
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
  rawCategory: string
): { value: string; label: string }[] => {
  const category = canonicalTransactionSlug(rawCategory);
  // Artist + Expense
  if (counterpartyType === "artist" && transactionType === "expense") {
    if (category === "performance_fees") return artistFeeTypes;
    return [];
  }

  // Company
  if (counterpartyType === "company") {
    if (transactionType === "expense") {
      switch (category) {
        case "services": return expenseServiceTypes;
        case "products": return expenseProductTypes;
        case "administrative": return administrativeExpenseTypes;
        case "marketing": return marketingExpenseTypes;
        case "travel": return travelExpenseTypes;
        default: return [];
      }
    }

    if (transactionType === "revenue") {
      switch (category) {
        case "music_revenue": return musicRevenueTypes;
        case "services": return revenueServiceTypes;
        case "products": return revenueProductTypes;
        case "contractual_revenue": return contractualRevenueTypes;
        default: return [];
      }
    }
  }

  // The individual counterparty has specific expense subcategories
  if (counterpartyType === "individual") {
    if (transactionType === "expense") {
      switch (category) {
        case "compensation": return individualCompensationTypes;
        case "individual_services": return individualServiceTypes;
        case "reimbursement": return individualReimbursementTypes;
        default: return [];
      }
    }

    if (transactionType === "revenue") {
      switch (category) {
        case "music_revenue": return musicRevenueTypes;
        case "services": return revenueServiceTypes;
        case "products": return revenueProductTypes;
        case "contractual_revenue": return contractualRevenueTypes;
        default: return [];
      }
    }
  }

  return [];
};


// ==================== BUSINESS RULES - CHECKERS ====================

// Checks whether an expense service requires artist + project
export const isServiceRequiringArtistAndProject = (subcategory: string): boolean => {
  return expenseServicesRequiringArtistAndProject.includes(canonicalTransactionSlug(subcategory));
};

// Checks whether an expense product requires an event
export const isProductRequiringEvent = (subcategory: string): boolean => {
  return expenseProductsRequiringEvent.includes(canonicalTransactionSlug(subcategory));
};

// Checks whether a music revenue requires artist + project
export const isMusicRevenueRequiringArtistAndProject = (subcategory: string): boolean => {
  return musicRevenueRequiringArtistAndProject.includes(canonicalTransactionSlug(subcategory));
};

// Checks whether a revenue service requires artist + project
export const isRevenueServiceRequiringArtistAndProject = (subcategory: string): boolean => {
  return revenueServicesRequiringArtistAndProject.includes(canonicalTransactionSlug(subcategory));
};

// Checks whether a revenue service requires only the artist
export const isRevenueServiceRequiringArtistOnly = (subcategory: string): boolean => {
  return revenueServicesRequiringArtistOnly.includes(canonicalTransactionSlug(subcategory));
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
 * PT-BR label registry of the platform taxonomy: canonical English id -> display
 * label (the text users always saw). Legacy slugs are canonicalized before the
 * lookup (transactionCategoryLabel); the UI never shows the raw slug.
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
  const slugLabel = CATEGORY_LABEL_BY_SLUG.get(canonicalTransactionCategory(text));
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
 * - every top-level taxonomy slug (historical rows, OFX placeholder "other").
 * The API filters by exact value and expands a platform slug to every persisted
 * spelling (canonical + legacy), so the option value is the canonical id. A slug whose label equals a rule
 * category is kept as its own option, marked with LEGACY_CATEGORY_SUFFIX.
 */
export function buildTransactionCategoryFilterOptions(
  ruleCategories: ReadonlyArray<string | null | undefined> = [],
): Array<{ value: string; label: string }> {
  const byValue = new Map<string, string>();
  for (const raw of ruleCategories) {
    const value = typeof raw === "string" ? canonicalTransactionCategory(raw.trim()) : "";
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
