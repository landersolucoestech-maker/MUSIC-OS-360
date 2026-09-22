/**
 * Regressão entity↔schema contra PostgreSQL real.
 * Mantém somente contratos que continuam vivos no schema canônico atual.
 * Todas as escritas rodam em transação com rollback.
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

  it('conversations e mensagens preservam enums mapeados', async () => {
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

  it('conversation rejeita enum inválido no banco', async () => {
    const qr = ds.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      const repo = qr.manager.getRepository(ConversationEntity);
      await expect(repo.save(repo.create({
        tenant_id: TENANT,
        status: 'invalido' as never,
        channel: 'internal',
      }))).rejects.toBeInstanceOf(QueryFailedError);
    } finally {
      await qr.rollbackTransaction().catch(() => undefined);
      await qr.release();
    }
  });

  it('transactions preservam categoria e snapshot financeiro', async () => {
    const qr = ds.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      const repo = qr.manager.getRepository(TransactionEntity);
      const snapshot = { name: 'Royalties', code: 'ROY', path: 'receita.royalties' };
      const row = await repo.save(repo.create({
        tenant_id: TENANT,
        type: 'receita' as never,
        categoria: 'royalties',
        valor: '1000.00',
        data: new Date(),
        financial_category_snapshot: snapshot,
      }));
      expect((await repo.findOneByOrFail({ id: row.id })).financial_category_snapshot).toMatchObject(snapshot);
    } finally {
      await qr.rollbackTransaction();
      await qr.release();
    }
  });

  it('financial_categories preserva o contrato canônico nature/level', async () => {
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

  it('leads usa somente colunas do schema canônico atual', async () => {
    const qr = ds.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      const repo = qr.manager.getRepository(LeadEntity);
      const lead = await repo.save(repo.create({
        tenant_id: TENANT,
        nome: 'SCHEMA_E2E',
        status: 'new' as never,
        fonte: 'manual',
        nome_completo: 'Fulano de Tal',
        nome_artistico: 'FulanX',
        whatsapp: '+5511999999999',
        instagram: '@fulanx',
        city: 'São Paulo',
        state: 'SP',
        country: 'BR',
        client_type: 'artista',
        service_type: 'distribuicao',
        tags: ['vip', 'inbound'],
        payload_servico: { plano: 'pro' },
        // origem_lead/responsavel/prioridade/temperatura/estimated_value/
        // probabilidade_fechamento/proximo_follow_up: dropped as dead
        // physical columns (naming-closure Cluster E,
        // 20260921000005_DropDeadLeadsCrmDualStorageColumns) -- these
        // concepts live exclusively in dados_internos_crm now, the same
        // place real usage always wrote them.
        dados_internos_crm: {
          score_interno: 9,
          responsavel: 'ana',
          prioridade: 'alta',
          temperatura: 'quente',
          origemLead: 'indicacao',
          valorEstimado: 1500.0,
          proximoFollowUp: '2026-07-01T12:00:00Z',
        },
      }));
      const read = await repo.findOneByOrFail({ id: lead.id });
      expect(read.service_type).toBe('distribuicao');
      expect(read.dados_internos_crm['origemLead']).toBe('indicacao');
      expect(read.dados_internos_crm['responsavel']).toBe('ana');
      expect(read.tags).toEqual(['vip', 'inbound']);
    } finally {
      await qr.rollbackTransaction();
      await qr.release();
    }
  });
});