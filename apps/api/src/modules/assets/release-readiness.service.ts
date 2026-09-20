/**
 * modules/assets/release-readiness.service.ts
 *
 * Release Readiness Skill (real). Avalia os requisitos OBRIGATÓRIOS antes de
 * liberar um lançamento para distribuição, reusando o modelo central de assets:
 *   - Capa aprovada (cover_art vinculada ao projeto)
 *   - WAV Master (wav/master vinculado ao projeto)
 *   - ISRC (no fonograma)
 *   - Registro de fonograma (fonograma existente)
 *   - Registro de obra (quando há obra associada)
 *   - Metadados obrigatórios (título, artista, gênero, intérpretes)
 *
 * Executa via SkillRunService → persistência/auditoria/eventos skill.* automáticos.
 * Apenas avaliação (não publica). Infraestrutura interna.
 */

import { Injectable, Inject, Optional, Logger } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { DATA_SOURCE } from '../../database/database.module';
import { PhonogramEntity, WorkEntity } from '../../database/entities';
import { SkillRunService } from '../../core/skills/skill-run.service';
import { AssetLinkingService } from './asset-linking.service';

export type RequirementStatus = 'met' | 'missing' | 'not_applicable';

export interface ReadinessRequirement {
  id: string;
  label: string;
  status: RequirementStatus;
  blocking: boolean;
  detail?: string;
}

export interface ReleaseReadinessInput {
  projectId?: string | null;
  phonogramId?: string | null;
}

export interface ReleaseReadinessResult {
  ready: boolean;
  requirements: ReadinessRequirement[];
  missing: string[];
}

const COVER_TYPES = new Set(['cover_art']);
const MASTER_TYPES = new Set(['wav', 'master']);

@Injectable()
export class ReleaseReadinessService {
  private readonly logger = new Logger(ReleaseReadinessService.name);
  private readonly phonograms: Repository<PhonogramEntity> | null = null;
  private readonly works: Repository<WorkEntity> | null = null;

  constructor(
    @Inject(DATA_SOURCE) @Optional() ds: DataSource | null,
    private readonly skillRuns: SkillRunService,
    private readonly assetLinking: AssetLinkingService,
  ) {
    if (ds) {
      this.phonograms = ds.getRepository(PhonogramEntity);
      this.works = ds.getRepository(WorkEntity);
    }
  }

  /** Avalia a prontidão para distribuição (executa como skill com auditoria). */
  async evaluate(tenantId: string, input: ReleaseReadinessInput, actorId?: string): Promise<ReleaseReadinessResult> {
    return this.skillRuns.run<ReleaseReadinessResult>(
      {
        tenantId,
        userId: actorId,
        skillName: 'release-readiness',
        entityType: input.phonogramId ? 'phonogram' : 'project',
        entityId: input.phonogramId ?? input.projectId ?? null,
        input: input as unknown as Record<string, unknown>,
      },
      async (ctx) => {
        const requirements: ReadinessRequirement[] = [];

        // ── Assets vinculados ao projeto (capa + master) ───────────────────────
        const assets = input.projectId
          ? await this.assetLinking.getProjectAssetsDetailed(tenantId, input.projectId)
          : [];
        const hasCover = assets.some((a) => a.assetType != null && COVER_TYPES.has(a.assetType) && a.status === 'active');
        const hasMaster = assets.some((a) => a.assetType != null && MASTER_TYPES.has(a.assetType) && a.status === 'active');
        requirements.push({ id: 'cover_art', label: 'Capa aprovada', status: hasCover ? 'met' : 'missing', blocking: true });
        requirements.push({ id: 'wav_master', label: 'WAV Master', status: hasMaster ? 'met' : 'missing', blocking: true });

        // ── Fonograma: ISRC + registro + metadados ─────────────────────────────
        const phonogram = input.phonogramId && this.phonograms
          ? await this.phonograms.findOne({ where: { id: input.phonogramId, tenant_id: tenantId } })
          : null;

        requirements.push({
          id: 'phonogram',
          label: 'Registro de fonograma',
          status: phonogram ? 'met' : 'missing',
          blocking: true,
        });
        requirements.push({
          id: 'isrc',
          label: 'ISRC',
          status: phonogram?.isrc ? 'met' : 'missing',
          blocking: true,
        });

        const metaOk = !!(phonogram?.title && phonogram?.music_genre && phonogram?.interpretes && phonogram?.artist_id);
        requirements.push({
          id: 'metadata',
          label: 'Metadados obrigatórios',
          status: metaOk ? 'met' : 'missing',
          blocking: true,
          detail: metaOk ? undefined : 'Exige título, artista, gênero e intérpretes',
        });

        // ── Registro de obra (condicional) ─────────────────────────────────────
        if (phonogram?.work_id && this.works) {
          const work = await this.works.findOne({ where: { id: phonogram.work_id, tenant_id: tenantId } });
          requirements.push({
            id: 'work',
            label: 'Registro de obra',
            status: work ? 'met' : 'missing',
            blocking: true,
          });
        } else {
          requirements.push({ id: 'work', label: 'Registro de obra', status: 'not_applicable', blocking: false });
        }

        const missing = requirements.filter((r) => r.blocking && r.status === 'missing').map((r) => r.id);
        const ready = missing.length === 0;

        await ctx.log('info', `Release readiness: ${ready ? 'PRONTO' : 'BLOQUEADO'}`, { missing });

        const result: ReleaseReadinessResult = { ready, requirements, missing };
        return { result, output: result as unknown as Record<string, unknown> };
      },
    );
  }
}
