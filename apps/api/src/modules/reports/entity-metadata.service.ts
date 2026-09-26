/**
 * modules/reports/entity-metadata.service.ts
 *
 * PHASE 1 — REAL scan of the TypeORM entities (no dependency on the frontend and no
 * database connection required). Reads the decorator metadata via
 * `getMetadataArgsStorage()` for the entities registered in `ALL_ENTITIES`
 * (the DataSource's source of truth), classifies each one explicitly and exposes
 * a reliable technical inventory.
 *
 * Does NOT implement import/export. Does NOT use fake data. Does NOT use a frontend hook.
 */
import { Injectable } from '@nestjs/common';
import { getMetadataArgsStorage } from 'typeorm';
import { ALL_ENTITIES } from '../../database/entities';
import { getReportableMetadata } from './reportable.decorator';
import { tryGetFieldLabelPtBr } from './i18n/field-labels.pt-br';
import { resolveEntityLabel } from './i18n/entity-labels.pt-br';
import {
  ACCOUNTING_SUMMARY_TABLE_NAME,
  REPORT_MODULE_REGISTRY_BY_TABLE,
  REPORT_MODULE_TABLE_NAMES,
} from './report-module-registry';
import {
  EntityCategory,
  type ColumnMeta,
  type EntityReport,
  type EntitiesInventory,
  type RelationMeta,
} from './entity-metadata.types';

