/**
 * core/automation/financial-classification.automation.ts
 *
 * NATIVE, INTERNAL and INVISIBLE automation:
 *   transaction.created → financial-classification → saves a SUGGESTION in
 *   transactions.metadata.aiClassification
 *
 * All common orchestration (metadata + skill_runs idempotency, auditing,
 * envelope, persistence, fail-safe) lives in `runNativeSkillAutomation`. Only
 * the specific parts live here: loading the transaction, assembling the input and the
 * UPDATE of the `transactions` table.
 *
 * Guarantees inherited from the runner: non-blocking execution, an AI failure never reverts the
 * transaction creation, double idempotency guard (recent running/success
 * block; stale running/failed allow a retry). Only writes an internal SUGGESTION —
 * does NOT post a definitive classification, does NOT change the official category or cost
 * center, no tasks, no notifications, no new tables.
 */

import { Injectable, Inject, Optional } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { DataSource, EntityManager } from 'typeorm';
import { DATA_SOURCE } from '../../database/database.module';
import { DatabaseContextService } from '../../database/database-context.service';
import { DOMAIN_EVENTS } from '../events/events.service';
import type { DomainEvent } from '../events/events.service';
import type { TransactionCreatedPayload } from '../events/domain-events.types';
import { SkillRunService } from '../skills/skill-run.service';
import { AIService } from '../../modules/ai/ai.service';
import {
  FINANCIAL_CLASSIFICATION_SYSTEM_PROMPT,
  buildFinancialClassificationPrompt,
  parseFinancialClassificationResponse,
  validateFinancialClassificationInput,
  type FinancialClassificationInput,
  type FinancialDirection,
} from '@music-os-360/ai-skills';
import { runNativeSkillAutomation } from './native-skill-automation.runner';

const SKILL_NAME = 'financial-classification';

interface TransactionRow {
  type: string | null;
  category: string | null;
  description: string | null;
  amount: string | null;
  transaction_date: string | Date | null;
  notes: string | null;
  artist_name: string | null;
  metadata: Record<string, unknown> | null;
}

/** Maps the transaction `type` (revenue/expense) to the skill's direction. */
function mapDirection(type: string | null | undefined): FinancialDirection {
  return (type ?? '').trim().toLowerCase() === 'revenue' ? 'income' : 'expense';
}

@Injectable()
export class FinancialClassificationAutomation {
  private readonly ds: DataSource | null;

  constructor(
    @Inject(DATA_SOURCE) @Optional() ds: DataSource | null,
    private readonly skillRun: SkillRunService,
    private readonly ai: AIService,
    @Optional() private readonly dbContext?: DatabaseContextService,
  ) {
    this.ds = ds ?? null;
  }

  @OnEvent(DOMAIN_EVENTS.TRANSACTION_CREATED, { async: true })
  async onTransactionCreated(event: DomainEvent<TransactionCreatedPayload>): Promise<void> {
    const tenantId = event.tenantId;
    const payload = event.payload;
    const transactionId = payload?.transactionId;

    await runNativeSkillAutomation<TransactionRow, FinancialClassificationInput>(
      { ds: this.ds, dbContext: this.dbContext, skillRun: this.skillRun, ai: this.ai },
      {
        eventName: DOMAIN_EVENTS.TRANSACTION_CREATED,
        skillName: SKILL_NAME,
        tenantId,
        userId: payload?.createdBy ?? null,
        entityType: 'transaction',
        entityId: transactionId,
        metadataKey: 'aiClassification',
        systemPrompt: FINANCIAL_CLASSIFICATION_SYSTEM_PROMPT,
        load: (manager) => this.loadTransaction(tenantId, transactionId, manager),
        getMetadata: (row) => (row.metadata ?? {}) as Record<string, unknown>,
        buildInput: (row) => this.buildInput(row),
        validateInput: validateFinancialClassificationInput,
        buildPrompt: buildFinancialClassificationPrompt,
        parseResponse: parseFinancialClassificationResponse,
        saveMetadata: (next, manager) => this.persistMetadata(tenantId, transactionId, next, manager),
      },
    );
  }

  // ── Persistence (read/write of transactions.metadata via DataSource) ───

  private async loadTransaction(
    tenantId: string,
    transactionId: string,
    manager: EntityManager,
  ): Promise<TransactionRow | null> {
    if (!this.ds) return null;
    const rows = (await manager.query(
      `SELECT t.type, t.category, t.description, t.amount, t.transaction_date, t.notes, t.metadata,
              a.nome_artistico AS artist_name
         FROM transactions t
         LEFT JOIN artists a
           ON a.id = t.artist_id AND a.tenant_id = t.tenant_id AND a.deleted_at IS NULL
        WHERE t.id = $1 AND t.tenant_id = $2 AND t.deleted_at IS NULL
        LIMIT 1`,
      [transactionId, tenantId],
    )) as TransactionRow[];
    return rows?.[0] ?? null;
  }

  private async persistMetadata(
    tenantId: string,
    transactionId: string,
    nextMetadata: Record<string, unknown>,
    manager: EntityManager,
  ): Promise<void> {
    if (!this.ds) return;
    await manager.query(
      `UPDATE transactions SET metadata = $1::jsonb, updated_at = NOW()
        WHERE id = $2 AND tenant_id = $3 AND deleted_at IS NULL`,
      [JSON.stringify(nextMetadata), transactionId, tenantId],
    );
  }

  // ── Skill input assembly ────────────────────────────────────────────────────

  private buildInput(tx: TransactionRow): FinancialClassificationInput {
    const md = (tx.metadata ?? {}) as Record<string, unknown>;

    const input: FinancialClassificationInput = {
      description: tx.description?.trim() || tx.category?.trim() || 'Transação financeira',
      amount: Number(tx.amount ?? 0),
      direction: mapDirection(tx.type),
      language: 'pt-BR',
    };

    if (tx.transaction_date) input.date = new Date(tx.transaction_date).toISOString();
    if (tx.artist_name?.trim()) input.relatedArtist = tx.artist_name.trim();

    const context = typeof md.context === 'string' ? md.context : tx.notes;
    if (context) input.context = context;

    return input;
  }
}
