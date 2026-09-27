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
 * PORTAL_RPA — STUB, DISABLED BY DEFAULT. Placeholder for an authorised, opt-in
 * RPA automation. Never enabled implicitly; requires REGISTRY_PORTAL_RPA_ENABLED
 * =true AND an explicit, authorised configuration. No scraping/bypass is shipped.
 */
@Injectable()
export class PortalRpaAdapter implements SocietyAdapter {
  readonly driver = SocietyDriver.PORTAL_RPA;
  readonly enabled = process.env['REGISTRY_PORTAL_RPA_ENABLED'] === 'true';

  private guard(): never {
    throw new ServiceUnavailableException('A automação de portal da sociedade está desabilitada.');
  }

  async submitWork(): Promise<SocietySubmissionResult> { return this.guard(); }
  async submitRecording(): Promise<SocietySubmissionResult> { return this.guard(); }
  async getSubmissionStatus(): Promise<SocietySubmissionStatusResult> { return this.guard(); }
  async exportPayload(_payload: Record<string, unknown>, _format: ExportFormat): Promise<ExportResult> { return this.guard(); }
}
