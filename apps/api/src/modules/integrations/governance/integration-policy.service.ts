/**
 * governance/integration-policy.service.ts
 *
 * POLICY RESOLVER — the final composition:
 *
 *   ADMIN GOVERNANCE (database: publication + VIEW/USE audience)
 * + TECHNICAL CAPABILITY (code: does an adapter exist?)
 * + AUDIENCE POLICY (the customer's plan/tenant)
 * + TENANT CONNECTION (credentials/OAuth — stays SEPARATE)
 * = RESOLVED CLIENT INTEGRATION
 *
 * Each factor is independent and none replaces another:
 *   - publishing does not create technical capability;
 *   - technical capability does not grant audience;
 *   - audience does not connect the tenant;
 *   - being connected does not authorize use if the admin revoked the audience.
 *
 * This is the function the enforcement guard consults — which is why changing
 * governance in the database changes customer behavior WITHOUT a deploy.
 */

import { Injectable, Inject, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, Repository } from 'typeorm';
import { DATA_SOURCE } from '../../../database/database.module';
import {
  IntegrationEntity,
  OAuthConnectionEntity,
  PlatformIntegrationEntity,
  IntegrationCategoryEntity,
  BillingPlanEntity,
  type IntegrationAudience,
} from '../../../database/entities';
import { classifyFailureCode, type ApiErrorCode } from '@music-os-360/types';
import {
  ExternalProviderStatus,
  IntegrationStatus,
  IntegrationClassification,
  IntegrationTechnicalState,
  IntegrationPublicationState,
  IntegrationReasonCode,
  CUSTOMER_FACING_CLASSIFICATIONS,
  OPERATIONAL_TECHNICAL_STATES,
  PLAN_INTEGRATIONS_FEATURE_KEY,
} from '@music-os-360/types';
import {
  IntegrationTechnicalCapability,
  technicalCapabilityOf,
  capabilityEvidenceOf,
} from './integration-capability.registry';

export interface ResolvedIntegration {
  providerKey: string;
  name: string;
  category: string | null;
  connectionKind: PlatformIntegrationEntity['connection_kind'];
  /** Commercial rollout — separate from technical/entitlement/connection. */
  publicationState: IntegrationPublicationState;
  /** Operational state of the adapter — separate from the in-code capability. */
  technicalState: IntegrationTechnicalState;
  /** Architectural classification — commercial / internal / billing. */
  classification: IntegrationClassification;
  /** Does the tenant's plan include this slug (billing_plans.integrations)? */
  entitled: boolean;
  /** Stable code for the frontend to branch on — never human text. */
  reasonCode: IntegrationReasonCode;
  /** Appears in the catalog (may be blocked by plan). */
  canDiscover: boolean;
  /** Can start connection/OAuth — does NOT require being connected. */
  canConnect: boolean;
  technicalCapability: IntegrationTechnicalCapability;
  capabilityEvidence: string | null;
  /** Customer can SEE the integration. */
  canView: boolean;
  /** Customer can USE it (call endpoints). The guard depends on this. */
  canUse: boolean;
  /** Why USE was denied — for honest diagnostics, never for the customer to guess. */
  denyReason: string | null;
  /** Tenant connection — a dimension SEPARATE from authorization. */
  connectionStatus: ExternalProviderStatus;
  missingRequirements: string[];
  lastErrorAt: string | null;
  /** Stable failure class; the raw reason stays in integration metadata (internal). */
  lastErrorCode: ApiErrorCode | null;
}

export interface TenantPolicyContext {
  tenantId: string;
  userId: string;
  /**
   * The tenant's plan. The real column is `tenants.plan` (TenantPlan) — NOT
   * `plan_slug`. Reading the wrong name made `mode:'plans'` deny everyone,
   * silently and fail-closed (reproduced at runtime before this fix).
   */
  planSlug?: string | null;
  /** Per-tenant overrides (`tenants.features`), when already loaded. */
  tenantFeatures?: Record<string, unknown> | null;
}

@Injectable()
export class IntegrationPolicyService {
  private readonly platformRepo: Repository<PlatformIntegrationEntity> | null = null;
  private readonly categoryRepo: Repository<IntegrationCategoryEntity> | null = null;
  private readonly integRepo:    Repository<IntegrationEntity>         | null = null;
  private readonly oauthRepo:    Repository<OAuthConnectionEntity>     | null = null;
  /** Plans — source of the entitlements (billing_plans.integrations). */
  private readonly planRepo: Repository<BillingPlanEntity> | null = null;

