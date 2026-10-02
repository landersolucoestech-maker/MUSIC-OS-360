/**
 * Platform-owned transaction category / subcategory slugs
 * (`transactions.category`, `transactions.subcategory`) — TX1.
 *
 * Canonical machine values are lower snake_case English ids; the PT-BR text is a
 * display label that lives in the web label registry only
 * (apps/web/src/modules/accounting/constants/transaction-constants.ts). The
 * option lists of the web form held kebab-case Portuguese slugs
 * (`receitas-musicais`, `cache-show`, ...); this file is the single API source of
 * the legacy -> canonical map. The web mirror
 * (apps/web/src/modules/accounting/constants/transaction-category-slugs.ts) is
 * kept identical by a parity test.
 *
 * Expand/contract: writes (API service, reports import) are canonical; every
 * reader keeps accepting the legacy spelling, and list/export filters match BOTH
 * spellings (IN-expansion) so rows the backfill (migration 20260930000018) has not
 * reached yet are still found. Matching is EXACT and case-sensitive: free text
 * written by users or by the keyword rules (financial_categories.name, e.g.
 * "Receitas Musicais") is never a slug and is never rewritten.
 *
 * Deliberately NOT mapped (meaning not clear from code or label; left as stored,
 * listed in docs/runbooks/staging-to-production.md#residue-census-20260930000018): `receitas-internas`, `repasse-contrato`.
 * Already-English values (`marketing`, `internet`, `iof`, `iss`, `camera`, ...) are
 * not in the map: they keep their spelling. `external_rights_receipts` is owned by
 * CT1 (common/compat/external-rights-receipts.ts); its legacy phrase is folded in
 * by {@link canonicalTransactionSlug}, its hyphenated seed spelling is mapped here.
 *
 * Removal condition for the legacy side: the preflight census in
 * docs/runbooks/staging-to-production.md#residue-census-20260930000018 returns 0 legacy slugs for one release window.
 * S11 (CHECK on transactions.category) stays blocked until every writer is
 * validated (reports import included) and the residue preflight is 0.
 */
import { canonicalExternalRightsReceipts } from '../../common/compat/external-rights-receipts';