// ─── Central, explicit and exhaustive classification (117 tables) ─────────────────
// Any table missing here falls into UNKNOWN → the test fails (on purpose).
//
// Part 89 — the REPORTABLE category is no longer assigned here per table: it
// is derived exclusively from presence in REPORT_MODULE_REGISTRY (closed
// registry, see report-module-registry.ts). The tables listed below as
// NOT_REPORTABLE are the ones NOT present in the authorized registry — this includes
// both technical noise and real entities still without an explicit contract/authorization
// to appear in Reports.
const ENTITY_CATEGORY: Record<string, EntityCategory> = {
  // ── Operational, NOT reportable (outside the closed Reports registry) ──────
  // Part 87: "pipelines" (PipelineEntity) may never appear in the Reports
  // Center (not in export, import or the entity inventory) —
  // it keeps existing normally in its own module, outside Reports.
  // ("forms" removed — DropGenericFormsModule20260822000005.)
  pipelines: EntityCategory.NOT_REPORTABLE,
  // Part 89 — not part of the list of 22 modules authorized by the
  // user. They keep existing normally in their own modules.
  contract_templates: EntityCategory.NOT_REPORTABLE,
  contract_service_types: EntityCategory.NOT_REPORTABLE,
  lead_interactions: EntityCategory.NOT_REPORTABLE,
  campaigns: EntityCategory.NOT_REPORTABLE,
  support_tickets: EntityCategory.NOT_REPORTABLE,
  ecad_reports: EntityCategory.NOT_REPORTABLE,
  conversations: EntityCategory.NOT_REPORTABLE,
  internal_conversations: EntityCategory.NOT_REPORTABLE,
  internal_conversation_participants: EntityCategory.NOT_REPORTABLE,
  internal_messages: EntityCategory.NOT_REPORTABLE,
  financial_categories: EntityCategory.NOT_REPORTABLE,
  financial_rules: EntityCategory.NOT_REPORTABLE,
  payroll_entries: EntityCategory.NOT_REPORTABLE,
  leave_requests: EntityCategory.NOT_REPORTABLE,
  artist_goals: EntityCategory.NOT_REPORTABLE,
  assets: EntityCategory.NOT_REPORTABLE,
  rights_holders: EntityCategory.NOT_REPORTABLE,
  marketing_projects: EntityCategory.NOT_REPORTABLE,
  marketing_strategies: EntityCategory.NOT_REPORTABLE,
  marketing_assets: EntityCategory.NOT_REPORTABLE,
  audiovisual_briefings: EntityCategory.NOT_REPORTABLE,
  // operational_tasks: no controller, no DTO, no Create/Edit screen —
  // written only by internal automatic workflows (see Block 26). "Tarefas"
  // in the registry points to marketing_tasks, the real screen. Outside the registry.
  operational_tasks: EntityCategory.NOT_REPORTABLE,
  audiovisual_tasks: EntityCategory.NOT_REPORTABLE,
  audiovisual_assets: EntityCategory.NOT_REPORTABLE,
  audiovisual_deliverables: EntityCategory.NOT_REPORTABLE,
  pipeline_opportunities: EntityCategory.NOT_REPORTABLE,
  society_submissions: EntityCategory.NOT_REPORTABLE,
  society_accounts: EntityCategory.NOT_REPORTABLE,
  // work_participants: normalized authorship relation of works (migration
  // 20260718000011) — reportable separately, like shares/rights_holders.
  work_participants: EntityCategory.NOT_REPORTABLE,
  // client_attachments: attachment metadata (Part 80) — sub-entity of
  // clients, same pattern as work_participants/project_tracks.
  client_attachments: EntityCategory.NOT_REPORTABLE,
  // project_tracks/project_track_participants: normalized relation of
  // projects' musicas[] (migration 20260718000013) — reportable
  // separately, same pattern as work_participants.
  project_tracks: EntityCategory.NOT_REPORTABLE,
  project_track_participants: EntityCategory.NOT_REPORTABLE,
  notifications: EntityCategory.NOT_REPORTABLE,
  uploads: EntityCategory.NOT_REPORTABLE,
  form_submissions: EntityCategory.NOT_REPORTABLE,
  conversation_messages: EntityCategory.NOT_REPORTABLE,
  conversation_notes: EntityCategory.NOT_REPORTABLE,
  asset_versions: EntityCategory.NOT_REPORTABLE,
  campaign_tasks: EntityCategory.NOT_REPORTABLE,
  campaign_assets: EntityCategory.NOT_REPORTABLE,
  financial_category_centers: EntityCategory.NOT_REPORTABLE,
  financial_category_rules: EntityCategory.NOT_REPORTABLE,
  finance_category_keyword_rules: EntityCategory.NOT_REPORTABLE,
  financial_category_favorites: EntityCategory.NOT_REPORTABLE,
  marketing_strategy_objectives: EntityCategory.NOT_REPORTABLE,
  marketing_strategy_initiatives: EntityCategory.NOT_REPORTABLE,
  marketing_strategy_actions: EntityCategory.NOT_REPORTABLE,
  marketing_asset_versions: EntityCategory.NOT_REPORTABLE,
  marketing_asset_approvals: EntityCategory.NOT_REPORTABLE,
  audiovisual_approvals: EntityCategory.NOT_REPORTABLE,
  audiovisual_shots: EntityCategory.NOT_REPORTABLE,
  audiovisual_production_days: EntityCategory.NOT_REPORTABLE,
  audiovisual_team_members: EntityCategory.NOT_REPORTABLE,
  pipeline_stages: EntityCategory.NOT_REPORTABLE,
  external_identifiers: EntityCategory.NOT_REPORTABLE,
  integrations: EntityCategory.NOT_REPORTABLE,

  // ── Join (N:N) ───────────────────────────────────────────────────────────────
  role_permissions: EntityCategory.JUNCTION,
  role_template_permissions: EntityCategory.JUNCTION,
  role_inheritance: EntityCategory.JUNCTION,
  permission_dependencies: EntityCategory.JUNCTION,
  permission_conflicts: EntityCategory.JUNCTION,
  membership_job_functions: EntityCategory.JUNCTION,
  project_assets: EntityCategory.JUNCTION,
  task_assets: EntityCategory.JUNCTION,
  financial_category_links: EntityCategory.JUNCTION,

  // ── Security / RBAC / auth / audit ──────────────────────────────────────────
  auth: EntityCategory.SECURITY,
  users: EntityCategory.SECURITY,
  permissions: EntityCategory.SECURITY,
  permission_groups: EntityCategory.SECURITY,
  permission_aliases: EntityCategory.SECURITY,
  role_templates: EntityCategory.SECURITY,
  roles: EntityCategory.SECURITY,
  org_members: EntityCategory.SECURITY,
  oauth_connections: EntityCategory.SECURITY,
  departments: EntityCategory.SECURITY,
  positions: EntityCategory.SECURITY,
  job_functions: EntityCategory.SECURITY,
  audit_logs: EntityCategory.SECURITY,
  financial_category_audit_logs: EntityCategory.SECURITY,

  // ── Billing ─────────────────────────────────────────────────────────────────
  billing: EntityCategory.BILLING,
  billing_plans: EntityCategory.BILLING,
  billing_settings: EntityCategory.BILLING,
  billing_subscriptions: EntityCategory.BILLING,
  payment_events: EntityCategory.BILLING,
  tenant_billing_state: EntityCategory.BILLING,

  // ── Infra interna de IA ───────────────────────────────────────────────────
  ai: EntityCategory.AI_INTERNAL,
  ai_jobs: EntityCategory.AI_INTERNAL,
  ai_usage_logs: EntityCategory.AI_INTERNAL,
  skill_runs: EntityCategory.AI_INTERNAL,
  skill_run_logs: EntityCategory.AI_INTERNAL,

  // ── Infraestrutura (logs, eventos, jobs, org/tenant, sync) ────────────────
  activity_logs: EntityCategory.INFRA,
  notification_settings: EntityCategory.INFRA,
  artist_platform_profiles: EntityCategory.INFRA,
  artist_metric_snapshots: EntityCategory.INFRA,
  career_stage_snapshots: EntityCategory.INFRA,
  market_benchmark_snapshots: EntityCategory.INFRA,
  market_reference_metrics: EntityCategory.INFRA,
  asset_usage_logs: EntityCategory.INFRA,
  domain_event_log: EntityCategory.INFRA,
  health: EntityCategory.INFRA,
  // Integration governance (migration 20260823000001): GLOBAL platform
  // config, no tenant_id and no business data — not reportable.
  integration_categories: EntityCategory.INFRA,
  platform_integrations: EntityCategory.INFRA,
  hr: EntityCategory.INFRA,
  organizations: EntityCategory.INFRA,
  tenants: EntityCategory.INFRA,
  webhook_events: EntityCategory.INFRA,
  workflow_transitions: EntityCategory.INFRA,
  workflow_executions: EntityCategory.INFRA,
  workflow_execution_logs: EntityCategory.INFRA,
  financial_category_rule_runs: EntityCategory.INFRA,
  musicchat_automation_events: EntityCategory.INFRA,
  musicchat_automation_notifications: EntityCategory.INFRA,
  musicchat_automation_settings: EntityCategory.INFRA,
  society_payload_snapshots: EntityCategory.INFRA,
  society_submission_events: EntityCategory.INFRA,
  society_sync_jobs: EntityCategory.INFRA,
  society_validation_errors: EntityCategory.INFRA,
};

