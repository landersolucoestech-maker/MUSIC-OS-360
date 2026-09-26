/**
 * test/e2e/e2e-db-guard.ts — fail-closed guard of the E2E bootstrap (setupFiles).
 *
 * Runs BEFORE any spec: if the process's database variables
 * point to a target not authorized for NODE_ENV (in jest, `test` →
 * no remote Supabase project; local Postgres allowed), the process aborts
 * before any DataSource is created. E2E specs against an authorized remote
 * branch require an explicit decision (NODE_ENV and env coherent with the matrix
 * in docs/SUPABASE_ENVIRONMENTS.md).
 */
import { assertDatabaseCommandEnv } from '../../src/core/config/env.schema';

assertDatabaseCommandEnv('jest-e2e');