/** legacy slug -> canonical slug (platform-owned, exact match). */
export const LEGACY_TRANSACTION_CATEGORY_SLUGS: Readonly<Record<string, string>> = {
  // ── expense / company + person categories and subcategories ──
  'servicos': 'services',
  'produtos': 'products',
  'administrativo': 'administrative',
  'viagens': 'travel',
  'suporte-financeiro': 'financial_support',
  'remuneracao': 'compensation',
  'servicos-pf': 'individual_services',
  'reembolso': 'reimbursement',
  'salario': 'salary',
  'pro-labore': 'pro_labore',
  'pagamento-diaria': 'daily_rate_payment',
  'hora-extra': 'overtime',
  'comissao': 'commission',
  'bonus-premiacao': 'bonus_award',
  'prestador-autonomo': 'independent_contractor',
  'consultoria': 'consulting',
  'reembolso-transporte': 'transport_reimbursement',
  'reembolso-alimentacao': 'meal_reimbursement',
  'reembolso-hospedagem': 'lodging_reimbursement',
  'reembolso-materiais': 'materials_reimbursement',
  'design-grafico': 'graphic_design',
  'producao-audiovisual': 'audiovisual_production',
  'licenciamento-obras': 'works_licensing',
  'direitos-autorais': 'copyright',
  'fotografia-audiovisual': 'photography_audiovisual',
  'sampling-clearance': 'sampling_clearance',
  'assessoria-juridica': 'legal_advisory',
  'contabil-fiscal': 'accounting_tax',
  'ti-desenvolvimento-saas': 'it_development_saas',
  'marketing-trafego-pr': 'marketing_traffic_pr',
  'anuncios': 'ads',
  'brindes-promocionais': 'promotional_gifts',
  'passagens': 'travel_tickets',
  'hospedagem': 'lodging',
  'alimentacao': 'meals',
  'transporte': 'transport',
  'locacao-equipamentos': 'equipment_rental',
  'equipamentos': 'equipment',
  'cenografia-pirotecnia': 'set_design_pyrotechnics',
  'aluguel': 'rent',
  'agua': 'water',
  'luz': 'electricity',
  'telefonia': 'telephony',
  'correios-logistica': 'postal_logistics',
  'taxas-bancarias': 'bank_fees',
  'impostos': 'taxes',
  'juros': 'interest',
  'multas': 'fines',
  'tarifas-plataformas': 'platform_fees',
  'caches': 'performance_fees',
  'show-evento': 'show_event',
  'publicidade': 'advertising',
  // ── revenue ──
  'receitas-musicais': 'music_revenue',
  'receitas-contratuais': 'contractual_revenue',
  'participacao-show-evento': 'show_event_participation',
  'venda-show-fechado': 'closed_show_sale',
  'direitos-conexos': 'neighboring_rights',
  'external-rights-streaming': 'external_rights_streaming',
  'recebimentos-externos-streaming': 'external_rights_streaming',
  'licenciamento-obra': 'work_licensing',
  'licenciamento-fonograma': 'phonogram_licensing',
  'sincronizacao': 'synchronization',
  'venda-beats': 'beat_sales',
  'producao-musical': 'music_production',
  'marketing-divulgacao': 'marketing_promotion',
  'criacao-site': 'website_creation',
  'gestao-redes-sociais': 'social_media_management',
  'trafego-pago': 'paid_traffic',
  'gravacao-estudio': 'studio_recording',
  'mixagem': 'mixing',
  'masterizacao': 'mastering',
  'sessao-producao': 'production_session',
  'ensaio': 'rehearsal',
  'locacao-estudio': 'studio_rental',
  'venda-merchandising': 'merchandise_sales',
  'venda-produtos-fisicos': 'physical_product_sales',
  'venda-produtos-digitais': 'digital_product_sales',
  'venda-nfts': 'nft_digital_asset_sales',
  'beats-avulsos': 'single_beats',
  'pack-beats': 'beat_packs',
  'sample-packs': 'sample_packs',
  'presets-plugins': 'presets_plugins',
  'fee-administrativo': 'administrative_fee',
  'reembolso-recebido': 'reimbursement_received',
  'multa-contratual': 'contractual_fine',
  'bonus-incentivo': 'bonus_incentive',
  'patrocinio': 'sponsorship',
  'apoio-cultural': 'cultural_support',
  // ── artist revenue ──
  'cache-show': 'show_fee',
  'external-rights-receipts': 'external_rights_receipts', // seed spelling (CT1 owns the id)
  'licenciamento': 'licensing',
  'adiantamento': 'advance',
  'outros': 'other',
  // ── investment ──
  'infraestrutura': 'infrastructure',
  'tecnologia': 'technology',
  'formacao': 'training',
  'microfone': 'microphone',
  'fone-ouvido': 'headphones',
  'mesa-som': 'mixing_console',
  'monitor-referencia': 'reference_monitor',
  'interface-audio': 'audio_interface',
  'instrumento-musical': 'musical_instrument',
  'iluminacao': 'lighting',
  'computador': 'computer',
  'acessorios': 'accessories',
  'reforma-escritorio': 'office_renovation',
  'reforma-estudio': 'studio_renovation',
  'mobiliario': 'furniture',
  'tratamento-acustico': 'acoustic_treatment',
  'ar-condicionado': 'air_conditioning',
  'eletrica': 'electrical_installation',
  'seguranca': 'security',
  'software-daw': 'daw_software',
  'plugins-vst': 'vst_plugins',
  'licenca-software': 'software_license',
  'servicos-cloud': 'cloud_services',
  'armazenamento': 'storage',
  'crm-erp': 'crm_erp',
  'automacao': 'automation',
  'ia': 'ai',
  'redes-sociais': 'social_media',
  'assessoria-imprensa': 'press_relations',
  'material-promocional': 'promotional_material',
  'evento-lancamento': 'launch_event',
  'pesquisa-mercado': 'market_research',
  'fotografia': 'photography',
  'videoclipe': 'music_video',
  'curso-producao': 'production_course',
  'curso-mixagem': 'mixing_mastering_course',
  'curso-gestao': 'management_course',
  'curso-marketing': 'marketing_course',
  'mentoria': 'mentoring',
  'certificacao': 'certification',
  'evento-networking': 'networking_event',
  // ── tax / transfer (statutory acronyms keep their spelling; only `simples-nacional` changes format) ──
  'simples-nacional': 'simples_nacional',
  'entre-contas': 'between_accounts',
  'aplicacao': 'investment_application',
  'resgate': 'investment_redemption',
};

