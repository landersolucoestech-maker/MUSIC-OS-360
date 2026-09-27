import { Injectable, BadRequestException } from '@nestjs/common';
import { SocietyDriver } from '@music-os-360/types';
import type { SocietyAdapter } from './society-adapter.contract';
import { ManualExportAdapter } from './manual-export.adapter';
import { PartnerApiAdapter } from './partner-api.adapter';
import { PortalRpaAdapter } from './portal-rpa.adapter';

/** Resolves a SocietyAdapter by driver. New drivers register here only. */
@Injectable()
export class SocietyAdapterRegistry {
  private readonly adapters: Record<SocietyDriver, SocietyAdapter>;

  constructor(
    manual: ManualExportAdapter,
    partner: PartnerApiAdapter,
    rpa: PortalRpaAdapter,
  ) {
    this.adapters = {
      [SocietyDriver.MANUAL_EXPORT]: manual,
      [SocietyDriver.PARTNER_API]: partner,
      [SocietyDriver.PORTAL_RPA]: rpa,
    };
  }

  resolve(driver: SocietyDriver): SocietyAdapter {
    const adapter = this.adapters[driver];
    if (!adapter) throw new BadRequestException('Esta sociedade não é suportada para envio.');
    return adapter;
  }

  /** Drivers that are currently enabled (manual is always on). */
  enabledDrivers(): SocietyDriver[] {
    return Object.values(this.adapters).filter((a) => a.enabled).map((a) => a.driver);
  }
}
