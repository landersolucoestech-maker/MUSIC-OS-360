#!/usr/bin/env ts-node
/**
 * scripts/dump-migrations-sql.ts
 *
 * Generates a consolidated SQL file with all TypeORM migrations.
 * Useful to run in the Supabase SQL Editor when the TCP connection is not available.
 *
 * Usage:
 *   ts-node --transpile-only scripts/dump-migrations-sql.ts > migrations-complete.sql
 *   # Or:
 *   npm run dump:sql
 */

import 'reflect-metadata';
import { MigrationInterface, QueryRunner } from 'typeorm';
import { InitialSchema20240101000000 }             from '../src/database/migrations/20240101000000_InitialSchema';
import { WorkflowTransitions20240601000001 }       from '../src/database/migrations/20240601000001_WorkflowTransitions';
import { DomainEventLog20240602000001 }            from '../src/database/migrations/20240602000001_DomainEventLog';
import { AuditLogEnterpriseColumns20260516000001 } from '../src/database/migrations/20260516000001_AuditLogEnterpriseColumns';
import { ActivityLogs20260520000002 }              from '../src/database/migrations/20260520000002_ActivityLogs';
import { SupabaseAuthColumnNames20260520000004 }   from '../src/database/migrations/20260520000004_SupabaseAuthColumnNames';
import { RLSPolicies20260520000020 }               from '../src/database/migrations/20260520000020_RLSPolicies';
import { PerformanceIndexes20260521000030 }        from '../src/database/migrations/20260521000030_PerformanceIndexes';
import { ConversationsAndForms20260521000040 }     from '../src/database/migrations/20260521000040_ConversationsAndForms';
import { LeadsContactsOperationalRefactor20260528000002 } from '../src/database/migrations/20260528000002_LeadsContactsOperationalRefactor';

const migrations: { name: string; instance: MigrationInterface }[] = [
  { name: 'InitialSchema20240101000000',             instance: new InitialSchema20240101000000() },
  { name: 'WorkflowTransitions20240601000001',       instance: new WorkflowTransitions20240601000001() },
  { name: 'DomainEventLog20240602000001',            instance: new DomainEventLog20240602000001() },
  { name: 'AuditLogEnterpriseColumns20260516000001', instance: new AuditLogEnterpriseColumns20260516000001() },
  { name: 'ActivityLogs20260520000002',              instance: new ActivityLogs20260520000002() },
  { name: 'SupabaseAuthColumnNames20260520000004',   instance: new SupabaseAuthColumnNames20260520000004() },
  { name: 'RLSPolicies20260520000020',               instance: new RLSPolicies20260520000020() },
  { name: 'PerformanceIndexes20260521000030',        instance: new PerformanceIndexes20260521000030() },
  { name: 'ConversationsAndForms20260521000040',     instance: new ConversationsAndForms20260521000040() },
  { name: 'LeadsContactsOperationalRefactor20260528000002', instance: new LeadsContactsOperationalRefactor20260528000002() },
];

// Mock QueryRunner that captures SQL instead of executing it
function createMockQueryRunner(sqlLines: string[]): QueryRunner {
  return {
    query: async (sql: string) => {
      let trimmed = sql.trim().replace(/\n\s*\n/g, '\n').trim();
      // CONCURRENTLY is not allowed in transactions (SQL Editor wraps in transaction)
      trimmed = trimmed.replace(/\bCONCURRENTLY\s+/gi, '');
      if (trimmed) sqlLines.push(trimmed + ';');
    },
    // Stub other QueryRunner methods to prevent errors
    hasError: false,
    manager: {} as any,
    connection: {} as any,
    isTransactionActive: false,
    data: {},
    connect: async () => {},
    release: async () => {},
    startTransaction: async () => {},
    commitTransaction: async () => {},
    rollbackTransaction: async () => {},
    clearDatabase: async () => {},
    getTable: async () => undefined,
    getTables: async () => [],
    hasTable: async () => false,
    hasColumn: async () => false,
    hasIndex: async () => false,
    createSchema: async () => {},
    dropSchema: async () => {},
    createTable: async () => {},
    dropTable: async () => {},
    renameTable: async () => {},
    addColumn: async () => {},
    addColumns: async () => {},
    renameColumn: async () => {},
    changeColumn: async () => {},
    changeColumns: async () => {},
    dropColumn: async () => {},
    dropColumns: async () => {},
    createPrimaryKey: async () => {},
    updatePrimaryKeys: async () => {},
    dropPrimaryKey: async () => {},
    createUniqueConstraint: async () => {},
    createUniqueConstraints: async () => {},
    dropUniqueConstraint: async () => {},
    dropUniqueConstraints: async () => {},
    createCheckConstraint: async () => {},
    createCheckConstraints: async () => {},
    dropCheckConstraint: async () => {},
    dropCheckConstraints: async () => {},
    createForeignKey: async () => {},
    createForeignKeys: async () => {},
    dropForeignKey: async () => {},
    dropForeignKeys: async () => {},
    createIndex: async () => {},
    createIndices: async () => {},
    dropIndex: async () => {},
    dropIndices: async () => {},
    clearTable: async () => {},
    stream: async () => ({} as any),
    getDatabases: async () => [],
    getSchemas: async () => [],
    getView: async () => undefined,
    getViews: async () => [],
    hasDatabase: async () => false,
    hasSchema: async () => false,
    hasView: async () => false,
    createView: async () => {},
    dropView: async () => {},
    getReplicationMode: () => 'master' as any,
  } as unknown as QueryRunner;
}

