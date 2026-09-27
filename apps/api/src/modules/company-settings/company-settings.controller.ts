import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentTenant } from '../../core/decorators/current-tenant.decorator';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { RequireRole } from '../../core/decorators/roles.decorator';
import type { JwtAuth } from '../../core/guards/auth.guard';
import { CompanySettingsService } from './company-settings.service';
import { UpdateCompanySettingsDto } from './dto/update-company-settings.dto';

@ApiTags('Company Settings')
@ApiBearerAuth()
@Controller('company-settings')
export class CompanySettingsController {
  constructor(private readonly service: CompanySettingsService) {}

  @Get()
  @RequireRole('admin')
  @ApiOperation({ summary: 'Get the company registration settings (current tenant)' })
  get(@CurrentTenant() tenant: Record<string, unknown>) {
    return this.service.get(String(tenant['id']), String(tenant['org_id']));
  }

  @Patch()
  @RequireRole('admin')
  @ApiOperation({ summary: 'Update the company registration settings (current tenant)' })
  update(
    @CurrentUser() user: JwtAuth,
    @CurrentTenant() tenant: Record<string, unknown>,
    @Body() dto: UpdateCompanySettingsDto,
  ) {
    return this.service.update(String(tenant['id']), String(tenant['org_id']), user.userId, user.orgRole, dto);
  }
}
