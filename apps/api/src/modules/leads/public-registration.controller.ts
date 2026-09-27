import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../core/decorators/public.decorator';
import { LeadsService } from './leads.service';
import { PublicArtistRegistrationDto } from './dto/leads.dto';

@ApiTags('Public') @Controller('public')
export class PublicRegistrationController {
  constructor(private readonly svc: LeadsService) {}

  @Public()
  @Get('workspaces/:slug')
  @ApiOperation({ summary: 'Resolve the active workspace for public signup' })
  resolveWorkspace(@Param('slug') slug: string) {
    return this.svc.resolvePublicWorkspace(slug);
  }

  @Public()
  @Post('artist-registration')
  @ApiOperation({ summary: 'Register a public artist signup as a lead' })
  submitArtistRegistration(@Body() dto: PublicArtistRegistrationDto) {
    return this.svc.submitPublicArtistRegistration(dto);
  }
}