async function main(): Promise<void> {
  const now = new Date().toISOString();

  const lines: string[] = [
    '-- ============================================================',
    '-- MUSIC OS 360 — Complete Migration SQL',
    `-- Generated: ${now}`,
    '-- Run this in Supabase SQL Editor (Dashboard → SQL Editor)',
    '-- ============================================================',
    '',
    '-- ── PREAMBLE: patch pre-existing tables from prior schema tools ─────────────',
    '-- These ALTER TABLE statements are fully idempotent (IF EXISTS / IF NOT EXISTS).',
    '-- They run BEFORE any CREATE INDEX so columns exist before indexes reference them.',
    'CREATE EXTENSION IF NOT EXISTS "pg_trgm";',
    'ALTER TABLE IF EXISTS "organizations" ADD COLUMN IF NOT EXISTS "external_auth_org_id" VARCHAR(255);',
    'ALTER TABLE IF EXISTS "organizations" ADD COLUMN IF NOT EXISTS "plan"             VARCHAR(50)  NOT NULL DEFAULT \'starter\';',
    'ALTER TABLE IF EXISTS "organizations" ADD COLUMN IF NOT EXISTS "billing_status"   VARCHAR(50)  NOT NULL DEFAULT \'trial\';',
    'ALTER TABLE IF EXISTS "organizations" ADD COLUMN IF NOT EXISTS "industry"         VARCHAR(100) NOT NULL DEFAULT \'gravadora\';',
    'ALTER TABLE IF EXISTS "organizations" ADD COLUMN IF NOT EXISTS "cnpj_encrypted"   TEXT;',
    'ALTER TABLE IF EXISTS "organizations" ADD COLUMN IF NOT EXISTS "phone"            VARCHAR(50);',
    'ALTER TABLE IF EXISTS "organizations" ADD COLUMN IF NOT EXISTS "address"          JSONB        NOT NULL DEFAULT \'{}\';',
    'ALTER TABLE IF EXISTS "organizations" ADD COLUMN IF NOT EXISTS "config"           JSONB        NOT NULL DEFAULT \'{}\';',
    'ALTER TABLE IF EXISTS "organizations" ADD COLUMN IF NOT EXISTS "metadata"         JSONB        NOT NULL DEFAULT \'{}\';',
    'ALTER TABLE IF EXISTS "organizations" ADD COLUMN IF NOT EXISTS "updated_at"       TIMESTAMP    NOT NULL DEFAULT NOW();',
    'ALTER TABLE IF EXISTS "organizations" ADD COLUMN IF NOT EXISTS "deleted_at"       TIMESTAMP;',
    'ALTER TABLE IF EXISTS "tenants"       ADD COLUMN IF NOT EXISTS "external_auth_org_id" VARCHAR(255);',
    'ALTER TABLE IF EXISTS "tenants"       ADD COLUMN IF NOT EXISTS "features"         JSONB        NOT NULL DEFAULT \'{}\';',
    'ALTER TABLE IF EXISTS "tenants"       ADD COLUMN IF NOT EXISTS "settings"         JSONB        NOT NULL DEFAULT \'{}\';',
    'ALTER TABLE IF EXISTS "tenants"       ADD COLUMN IF NOT EXISTS "active"           BOOLEAN      NOT NULL DEFAULT TRUE;',
    'ALTER TABLE IF EXISTS "tenants"       ADD COLUMN IF NOT EXISTS "deleted_at"       TIMESTAMP;',
    'ALTER TABLE IF EXISTS "tenants"       ADD COLUMN IF NOT EXISTS "updated_at"       TIMESTAMP    NOT NULL DEFAULT NOW();',
    'ALTER TABLE IF EXISTS "org_members"   ADD COLUMN IF NOT EXISTS "auth_user_id"     VARCHAR(255);',
    'ALTER TABLE IF EXISTS "org_members"   ADD COLUMN IF NOT EXISTS "full_name"        VARCHAR(255);',
    'ALTER TABLE IF EXISTS "org_members"   ADD COLUMN IF NOT EXISTS "is_active"        BOOLEAN      NOT NULL DEFAULT TRUE;',
    'ALTER TABLE IF EXISTS "org_members"   ADD COLUMN IF NOT EXISTS "joined_at"        TIMESTAMP;',
    'ALTER TABLE IF EXISTS "org_members"   ADD COLUMN IF NOT EXISTS "updated_at"       TIMESTAMP    NOT NULL DEFAULT NOW();',
    '',
    '-- ── Migration tracking table ──────────────────────────────────────────────────',
    `CREATE TABLE IF NOT EXISTS "musicos360_migrations" (`,
    `  "id"        SERIAL PRIMARY KEY,`,
    `  "timestamp" BIGINT NOT NULL,`,
    `  "name"      VARCHAR NOT NULL`,
    `);`,
    '',
  ];

  for (const { name, instance } of migrations) {
    const sqlLines: string[] = [];
    const runner = createMockQueryRunner(sqlLines);

    lines.push(`-- ── Migration: ${name} ──────────────────────────────────────────────`);
    lines.push('');

    await instance.up(runner);

    lines.push(...sqlLines);
    lines.push('');

    // Extract timestamp from name (first 14 digits)
    const tsMatch = name.match(/(\d{14})/);
    const ts = tsMatch ? tsMatch[1] : '0';
    lines.push(`INSERT INTO "musicos360_migrations" ("timestamp", "name") VALUES (${ts}, '${name}') ON CONFLICT DO NOTHING;`);
    lines.push('');
  }

  lines.push('-- ============================================================');
  lines.push('-- All migrations applied successfully');
  lines.push('-- ============================================================');

  process.stdout.write(lines.join('\n') + '\n');
}

main().catch((err) => {
  process.stderr.write(`[dump-migrations-sql] Error: ${(err as Error).message}\n`);
  process.exit(1);
});
