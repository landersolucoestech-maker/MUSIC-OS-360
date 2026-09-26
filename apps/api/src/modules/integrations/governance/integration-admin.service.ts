/**
 * governance/integration-admin.service.ts
 *
 * Administrative CRUD of integration governance (Admin portal → Settings
 * → Integrations). Writes only what is REALLY governance: category, publication
 * and VIEW/USE audience.
 *
 * Deliberately NOT editable here:
 *   - technical capability → it is code (integration-capability.registry.ts)
 *   - tenant connection    → it is the customer's credential (integrations/oauth_connections)
 * Allowing a nonexistent adapter to be "switched on" from a panel would fabricate capability.
 */

import { Injectable, Inject, Optional, NotFoundException, BadRequestException } from '@nestjs/common';
import { IntegrationClassification } from '@music-os-360/types';
import { DataSource, Repository } from 'typeorm';
import { DATA_SOURCE } from '../../../database/database.module';
import {
  PlatformIntegrationEntity,
  IntegrationCategoryEntity,
  BillingPlanEntity,
  type IntegrationAudience,
} from '../../../database/entities';
import {
  technicalCapabilityOf,
  capabilityEvidenceOf,
  IntegrationTechnicalCapability,
} from './integration-capability.registry';

const AUDIENCE_MODES = ['none', 'all', 'plans', 'tenants'] as const;
const PUBLICATION_STATES = ['hidden', 'coming_soon', 'beta', 'available', 'temporarily_unavailable'] as const;
const TECHNICAL_STATES = [
  'planned', 'in_development', 'configuring', 'awaiting_provider',
  'homologating', 'ready', 'degraded', 'disabled', 'retired',
] as const;

export interface AdminIntegrationView {
  id: string;
  providerKey: string;
  name: string;
  categorySlug: string | null;
  categoryName: string | null;
  connectionKind: string;
  requiredEnv: string[];
  publicationState: string;
  technicalState: string;
  classification: string;
  /** Plans that include this slug — read-only here; editing lives in Admin Plans. */
  includedInPlans: string[];
  viewAudience: IntegrationAudience;
  useAudience: IntegrationAudience;
  isCore: boolean;
  notes: string | null;
  /** Read-only — comes from code, not from the database. */
  technicalCapability: IntegrationTechnicalCapability;
  capabilityEvidence: string | null;
  /** Published but without an adapter: the admin must see this contradiction. */
  publishedWithoutCapability: boolean;
}

@Injectable()
export class IntegrationAdminService {
  private readonly platformRepo: Repository<PlatformIntegrationEntity> | null = null;
  private readonly categoryRepo: Repository<IntegrationCategoryEntity> | null = null;
  private readonly planRepo: Repository<BillingPlanEntity> | null = null;

  constructor(@Inject(DATA_SOURCE) @Optional() ds: DataSource | null) {

    if (ds) {
      this.platformRepo = ds.getRepository(PlatformIntegrationEntity);
      this.categoryRepo = ds.getRepository(IntegrationCategoryEntity);
      this.planRepo     = ds.getRepository(BillingPlanEntity);
    }
  }

  private assertRepos(): void {
    if (!this.platformRepo || !this.categoryRepo) {
      throw new BadRequestException('Serviço temporariamente indisponível. Tente novamente em instantes.');
    }
  }


  /** provider_key -> plans that include it (billing_plans.integrations). */
  private async loadPlanIntegrationMap(): Promise<Map<string, string[]>> {
    const map = new Map<string, string[]>();
    if (!this.planRepo) return map;
    try {
      const plans = await this.planRepo.find({ where: { active: true }, order: { amount: 'ASC' } });
      for (const p of plans) {
        for (const slug of Array.isArray(p.integrations) ? p.integrations : []) {
          if (typeof slug !== 'string') continue;
          map.set(slug, [...(map.get(slug) ?? []), p.slug]);
        }
      }
    } catch { /* no readable plans → empty map, never a catalog error */ }
    return map;
  }

  /** Valid commercial slugs — used to validate plan entitlements. */
  async listCommercialSlugs(): Promise<string[]> {
    this.assertRepos();
    const rows = await this.platformRepo!.find();
    return rows
      .filter((r) => r.classification === IntegrationClassification.COMMERCIAL)
      .map((r) => r.provider_key);
  }

  async listCategories(): Promise<IntegrationCategoryEntity[]> {
    this.assertRepos();
    return this.categoryRepo!.find({ order: { display_order: 'ASC' } });
  }

