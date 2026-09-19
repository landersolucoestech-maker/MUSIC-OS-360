import { Injectable, Inject, Optional, NotFoundException, Logger, ServiceUnavailableException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { DATA_SOURCE } from '../../database/database.module';
import { FinancialRuleEntity } from '../../database/entities';
import { EventsService, DOMAIN_EVENTS } from '../../core/events/events.service';
import { casUpdate } from '../../common/persistence/optimistic-update.util';
import type { CreateFinancialRuleDto, UpdateFinancialRuleDto, QueryFinancialRuleDto } from './dto/financial-rules.dto';

export type FinancialRuleTrigger =
  | 'transaction.created'
  | 'transaction.paid'
  | 'invoice.overdue'
  | 'contract.signed';

@Injectable()
export class FinancialRulesService {
  private readonly logger = new Logger(FinancialRulesService.name);
  private readonly repo: Repository<FinancialRuleEntity> | null;

  constructor(
    @Inject(DATA_SOURCE) ds: DataSource | null,
    @Optional() private readonly events: EventsService,
  ) {
    this.repo = ds?.getRepository(FinancialRuleEntity) ?? null;
  }

  private get repository(): Repository<FinancialRuleEntity> {
    if (!this.repo) {
      throw new ServiceUnavailableException('Database unavailable for financial rules');
    }
    return this.repo;
  }

  async list(tenantId: string, query: QueryFinancialRuleDto) {
    const qb = this.repository.createQueryBuilder('r')
      .where('r.tenant_id = :tenantId', { tenantId })
      .andWhere('r.deleted_at IS NULL');

    if (query.type)     qb.andWhere('r.type = :type',           { type: query.type });
    if (query.category) qb.andWhere('r.category = :category', { category: query.category });
    if (query.ativo !== undefined) qb.andWhere('r.ativo = :ativo', { ativo: query.ativo });
    if (query.search)   qb.andWhere('r.nome ILIKE :search',     { search: `%${query.search}%` });

    qb.orderBy('r.nome', 'ASC')
      .skip(query.offset ?? 0)
      .take(query.limit ?? 100);

    const [data, total] = await qb.getManyAndCount();
    return { data, meta: { total, offset: query.offset ?? 0, limit: query.limit ?? 100 } };
  }

  async findById(tenantId: string, id: string): Promise<FinancialRuleEntity> {
    const item = await this.repository.findOne({ where: { id, tenant_id: tenantId, deleted_at: null } as any });
    if (!item) throw new NotFoundException('Regra financeira não encontrada');
    return item;
  }

  async create(tenantId: string, userId: string, dto: CreateFinancialRuleDto): Promise<FinancialRuleEntity> {
    const item = this.repository.create({ tenant_id: tenantId, ...dto, created_by: userId, updated_by: userId } as any);
    return this.repository.save(item as any) as any;
  }

  async update(tenantId: string, userId: string, id: string, dto: UpdateFinancialRuleDto): Promise<FinancialRuleEntity> {
    await this.findById(tenantId, id);
    const updates: Record<string, unknown> = { ...dto, updated_at: new Date(), updated_by: userId };
    const expectedUpdatedAt = updates['expectedUpdatedAt'] as string | undefined;
    delete updates['expectedUpdatedAt'];
    await casUpdate(
      this.repository,
      { id, tenant_id: tenantId } as any,
      updates as any,
      expectedUpdatedAt,
      'Esta regra financeira foi alterada por outro usuário desde que você a carregou. Recarregue e tente novamente.',
    );
    return this.findById(tenantId, id);
  }

  async softDelete(tenantId: string, id: string) {
    await this.findById(tenantId, id);
    await this.repository.update({ id, tenant_id: tenantId } as any, { deleted_at: new Date() } as any);
    return { deleted: true };
  }

  /**
   * Evaluate all active financial rules for the given trigger and context.
   * Emits FINANCIAL_RULE_TRIGGERED for each matching rule.
   * Called from TransactionsService, InvoicesService, ContractsService on relevant events.
   */
  async evaluateRules(
    tenantId: string,
    trigger: FinancialRuleTrigger,
    context: {
      entityId:   string | null;
      entityType: string | null;
      valor?:     number;
      category?:  string;
      type?:      string;
    },
  ): Promise<void> {
    if (!this.events) return;

    let rules: FinancialRuleEntity[];
    try {
      if (!this.repo) return;
      rules = await this.repo
        .createQueryBuilder('r')
        .where('r.tenant_id = :tenantId AND r.ativo = true AND r.deleted_at IS NULL', { tenantId })
        .getMany();
    } catch (err) {
      this.logger.warn(`evaluateRules: failed to fetch rules — ${String(err)}`);
      return;
    }

    for (const rule of rules) {
      const conds = (rule.condicoes ?? {}) as Record<string, unknown>;

      // Trigger filter: if rule specifies triggers, check match
      if (Array.isArray(conds['triggers']) && !(conds['triggers'] as string[]).includes(trigger)) continue;

      // Category filter
      if (rule.category && context.category && rule.category !== context.category) continue;

      // Tipo filter
      if (conds['type'] && context.type && conds['type'] !== context.type) continue;

      // Compute result
      const valor  = context.valor ?? 0;
      const ruleVal = parseFloat(String(rule.valor));
      let computed: number;
      if (rule.calculo === 'percentual') computed = (valor * ruleVal) / 100;
      else if (rule.calculo === 'fixo')  computed = ruleVal;
      else {
        // REM-03: 'faixa' (tiered/bracket) ainda não tem estrutura de faixas
        // persistida (schema de brackets é decisão de produto em aberto — ver
        // FinancialRules.tsx "Faixa (em breve)"). Nunca fabricar computed=0
        // como se fosse um resultado real — pula a regra e avisa.
        this.logger.warn(
          `evaluateRules: regra "${rule.nome}" (${rule.id}) usa calculo="${rule.calculo}" ainda não implementado — pulando, nenhum evento emitido`,
        );
        continue;
      }

      const result = { trigger, computed, ruleCalculo: rule.calculo, ruleValor: ruleVal, contextValor: valor };

      try {
        this.events.emitTyped(DOMAIN_EVENTS.FINANCIAL_RULE_TRIGGERED, {
          tenantId,
          userId:        'system',
          aggregateType: 'financial_rule',
          aggregateId:   rule.id,
          payload: {
            ruleId:     rule.id,
            tenantId,
            ruleName:   rule.nome,
            ruleType:   rule.type,
            trigger,
            entityId:   context.entityId,
            entityType: context.entityType,
            result,
          },
        });
        this.logger.log(`FinancialRule "${rule.nome}" (${rule.id}) triggered by ${trigger}`);
      } catch (err) {
        this.logger.warn(`evaluateRules: emit failed for rule "${rule.id}" — ${String(err)}`);
      }
    }
  }
}