  constructor(
    @Inject(DATA_SOURCE) @Optional() ds: DataSource | null,
    private readonly config: ConfigService,
  ) {
    if (ds) {
      this.planRepo = ds.getRepository(BillingPlanEntity);
      this.platformRepo = ds.getRepository(PlatformIntegrationEntity);
      this.categoryRepo = ds.getRepository(IntegrationCategoryEntity);
      this.integRepo    = ds.getRepository(IntegrationEntity);
      this.oauthRepo    = ds.getRepository(OAuthConnectionEntity);
    }
  }

  /** Audience: 'none' denies, 'all' grants, 'plans'/'tenants' match the context. */
  private audienceAllows(audience: IntegrationAudience | null, ctx: TenantPolicyContext): boolean {
    if (!audience) return false;
    switch (audience.mode) {
      case 'all':     return true;
      case 'plans':   return !!ctx.planSlug && (audience.plans ?? []).includes(ctx.planSlug);
      case 'tenants': return (audience.tenantIds ?? []).includes(ctx.tenantId);
      case 'none':
      default:        return false;
    }
  }

  private missingEnv(requiredEnv: string[]): string[] {
    return (requiredEnv ?? []).filter((name) => {
      const value = this.config.get<string>(name);
      return !value || value.trim() === '';
    });
  }

  /**
   * Plans that include a commercial slug — for the upgrade hint. Discovered by
   * query, never hardcoded: no plan name decides access in code.
   */
  async plansIncluding(providerKey: string): Promise<string[]> {
    if (!this.planRepo) return [];
    try {
      const plans = await this.planRepo.find({ where: { active: true }, order: { amount: 'ASC' } });
      return plans
        .filter((p) => Array.isArray(p.integrations) && p.integrations.includes(providerKey))
        .map((p) => p.slug);
    } catch {
      return [];
    }
  }

  /**
   * Commercial slugs enabled for the tenant.
   *
   * Precedence (documented because it is semantics, not accident):
   *   1. `tenants.features.integrations` — explicit per-tenant override, when
   *      present, BEATS the plan (existing override mechanism).
   *   2. `billing_plans.integrations` of the tenant's active plan.
   * A read failure NEVER becomes a grant: it falls back to an empty list (fail-closed).
   */
  private async resolveEntitledSlugs(ctx: TenantPolicyContext): Promise<string[]> {
    const override = (ctx.tenantFeatures ?? null)?.[PLAN_INTEGRATIONS_FEATURE_KEY];
    if (Array.isArray(override)) {
      return override.filter((s): s is string => typeof s === 'string');
    }

    if (!ctx.planSlug || !this.planRepo) return [];
    try {
      const plan = await this.planRepo.findOne({ where: { slug: ctx.planSlug, active: true } });
      const list = plan?.integrations;
      return Array.isArray(list) ? list.filter((s): s is string => typeof s === 'string') : [];
    } catch {
      return [];
    }
  }

  /**
   * Entitlement = the commercial slug is in the plan's dynamic list. Generic
   * structure: a new commercial integration enters a plan with no new schema and
   * no per-provider code.
   */
  private isEntitled(providerKey: string, entitledSlugs: string[]): boolean {
    return entitledSlugs.includes(providerKey);
  }

  async resolveAll(ctx: TenantPolicyContext): Promise<ResolvedIntegration[]> {
    if (!this.platformRepo) return [];

    const [rows, categories] = await Promise.all([
      this.platformRepo.find(),
      this.categoryRepo ? this.categoryRepo.find() : Promise.resolve([] as IntegrationCategoryEntity[]),
    ]);
    if (rows.length === 0) return [];

    const catById = new Map(categories.map((c) => [c.id, c.slug]));
    const keys = rows.map((r) => r.provider_key);

    const [integrations, oauthConns] = await Promise.all([
      this.integRepo
        ? this.integRepo.createQueryBuilder('i')
            .where('i.tenant_id = :tenantId AND i.provider IN (:...keys)', { tenantId: ctx.tenantId, keys })
            .getMany()
        : Promise.resolve([] as IntegrationEntity[]),
      this.oauthRepo
        ? this.oauthRepo.createQueryBuilder('o')
            .where('o.tenant_id = :tenantId AND o.user_id = :userId AND o.provider IN (:...keys)', {
              tenantId: ctx.tenantId, userId: ctx.userId, keys,
            })
            .getMany()
        : Promise.resolve([] as OAuthConnectionEntity[]),
    ]);

    const integByKey = new Map(integrations.map((i) => [i.provider, i]));
    const oauthByKey = new Map(oauthConns.map((o) => [o.provider, o]));
    const features = await this.resolveEntitledSlugs(ctx);

    return rows.map((row) => this.resolveRow(row, catById, integByKey, oauthByKey, ctx, features));
  }

