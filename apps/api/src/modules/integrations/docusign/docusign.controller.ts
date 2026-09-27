import { Body, Controller, Headers, HttpCode, HttpStatus, Post, Request, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../../core/decorators/public.decorator';
import { RequireRole } from '../../../core/decorators/roles.decorator';
import { Audit } from '../../../core/interceptors/audit.interceptor';
import { IdempotencyInterceptor } from '../../../core/interceptors/idempotency.interceptor';
import { DocuSignService } from './docusign.service';
import { SendForSignatureDto } from '../dto/integrations.dto';
import { IntegrationUsageGuard, RequiresIntegration } from '../governance/integration-usage.guard';

/**
 * Mirrors AutentiqueController: same semantic routes, same DTO, same RBAC
 * (@RequireRole('editor')) and same auditing. The webhook is @Public() because the
 * caller is DocuSign Connect — its authentication is the HMAC signature
 * verified in DocuSignService.handleWebhook, not a JWT.
 */
@ApiTags('DocuSign')
@Controller('integrations/docusign')
export class DocuSignController {
  constructor(private readonly docusign: DocuSignService) {}

  @Post('documents')
  @ApiBearerAuth()
  @RequireRole('editor')
  // Governance enforcement: RBAC authorizes the ROLE, this authorizes the
  // INTEGRATION for this tenant. A direct API call is blocked here, not just
  // hidden in the frontend.
  @UseGuards(IntegrationUsageGuard)
  @RequiresIntegration('docusign')
  @UseInterceptors(IdempotencyInterceptor)
  @Audit('integration.docusign_document_created')
  @ApiOperation({ summary: 'Create a DocuSign envelope for signing' })
  @HttpCode(HttpStatus.CREATED)
  createDocument(@Request() req: any, @Body() dto: SendForSignatureDto) {
    return this.docusign.sendForSignature({
      tenantId:   req.tenant?.id ?? req.tenantId,
      userId:     req.auth?.userId ?? req.user?.id,
      contractId: dto.contractId ?? '',
      name:       dto.name,
      fileBase64: dto.fileBase64,
      signers:    dto.signers,
    });
  }

  @Post('webhook')
  @Public()
  @ApiOperation({ summary: 'Webhook DocuSign Connect (HMAC X-DocuSign-Signature-1)' })
  @HttpCode(HttpStatus.OK)
  webhook(
    @Request() req: any,
    @Body() payload: any,
    @Headers('x-docusign-signature-1') signature?: string,
  ) {
    // rawBody is populated at bootstrap (create-app.ts) — DocuSign's HMAC
    // verification is over the original bytes, not over the re-serialized JSON.
    const rawBody = (req.rawBody as Buffer | undefined)?.toString('utf8') ?? '';
    return this.docusign.handleWebhook(payload, rawBody, signature);
  }
}
