import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { SocietyDriver } from '@music-os-360/types';
import type {
  ExportFormat,
  ExportResult,
  SocietyAdapter,
  SocietySubmissionResult,
  SocietySubmissionStatusResult,
} from './society-adapter.contract';

/**
 * PARTNER_API — STUB, disabled by default. Enabled only when an official partner
 * integration exists AND `REGISTRY_PARTNER_API_ENABLED=true`. Never assumes a
 * public ABRAMUS API. While there is no real endpoint, every op refuses cleanly.
 */
@Injectable()
export class PartnerApiAdapter implements SocietyAdapter {
  readonly driver = SocietyDriver.PARTNER_API;
  readonly enabled = process.env['REGISTRY_PARTNER_API_ENABLED'] === 'true';

  private guard(): never {
    throw new ServiceUnavailableException(
      'O envio automático por parceiro oficial ainda não está disponível para esta sociedade.',
    );
  }

  async submitWork(): Promise<SocietySubmissionResult> { return this.guard(); }
  async submitRecording(): Promise<SocietySubmissionResult> { return this.guard(); }
  async getSubmissionStatus(): Promise<SocietySubmissionStatusResult> { return this.guard(); }
  async exportPayload(_payload: Record<string, unknown>, _format: ExportFormat): Promise<ExportResult> { return this.guard(); }
}
