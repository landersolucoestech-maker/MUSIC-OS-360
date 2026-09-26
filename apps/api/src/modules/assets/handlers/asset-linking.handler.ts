/**
 * modules/assets/handlers/asset-linking.handler.ts
 *
 * Connects the REAL existing asset.uploaded event to the Asset Linking Skill.
 * Internal infrastructure — no exposure to the user.
 */

import { Injectable, Logger, Optional } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { DOMAIN_EVENTS, type DomainEvent } from '../../../core/events/events.service';
import type { AssetUploadedPayload } from '../../../core/events/domain-events.types';
import { DatabaseContextService } from '../../../database/database-context.service';
import { AssetLinkingService } from '../asset-linking.service';

@Injectable()
export class AssetLinkingHandler {
  private readonly logger = new Logger(AssetLinkingHandler.name);

  constructor(
    private readonly assetLinking: AssetLinkingService,
    @Optional() private readonly dbContext?: DatabaseContextService,
  ) {}

  @OnEvent(DOMAIN_EVENTS.ASSET_UPLOADED, { async: true })
  async onAssetUploaded(event: DomainEvent<AssetUploadedPayload>): Promise<void> {
    const tenantId = event?.tenantId ?? event?.payload?.tenantId;
    // Fail-closed: an async handler without a tenant must not touch tenant data.
    if (!tenantId) {
      this.logger.warn('AssetLinkingHandler: event without tenantId — aborted (fail-closed)');
      return;
    }
    if (!this.dbContext) {
      this.logger.warn(
        'AssetLinkingHandler: DatabaseContextService unavailable — aborted (fail-closed)',
      );
      return;
    }

    try {
      const work = () => this.assetLinking.processUpload(event.payload);
      await this.dbContext.runInTenantContext(
        { tenantId, orgId: null, role: null },
        work,
      );
    } catch (err) {
      // The failure is already persisted in the skill_run; here only an internal technical log.
      this.logger.error(
        `Asset linking failed for upload "${event.payload.uploadId}"`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }
}
