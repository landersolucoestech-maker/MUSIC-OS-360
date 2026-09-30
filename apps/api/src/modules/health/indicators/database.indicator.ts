/**
 * health/indicators/database.indicator.ts
 *
 * Terminus health indicator that checks whether PostgreSQL is reachable.
 * Runs a SELECT 1 to confirm real connectivity.
 * The result is PUBLIC (GET /health/ready is unauthenticated): it carries only a
 * stable error code. The raw driver diagnostic is logged server-side, redacted.
 */

import { Injectable, Inject, Logger, Optional } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { DataSource } from 'typeorm';
import { redactDiagnosticText } from '../../../core/filters/redact-diagnostic';
import { DATA_SOURCE } from '../../../database/database.module';

@Injectable()
export class DatabaseHealthIndicator extends HealthIndicator {
  private readonly logger = new Logger(DatabaseHealthIndicator.name);

  constructor(
    @Optional() @Inject(DATA_SOURCE) private readonly ds: DataSource | null,
  ) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    if (!this.ds || !this.ds.isInitialized) {
      this.logger.error('Database readiness check failed: data source not initialized');
      const result = this.getStatus(key, false, { code: 'DATABASE_UNAVAILABLE' });
      throw new HealthCheckError('Database check failed', result);
    }

    try {
      await this.ds.query('SELECT 1');
      return this.getStatus(key, true, { driver: 'postgres' });
    } catch (err) {
      this.logger.error(
        `Database readiness check failed: ${redactDiagnosticText(err instanceof Error ? err.message : String(err))}`,
      );
      const result = this.getStatus(key, false, { code: 'DATABASE_UNAVAILABLE' });
      throw new HealthCheckError('Database check failed', result);
    }
  }
}
