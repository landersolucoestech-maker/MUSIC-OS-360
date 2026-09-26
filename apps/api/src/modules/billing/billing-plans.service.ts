import { Optional,
  Injectable, Logger, Inject, BadRequestException,
  NotFoundException, ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, Repository } from 'typeorm';
import { DATA_SOURCE } from '../../database/database.module';
import { BillingPlanEntity } from '../../database/entities';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const StripeRaw = require('stripe');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const StripeClass: new (key: string, opts: Record<string, unknown>) => StripePlansClient =
  (StripeRaw as any).default ?? StripeRaw;

interface StripePlansClient {
  products: {
    create(params: Record<string, unknown>): Promise<{ id: string }>;
    update(id: string, params: Record<string, unknown>): Promise<{ id: string }>;
  };
  prices: {
    create(params: Record<string, unknown>): Promise<{ id: string }>;
    update(id: string, params: Record<string, unknown>): Promise<{ id: string }>;
  };
}

export interface UpsertPlanInput {
  slug?: string;
  name?: string;
  description?: string | null;
  amount?: number;
  currency?: string;
  interval?: string;
  active?: boolean;
  features?: unknown[];
  limits?: Record<string, unknown>;
}

const VALID_INTERVALS = ['month', 'year'];

@Injectable()
export class BillingPlansService {
  private readonly logger = new Logger(BillingPlansService.name);
  private readonly stripe: StripePlansClient | null = null;
  private readonly planRepo: Repository<BillingPlanEntity> | null = null;

  constructor(
    @Optional() @Inject(ConfigService) private readonly config: ConfigService | undefined,
    @Inject(DATA_SOURCE) private readonly ds: DataSource | null,
  ) {
    if (ds) this.planRepo = ds.getRepository(BillingPlanEntity);
    const key = this.config?.get<string>('STRIPE_SECRET_KEY') ?? process.env.STRIPE_SECRET_KEY;
    if (key) this.stripe = new StripeClass(key, { apiVersion: '2026-04-22.dahlia' });
  }

  private get repo(): Repository<BillingPlanEntity> {
    if (!this.planRepo) throw new ServiceUnavailableException('Serviço temporariamente indisponível. Tente novamente em instantes.');
    return this.planRepo;
  }

  private get stripeRequired(): StripePlansClient {
    if (!this.stripe) throw new BadRequestException('Stripe nao configurado neste ambiente');
    return this.stripe;
  }

  // ── Reads ────────────────────────────────────────────────────────────────
  // Normalizes `features` to an array on every read: rows created before the
  // default fix (Part 84) may still have {} persisted in jsonb, which
  // breaks .map() in every consumer (billing/settings/landing screens —
  // the only ones reading via this service; the admin editor uses
  // AdminPlansService, which already unwraps `.labels` on its side). When the
  // legacy value is the {labels, color, price_annual, tier} object written by the
  // admin editor, extracts `labels` instead of discarding the already
  // registered labels. A single guard here instead of in each screen.
  private normalize(plan: BillingPlanEntity): BillingPlanEntity {
    if (Array.isArray(plan.features)) return plan;
    const labels = (plan.features as { labels?: unknown } | null)?.labels;
    plan.features = Array.isArray(labels) ? labels : [];
    return plan;
  }

  async list(opts?: { includeInactive?: boolean }): Promise<BillingPlanEntity[]> {
    const qb = this.repo.createQueryBuilder('p').orderBy('p.amount', 'ASC');
    if (!opts?.includeInactive) qb.where('p.active = true');
    const plans = await qb.getMany();
    return plans.map((p) => this.normalize(p));
  }

  /**
   * Decision Gate item 1: public, no authentication — consumed by the Landing page.
   * Strict field allow-list, never returns the raw entity (which carries
   * stripe_product_id/stripe_price_id/limits — internal administrative data).
   */
  async listPublic(): Promise<Array<{
    slug: string; name: string; description: string | null;
    amount: number; currency: string; interval: string; features: unknown[];
  }>> {
    const plans = await this.list();
    return plans.map((p) => ({
      slug: p.slug,
      name: p.name,
      description: p.description,
      amount: p.amount,
      currency: p.currency,
      interval: p.interval,
      features: p.features,
    }));
  }

  async get(id: string): Promise<BillingPlanEntity> {
    const plan = await this.repo.findOne({ where: { id } });
    if (!plan) throw new NotFoundException('Plano não encontrado');
    return this.normalize(plan);
  }

  /** Resolves by id (uuid) or slug; used by checkout. */
  async resolve(idOrSlug: string): Promise<BillingPlanEntity | null> {
    const plan = await this.repo
      .createQueryBuilder('p')
      .where('p.id::text = :v OR p.slug = :v', { v: idOrSlug })
      .getOne();
    return plan ? this.normalize(plan) : null;
  }