/** Legacy slugs whose meaning is not clear: left as stored (no canonical id), listed in the findings. */
export const UNMAPPED_TRANSACTION_CATEGORY_SLUGS: readonly string[] = ['receitas-internas', 'repasse-contrato'];

/**
 * Taxonomy slugs that were already English (or statutory acronyms) and keep their
 * spelling. Not in the map; listed so the backfill report can tell known values
 * from residue and so the web mirror test can assert the option lists are complete.
 */
export const UNCHANGED_TRANSACTION_CATEGORY_SLUGS: readonly string[] = [
  'marketing', 'internet', 'iof', 'camera', 'streaming', 'branding', 'website', 'workshop',
  'freelancer', 'merchandising', 'irrf', 'inss', 'iss', 'pis', 'cofins', 'csll', 'icms', 'das', 'iptu', 'ipva',
];

/** Distinct canonical ids of the legacy map. */
export const CANONICAL_TRANSACTION_CATEGORY_SLUGS: readonly string[] = Array.from(
  new Set(Object.values(LEGACY_TRANSACTION_CATEGORY_SLUGS)),
).sort();

/** The "no real choice" category: canonical id, and its deprecated spelling still found in stored rows. */
export const UNCATEGORIZED_CATEGORY = 'other';
export const LEGACY_UNCATEGORIZED_CATEGORY = 'outros';

/**
 * Canonical slug for a platform-owned legacy slug (exact, case-sensitive match);
 * the CT1 external-rights phrase is folded in; every other value (free text,
 * canonical ids, unmapped slugs, non-strings) is returned untouched.
 */
export function canonicalTransactionSlug<T>(value: T): T | string {
  if (typeof value !== 'string') return value;
  const folded = canonicalExternalRightsReceipts(value);
  return Object.prototype.hasOwnProperty.call(LEGACY_TRANSACTION_CATEGORY_SLUGS, folded)
    ? LEGACY_TRANSACTION_CATEGORY_SLUGS[folded]
    : folded;
}

/**
 * Every persisted spelling of a category/subcategory value: the canonical id first,
 * then each legacy alias (including the CT1 phrase). `[value]` for any value that
 * is not platform-owned (exact-match filter unchanged).
 */
export function transactionSlugVariants(value: string): string[] {
  const canonical = canonicalTransactionSlug(value) as string;
  const legacy = Object.entries(LEGACY_TRANSACTION_CATEGORY_SLUGS)
    .filter(([, c]) => c === canonical)
    .map(([l]) => l);
  const phrase = canonical === 'external_rights_receipts' ? ['recebimentos externos de direitos'] : [];
  const all = [...legacy, ...phrase];
  if (all.length === 0) return [value];
  return [canonical, ...all];
}

/** True when the stored category is the "uncategorized" placeholder in either spelling. */
export function isUncategorizedCategory(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const v = value.trim().toLowerCase();
  return v === UNCATEGORIZED_CATEGORY || v === LEGACY_UNCATEGORIZED_CATEGORY;
}
