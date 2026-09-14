import { Body, Controller, Headers, HttpCode, HttpStatus, Post, Request, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../../core/decorators/public.decorator';
import { RequireRole } from '../../../core/decorators/roles.decorator';
import { Audit } from '../../../core/interceptors/audit.interceptor';
import { IdempotencyInterceptor } from '../../../core/interceptors/idempotency.interceptor';
import { AutentiqueService } from './autentique.service';
import { CreateAutentiqueDocumentDto, SendForSignatureDto } from '../dto/integrations.dto';
import { IntegrationUsageGuard, RequiresIntegration } from '../governance/integration-usage.guard';

@ApiTags('Autentique')
@Controller('integrations/autentique')
export class AutentiqueController {
  constructor(private readonly autentique: AutentiqueService) {}

  @Post('documents')
  @ApiBearerAuth()
  @RequireRole('editor')
  @UseGuards(IntegrationUsageGuard)
  @RequiresIntegration('autentique')
  @UseInterceptors(IdempotencyInterceptor)
  @Audit('integration.autentique_document_created')
  @ApiOperation({ summary: 'Criar documento Autentique para assinatura' })
  @HttpCode(HttpStatus.CREATED)
  createDocument(@Request() req: any, @Body() dto: CreateAutentiqueDocumentDto) {
    return this.autentique.sendForSignature({
      tenantId: req.tenant?.id ?? req.tenantId,
      contractId: dto.contractId ?? '',
      name: dto.name,
      fileBase64: dto.fileBase64,
      signers: dto.signers,
    });
  }

  @Post('signature-requests')
  @ApiBearerAuth()
  @RequireRole('editor')
  @UseGuards(IntegrationUsageGuard)
  @RequiresIntegration('autentique')
  @UseInterceptors(IdempotencyInterceptor)
  @Audit('integration.autentique_signature_requested')
  @ApiOperation({ summary: 'Enviar contrato/documento para assinatura Autentique' })
  @HttpCode(HttpStatus.OK)
  requestSignature(@Request() req: any, @Body() dto: SendForSignatureDto) {
    return this.autentique.sendForSignature({
      tenantId: req.tenant?.id ?? req.tenantId,
      contractId: dto.contractId,
      name: dto.name,
      fileBase64: dto.fileBase64,
      signers: dto.signers,
    });
  }

  @Post('webhook')
  @Public()
  @ApiOperation({ summary: 'Webhook Autentique protegido por x-autentique-secret' })
  @HttpCode(HttpStatus.OK)
  webhook(
    @Body() payload: any,
    @Headers('x-autentique-secret') secret?: string,
  ) {
    return this.autentique.handleWebhook(payload, secret);
  }
}
