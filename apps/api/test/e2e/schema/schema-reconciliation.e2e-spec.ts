/**
 * entity↔schema regression against a real PostgreSQL.
 * Keeps only contracts that are still alive in the current canonical schema.
 * Every write runs in a transaction with rollback.
 */
import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import { DataSource, QueryFailedError } from 'typeorm';
import {
  ALL_ENTITIES,
  ConversationEntity,
  ConversationMessageEntity,
  LeadEntity,
  TransactionEntity,
} from '../../../src/database/entities';

const TENANT = '10000000-0000-0000-0000-000000000002';

function databaseUrl(): string {
  // An explicitly-provided process env must always win over .env.development.
  const envPath = path.resolve(process.cwd(), '.env.development');
  const envText = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
  return (process.env['DATABASE_URL'] ?? envText.match(/^DATABASE_URL=(.+)$/m)?.[1] ?? '')
    .trim()
    .replace(/^["']|["']$/g, '');
}

describe('Schema reconciliation — PostgreSQL real', () => {
  let ds: DataSource;

  beforeAll(async () => {
    ds = await new DataSource({
      type: 'postgres',
      url: databaseUrl(),
      entities: ALL_ENTITIES,
      synchronize: false,
      logging: false,
      ssl: false,
    }).initialize();
  }, 30_000);

  afterAll(async () => {
    if (ds?.isInitialized) await ds.destroy();
  });

  it('conversations and messages preserve mapped enums', async () => {
    const qr = ds.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      const conversations = qr.manager.getRepository(ConversationEntity);
      const conversation = await conversations.save(conversations.create({
        tenant_id: TENANT,
        subject: 'SCHEMA_E2E',
        status: 'pending',
        channel: 'whatsapp',
      }));
      expect((await conversations.findOneByOrFail({ id: conversation.id })).status).toBe('pending');

      const messages = qr.manager.getRepository(ConversationMessageEntity);
      const message = await messages.save(messages.create({
        conversation_id: conversation.id,
        tenant_id: TENANT,
        body: 'oi',
        sender_id: 'e2e',
        sender_type: 'ai',
      }));
      expect((await messages.findOneByOrFail({ id: message.id })).sender_type).toBe('ai');
    } finally {
      await qr.rollbackTransaction();
      await qr.release();
    }
  });

  it('conversation rejects an invalid enum in the database', async () => {
    const qr = ds.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      const repo = qr.manager.getRepository(ConversationEntity);
      await expect(repo.save(repo.create({
        tenant_id: TENANT,
        status: 'invalid' as never,
        channel: 'internal',
      }))).rejects.toBeInstanceOf(QueryFailedError);
    } finally {
      await qr.rollbackTransaction().catch(() => undefined);
      await qr.release();
    }
  });

  it('transactions preserve the category and financial snapshot', async () => {
    const qr = ds.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      const repo = qr.manager.getRepository(TransactionEntity);
      const snapshot = { name: 'Royalties', code: 'ROY', path: 'receita.royalties' };
      const row = await repo.save(repo.create({
        tenant_id: TENANT,
        type: 'revenue' as never,
        category: 'royalties',
        amount: '1000.00',
        transaction_date: new Date(),
        financial_category_snapshot: snapshot,
      }));
      expect((await repo.findOneByOrFail({ id: row.id })).financial_category_snapshot).toMatchObject(snapshot);
    } finally {
      await qr.rollbackTransaction();
      await qr.release();
    }
  });

  it('financial_categories preserves the canonical nature/level contract', async () => {
    const qr = ds.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      const suffix = Date.now().toString(36);
      const inserted = await qr.query(
        `
          INSERT INTO "financial_categories" (
            "tenant_id",
            "name",
            "nature",
            "level"
          )
          VALUES ($1, $2, $3, $4)
          RETURNING
            "id",
            "nature",
            "level",
            "includes_in_pnl",
            "is_active",
            "sort_order"
        `,
        [TENANT, `Schema E2E ${suffix}`, 'operating_expense', 1],
      );

      expect(inserted[0]).toMatchObject({
        nature: 'operating_expense',
        level: 1,
        includes_in_pnl: true,
        is_active: true,
        sort_order: 0,
      });

      const persisted = await qr.query(
        `
          SELECT
            "nature",
            "level",
            "includes_in_pnl",
            "is_active",
            "sort_order"
          FROM "financial_categories"
          WHERE "id" = $1
        `,
        [inserted[0].id],
      );

      expect(persisted[0]).toMatchObject({
        nature: 'operating_expense',
        level: 1,
        includes_in_pnl: true,
        is_active: true,
        sort_order: 0,
      });
    } finally {
      await qr.rollbackTransaction();
      await qr.release();
    }
  });

  it('leads uses only columns of the current canonical schema', async () => {
    const qr = ds.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      const repo = qr.manager.getRepository(LeadEntity);
      const lead = await repo.save(repo.create({
        tenant_id: TENANT,
        name: 'SCHEMA_E2E',
        status: 'new' as never,
        source: 'manual',
        full_name: 'Fulano de Tal',
        stage_name: 'FulanX',
        whatsapp: '+5511999999999',
        instagram: '@fulanx',
        city: 'São Paulo',
        state: 'SP',
        country: 'BR',
        client_type: 'artist',
        service_type: 'digitalDistribution',
        tags: ['vip', 'inbound'],
        service_payload: { plan: 'pro' },
        // The lead origin/owner/priority/temperature/estimated value/next
        // follow-up concepts live exclusively in crm_internal_data (their dead
        // physical columns were dropped by naming-closure Cluster E,
        // 20260921000005_DropDeadLeadsCrmDualStorageColumns; keys English
        // since CZ-033).
        crm_internal_data: {
          internalScore: 9,
          responsiblePerson: 'ana',
          priority: 'high',
          temperature: 'hot',
          leadSource: 'referral',
          estimatedValue: 1500.0,
          nextFollowUpAt: '2026-07-01T12:00:00Z',
        },
      }));
      const read = await repo.findOneByOrFail({ id: lead.id });
      expect(read.service_type).toBe('digitalDistribution');
      expect(read.crm_internal_data['leadSource']).toBe('referral');
      expect(read.crm_internal_data['responsiblePerson']).toBe('ana');
      expect(read.tags).toEqual(['vip', 'inbound']);
    } finally {
      await qr.rollbackTransaction();
      await qr.release();
    }
  });
});