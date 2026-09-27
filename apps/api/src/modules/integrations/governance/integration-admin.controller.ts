/**
 * governance/integration-admin.controller.ts
 *
 * Admin portal → Settings → Integrations.
 *
 * Writes restricted to super_admin (same pattern as admin/users). Every change is
 * audited: changing an integration's audience changes what customers can
 * use, so it needs a trail.
 */

import { Body, Controller, Get, Param, Patch, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequireRole } from '../../../core/decorators/roles.decorator';
import { Audit } from '../../../core/interceptors/audit.interceptor';
import { IntegrationAdminService } from './integration-admin.service';
import { UpdatePlatformIntegrationDto, SetPlanIntegrationsDto } from '../dto/integration-governance.dto';

@ApiTags('AdminIntegrations')
@ApiBearerAuth()
@Controller('admin/integrations')
export class IntegrationAdminController {
  constructor(private readonly admin: IntegrationAdminService) {}

  @Get('categories')
  @RequireRole('super_admin')
  @ApiOperation({ summary: 'Integration categories (governance)' })
  listCategories() {
    return this.admin.listCategories();
  }

  @Get()
  @RequireRole('super_admin')
  @ApiOperation({
    summary: 'Governed integrations, with technical state derived from the code',
  })
  list() {
    return this.admin.list();
  }

  /**
   * Per-plan integration entitlements — persisted in
   * billing_plans.features.integrations. Single source of truth: editing lives
   * here/Admin Plans, and the integration screen only DISPLAYS includedInPlans.
   */
  @Get('plans/:planSlug')
  @RequireRole('super_admin')
  @ApiOperation({ summary: 'Commercial integrations included in the plan' })
  getPlanIntegrations(@Param('planSlug') planSlug: string) {
    return this.admin.getPlanIntegrations(planSlug);
  }

  @Put('plans/:planSlug')
  @RequireRole('super_admin')
  @Audit('admin.plan_integrations_updated')
  @ApiOperation({
    summary: 'Defines the commercial integrations included in the plan',
    description:
      'Internal/billing/nonexistent slugs are rejected — a commercial entitlement ' +
      'cannot be granted to internal infrastructure.',
  })
  setPlanIntegrations(
    @Param('planSlug') planSlug: string,
    @Body() dto: SetPlanIntegrationsDto,
  ) {
    return this.admin.setPlanIntegrations(planSlug, dto.integrations ?? []);
  }

  @Patch(':id')
  @RequireRole('super_admin')
  @Audit('admin.integration_governance_updated')
  @ApiOperation({
    summary: 'Updates governance (category, publication, VIEW/USE audience)',
    description:
      'Does not change the technical capability (it is code) nor the tenant connection (it is the client\'s credential).',
  })
  update(@Param('id') id: string, @Body() dto: UpdatePlatformIntegrationDto) {
    return this.admin.update(id, {
      categoryId:       dto.categoryId,
      publicationState: dto.publicationState,
      technicalState:   dto.technicalState,
      viewAudience:     dto.viewAudience,
      useAudience:      dto.useAudience,
      notes:            dto.notes,
    });
  }
}
