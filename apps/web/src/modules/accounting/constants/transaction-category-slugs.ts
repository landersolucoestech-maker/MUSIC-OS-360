/**
 * Platform-owned transaction category / subcategory slugs — web mirror of
 * apps/api/src/modules/transactions/transaction-category-slugs.ts (TX1). A parity
 * test (transaction-category-slugs.parity.test.ts) keeps the two maps identical.
 *
 * Canonical machine values are lower snake_case English ids; the PT-BR text is a
 * display label only (the label registry in transaction-constants.ts). The API
 * writes canonical ids and keeps reading/filtering the legacy kebab-case
 * Portuguese slugs until migration 20260930000018 has run everywhere, so every
 * web reader treats both spellings as the same category. Matching is exact and
 * case-sensitive: free text (user / keyword-rule category names such as
 * "Receitas Musicais") is never a slug and passes through untouched.
 *
 * `receitas-internas` and `repasse-contrato` map to `internal_revenue` and
 * `contract_pass_through` (backfill 20260930000037); nothing is left unmapped.
 * Removal condition for the legacy side: docs/runbooks/staging-to-production.md#residue-census-20260930000018 (and ...37) census = 0
 * for one release window.
 */
export const LEGACY_TRANSACTION_CATEGORY_SLUGS: Readonly<Record<string, string>> = {
  // ── expense / company + person categories and subcategories ──
  "servicos": "services",
  "produtos": "products",
  "administrativo": "administrative",
  "viagens": "travel",
  "suporte-financeiro": "financial_support",
  "remuneracao": "compensation",
  "servicos-pf": "individual_services",
  "reembolso": "reimbursement",
  "salario": "salary",
  "pro-labore": "pro_labore",
  "pagamento-diaria": "daily_rate_payment",
  "hora-extra": "overtime",
  "comissao": "commission",
  "bonus-premiacao": "bonus_award",
  "prestador-autonomo": "independent_contractor",
  "consultoria": "consulting",
  "reembolso-transporte": "transport_reimbursement",
  "reembolso-alimentacao": "meal_reimbursement",
  "reembolso-hospedagem": "lodging_reimbursement",
  "reembolso-materiais": "materials_reimbursement",
  "design-grafico": "graphic_design",
  "producao-audiovisual": "audiovisual_production",
  "licenciamento-obras": "works_licensing",
  "direitos-autorais": "copyright",
  "fotografia-audiovisual": "photography_audiovisual",
  "sampling-clearance": "sampling_clearance",
  "assessoria-juridica": "legal_advisory",
  "contabil-fiscal": "accounting_tax",
  "ti-desenvolvimento-saas": "it_development_saas",
  "marketing-trafego-pr": "marketing_traffic_pr",
  "anuncios": "ads",
  "brindes-promocionais": "promotional_gifts",
  "passagens": "travel_tickets",
  "hospedagem": "lodging",
  "alimentacao": "meals",
  "transporte": "transport",
  "locacao-equipamentos": "equipment_rental",
  "equipamentos": "equipment",
  "cenografia-pirotecnia": "set_design_pyrotechnics",
  "aluguel": "rent",
  "agua": "water",
  "luz": "electricity",
  "telefonia": "telephony",
  "correios-logistica": "postal_logistics",
  "taxas-bancarias": "bank_fees",
  "impostos": "taxes",
  "juros": "interest",
  "multas": "fines",
  "tarifas-plataformas": "platform_fees",
  "caches": "performance_fees",
  "show-evento": "show_event",
  "publicidade": "advertising",
  // ── revenue ──
  "receitas-musicais": "music_revenue",
  "receitas-contratuais": "contractual_revenue",
  "receitas-internas": "internal_revenue",
  "repasse-contrato": "contract_pass_through",
  "participacao-show-evento": "show_event_participation",
  "venda-show-fechado": "closed_show_sale",
  "direitos-conexos": "neighboring_rights",
  "external-rights-streaming": "external_rights_streaming",
  "recebimentos-externos-streaming": "external_rights_streaming",
  "licenciamento-obra": "work_licensing",
  "licenciamento-fonograma": "phonogram_licensing",
  "sincronizacao": "synchronization",
  "venda-beats": "beat_sales",
  "producao-musical": "music_production",
  "marketing-divulgacao": "marketing_promotion",
  "criacao-site": "website_creation",
  "gestao-redes-sociais": "social_media_management",
  "trafego-pago": "paid_traffic",
  "gravacao-estudio": "studio_recording",
  "mixagem": "mixing",
  "masterizacao": "mastering",
  "sessao-producao": "production_session",
  "ensaio": "rehearsal",
  "locacao-estudio": "studio_rental",
  "venda-merchandising": "merchandise_sales",
  "venda-produtos-fisicos": "physical_product_sales",
  "venda-produtos-digitais": "digital_product_sales",
  "venda-nfts": "nft_digital_asset_sales",
  "beats-avulsos": "single_beats",
  "pack-beats": "beat_packs",
  "sample-packs": "sample_packs",
  "presets-plugins": "presets_plugins",
  "fee-administrativo": "administrative_fee",
  "reembolso-recebido": "reimbursement_received",
  "multa-contratual": "contractual_fine",
  "bonus-incentivo": "bonus_incentive",
  "patrocinio": "sponsorship",
  "apoio-cultural": "cultural_support",
  // ── artist revenue ──
  "cache-show": "show_fee",
  "external-rights-receipts": "external_rights_receipts", // seed spelling (CT1 owns the id)
  "licenciamento": "licensing",
  "adiantamento": "advance",
  "outros": "other",
  // ── investment ──
  "infraestrutura": "infrastructure",
  "tecnologia": "technology",
  "formacao": "training",
  "microfone": "microphone",
  "fone-ouvido": "headphones",
  "mesa-som": "mixing_console",
  "monitor-referencia": "reference_monitor",
  "interface-audio": "audio_interface",
  "instrumento-musical": "musical_instrument",
  "iluminacao": "lighting",
  "computador": "computer",
  "acessorios": "accessories",
  "reforma-escritorio": "office_renovation",
  "reforma-estudio": "studio_renovation",
  "mobiliario": "furniture",
  "tratamento-acustico": "acoustic_treatment",
  "ar-condicionado": "air_conditioning",
  "eletrica": "electrical_installation",
  "seguranca": "security",
  "software-daw": "daw_software",
  "plugins-vst": "vst_plugins",
  "licenca-software": "software_license",
  "servicos-cloud": "cloud_services",
  "armazenamento": "storage",
  "crm-erp": "crm_erp",
  "automacao": "automation",
  "ia": "ai",
  "redes-sociais": "social_media",
  "assessoria-imprensa": "press_relations",
  "material-promocional": "promotional_material",
  "evento-lancamento": "launch_event",
  "pesquisa-mercado": "market_research",
  "fotografia": "photography",
  "videoclipe": "music_video",
  "curso-producao": "production_course",
  "curso-mixagem": "mixing_mastering_course",
  "curso-gestao": "management_course",
  "curso-marketing": "marketing_course",
  "mentoria": "mentoring",
  "certificacao": "certification",
  "evento-networking": "networking_event",
  // ── tax / transfer (statutory acronyms keep their spelling; only `simples-nacional` changes format) ──
  "simples-nacional": "simples_nacional",
  "entre-contas": "between_accounts",
  "aplicacao": "investment_application",
  "resgate": "investment_redemption",
};

