import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Query,
  Req,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../core/decorators/public.decorator';
import { CurrentTenant } from '../../core/decorators/current-tenant.decorator';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { RequireRole } from '../../core/decorators/roles.decorator';
import { ExternalDataExchangeService } from '../../core/external-data/external-data-exchange.service';
import { WorkflowQueueService } from '../../queues/services/workflow-queue.service';
import type { JwtAuth } from '../../core/guards/auth.guard';
import type { Request } from 'express';
import {
  DistributorSubmitDto,
  ExternalDataStatusCheckDto,
  RequestExternalDataSyncDto,
  SocietySubmitDto,
} from './dto/integrations.dto';

function header(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0]?.trim() || null;
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

@ApiTags('External Data Exchange')
@ApiBearerAuth()
@Controller('integrations/external-data')
export class ExternalDataController {
  constructor(
    private readonly exchange: ExternalDataExchangeService,
    private readonly queue: WorkflowQueueService,
    private readonly config: ConfigService,
  ) {}

  @Get('providers')
  @RequireRole('viewer')
  @ApiOperation({ summary: 'List external data exchange providers' })
  listProviders(@Query('kind') kind?: 'distributor' | 'society') {
    return this.exchange.listProviders(kind);
  }

  @Post('sync/request')
  @RequireRole('editor')
  @ApiOperation({ summary: 'Request external data sync for an artist/work set' })
  async requestSync(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser() user: JwtAuth,
    @Body() dto: RequestExternalDataSyncDto,
  ) {
    const payload = await this.exchange.requestExternalSync({
      tenantId: tenant.id,
      userId: user.userId,
      artistId: dto.artistId,
      workIds: dto.workIds ?? [],
      societyHint: dto.societyHint ?? null,
    });
    await this.queue.enqueueExternalDataSync(payload);
    return payload;
  }

  @Post('distributor/submit')
  @RequireRole('editor')
  @ApiOperation({ summary: 'Submit artist/release/phonogram metadata to a distributor provider' })
  async submitDistributor(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser() user: JwtAuth,
    @Body() dto: DistributorSubmitDto,
  ) {
    const result = await this.exchange.submitDistributor({
      tenantId: tenant.id,
      userId: user.userId,
      providerId: dto.providerId,
      artistId: dto.artistId,
      releaseId: dto.releaseId ?? null,
      phonogramIds: dto.phonogramIds ?? [],
      idempotencyKey: dto.idempotencyKey,
      metadata: dto.metadata ?? {},
    });
    return result;
  }

  @Post('distributor/status-check')
  @RequireRole('viewer')
  @ApiOperation({ summary: 'Check distributor submission status' })
  async checkDistributor(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser() user: JwtAuth,
    @Body() dto: ExternalDataStatusCheckDto,
  ) {
    const result = await this.exchange.checkDistributorStatus({
      tenantId: tenant.id,
      userId: user.userId,
      providerId: dto.providerId,
      submissionId: dto.submissionId,
      entityType: dto.entityType,
      entityId: dto.entityId,
      idempotencyKey: dto.idempotencyKey,
    });
    return result;
  }

  @Post('society/submit')
  @RequireRole('editor')
  @ApiOperation({ summary: 'Submit works/phonograms metadata to a society provider' })
  async submitSociety(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser() user: JwtAuth,
    @Body() dto: SocietySubmitDto,
  ) {
    const result = await this.exchange.submitSociety({
      tenantId: tenant.id,
      userId: user.userId,
      providerId: dto.providerId,
      artistId: dto.artistId ?? null,
      workIds: dto.workIds ?? [],
      phonogramIds: dto.phonogramIds ?? [],
      idempotencyKey: dto.idempotencyKey,
      metadata: dto.metadata ?? {},
    });
    return result;
  }

  @Post('society/status-check')
  @RequireRole('viewer')
  @ApiOperation({ summary: 'Check society registration status' })
  async checkSociety(
    @CurrentTenant() tenant: { id: string },
    @CurrentUser() user: JwtAuth,
    @Body() dto: ExternalDataStatusCheckDto,
  ) {
    const result = await this.exchange.checkSocietyStatus({
      tenantId: tenant.id,
      userId: user.userId,
      providerId: dto.providerId,
      submissionId: dto.submissionId,
      entityType: dto.entityType,
      entityId: dto.entityId,
      idempotencyKey: dto.idempotencyKey,
    });
    return result;
  }

  @Post('webhooks/:providerId')
  @Public()
  @ApiOperation({ summary: 'External data provider webhook intake protected by HMAC signature' })
  async webhook(
    @Req() req: Request,
    @Headers('x-provider-signature') signatureHeader: string | string[] | undefined,
    @Body() payload: Record<string, unknown>,
  ) {
    // find-bc7c20a6: tenant is NEVER taken from a caller-supplied header —
    // ExternalDataExchangeService.ingestWebhook resolves it server-side from
    // a submission this API itself recorded. A signature only proves the
    // payload was signed with the shared per-provider secret; it proves
    // nothing about which tenant the webhook is for.
    const providerId = String(req.params['providerId'] ?? '');
    if (!providerId) throw new BadRequestException('Provider id is required');

    const secret = this.config.get<string>(`EXTERNAL_DATA_WEBHOOK_SECRET_${providerId.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`)
      ?? this.config.get<string>('EXTERNAL_DATA_WEBHOOK_SECRET');
    if (!secret) {
      throw new ServiceUnavailableException('External data webhook secret unavailable');
    }

    const kind = providerId.includes('society') ? 'society' : 'distributor';
    return this.exchange.ingestWebhook({
      providerId,
      kind,
      payload,
      signature: header(signatureHeader),
      secret,
    });
  }
}
