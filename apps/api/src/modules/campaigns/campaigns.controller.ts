import { Controller, Get, Post, Patch, Delete, Body, Param, Query, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CurrentTenant } from '../../core/decorators/current-tenant.decorator';
import { CurrentUser }   from '../../core/decorators/current-user.decorator';
import { RequireRole }   from '../../core/decorators/roles.decorator';
import { Audit }         from '../../core/interceptors/audit.interceptor';
import type { JwtAuth }  from '../../core/guards/auth.guard';
import { CampaignsService } from './campaigns.service';
import { CreateCampaignDto, UpdateCampaignDto, QueryCampaignDto } from './dto/campaigns.dto';

@ApiTags('Campaigns') @ApiBearerAuth() @Controller('campaigns')
export class CampaignsController {
  constructor(private readonly svc: CampaignsService) {}

  @Get() @RequireRole('viewer') @ApiOperation({ summary: 'List campaigns' })
  list(@CurrentTenant() t: { id: string }, @Query() q: QueryCampaignDto) {
    return this.svc.list(t.id, q);
  }

  @Get(':id') @RequireRole('viewer') @ApiOperation({ summary: 'Get a campaign' })
  findById(
    @CurrentTenant() t: { id: string },
    @CurrentUser()   u: JwtAuth,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.findById(t.id, id, u?.orgRole ?? undefined);
  }

  @Post() @RequireRole('editor') @Audit('campaign.created') @ApiOperation({ summary: 'Create a campaign' })
  create(
    @CurrentTenant() t: { id: string },
    @CurrentUser()   u: JwtAuth,
    @Body()          dto: CreateCampaignDto,
  ) {
    return this.svc.create(t.id, u?.userId ?? '', dto);
  }

  @Patch(':id') @RequireRole('editor') @Audit('campaign.updated') @ApiOperation({ summary: 'Update a campaign' })
  update(
    @CurrentTenant() t: { id: string },
    @CurrentUser()   u: JwtAuth,
    @Param('id', ParseUUIDPipe) id: string,
    @Body()          dto: UpdateCampaignDto,
  ) {
    return this.svc.update(t.id, u?.userId ?? '', id, dto, u?.orgRole ?? undefined);
  }

  @Delete(':id') @RequireRole('manager') @Audit('campaign.deleted') @ApiOperation({ summary: 'Cancel a campaign' })
  remove(@CurrentTenant() t: { id: string }, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.remove(t.id, id);
  }
}
