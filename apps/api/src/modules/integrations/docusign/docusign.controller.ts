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
 * Espelha AutentiqueController: mesmas rotas semânticas, mesmo DTO, mesmo RBAC
 * (@RequireRole('editor')) e mesma auditoria. O webhook é @Public() porque quem
 * chama é o DocuSign Connect — a autenticação dele é a assinatura HMAC
 * verificada em DocuSignService.handleWebhook, não um JWT.
 */
@ApiTags('DocuSign')
@Controller('integrations/docusign')
export class DocuSignController {
  constructor(private readonly docusign: DocuSignService) {}

  @Post('documents')
  @ApiBearerAuth()
  @RequireRole('editor')
  // Enforcement de governança: RBAC autoriza o PAPEL, isto autoriza a
  // INTEGRAÇÃO para este tenant. Chamada direta à API é bloqueada aqui, não só
  // escondida no frontend.
  @UseGuards(IntegrationUsageGuard)
  @RequiresIntegration('docusign')
  @UseInterceptors(IdempotencyInterceptor)
  @Audit('integration.docusign_document_created')
  @ApiOperation({ summary: 'Criar envelope DocuSign para assinatura' })
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
    // rawBody é populado no bootstrap (create-app.ts) — a verificação HMAC do
    // DocuSign é sobre os bytes originais, não sobre o JSON re-serializado.
    const rawBody = (req.rawBody as Buffer | undefined)?.toString('utf8') ?? '';
    return this.docusign.handleWebhook(payload, rawBody, signature);
  }
}