  // ── Writes ───────────────────────────────────────────────────────────────
  private validate(input: UpsertPlanInput, requireAll: boolean): void {
    if (requireAll) {
      if (!input.slug) throw new BadRequestException('slug é obrigatório');
      if (!input.name) throw new BadRequestException('name é obrigatório');
      if (input.amount == null) throw new BadRequestException('O valor é obrigatório.');
    }
    if (input.amount != null && (!Number.isInteger(input.amount) || input.amount <= 0)) {
      throw new BadRequestException('O valor deve ser um número inteiro de centavos maior que zero.');
    }
    if (input.currency != null && !/^[a-z]{3}$/.test(input.currency)) {
      throw new BadRequestException('currency deve ser ISO de 3 letras minúsculas (ex: brl)');
    }
    if (input.interval != null && !VALID_INTERVALS.includes(input.interval)) {
      throw new BadRequestException(`interval deve ser um de: ${VALID_INTERVALS.join(', ')}`);
    }
  }

  async create(input: UpsertPlanInput): Promise<BillingPlanEntity> {
    this.validate(input, true);
    const existing = await this.repo.findOne({ where: { slug: input.slug } });
    if (existing) throw new BadRequestException(`Já existe um plano com slug '${input.slug}'`);

    const plan = await this.repo.save(this.repo.create({
      slug: input.slug!,
      name: input.name!,
      description: input.description ?? null,
      amount: input.amount!,
      currency: input.currency ?? 'brl',
      interval: input.interval ?? 'month',
      active: input.active ?? true,
      features: input.features ?? [],
      limits: input.limits ?? {},
      stripe_product_id: null,
      stripe_price_id: null,
    }));

    // Syncs (product + price). A Stripe error does not invalidate the plan — it stays
    // "not synced" and can be re-synced via /sync-stripe.
    return this.syncSafe(plan, { recreatePrice: true });
  }

  async update(id: string, input: UpsertPlanInput): Promise<BillingPlanEntity> {
    this.validate(input, false);
    const plan = await this.get(id);

    if (input.slug && input.slug !== plan.slug) {
      const dup = await this.repo.findOne({ where: { slug: input.slug } });
      if (dup) throw new BadRequestException(`Já existe um plano com slug '${input.slug}'`);
    }

    // A Stripe Price is IMMUTABLE: changing amount/currency/interval requires a new Price.
    const pricingChanged =
      (input.amount != null && input.amount !== plan.amount) ||
      (input.currency != null && input.currency !== plan.currency) ||
      (input.interval != null && input.interval !== plan.interval);

    Object.assign(plan, {
      slug: input.slug ?? plan.slug,
      name: input.name ?? plan.name,
      description: input.description !== undefined ? input.description : plan.description,
      amount: input.amount ?? plan.amount,
      currency: input.currency ?? plan.currency,
      interval: input.interval ?? plan.interval,
      active: input.active ?? plan.active,
      features: input.features ?? plan.features,
      limits: input.limits ?? plan.limits,
    });
    await this.repo.save(plan);

    return this.syncSafe(plan, { recreatePrice: pricingChanged });
  }

  /** Explicit re-sync endpoint. */
  async syncStripe(id: string): Promise<BillingPlanEntity> {
    const plan = await this.get(id);
    return this.syncPlanToStripe(plan, { recreatePrice: !plan.stripe_price_id });
  }

  private async syncSafe(plan: BillingPlanEntity, opts: { recreatePrice: boolean }): Promise<BillingPlanEntity> {
    if (!this.stripe) {
      this.logger.warn(`Plan '${plan.slug}' created/updated without Stripe configured — not synced`);
      return plan;
    }
    try {
      return await this.syncPlanToStripe(plan, opts);
    } catch (err) {
      this.logger.error(`Failed to sync plan '${plan.slug}' with Stripe: ${(err as Error).message}`);
      return plan; // plan persisted; sync pending
    }
  }

  /**
   * Syncs a plan with Stripe:
   *  - Product is updatable (upsert).
   *  - Price is immutable → recreated when missing or opts.recreatePrice; the old one is deactivated.
   */
  async syncPlanToStripe(
    plan: BillingPlanEntity,
    opts: { recreatePrice: boolean },
  ): Promise<BillingPlanEntity> {
    const stripe = this.stripeRequired;

    // 1. Product (upsert)
    let productId = plan.stripe_product_id;
    const productParams = {
      name: plan.name,
      description: plan.description ?? undefined,
      active: plan.active,
      metadata: { plan_id: plan.id, slug: plan.slug },
    };
    if (!productId) {
      const product = await stripe.products.create(productParams);
      productId = product.id;
    } else {
      await stripe.products.update(productId, productParams);
    }

    // 2. Price (immutable)
    let priceId = plan.stripe_price_id;
    if (opts.recreatePrice || !priceId) {
      const oldPriceId = priceId;
      const price = await stripe.prices.create({
        product: productId,
        unit_amount: plan.amount,
        currency: plan.currency,
        recurring: { interval: plan.interval },
        metadata: { plan_id: plan.id, slug: plan.slug },
      });
      priceId = price.id;
      if (oldPriceId) {
        try {
          await stripe.prices.update(oldPriceId, { active: false });
        } catch (e) {
          this.logger.warn(`Could not deactivate old price ${oldPriceId}: ${(e as Error).message}`);
        }
      }
    }

    await this.repo.update(plan.id, {
      stripe_product_id: productId,
      stripe_price_id: priceId,
      updated_at: new Date(),
    });
    plan.stripe_product_id = productId;
    plan.stripe_price_id = priceId;
    return plan;
  }
}
