import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentTenant } from '../../core/decorators/current-tenant.decorator';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { RequirePermission } from '../../core/decorators/permissions.decorator';
import { RequireRole } from '../../core/decorators/roles.decorator';
import type { JwtAuth } from '../../core/guards/auth.guard';
import { MarketingAiSuggestionsService } from './marketing-ai-suggestions.service';

@ApiTags('Marketing AI')
@ApiBearerAuth()
@Controller('marketing/ai-suggestions')
export class MarketingAiSuggestionsController {
  constructor(private readonly service: MarketingAiSuggestionsService) {}

  @Get()
  @RequireRole('viewer')
  @RequirePermission('marketing:read')
  list(@CurrentTenant() tenant: { id: string }) {
    return this.service.list(tenant.id);
  }

  @Post()
  @RequireRole('editor')
  @RequirePermission('marketing:create')
  create(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser() user: JwtAuth,
    // dto-guard-allow: heterogeneous AI-suggestion metadata blob (varies per
    // task kind -- lyrics/audio/cover/campaign), stored verbatim as
    // activity_logs.metadata (jsonb). Service reads kind/targetName
    // defensively via bracket access with fallbacks; the rest is never
    // interpolated into SQL/HTML, only persisted as JSONB. A strict
    // whitelisted DTO would silently drop the metadata a caller actually
    // needs stored.
    @Body() suggestion: Record<string, unknown>,
  ) {
    return this.service.create(tenant.id, user?.userId ?? '', suggestion);
  }
}