const IDENTITY_COLUMN_NAMES = new Set([
  'name', 'nome', 'nome_artistico', 'nome_civil', 'nome_fantasia', 'trade_name',
  'individual_name', 'razao_social',
  'title', 'title', 'numero', 'codigo', 'code', 'slug', 'email', 'label',
  'assunto', 'descricao', 'description', 'referencia', 'ref',
  // Part 89 — identity columns of the new modules in the closed registry.
  'titulo_detectado', 'nome_musica', 'music_title',
]);

/**
 * Synthetic "columns" of the Contabilidade report (computed report — P&L per
 * artist aggregated over `transactions`). They do not exist physically; they only
 * give the central contract (form-contracts) consistent backing for
 * the guard test, and tell the export engine the final XLSX shape.
 */
const ACCOUNTING_SUMMARY_COLUMNS: ColumnMeta[] = [
  { name: 'artista', label: 'Artista', type: 'varchar', nullable: false, hasDefault: false, primary: false, generated: false, isEnum: false, isCreatedAt: false, isUpdatedAt: false, isDeletedAt: false, isTenantId: false },
  { name: 'receitas', label: 'Receitas', type: 'numeric', nullable: false, hasDefault: false, primary: false, generated: false, isEnum: false, isCreatedAt: false, isUpdatedAt: false, isDeletedAt: false, isTenantId: false },
  { name: 'despesas', label: 'Despesas', type: 'numeric', nullable: false, hasDefault: false, primary: false, generated: false, isEnum: false, isCreatedAt: false, isUpdatedAt: false, isDeletedAt: false, isTenantId: false },
  { name: 'resultado', label: 'Resultado', type: 'numeric', nullable: false, hasDefault: false, primary: false, generated: false, isEnum: false, isCreatedAt: false, isUpdatedAt: false, isDeletedAt: false, isTenantId: false },
  { name: 'margem', label: 'Margem (%)', type: 'numeric', nullable: false, hasDefault: false, primary: false, generated: false, isEnum: false, isCreatedAt: false, isUpdatedAt: false, isDeletedAt: false, isTenantId: false },
  // Not exported (outside ACCOUNTING_SUMMARY_CONTRACT.fields) — exists only
  // so dateColumn has a valid physical column for the sort fallback.
  { name: 'created_at', label: null, type: 'timestamp', nullable: false, hasDefault: true, primary: false, generated: false, isEnum: false, isCreatedAt: true, isUpdatedAt: false, isDeletedAt: false, isTenantId: false },
];

