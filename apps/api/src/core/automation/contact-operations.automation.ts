/**
 * core/automation/contact-operations.automation.ts
 *
 * NATIVE, INTERNAL and INVISIBLE automation:
 *   client.created → contact-operations → saves a SUGGESTION in
 *   clients.metadata.aiContactOperations
 *
 * All common orchestration (metadata + skill_runs idempotency, auditing,
 * envelope, persistence, fail-safe) lives in `runNativeSkillAutomation`. Only
 * the specific parts live here: loading the client, assembling the input and the
 * UPDATE of the `clients` table.
 *
 * client.created fires ONLY on creation via lead conversion
 * (LeadEventsHandler.convertLead, after the transaction commits) — the moment
 * a new commercial relationship is born. Distinct from crm-followup, which
 * acts on lead.created (BEFORE the conversion, trying to close the deal);
 * contact-operations acts AFTERWARDS, helping to operationalize the relationship with the
 * newly created client. Only writes an internal SUGGESTION — does not change the client's
 * official data, does not write to any "timeline"/interaction
 * history.
 */

import { Injectable, Inject, Optional } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { DataSource, EntityManager } from 'typeorm';
import { DATA_SOURCE } from '../../database/database.module';
import { DatabaseContextService } from '../../database/database-context.service';
import { DOMAIN_EVENTS } from '../events/events.service';
import type { DomainEvent } from '../events/events.service';
import type { ClientCreatedPayload } from '../events/domain-events.types';
import { SkillRunService } from '../skills/skill-run.service';
import { AIService } from '../../modules/ai/ai.service';
import {
  CONTACT_OPERATIONS_SYSTEM_PROMPT,
  buildContactOperationsPrompt,
  parseContactOperationsResponse,
  validateContactOperationsInput,
  type ContactOperationsInput,
} from '@music-os-360/ai-skills';
import { runNativeSkillAutomation } from './native-skill-automation.runner';

const SKILL_NAME = 'contact-operations';

interface ClientRow {
  nome: string | null;
  categoria: string | null;
  tipo_pessoa: string | null;
  responsavel_nome: string | null;
  metadata: Record<string, unknown> | null;
}

@Injectable()
export class ContactOperationsAutomation {
  private readonly ds: DataSource | null;

  constructor(
    @Inject(DATA_SOURCE) @Optional() ds: DataSource | null,
    private readonly skillRun: SkillRunService,
    private readonly ai: AIService,
    @Optional() private readonly dbContext?: DatabaseContextService,
  ) {
    this.ds = ds ?? null;
  }

  @OnEvent(DOMAIN_EVENTS.CLIENT_CREATED, { async: true })
  async onClientCreated(event: DomainEvent<ClientCreatedPayload>): Promise<void> {
    const tenantId = event.tenantId;
    const payload = event.payload;
    const clientId = payload?.clientId;

    await runNativeSkillAutomation<ClientRow, ContactOperationsInput>(
      { ds: this.ds, dbContext: this.dbContext, skillRun: this.skillRun, ai: this.ai },
      {
        eventName: DOMAIN_EVENTS.CLIENT_CREATED,
        skillName: SKILL_NAME,
        tenantId,
        userId: payload?.createdBy ?? null,
        entityType: 'client',
        entityId: clientId,
        metadataKey: 'aiContactOperations',
        systemPrompt: CONTACT_OPERATIONS_SYSTEM_PROMPT,
        load: (manager) => this.loadClient(tenantId, clientId, manager),
        getMetadata: (row) => (row.metadata ?? {}) as Record<string, unknown>,
        buildInput: (row) => this.buildInput(row, payload?.sourceLeadId ?? null),
        validateInput: validateContactOperationsInput,
        buildPrompt: buildContactOperationsPrompt,
        parseResponse: parseContactOperationsResponse,
        saveMetadata: (next, manager) => this.persistMetadata(tenantId, clientId, next, manager),
      },
    );
  }

  // ── Persistence (read/write of clients.metadata via DataSource) ──────

  private async loadClient(
    tenantId: string,
    clientId: string,
    manager: EntityManager,
  ): Promise<ClientRow | null> {
    if (!this.ds) return null;
    const rows = (await manager.query(
      `SELECT nome, categoria, tipo_pessoa, responsavel_nome, metadata
         FROM clients
        WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL
        LIMIT 1`,
      [clientId, tenantId],
    )) as ClientRow[];
    return rows?.[0] ?? null;
  }

  private async persistMetadata(
    tenantId: string,
    clientId: string,
    nextMetadata: Record<string, unknown>,
    manager: EntityManager,
  ): Promise<void> {
    if (!this.ds) return;
    await manager.query(
      `UPDATE clients SET metadata = $1::jsonb, updated_at = NOW()
        WHERE id = $2 AND tenant_id = $3 AND deleted_at IS NULL`,
      [JSON.stringify(nextMetadata), clientId, tenantId],
    );
  }

  // ── Montagem do input da skill ──────────────────────────────────────────────

  private buildInput(c: ClientRow, sourceLeadId: string | null): ContactOperationsInput {
    const input: ContactOperationsInput = {
      clientName: c.nome?.trim() || 'Cliente',
      clientCategory: c.categoria?.trim() || 'geral',
      clientTipoPessoa: c.tipo_pessoa?.trim() || 'pessoa_juridica',
      language: 'pt-BR',
    };

    if (c.responsavel_nome?.trim()) input.responsavelNome = c.responsavel_nome.trim();
    if (sourceLeadId) input.sourceLeadId = sourceLeadId;

    return input;
  }
}