  /** Resolves a single provider — the path used by the enforcement guard. */
  async resolveOne(providerKey: string, ctx: TenantPolicyContext): Promise<ResolvedIntegration | null> {
    if (!this.platformRepo) return null;
    const row = await this.platformRepo.findOne({ where: { provider_key: providerKey } });
    if (!row) return null;

    const categories = this.categoryRepo ? await this.categoryRepo.find() : [];
    const catById = new Map(categories.map((c) => [c.id, c.slug]));

    const integ = this.integRepo
      ? await this.integRepo.createQueryBuilder('i')
          .where('i.tenant_id = :tenantId AND i.provider = :key', { tenantId: ctx.tenantId, key: providerKey })
          .getOne()
      : null;
    const oauth = this.oauthRepo
      ? await this.oauthRepo.createQueryBuilder('o')
          .where('o.tenant_id = :tenantId AND o.user_id = :userId AND o.provider = :key', {
            tenantId: ctx.tenantId, userId: ctx.userId, key: providerKey,
          })
          .getOne()
      : null;

    const features = await this.resolveEntitledSlugs(ctx);
    return this.resolveRow(
      row, catById,
      new Map(integ ? [[providerKey, integ]] : []),
      new Map(oauth ? [[providerKey, oauth]] : []),
      ctx,
      features,
    );
  }

  private resolveRow(
    row: PlatformIntegrationEntity,
    catById: Map<string, string>,
    integByKey: Map<string, IntegrationEntity>,
    oauthByKey: Map<string, OAuthConnectionEntity>,
    ctx: TenantPolicyContext,
    features: string[],
  ): ResolvedIntegration {
    const capability = technicalCapabilityOf(row.provider_key);
    const integ = integByKey.get(row.provider_key) ?? null;
    const oauth = oauthByKey.get(row.provider_key) ?? null;

    // Connection is a SEPARATE dimension and is resolved first only to compose the
    // reason code — never to replace authorization.
    const connectionStatusPre = this.resolveConnectionStatus(row, integ, oauth);

    const classification = (row.classification as IntegrationClassification)
      ?? IntegrationClassification.COMMERCIAL;
    // An internal/billing integration is NEVER a customer integration: the platform
    // holds the credential. It stays out of the commercial catalog even if someone
    // publishes it or opens its audience by mistake.
    const customerFacing = CUSTOMER_FACING_CLASSIFICATIONS.includes(classification);
    const entitled = this.isEntitled(row.provider_key, features);

    const technicalState = (row.technical_state as IntegrationTechnicalState)
      ?? IntegrationTechnicalState.PLANNED;
    const publication = (row.publication_state as IntegrationPublicationState)
      ?? IntegrationPublicationState.HIDDEN;

    // The in-code capability VETOES an optimistic technical_state: marking READY without
    // an adapter in the admin cannot create a real operation.
    const technicalReady =
      OPERATIONAL_TECHNICAL_STATES.includes(technicalState)
      && capability === IntegrationTechnicalCapability.IMPLEMENTED;

    // ── DISCOVER: does it appear in the catalog? (publication + VIEW) ───────────
    // Without entitlement it does NOT disappear — it appears blocked, with an upgrade.
    const viewAllowed = this.audienceAllows(row.view_audience, ctx);
    const canDiscover =
      customerFacing
      && publication !== IntegrationPublicationState.HIDDEN
      && viewAllowed;

    // ── CONNECT: can it start OAuth/save a credential? ──────────────────────────
    // Does NOT require a prior connection (otherwise Connect itself would be impossible).
    const canConnect =
      canDiscover
      && publication !== IntegrationPublicationState.COMING_SOON
      && publication !== IntegrationPublicationState.TEMPORARILY_UNAVAILABLE
      && technicalReady
      && entitled
      && this.audienceAllows(row.use_audience, ctx);

    // ── USE: operate for real. Needs everything above + a valid connection. ────────
    let reasonCode: IntegrationReasonCode;
    if (!customerFacing)                                     reasonCode = IntegrationReasonCode.NOT_CUSTOMER_FACING;
    else if (publication === IntegrationPublicationState.HIDDEN)     reasonCode = IntegrationReasonCode.HIDDEN;
    else if (!viewAllowed)                                   reasonCode = IntegrationReasonCode.AUDIENCE_NOT_ALLOWED;
    else if (publication === IntegrationPublicationState.COMING_SOON) reasonCode = IntegrationReasonCode.COMING_SOON;
    else if (publication === IntegrationPublicationState.TEMPORARILY_UNAVAILABLE)
                                                             reasonCode = IntegrationReasonCode.TEMPORARILY_UNAVAILABLE;
    else if (capability === IntegrationTechnicalCapability.NOT_IMPLEMENTED)
                                                             reasonCode = IntegrationReasonCode.NOT_IMPLEMENTED;
    else if (!technicalReady)                                reasonCode = IntegrationReasonCode.TECHNICAL_NOT_READY;
    // Entitlement is evaluated AFTER visibility: without a plan the integration
    // stays visible and blocked, never hidden.
    else if (!entitled)                                      reasonCode = IntegrationReasonCode.PLAN_NOT_INCLUDED;
    else if (!this.audienceAllows(row.use_audience, ctx))    reasonCode = IntegrationReasonCode.AUDIENCE_NOT_ALLOWED;
    else if (connectionStatusPre === ExternalProviderStatus.REQUIRES_REAUTH)
                                                             reasonCode = IntegrationReasonCode.REQUIRES_REAUTH;
    else if (connectionStatusPre === ExternalProviderStatus.PROVIDER_ERROR)
                                                             reasonCode = IntegrationReasonCode.PROVIDER_ERROR;
    else if (connectionStatusPre !== ExternalProviderStatus.CONNECTED)
                                                             reasonCode = IntegrationReasonCode.NOT_CONNECTED;
    else                                                     reasonCode = IntegrationReasonCode.CONNECTED;

    const canUse = reasonCode === IntegrationReasonCode.CONNECTED;
    const canView = canDiscover;
    const denyReason = canUse ? null : reasonCode;

    const connectionStatus = connectionStatusPre;
    const missingRequirements =
      connectionStatus === ExternalProviderStatus.DEPENDENCY_NOT_MET
        ? this.missingEnv(row.required_env)
        : [];
    const isError = connectionStatus === ExternalProviderStatus.PROVIDER_ERROR;

    return {
      providerKey: row.provider_key,
      name: row.name,
      category: row.category_id ? catById.get(row.category_id) ?? null : null,
      connectionKind: row.connection_kind,
      publicationState: publication,
      technicalState,
      classification,
      entitled,
      reasonCode,
      canDiscover,
      canConnect,
      technicalCapability: capability,
      capabilityEvidence: capabilityEvidenceOf(row.provider_key),
      canView,
      canUse,
      denyReason,
      connectionStatus,
      missingRequirements,
      lastErrorAt:     isError ? ((integ?.metadata?.['last_failure_at'] as string) ?? null) : null,
      lastErrorCode: isError ? classifyFailureCode(integ?.metadata?.['last_failure_reason'], 'INTEGRATION_CALL_FAILED') : null,
    };
  }

