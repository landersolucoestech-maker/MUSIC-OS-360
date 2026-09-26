/**
 * modules/reports/import/import-audit.service.ts  ·  PHASE 2.3B
 * Import commit auditing via the existing EventsService.
 */
import { Injectable, Logger, Optional } from '@nestjs/common';
import { EventsService } from '../../../core/events/events.service';

export const REPORT_IMPORT_COMMIT_EVENT = 'report.import.committed';

export interface ImportCommitAuditEntry {
  userId: string;
  tenantId: string;
  entity: string;
  recordCount: number;
  successCount: number;
  failureCount: number;
  status: 'committed' | 'rolledback';
}

@Injectable()
export class ImportAuditService {
  private readonly logger = new Logger('ImportAudit');

  constructor(@Optional() private readonly events?: EventsService) {}

  record(entry: ImportCommitAuditEntry): void {
    this.logger.log(
      `REPORT_IMPORT_COMMIT tenant=${entry.tenantId} user=${entry.userId} entity=${entry.entity} ` +
        `records=${entry.recordCount} imported=${entry.successCount} failed=${entry.failureCount} status=${entry.status}`,
    );
    this.events?.emit({
      type: REPORT_IMPORT_COMMIT_EVENT,
      tenantId: entry.tenantId,
      userId: entry.userId,
      aggregateType: 'report',
      aggregateId: entry.entity,
      occurredAt: new Date().toISOString(),
      payload: {
        entity: entry.entity,
        recordCount: entry.recordCount,
        successCount: entry.successCount,
        failureCount: entry.failureCount,
        status: entry.status,
      },
    });
  }
}
