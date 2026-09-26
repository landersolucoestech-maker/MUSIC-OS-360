/**
 * governance/integration-usage.guard.ts
 *
 * BACKEND ENFORCEMENT — the missing requirement.
 *
 * Hiding a card in the frontend is not authorization: whoever calls the API directly
 * (curl, script, stolen token, old cached client) would get through. This guard
 * closes that in the backend, consulting the SAME policy resolver the frontend uses.
 *
 * Usage:
 *   @UseGuards(IntegrationUsageGuard)
 *   @RequiresIntegration('docusign')
 *   createDocument(...) { ... }
 *
 * Fail-closed on every path: unknown provider, missing policy,
 * missing tenant context or unavailable resolver → 403. Never "lets it
 * through because it could not decide".
 */

import {
  CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata, Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IntegrationPolicyService } from './integration-policy.service';

export const REQUIRES_INTEGRATION = 'requires_integration';

/**
 * `use`     — real operation: requires everything, including a valid connection.
 * `connect` — start OAuth/save a credential: requires publication, technical
 *             capability, audience and entitlement, but obviously does NOT require the
 *             account to be already connected (otherwise connecting would be impossible).
 */
export type IntegrationRequirementMode = 'use' | 'connect';

export interface IntegrationRequirement {
  providerKey: string;
  mode: IntegrationRequirementMode;
}

export const RequiresIntegration = (
  providerKey: string,
  mode: IntegrationRequirementMode = 'use',
) => SetMetadata(REQUIRES_INTEGRATION, { providerKey, mode } as IntegrationRequirement);

/** Messages per reason code — honest, without exposing internal governance. */
const DENY_MESSAGE: Record<string, string> = {
  NOT_CUSTOMER_FACING:     'Esta integração não é uma integração de cliente.',
  HIDDEN:                  'Esta integração não está disponível nesta plataforma.',
  COMING_SOON:             'Esta integração ainda não está disponível.',
  TECHNICAL_NOT_READY:     'Esta integração ainda não está operacional.',
  NOT_IMPLEMENTED:         'Esta integração ainda não está implementada.',
  TEMPORARILY_UNAVAILABLE: 'Esta integração está temporariamente indisponível.',
  AUDIENCE_NOT_ALLOWED:    'Esta integração não está habilitada para a sua conta.',
  PLAN_NOT_INCLUDED:       'O seu plano não inclui esta integração.',
  NOT_CONNECTED:           'Conecte a sua conta antes de usar esta integração.',
  REQUIRES_REAUTH:         'A conexão expirou — reconecte a sua conta.',
  PROVIDER_ERROR:          'A última comunicação com o provedor falhou.',
};

@Injectable()
export class IntegrationUsageGuard implements CanActivate {
  private readonly logger = new Logger(IntegrationUsageGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly policy: IntegrationPolicyService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requirement = this.reflector.getAllAndOverride<IntegrationRequirement>(
      REQUIRES_INTEGRATION,
      [context.getHandler(), context.getClass()],
    );
    // Handler declares no requirement → the guard has no opinion.
    if (!requirement?.providerKey) return true;
    const { providerKey, mode } = requirement;

    const req = context.switchToHttp().getRequest();
    const tenantId = req.tenant?.id ?? req.tenantId;
    const userId   = req.auth?.userId ?? req.user?.id ?? req.userId;

    if (!tenantId) {
      this.logger.warn(`[integration-usage] ${providerKey}: sem contexto de tenant — negado (fail-closed)`);
      throw new ForbiddenException('Contexto de tenant ausente para autorizar a integração.');
    }

    const resolved = await this.policy.resolveOne(providerKey, {
      tenantId,
      userId: userId ?? '',
      // tenants.plan is the real column (TenantPlan). plan_slug/planSlug do NOT exist —
      // reading them made mode:'plans' deny everyone, silently.
      planSlug: req.tenant?.plan ?? null,
      tenantFeatures: (req.tenant?.features as Record<string, unknown> | undefined) ?? null,
    });

    if (!resolved) {
      this.logger.warn(`[integration-usage] ${providerKey}: sem política registada — negado (fail-closed)`);
      throw new ForbiddenException('Esta integração não está disponível nesta plataforma.');
    }

    const allowed = mode === 'connect' ? resolved.canConnect : resolved.canUse;
    if (!allowed) {
      this.logger.warn(
        `[integration-usage] ${providerKey} (${mode}): negado para tenant=${tenantId} — reason=${resolved.reasonCode}`,
      );
      throw new ForbiddenException(
        DENY_MESSAGE[resolved.reasonCode] ?? 'Uso desta integração não autorizado.',
      );
    }

    return true;
  }
}