  /**
   * Tenant connection — a dimension independent of authorization. A provider can
   * be CONNECTED and still have canUse=false (audience revoked), and that is
   * exactly what keeps the two things separate.
   */
  private resolveConnectionStatus(
    row: PlatformIntegrationEntity,
    integ: IntegrationEntity | null,
    oauth: OAuthConnectionEntity | null,
  ): ExternalProviderStatus {
    if (technicalCapabilityOf(row.provider_key) === IntegrationTechnicalCapability.NOT_IMPLEMENTED) {
      return ExternalProviderStatus.DEPENDENCY_NOT_MET;
    }
    if (this.missingEnv(row.required_env).length > 0) {
      return ExternalProviderStatus.DEPENDENCY_NOT_MET;
    }

    if (row.connection_kind === 'oauth') {
      if (!oauth) return ExternalProviderStatus.AVAILABLE_NOT_CONNECTED;
      if (oauth.metadata?.['needs_reauth'] === true) return ExternalProviderStatus.REQUIRES_REAUTH;
      if (oauth.expires_at && oauth.expires_at.getTime() <= Date.now()) {
        return ExternalProviderStatus.REQUIRES_REAUTH;
      }
      return ExternalProviderStatus.CONNECTED;
    }

    if (row.connection_kind === 'tenant_credentials') {
      if (!integ?.credentials_encrypted) return ExternalProviderStatus.AVAILABLE_NOT_CONNECTED;
      if (integ.status === IntegrationStatus.ERROR || this.hasUnresolvedFailure(integ)) {
        return ExternalProviderStatus.PROVIDER_ERROR;
      }
      return ExternalProviderStatus.CONNECTED;
    }

    if (integ && (integ.status === IntegrationStatus.ERROR || this.hasUnresolvedFailure(integ))) {
      return ExternalProviderStatus.PROVIDER_ERROR;
    }
    return ExternalProviderStatus.CONNECTED;
  }

  /** A failure only counts while there has been no later success — otherwise it gets stuck forever. */
  private hasUnresolvedFailure(integ: IntegrationEntity): boolean {
    const failedAt = integ.metadata?.['last_failure_at'] as string | undefined;
    if (!failedAt) return false;
    const succeededAt = integ.metadata?.['last_success_at'] as string | undefined;
    if (!succeededAt) return true;
    return new Date(failedAt).getTime() > new Date(succeededAt).getTime();
  }
}
