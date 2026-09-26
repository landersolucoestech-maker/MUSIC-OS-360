/**
 * database/database.module.ts
 *
 * TypeORM DataSource provider for MUSIC OS 360 API.
 * Provides the DATA_SOURCE token injectable across all services.
 *
 * Graceful standalone mode: if DATABASE_URL is not set the provider returns
 * null — services and guards check for this and bypass DB calls safely.
 *
 * Includes MigrationValidatorService, which checks at boot whether there are
 * pending migrations (fatal in production, warn in dev).
 */

import { Module, Global, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { ALL_ENTITIES } from './entities';
import { MigrationValidatorService } from './migration-validator.service';
import { DatabaseContextService } from './database-context.service';
import { makeTenantAwareDataSource } from './tenant-als';
import { TenantBootstrapResolver } from './tenant-bootstrap.resolver';
import {
  DATA_SOURCE,
  ADMIN_DATA_SOURCE,
  PROVISIONING_DATA_SOURCE,
} from './database.tokens';
// ── Source of truth: TypeORM migrations only ─────────────────────────────────
// The apps/api/drizzle/ directory contains legacy SQL snapshots that are
// ARCHIVED and must not be run. TypeORM is the sole migration executor.
// Run migrations: pnpm --filter api db:migrate
//
// ALL_MIGRATIONS is the single shared registry (see ./migrations/index.ts) —
// datasource.ts (the real db:migrate/db:check runner) imports the exact same
// array, so there is exactly one list to keep in sync with the migrations/
// directory, checked by scripts/verify-migration-source-of-truth.mjs.
import { ALL_MIGRATIONS } from './migrations/index';

// Re-export from tokens file — services should import from database.tokens
// to avoid circular deps (service → module → service).
export {
  DATA_SOURCE,
  ADMIN_DATA_SOURCE,
  PROVISIONING_DATA_SOURCE,
} from './database.tokens';

/**
 * Factory for the ADMIN_DATA_SOURCE provider — a read-only owner connection
 * for cross-tenant enumeration and request identity bootstrap. It consults ONLY DATABASE_URL and
 * deliberately never reads APP_DATABASE_URL or DATABASE_SESSION_CONTEXT_ENABLED,
 * so enumeration always sees every tenant regardless of the session-context flag.
 */
export async function createAdminDataSource(config: ConfigService): Promise<DataSource | null> {
  const logger = new Logger('DatabaseModule');
  const isProd = config.get('NODE_ENV') === 'production';

  // Always the owner connection — never APP_DATABASE_URL, never flag-gated.
  const url = config.get<string>('DATABASE_URL');
  if (!url) {
    if (isProd) {
      throw new Error('DATABASE_URL is required in production');
    }
    logger.warn('DATABASE_URL not configured — ADMIN_DATA_SOURCE disabled (standalone mode)');
    return null;
  }

  const dbSslDisabled = config.get<string>('DB_SSL') === 'false';

  const adminDs = new DataSource({
    type:                'postgres',
    url,
    entities:            ALL_ENTITIES,
    // Metadata only (never runs: migrationsRun=false). Lets
    // MigrationValidatorService run showMigrations() on the owner connection —
    // musicos360_migrations has RLS without a policy and is invisible to the app role.
    migrations:          [...ALL_MIGRATIONS],
    synchronize:         false,
    migrationsRun:       false,
    logging:             isProd ? ['error', 'warn'] : ['error', 'warn'],
    ssl:                 dbSslDisabled ? false : { rejectUnauthorized: false },
    migrationsTableName: 'musicos360_migrations',
    // Reduced pool — enumeration only.
    extra: {
      max:               2,
      min:               0,
      idleTimeoutMillis: 30_000,
    },
  });

  try {
    await adminDs.initialize();
    logger.log('ADMIN_DATA_SOURCE connected (owner, bootstrap/read-only enumeration)');
    return adminDs;
  } catch (err) {
    const message = err instanceof Error ? (err.message || err.name) : String(err);
    logger.error('Failed to initialize ADMIN_DATA_SOURCE', message);
    throw new Error(`ADMIN_DATA_SOURCE não inicializou: ${message}`);
  }
}

export async function createProvisioningDataSource(
  config: ConfigService,
): Promise<DataSource | null> {
  const logger = new Logger('ProvisioningDataSource');
  const url = config.get<string>('DATABASE_URL');
  if (!url) {
    if (config.get<string>('NODE_ENV') === 'production') {
      throw new Error('DATABASE_URL is required for workspace provisioning');
    }
    return null;
  }
  const ds = new DataSource({
    type: 'postgres',
    url,
    entities: ALL_ENTITIES,
    migrations: [],
    synchronize: false,
    migrationsRun: false,
    logging: ['error', 'warn'],
    ssl: config.get<string>('DB_SSL') === 'false'
      ? false
      : { rejectUnauthorized: false },
    extra: { max: 2, min: 0, idleTimeoutMillis: 30_000 },
  });
  await ds.initialize();
  logger.log('Owner connection ready for authenticated workspace bootstrap');
  return ds;
}

@Global()
@Module({
  providers: [
    {
      provide: DATA_SOURCE,
      inject: [ConfigService],
      useFactory: async (config: ConfigService): Promise<DataSource | null> => {
        const logger = new Logger('DatabaseModule');
        const isProd = config.get('NODE_ENV') === 'production';

        // P2-2/P2-4: when runtime session-context is enabled AND a dedicated
        // application connection (NOBYPASSRLS role) is provided, connect through
        // APP_DATABASE_URL so RLS actually applies to the API's own traffic.
        // DATABASE_URL remains the owner/migration connection and the fallback.
        const sessionContextEnabled =
          config.get<string>('DATABASE_SESSION_CONTEXT_ENABLED') === 'true';
        const appUrl = config.get<string>('APP_DATABASE_URL');
        const useAppUrl = sessionContextEnabled && !!appUrl;
        const url = useAppUrl ? appUrl : config.get<string>('DATABASE_URL');

        if (!url) {
          if (isProd) {
            throw new Error('DATABASE_URL is required in production');
          }
          logger.warn(
            'DATABASE_URL not configured — DB disabled (standalone mode)',
          );
          return null;
        }

        try {
          const parsedUrl = new URL(url);
          logger.log(
            `${useAppUrl ? 'APP_DATABASE_URL (session-context ON, NOBYPASSRLS app role)' : 'DATABASE_URL'} detectado — host=${parsedUrl.hostname} port=${parsedUrl.port || 'default'} user=${parsedUrl.username}`,
          );
        } catch {
          throw new Error('Database URL configurado, mas URL invalida');
        }

        const poolMax = Number(config.get<string>('DB_POOL_MAX') ?? (isProd ? 20 : 20));
        const poolMin = Number(config.get<string>('DB_POOL_MIN') ?? (isProd ? 2 : 1));
        const poolConnectionTimeoutMs = Number(config.get<string>('DB_POOL_CONNECTION_TIMEOUT_MS') ?? 15_000);
        const dbSslDisabled = config.get<string>('DB_SSL') === 'false';

        const ds = new DataSource({
          type:           'postgres',
          url,
          entities:       ALL_ENTITIES,
          migrations:     [...ALL_MIGRATIONS],
          synchronize:    false,  // NEVER true — the schema is managed by migrations
          logging:        isProd ? ['error', 'warn'] : ['query', 'error', 'warn'],
          ssl:            dbSslDisabled ? false : { rejectUnauthorized: false },
          migrationsTableName: 'musicos360_migrations',
          // Connection pool tuning
          extra: {
            max:              poolMax,
            min:              poolMin,
            idleTimeoutMillis: 30_000,
            connectionTimeoutMillis: poolConnectionTimeoutMs,
          },
        });

        try {
          await ds.initialize();
          logger.log('PostgreSQL conectado via TypeORM');
          // PHASE 3J: when session-context is active, wraps the DataSource in an
          // ALS-aware Proxy so that EVERY query of the HTTP request path (and of the jobs)
          // runs in the tenant context opened by runInTenantContext. Without the flag,
          // returns the raw DataSource (zero behavior change).
          return useAppUrl ? makeTenantAwareDataSource(ds) : ds;
        } catch (err) {
          const aggregateErrors = err && typeof err === 'object' && 'errors' in err
            ? (err as { errors?: unknown[] }).errors
            : undefined;
          const message = err instanceof Error
            ? (err.message || err.stack || err.name)
            : String(err);
          const detail = Array.isArray(aggregateErrors)
            ? `${message} ${JSON.stringify(aggregateErrors.map((inner) => {
                if (!inner || typeof inner !== 'object') return String(inner);
                const record = inner as Record<string, unknown>;
                return {
                  code: record['code'],
                  address: record['address'],
                  port: record['port'],
                  message: record['message'],
                };
              }))}`
            : message;
          logger.error('Failed to connect to PostgreSQL via TypeORM', detail);
          throw new Error(`DATABASE_URL configurado, mas PostgreSQL nao inicializou: ${detail}`);
        }
      },
    },
    {
      // P2-7: administrative, read-only connection for cross-tenant enumeration
      // (schedulers' discoverTenantIds). ALWAYS uses DATABASE_URL (owner),
      // independent of DATABASE_SESSION_CONTEXT_ENABLED / APP_DATABASE_URL.
      // Small pool — used only for bootstrap/enumeration SELECTs, never for writes.
      provide: ADMIN_DATA_SOURCE,
      inject: [ConfigService],
      useFactory: createAdminDataSource,
    },
    {
      provide: PROVISIONING_DATA_SOURCE,
      inject: [ConfigService],
      useFactory: createProvisioningDataSource,
    },
    MigrationValidatorService,
    DatabaseContextService,
    TenantBootstrapResolver,
  ],
  exports: [
    DATA_SOURCE,
    ADMIN_DATA_SOURCE,
    PROVISIONING_DATA_SOURCE,
    MigrationValidatorService,
    DatabaseContextService,
    TenantBootstrapResolver,
  ],
})
export class DatabaseModule {}
