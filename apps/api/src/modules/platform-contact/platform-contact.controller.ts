import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../core/decorators/public.decorator';
import { PlatformContactService } from './platform-contact.service';
import { PlatformContactDto } from './dto/platform-contact.dto';

/**
 * Platform Commercial Contact — institutional/commercial contact about
 * Music OS 360 itself (landing page). Deliberately without @CurrentTenant()
 * and without any relation to tenant, Support Ticket or MusicChat — see
 * the 2026-08-22 product decision.
 */
@ApiTags('Public') @Controller('public')
export class PlatformContactController {
  constructor(private readonly svc: PlatformContactService) {}

  @Public()
  @Post('platform-contact')
  @ApiOperation({ summary: 'Contato comercial/institucional sobre o Music OS 360 (não pertence a nenhum tenant)' })
  submit(@Body() dto: PlatformContactDto) {
    return this.svc.submit(dto);
  }
}