export const UNMAPPED_TRANSACTION_CATEGORY_SLUGS: readonly string[] = [];

/** Slugs that were already English (or statutory acronyms) and keep their spelling. */
export const UNCHANGED_TRANSACTION_CATEGORY_SLUGS: readonly string[] = [
  "marketing", "internet", "iof", "camera", "streaming", "branding", "website", "workshop",
  "freelancer", "merchandising", "irrf", "inss", "iss", "pis", "cofins", "csll", "icms", "das", "iptu", "ipva",
];

/** The "no real choice" category (canonical id) and its deprecated spelling. */
export const UNCATEGORIZED_CATEGORY = "other";
export const LEGACY_UNCATEGORIZED_CATEGORY = "outros";

export const EXTERNAL_RIGHTS_RECEIPTS_CATEGORY = "external_rights_receipts";
export const LEGACY_EXTERNAL_RIGHTS_RECEIPTS_CATEGORY = "recebimentos externos de direitos";

/**
 * Canonical id of a stored/legacy category or subcategory value (exact match);
 * the external-rights phrase is folded in; anything else is returned untouched.
 */
export function canonicalTransactionSlug(value: string): string;
export function canonicalTransactionSlug(value: string | null): string | null;
export function canonicalTransactionSlug(value: string | null | undefined): string | null | undefined;
export function canonicalTransactionSlug(value: string | null | undefined): string | null | undefined {
  if (typeof value !== "string") return value;
  const folded = value === LEGACY_EXTERNAL_RIGHTS_RECEIPTS_CATEGORY ? EXTERNAL_RIGHTS_RECEIPTS_CATEGORY : value;
  return Object.prototype.hasOwnProperty.call(LEGACY_TRANSACTION_CATEGORY_SLUGS, folded)
    ? LEGACY_TRANSACTION_CATEGORY_SLUGS[folded]
    : folded;
}

/** True when two stored values are the same platform category, whichever spelling each uses. */
export function sameTransactionSlug(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  return canonicalTransactionSlug(a) === canonicalTransactionSlug(b);
}