function isOwnedBy(cls: unknown, target: unknown): boolean {
  if (target === cls) return true;
  if (typeof target === 'function' && typeof cls === 'function') {
    return (cls as { prototype: object }).prototype instanceof (target as { new (): object });
  }
  return false;
}

function typeToString(type: unknown, mode: string): string {
  if (mode === 'createDate' || mode === 'updateDate' || mode === 'deleteDate') return 'timestamp';
  if (typeof type === 'function') return (type as { name?: string }).name ?? 'unknown';
  if (typeof type === 'string') return type;
  return 'unknown';
}

@Injectable()
export class EntityMetadataService {
  /** Scans every registered entity and returns the classified inventory. */
  scan(): EntitiesInventory {
    const storage = getMetadataArgsStorage();
    const entities: EntityReport[] = [];

    for (const cls of ALL_ENTITIES as unknown[]) {
      const tableArgs = storage.tables.find((t) => t.target === cls);
      if (!tableArgs) continue; // not an @Entity (defensive)
      const tableName = tableArgs.name ?? '';

      const columnArgs = storage.columns.filter((c) => isOwnedBy(cls, c.target));
      const generated = new Set(
        storage.generations.filter((g) => isOwnedBy(cls, g.target)).map((g) => g.propertyName),
      );
      const relationArgs = storage.relations.filter((r) => isOwnedBy(cls, r.target));

      const columns: ColumnMeta[] = columnArgs.map((c) => {
        const dbName = c.options.name ?? c.propertyName;
        const mode = String(c.mode ?? 'regular');
        const enumOpt = c.options.enum;
        return {
          name: dbName,
          // EXPLICIT label from the central layer; null when not yet translated
          // (never falls back to humanizeKey — no visual fallback).
          label: tryGetFieldLabelPtBr(dbName),
          type: typeToString(c.options.type, mode),
          nullable: c.options.nullable === true,
          hasDefault: c.options.default !== undefined,
          primary: c.options.primary === true,
          generated: generated.has(c.propertyName) || c.options.generated != null,
          isEnum: enumOpt != null,
          enumValues: Array.isArray(enumOpt) ? enumOpt.map(String) : undefined,
          isCreatedAt: mode === 'createDate' || dbName === 'created_at',
          isUpdatedAt: mode === 'updateDate' || dbName === 'updated_at',
          isDeletedAt: mode === 'deleteDate' || dbName === 'deleted_at',
          isTenantId: dbName === 'tenant_id',
        };
      });

      const relations: RelationMeta[] = relationArgs.map((r) => {
        const t = r.type as unknown;
        let targetName = 'unknown';
        try {
          const resolved = typeof t === 'function' && (t as { prototype?: unknown }).prototype === undefined
            ? (t as () => unknown)()
            : t;
          targetName = typeof resolved === 'function' ? (resolved as { name?: string }).name ?? 'unknown' : String(resolved);
        } catch { /* string/lazy relation — keeps unknown */ }
        return { property: r.propertyName, type: r.relationType, target: targetName };
      });

      const hasTenantId = columns.some((c) => c.isTenantId);
      const hasSoftDelete = columns.some((c) => c.isDeletedAt);
      const hasTimestamps = columns.some((c) => c.isCreatedAt) && columns.some((c) => c.isUpdatedAt);
      const hasIdentifiable = columns.some((c) => IDENTITY_COLUMN_NAMES.has(c.name));

      // Part 89: REPORTABLE is derived exclusively from presence in the
      // closed registry — never from a decorator/override, never from a heuristic.
      const inRegistry = REPORT_MODULE_TABLE_NAMES.has(tableName);
      const override = getReportableMetadata(cls);
      const category = override?.category ?? (inRegistry ? EntityCategory.REPORTABLE : (ENTITY_CATEGORY[tableName] ?? EntityCategory.UNKNOWN));
      const label = inRegistry ? (REPORT_MODULE_REGISTRY_BY_TABLE.get(tableName)?.label ?? resolveEntityLabel(tableName)) : resolveEntityLabel(tableName);

      // "Visible" columns (export candidates) without a pt-BR label — not technical.
      const untranslatedVisible = columns.filter(
        (c) => !c.primary && !c.generated && !c.isTenantId &&
          !c.isCreatedAt && !c.isUpdatedAt && !c.isDeletedAt &&
          !/_id$/.test(c.name) && c.label === null,
      );

      const risks: string[] = [];
      if (category === EntityCategory.UNKNOWN) risks.push('UNCLASSIFIED');
      if (category === EntityCategory.REPORTABLE && label === null) risks.push('UNTRANSLATED_ENTITY');
      if (category === EntityCategory.REPORTABLE && !hasTenantId) risks.push('MISSING_TENANT_ID');
      if (category === EntityCategory.REPORTABLE && !hasIdentifiable) risks.push('NO_IDENTIFIABLE_COLUMN');
      if (columns.length === 0) risks.push('NO_COLUMNS');
      if (category === EntityCategory.REPORTABLE && !hasTimestamps) risks.push('NO_TIMESTAMPS');
      if (category === EntityCategory.REPORTABLE && untranslatedVisible.length > 0) {
        risks.push(`UNTRANSLATED_COLUMNS:${untranslatedVisible.length}`);
      }

      // Actually reportable requires: (1) being in the closed registry (Part 89),
      // (2) tenant_id, (3) an identifiable column (fail-closed). Entities outside
      // the registry are NEVER reportable, even with a REPORTABLE category from
      // some future override — the registry is the only entry point.
      const reportable = inRegistry && hasTenantId && hasIdentifiable;

      entities.push({
        entityName: (cls as { name: string }).name,
        tableName,
        label,
        category,
        reportable,
        columns,
        relations,
        hasTenantId,
        hasSoftDelete,
        hasTimestamps,
        risks,
      });
    }

    // "Contabilidade" (Block 19/Part 89) is a computed report — an aggregation
    // over `transactions`, with no physical table of its own. Injected here (not in
    // ALL_ENTITIES) so it appears identically in getDefinitions() and
    // in the controller's inventory, without forcing a fictitious TypeORM @Entity.
    const accountingEntry = REPORT_MODULE_REGISTRY_BY_TABLE.get(ACCOUNTING_SUMMARY_TABLE_NAME);
    if (accountingEntry) {
      entities.push({
        entityName: 'AccountingSummaryReport',
        tableName: accountingEntry.tableName,
        label: accountingEntry.label,
        category: EntityCategory.REPORTABLE,
        reportable: true,
        columns: ACCOUNTING_SUMMARY_COLUMNS,
        relations: [],
        hasTenantId: true,
        hasSoftDelete: false,
        hasTimestamps: false,
        risks: [],
      });
    }

    // Display order: registry modules in the exact order defined by the
    // user (Blocks 2/31); any entity outside the registry comes afterwards,
    // in alphabetical order (it never appears in Reports, so the order is irrelevant).
    entities.sort((a, b) => {
      const oa = REPORT_MODULE_REGISTRY_BY_TABLE.get(a.tableName)?.order ?? Number.MAX_SAFE_INTEGER;
      const ob = REPORT_MODULE_REGISTRY_BY_TABLE.get(b.tableName)?.order ?? Number.MAX_SAFE_INTEGER;
      if (oa !== ob) return oa - ob;
      return a.tableName.localeCompare(b.tableName);
    });

    const reportableEntities = entities.filter((e) => e.reportable).length;
    const unknownEntities = entities.filter((e) => e.category === EntityCategory.UNKNOWN).length;

    return {
      totalEntities: entities.length,
      reportableEntities,
      nonReportableEntities: entities.length - reportableEntities,
      unknownEntities,
      entities,
    };
  }
}