  /**
   * Administrative catalog.
   *
   * By default returns ONLY `commercial`: this screen governs integrations
   * offered to customers, and Soundcharts/ACRCloud/Resend/Stripe stopped
   * being that (the platform owns the credential). They remain in the database —
   * `includeNonCommercial` exists for inspection/auditing, not for the normal
   * commercial flow.
   */
  async list(includeNonCommercial = false): Promise<AdminIntegrationView[]> {
    this.assertRepos();
    const [rows, categories, plans] = await Promise.all([
      this.platformRepo!.find({ order: { name: 'ASC' } }),
      this.categoryRepo!.find(),
      this.loadPlanIntegrationMap(),
    ]);
    const byId = new Map(categories.map((c) => [c.id, c]));
    const visible = includeNonCommercial
      ? rows
      : rows.filter((r) => r.classification === IntegrationClassification.COMMERCIAL);

    return visible.map((row) => {
      const cat = row.category_id ? byId.get(row.category_id) ?? null : null;
      const capability = technicalCapabilityOf(row.provider_key);
      return {
        id: row.id,
        providerKey: row.provider_key,
        name: row.name,
        categorySlug: cat?.slug ?? null,
        categoryName: cat?.name ?? null,
        connectionKind: row.connection_kind,
        requiredEnv: row.required_env ?? [],
        publicationState: row.publication_state,
        technicalState: row.technical_state,
        classification: row.classification,
        includedInPlans: plans.get(row.provider_key) ?? [],
        viewAudience: row.view_audience,
        useAudience: row.use_audience,
        isCore: row.is_core,
        notes: row.notes,
        technicalCapability: capability,
        capabilityEvidence: capabilityEvidenceOf(row.provider_key),
        publishedWithoutCapability:
          row.publication_state === 'published'
          && capability === IntegrationTechnicalCapability.NOT_IMPLEMENTED,
      };
    });
  }

  /**
   * Persists a plan's integration entitlements in
   * `billing_plans.integrations` — the canonical column of the plans table.
   *
   * Silently rejects (filters out) slugs that cannot be an entitlement:
   * nonexistent, internal and billing ones. A commercial entitlement for internal
   * infrastructure must not exist, not even by admin mistake.
   */
  async setPlanIntegrations(planSlug: string, slugs: string[]): Promise<{
    planSlug: string; integrations: string[]; rejected: string[];
  }> {
    if (!this.planRepo) throw new BadRequestException('Persistência de planos indisponível');

    const allowed = new Set(await this.listCommercialSlugs());
    const requested = Array.isArray(slugs) ? slugs.filter((s) => typeof s === 'string') : [];
    const accepted = [...new Set(requested.filter((s) => allowed.has(s)))];
    const rejected = requested.filter((s) => !allowed.has(s));

    const plan = await this.planRepo.findOne({ where: { slug: planSlug } });
    if (!plan) throw new NotFoundException(`Plano não encontrado: ${planSlug}`);

    // Write via the REPOSITORY: the tenant-aware DataSource filters a raw UPDATE on
    // billing_plans (0 rows, no error) — the repo is the path that persists.
    await this.planRepo.update(
      { id: plan.id } as never,
      { integrations: accepted, updated_at: new Date() } as never,
    );

    return { planSlug, integrations: accepted, rejected };
  }

  async getPlanIntegrations(planSlug: string): Promise<string[]> {
    if (!this.planRepo) return [];
    const plan = await this.planRepo.findOne({ where: { slug: planSlug } });
    const list = plan?.integrations;
    return Array.isArray(list) ? list.filter((s): s is string => typeof s === 'string') : [];
  }

  private validateAudience(audience: unknown, field: string): IntegrationAudience {
    const a = audience as Partial<IntegrationAudience> | undefined;
    if (!a || !AUDIENCE_MODES.includes(a.mode as never)) {
      throw new BadRequestException(`${field}.mode inválido — use: ${AUDIENCE_MODES.join(', ')}`);
    }
    return {
      mode: a.mode as IntegrationAudience['mode'],
      plans: Array.isArray(a.plans) ? a.plans.filter((p) => typeof p === 'string') : [],
      tenantIds: Array.isArray(a.tenantIds) ? a.tenantIds.filter((t) => typeof t === 'string') : [],
    };
  }

  async update(id: string, patch: {
    categoryId?: string | null;
    publicationState?: string;
    technicalState?: string;
    viewAudience?: unknown;
    useAudience?: unknown;
    notes?: string | null;
  }): Promise<AdminIntegrationView> {
    this.assertRepos();
    const row = await this.platformRepo!.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Integração não encontrada');

    const updates: Partial<PlatformIntegrationEntity> = {};

    if (patch.publicationState !== undefined) {
      if (!PUBLICATION_STATES.includes(patch.publicationState as never)) {
        throw new BadRequestException(`publicationState inválido — use: ${PUBLICATION_STATES.join(', ')}`);
      }
      updates.publication_state = patch.publicationState as PlatformIntegrationEntity['publication_state'];
    }
    if (patch.technicalState !== undefined) {
      if (!TECHNICAL_STATES.includes(patch.technicalState as never)) {
        throw new BadRequestException(`technicalState inválido — use: ${TECHNICAL_STATES.join(', ')}`);
      }
      updates.technical_state = patch.technicalState;
    }
    if (patch.viewAudience !== undefined) {
      updates.view_audience = this.validateAudience(patch.viewAudience, 'viewAudience');
    }
    if (patch.useAudience !== undefined) {
      updates.use_audience = this.validateAudience(patch.useAudience, 'useAudience');
    }
    if (patch.categoryId !== undefined) {
      if (patch.categoryId) {
        const cat = await this.categoryRepo!.findOne({ where: { id: patch.categoryId } });
        if (!cat) throw new BadRequestException('Categoria inexistente.');
      }
      updates.category_id = patch.categoryId;
    }
    if (patch.notes !== undefined) updates.notes = patch.notes;

    if (Object.keys(updates).length > 0) {
      await this.platformRepo!.update({ id } as never, { ...updates, updated_at: new Date() } as never);
    }

    const refreshed = (await this.list()).find((r) => r.id === id);
    if (!refreshed) throw new NotFoundException('Integração não encontrada após atualização');
    return refreshed;
  }
}
