/**
 * core/automation/copywriting.automation.ts
 *
 * Skill ON_DEMAND (ver on-demand-skill.runner.ts): rascunho de texto de
 * marketing genérico (e-mail/release de imprensa/landing/rascunho geral)
 * para uma MarketingTaskEntity real — nunca sobrepõe social-content (copy
 * de post) nem ad-creative (copy de anúncio pago), que operam sobre
 * entidades e formatos estruturados distintos.
 */

import { Injectable } from '@nestjs/common';
import { Inject, Optional } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DATA_SOURCE } from '../../database/database.module';
import { SkillRunService } from '../skills/skill-run.service';
import { AIService } from '../../modules/ai/ai.service';
import { MarketingTasksService } from '../../modules/marketing/marketing-tasks.service';
import {
  COPYWRITING_SYSTEM_PROMPT,
  buildCopywritingPrompt,
  parseCopywritingResponse,
  validateCopywritingInput,
  type CopywritingInput,
  type CopywritingOutput,
  type CopywritingIntent,
} from '@music-os-360/ai-skills';
import { runOnDemandSkill, type OnDemandSkillResult } from './on-demand-skill.runner';

const SKILL_NAME = 'copywriting';

const KIND_TO_INTENT: Record<string, CopywritingIntent> = {
  email: 'email',
  e_mail: 'email',
  press: 'press_release',
  press_release: 'press_release',
  assessoria: 'press_release',
  landing: 'landing_copy',
  landing_copy: 'landing_copy',
  copywriting: 'general_draft',
};

function mapKindToIntent(kind: string | null): CopywritingIntent {
  if (!kind) return 'general_draft';
  return KIND_TO_INTENT[kind.trim().toLowerCase()] ?? 'general_draft';
}

interface TaskRow {
  title: string;
  description: string | null;
  kind: string | null;
  project_title: string | null;
  artist_name: string | null;
}

@Injectable()
export class CopywritingAutomation {
  constructor(
    @Inject(DATA_SOURCE) @Optional() private readonly ds: DataSource | null,
    private readonly skillRun: SkillRunService,
    private readonly ai: AIService,
    private readonly tasks: MarketingTasksService,
  ) {}

  async run(
    tenantId: string,
    userId: string,
    taskId: string,
    tone: string | undefined,
    sourceFacts: string[] | undefined,
  ): Promise<OnDemandSkillResult<CopywritingOutput>> {
    // Confirma existência/tenant via o service real (lança NotFoundException se ausente).
    await this.tasks.findById(tenantId, taskId);
    const row = await this.loadTaskWithProject(tenantId, taskId);

    const input: CopywritingInput = {
      taskTitle: row?.title?.trim() || 'Tarefa de marketing',
      intent: mapKindToIntent(row?.kind ?? null),
      language: 'pt-BR',
    };
    if (row?.description?.trim()) input.taskDescription = row.description.trim();
    if (row?.project_title?.trim()) input.projectTitle = row.project_title.trim();
    if (row?.artist_name?.trim()) input.artistName = row.artist_name.trim();
    if (tone?.trim()) input.tone = tone.trim();
    if (sourceFacts && sourceFacts.length > 0) input.sourceFacts = sourceFacts;

    return runOnDemandSkill<CopywritingInput, CopywritingOutput>(
      { skillRun: this.skillRun, ai: this.ai },
      {
        skillName: SKILL_NAME,
        tenantId,
        userId,
        entityType: 'marketing_task',
        entityId: taskId,
        systemPrompt: COPYWRITING_SYSTEM_PROMPT,
        input,
        buildPrompt: buildCopywritingPrompt,
        parseResponse: parseCopywritingResponse,
        validateInput: validateCopywritingInput,
      },
    );
  }

  private async loadTaskWithProject(tenantId: string, taskId: string): Promise<TaskRow | null> {
    if (!this.ds) return null;
    const rows = (await this.ds.query(
      `SELECT t.title, t.description, t.kind,
              p.title AS project_title,
              a.nome_artistico AS artist_name
         FROM marketing_tasks t
         LEFT JOIN marketing_projects p
           ON p.id = t.marketing_project_id AND p.tenant_id = t.tenant_id AND p.deleted_at IS NULL
         LEFT JOIN artists a
           ON a.id = p.artist_id AND a.tenant_id = p.tenant_id AND a.deleted_at IS NULL
        WHERE t.id = $1 AND t.tenant_id = $2 AND t.deleted_at IS NULL
        LIMIT 1`,
      [taskId, tenantId],
    )) as TaskRow[];
    return rows?.[0] ?? null;
  }
}
