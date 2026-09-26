/**
 * database/datasource.ts
 *
 * Standalone TypeORM DataSource — used by the TypeORM CLI and migration scripts.
 * Do NOT import inside NestJS (use database.module.ts for injection).
 *
 * Usage:
 *   npx typeorm migration:generate -d src/database/datasource.ts migrations/MyName
 *   npx typeorm migration:run     -d src/database/datasource.ts
 *   npx typeorm migration:revert  -d src/database/datasource.ts
 *   npx typeorm schema:log        -d src/database/datasource.ts
 */

import 'reflect-metadata';
import * as path from 'path';
import { DataSource } from 'typeorm';
import { ALL_ENTITIES } from './entities';
import { ALL_MIGRATIONS } from './migrations/index';
import { assertDatabaseCommandEnv } from '../core/config/env.schema';

// ─── Load environment variables if dotenv is available ───────────────────────
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const dotenv = require('dotenv');
  // Try apps/api/.env.development first (2 levels up from src/database/), then root .env.development
  dotenv.config({ path: path.resolve(__dirname, '../../.env.development') });
  dotenv.config({ path: path.resolve(process.cwd(), '.env.development') });
} catch { /* dotenv opcional */ }

const DATABASE_URL = process.env['DATABASE_URL'];

if (!DATABASE_URL) {
  console.error(
    '\n[MUSIC OS 360] DATABASE_URL is not defined.\n' +
    'Set the DATABASE_URL environment variable before running migrations.\n',
  );
  process.exit(1);
}

// MODULE-LEVEL fail-closed guard: any importer (db-ops, seeds,
// verify-*, TypeORM CLI) is blocked BEFORE a DataSource exists if the target
// is not the one authorized for NODE_ENV (dev → only the DEV branch).
assertDatabaseCommandEnv('datasource');

const isProduction = process.env['NODE_ENV'] === 'production';
const dbSslDisabled = process.env['DB_SSL'] === 'false';

export const AppDataSource = new DataSource({
  type:        'postgres',
  url:          DATABASE_URL,
  entities:     ALL_ENTITIES,
  synchronize:  false,  // NEVER true — versioned migrations only
  logging:      !isProduction,
  ssl:          dbSslDisabled ? false : { rejectUnauthorized: false },

  // Was a glob (path.join(__dirname, 'migrations', '*.{ts,js}')) — replaced
  // with the shared ALL_MIGRATIONS registry (./migrations/index.ts) so this
  // and database.module.ts's runtime DataSource can never drift again (the
  // glob auto-discovered new files silently; database.module.ts's own
  // explicit list did not, which is exactly how the two fell ~50 migrations
  // out of sync before this fix). Adding a migration now means adding it to
  // migrations/index.ts — see apps/api/DATABASE.md.
  migrations: [...ALL_MIGRATIONS],
  migrationsTableName: 'musicos360_migrations',
  migrationsRun:       false,
});
