export type FinancialTransactionType = "REVENUE" | "EXPENSE" | "INVESTMENT" | "TAX" | "TRANSFER";
export type FinancialCategoryKind = "operational" | "managerial" | "accounting" | "tax" | "internal" | "automation" | "reporting";
export type FinanceRuleTransactionType = "RECEITA" | "DESPESA";
export type FinanceCategoryRuleOrigin = "SISTEMA" | "PERSONALIZADA";

export interface FinancialCategory {
  id: string;
  tenant_id: string;
  parent_id: string | null;
  path: string;
  depth_level: number;
  tree_order: number;
  name: string;
  slug: string;
  code: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  transaction_types: FinancialTransactionType[];
  category_kind: FinancialCategoryKind;
  system_category: boolean;
  protected: boolean;
  active: boolean;
  archived: boolean;
  allow_manual_usage: boolean;
  allow_ai_suggestions: boolean;
  usage_count: number;
  sort_order: number;
  metadata: Record<string, unknown>;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  children_count?: number;
  links_count?: number;
  links?: FinancialCategoryLink[];
  centers?: FinancialCategoryCenterLink[];
  audit?: FinancialCategoryAuditLog[];
}

export interface FinancialCategoryLink {
  id: string;
  category_id: string;
  entity_type: string;
  entity_id: string | null;
  entity_label: string | null;
  relation_role: "payable_to" | "receivable_from" | "vendor" | "customer" | "partner" | "beneficiary";
  metadata: Record<string, unknown>;
}

export interface FinancialCategoryCenterLink {
  id: string;
  category_id: string;
}

export interface FinanceCategoryRule {
  id: string;
  keywords: string[];
  transactionType: FinanceRuleTransactionType;
  categoryId: string;
  categoryName: string;
  origin: FinanceCategoryRuleOrigin;
  priority?: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export type FinanceCategoryRuleDraft = Omit<FinanceCategoryRule, "id" | "origin" | "createdAt" | "updatedAt">;

/** Shape returned by /finance-category-rules (real backend, see apps/api/src/modules/finance-category-rules). */
export interface FinanceCategoryRuleApiResponse {
  id: string;
  keywords: string[];
  transaction_type: FinanceRuleTransactionType;
  category_id: string;
  priority: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface FinancialCategoryAuditLog {
  id: string;
  action: string;
  actor_id: string | null;
  actor_type: string;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  timestamp: string;
}

export interface FinancialCategoryFilters {
  search?: string;
  transaction_type?: FinancialTransactionType | "all";
  category_kind?: FinancialCategoryKind | "all";
  parent_id?: string;
  active?: boolean;
  archived?: boolean;
  favorite?: boolean;
  limit?: number;
  offset?: number;
}
