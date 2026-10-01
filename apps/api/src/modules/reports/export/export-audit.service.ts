/**
 * modules/reports/export/export-audit.service.ts  ·  PHASE 2.2
 *
 * Export auditing using the existing event infrastructure
 * (EventsService). Emits the REPORT_EXPORT event. Does not create a parallel system.
 */
import { Injectable, Logger, Optional } from '@nestjs/common';
import { EventsService } from '../../../core/events/events.service';
import { redactForStorage } from '../../../core/filters/redact-diagnostic';
import type { ExportFormat } from './export.types';

export const REPORT_EXPORT_EVENT = 'report.exported';

export interface ExportAuditEntry {
  userId: string;
  tenantId: string;
  entity: string;
  format: ExportFormat;
  recordCount: number;
  status: 'success' | 'failed';
  error?: string;
}

@Injectable()
export class ExportAuditService {
  private readonly logger = new Logger('ExportAudit');

  constructor(@Optional() private readonly events?: EventsService) {}

  record(entry: ExportAuditEntry): void {
    this.logger.log(
      `REPORT_EXPORT tenant=${entry.tenantId} user=${entry.userId} entity=${entry.entity} ` +
        `format=${entry.format} records=${entry.recordCount} status=${entry.status}`,
    );
    this.events?.emit({
      type: REPORT_EXPORT_EVENT,
      tenantId: entry.tenantId,
      userId: entry.userId,
      aggregateType: 'report',
      aggregateId: entry.entity,
      occurredAt: new Date().toISOString(),
      payload: {
        entity: entry.entity,
        format: entry.format,
        recordCount: entry.recordCount,
        status: entry.status,
        // Never persist raw exception text in the event stream (tokens, DSNs, e-mails).
        error: entry.error ? redactForStorage(entry.error) : null,
      },
    });
  }
}
