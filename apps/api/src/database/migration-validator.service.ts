/**
 * database/migration-validator.service.ts
 *
 * NestJS service that validates, at application boot, whether there are pending
 * migrations. In production, the process terminates immediately if the schema is not
 * in sync — preventing deploys with an outdated schema.
 *
 * Inject it into AppModule as a provider to enable the check.
 */

import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  Inject,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { ADMIN_DATA_SOURCE, DATA_SOURCE } from './database.tokens';

@Injectable()
export class MigrationValidatorService implements OnApplicationBootstrap {
  private readonly logger = new Logger(MigrationValidatorService.name);

  constructor(
    @Optional() @Inject(DATA_SOURCE) private readonly appDs: DataSource | null,
    // musicos360_migrations has RLS enabled without a policy: under APP_DATABASE_URL
    // (NOBYPASSRLS role, session-context ON) the SELECT comes back empty and showMigrations()
    // would report 80 pending — in production that would kill the boot. The validation needs
    // the owner connection (always DATABASE_URL), which can see the migrations table.
    @Optional() @Inject(ADMIN_DATA_SOURCE) private readonly adminDs: DataSource | null,
    @Optional() private readonly config?: ConfigService,
  ) {}

  private getConfig(key: string): string | undefined {
    return this.config?.get<string>(key) ?? process.env[key];
  }

  private get ds(): DataSource | null {
    return this.adminDs ?? this.appDs;
  }

  async onApplicationBootstrap(): Promise<void> {
    if (!this.ds) {
      if (this.getConfig('NODE_ENV') === 'production') {
        this.logger.error('DB unavailable in production - migration validation cannot run');
        process.exit(1);
      }
      this.logger.warn('DB desativado — validação de migrations ignorada');
      return;
    }

    const isProduction = this.getConfig('NODE_ENV') === 'production';
    const skipCheck    = this.getConfig('SKIP_MIGRATION_CHECK') === 'true';

    if (skipCheck) {
      this.logger.warn('SKIP_MIGRATION_CHECK=true — validação desactivada');
      return;
    }

    try {
      const hasPending = await this.ds.showMigrations();

      if (hasPending) {
        const msg =
          'Existem migrations pendentes. Execute "npm run db:migrate" antes de iniciar a aplicação.';

        if (isProduction) {
          this.logger.error(`[FATAL] ${msg}`);
          // Give the logs time to flush before terminating
          await new Promise(r => setTimeout(r, 200));
          process.exit(1);
        } else {
          this.logger.warn(`[DEV] ${msg}`);
        }
      } else {
        this.logger.log('Schema sincronizado — sem migrations pendentes.');
      }
    } catch (err) {
      // A validation failure must not prevent boot in dev
      if (isProduction) {
        this.logger.error('Falha ao verificar migrations:', (err as Error).message);
        process.exit(1);
      } else {
        this.logger.warn('Não foi possível verificar migrations (dev):', (err as Error).message);
      }
    }
  }
}
