/**
 * core/automation/deals-crm.automation.ts
 *
 * Skill ON_DEMAND (ver on-demand-skill.runner.ts): análise do pipeline
 * comercial (deals = contratos reais, ContractEntity.client_id) de um
 * cliente, disparada por ação explícita do usuário na tela do cliente.
 *
 * "Deal" = contrato. dealStage é SEMPRE derivado deterministicamente do
 * ContractStatus real aqui no código — nunca decidido pelo modelo. Reaproveita
 * ClientsService.findById()/getContracts() (já reais, já existentes) — nenhum
 * novo domínio "pipeline_opportunities" é criado ou consultado (esse schema
 * existe mas está explicitamente sem contrato auditado, ver
 * apps/api/src/modules/reports/pipeline-forms-not-reportable.guard.spec.ts).
 */

import { Injectable } from '@nestjs/common';
import { SkillRunService } from '../skills/skill-run.service';
import { AIService } from '../../modules/ai/ai.service';
import { ClientsService } from '../../modules/clients/clients.service';
import {
  DEALS_CRM_SYSTEM_PROMPT,
  buildDealsCrmPrompt,
  parseDealsCrmResponse,
  validateDealsCrmInput,
  type DealsCrmInput,
  type DealsCrmOutput,
  type DealStage,
  type DealsCrmDeal,
} from '@music-os-360/ai-skills';
import { runOnDemandSkill, type OnDemandSkillResult } from './on-demand-skill.runner';

const SKILL_NAME = 'deals-crm';

interface ContractRow {
  id: string;
  title: string;
  type: string;
  status: string;
  valor: string | null;
  start_date: string | Date | null;
  end_date: string | Date | null;
}

const WON_STATUSES = new Set(['signed', 'active', 'in_force']);
const AT_RISK_STATUSES = new Set(['expiring']);
const LOST_STATUSES = new Set(['expired', 'terminated', 'cancelled']);

/** Deriva deterministicamente o estágio do deal a partir do ContractStatus real. */
function mapContractStatusToDealStage(status: string): DealStage {
  if (WON_STATUSES.has(status)) return 'won';
  if (AT_RISK_STATUSES.has(status)) return 'at_risk';
  if (LOST_STATUSES.has(status)) return 'lost';
  return 'open'; // draft, under_review, awaiting_signature
}

@Injectable()
export class DealsCrmAutomation {
  constructor(
    private readonly skillRun: SkillRunService,
    private readonly ai: AIService,
    private readonly clients: ClientsService,
  ) {}

  async run(
    tenantId: string,
    userId: string,
    clientId: string,
  ): Promise<OnDemandSkillResult<DealsCrmOutput>> {
    const [client, contracts] = await Promise.all([
      this.clients.findById(tenantId, clientId),
      this.clients.getContracts(tenantId, clientId) as Promise<ContractRow[]>,
    ]);

    const deals: DealsCrmDeal[] = contracts.map((c) => {
      const deal: DealsCrmDeal = {
        title: c.title,
        type: c.type,
        stage: mapContractStatusToDealStage(c.status),
        value: c.valor != null ? Number(c.valor) : null,
      };
      if (c.start_date) deal.startDate = new Date(c.start_date).toISOString();
      if (c.end_date) deal.endDate = new Date(c.end_date).toISOString();
      return deal;
    });

    const input: DealsCrmInput = {
      clientName: (client as { name?: string }).name?.trim() || 'Cliente',
      clientCategory: (client as { category?: string }).category?.trim() || 'geral',
      deals,
      language: 'pt-BR',
    };

    return runOnDemandSkill<DealsCrmInput, DealsCrmOutput>(
      { skillRun: this.skillRun, ai: this.ai },
      {
        skillName: SKILL_NAME,
        tenantId,
        userId,
        entityType: 'client',
        entityId: clientId,
        systemPrompt: DEALS_CRM_SYSTEM_PROMPT,
        input,
        buildPrompt: buildDealsCrmPrompt,
        parseResponse: parseDealsCrmResponse,
        validateInput: validateDealsCrmInput,
      },
    );
  }
}
