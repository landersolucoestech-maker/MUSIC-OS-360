/**
 * core/automation/launch-strategy.automation.ts
 *
 * Automação NATIVA, INTERNA e INVISÍVEL:
 *   release.approved → launch-strategy → salva SUGESTÃO em
 *   releases.metadata.aiLaunchStrategy
 *
 * Toda a orquestração comum (idempotência metadata + skill_runs, auditoria,
 * envelope, persistência, fail-safe) vive em `runNativeSkillAutomation`. Aqui
 * ficam apenas as partes específicas: load do release, montagem do input e o
 * UPDATE da tabela `releases`.
 *
 * release.approved já dispara marketing-calendar-builder (calendário tático)
 * e audiovisual-briefing (briefing de produção) — esta é a terceira skill não
 * sobreposta no mesmo evento (ver doc-comment de contracts.ts para a
 * distinção de escopo). Apenas grava SUGESTÃO interna — não altera dados
 * oficiais do release.
 */

import { Injectable, Inject, Optional } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { DataSource, EntityManager } from 'typeorm';
import { DATA_SOURCE } from '../../database/database.module';
import { DatabaseContextService } from '../../database/database-context.service';
import { DOMAIN_EVENTS } from '../events/events.service';
import type { DomainEvent } from '../events/events.service';
import type { ReleaseApprovedPayload } from '../events/domain-events.types';
import { SkillRunService } from '../skills/skill-run.service';
import { AIService } from '../../modules/ai/ai.service';
import {
  LAUNCH_STRATEGY_SYSTEM_PROMPT,
  buildLaunchStrategyPrompt,
  parseLaunchStrategyResponse,
  validateLaunchStrategyInput,
  type LaunchStrategyInput,
} from '@music-os-360/ai-skills';
import { runNativeSkillAutomation } from './native-skill-automation.runner';

const SKILL_NAME = 'launch-strategy';

interface ReleaseRow {
  title: string | null;
  type: string | null;
  genero: string | null;
  data_lancamento: string | Date | null;
  artist_name: string | null;
  metadata: Record<string, unknown> | null;
}

@Injectable()
export class LaunchStrategyAutomation {
  private readonly ds: DataSource | null;

  constructor(
    @Inject(DATA_SOURCE) @Optional() ds: DataSource | null,
    private readonly skillRun: SkillRunService,
    private readonly ai: AIService,
    @Optional() private readonly dbContext?: DatabaseContextService,
  ) {
    this.ds = ds ?? null;
  }

  @OnEvent(DOMAIN_EVENTS.RELEASE_APPROVED, { async: true })
  async onReleaseApproved(event: DomainEvent<ReleaseApprovedPayload>): Promise<void> {
    const tenantId = event.tenantId;
    const payload = event.payload;
    const releaseId = payload?.releaseId;

    await runNativeSkillAutomation<ReleaseRow, LaunchStrategyInput>(
      { ds: this.ds, dbContext: this.dbContext, skillRun: this.skillRun, ai: this.ai },
      {
        eventName: DOMAIN_EVENTS.RELEASE_APPROVED,
        skillName: SKILL_NAME,
        tenantId,
        userId: payload?.approvedBy ?? null,
        entityType: 'release',
        entityId: releaseId,
        metadataKey: 'aiLaunchStrategy',
        systemPrompt: LAUNCH_STRATEGY_SYSTEM_PROMPT,
        load: (manager) => this.loadRelease(tenantId, releaseId, manager),
        getMetadata: (row) => (row.metadata ?? {}) as Record<string, unknown>,
        buildInput: (row) => this.buildInput(row),
        validateInput: validateLaunchStrategyInput,
        buildPrompt: buildLaunchStrategyPrompt,
        parseResponse: parseLaunchStrategyResponse,
        saveMetadata: (next, manager) => this.persistMetadata(tenantId, releaseId, next, manager),
      },
    );
  }

  // ── Persistência (read/write de releases.metadata via DataSource) ───────────

  private async loadRelease(
    tenantId: string,
    releaseId: string,
    manager: EntityManager,
  ): Promise<ReleaseRow | null> {
    if (!this.ds) return null;
    const rows = (await manager.query(
      `SELECT r.title, r.type, r.genero, r.data_lancamento, r.metadata,
              a.nome_artistico AS artist_name
         FROM releases r
         LEFT JOIN artists a
           ON a.id = r.artist_id AND a.tenant_id = r.tenant_id AND a.deleted_at IS NULL
        WHERE r.id = $1 AND r.tenant_id = $2 AND r.deleted_at IS NULL
        LIMIT 1`,
      [releaseId, tenantId],
    )) as ReleaseRow[];
    return rows?.[0] ?? null;
  }

  private async persistMetadata(
    tenantId: string,
    releaseId: string,
    nextMetadata: Record<string, unknown>,
    manager: EntityManager,
  ): Promise<void> {
    if (!this.ds) return;
    await manager.query(
      `UPDATE releases SET metadata = $1::jsonb, updated_at = NOW()
        WHERE id = $2 AND tenant_id = $3 AND deleted_at IS NULL`,
      [JSON.stringify(nextMetadata), releaseId, tenantId],
    );
  }

  // ── Montagem do input da skill ──────────────────────────────────────────────

  private buildInput(r: ReleaseRow): LaunchStrategyInput {
    const md = (r.metadata ?? {}) as Record<string, unknown>;

    const input: LaunchStrategyInput = {
      releaseTitle: r.title?.trim() || 'Lançamento',
      releaseType: r.type?.trim() || 'single',
      language: 'pt-BR',
    };

    if (r.artist_name?.trim()) input.artistName = r.artist_name.trim();
    if (r.genero?.trim()) input.genre = r.genero.trim();
    if (r.data_lancamento) input.releaseDate = new Date(r.data_lancamento).toISOString();

    // Reaproveita os pilares de conteúdo já gerados por marketing-calendar-builder,
    // quando existirem — dado interno real (derivado, não reescrito pelo modelo),
    // nunca inventado.
    const calendarEnvelope = md.aiMarketingCalendar as
      | { parsed?: { contentPillars?: Array<{ pillar?: unknown }> } }
      | undefined;
    const pillars = calendarEnvelope?.parsed?.contentPillars;
    if (Array.isArray(pillars) && pillars.length > 0) {
      const names = pillars
        .map((p) => (typeof p.pillar === 'string' ? p.pillar.trim() : ''))
        .filter((p) => p.length > 0);
      if (names.length > 0) {
        input.existingCalendarSummary = `Pilares de conteúdo já planejados: ${names.join(', ')}.`;
      }
    }

    return input;
  }
}
