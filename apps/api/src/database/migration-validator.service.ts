/**
 * database/migration-validator.service.ts
 *
 * Serviço NestJS que valida, no boot da aplicação, se existem migrations
 * pendentes. Em produção, o processo termina imediatamente se o schema não
 * estiver sincronizado — prevenindo deploys com schema desatualizado.
 *
 * Injectar no AppModule como provider para activar a verificação.
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
    // musicos360_migrations tem RLS habilitado sem policy: sob APP_DATABASE_URL
    // (role NOBYPASSRLS, session-context ON) o SELECT volta vazio e showMigrations()
    // acusaria 80 pendentes — em produção isso mataria o boot. A validação precisa
    // da conexão owner (sempre DATABASE_URL), que enxerga a tabela de migrations.
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
          // Dar tempo aos logs de flush antes de terminar
          await new Promise(r => setTimeout(r, 200));
          process.exit(1);
        } else {
          this.logger.warn(`[DEV] ${msg}`);
        }
      } else {
        this.logger.log('Schema sincronizado — sem migrations pendentes.');
      }
    } catch (err) {
      // Falha na validação não deve impedir boot em dev
      if (isProduction) {
        this.logger.error('Falha ao verificar migrations:', (err as Error).message);
        process.exit(1);
      } else {
        this.logger.warn('Não foi possível verificar migrations (dev):', (err as Error).message);
      }
    }
  }
}
