import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequireRole } from '../../core/decorators/roles.decorator';
import { campaignBuilderConfig } from './campaign-builder.config';

@ApiTags('Marketing')
@ApiBearerAuth()
@Controller('marketing/campaign-builder')
export class CampaignBuilderController {
  @Get('config')
  @RequireRole('viewer')
  @ApiOperation({ summary: 'Get the official Campaign Builder configuration' })
  getConfig() {
    return campaignBuilderConfig;
  }
}
