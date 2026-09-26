import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import { BillingPlansService } from './billing-plans.service';
import { DATA_SOURCE } from '../../database/database.module';

jest.mock('stripe', () => {
  const instance = {
    products: { create: jest.fn(), update: jest.fn() },
    prices:   { create: jest.fn(), update: jest.fn() },
  };
  const ctor = jest.fn(() => instance);
  (ctor as any).default = ctor;
  (ctor as any).__instance = instance;
  return ctor;
});

const stripe = () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('stripe').__instance;
};

describe('BillingPlansService', () => {
  let service: BillingPlansService;
  let repo: Record<string, jest.Mock>;

  beforeEach(async () => {
    jest.clearAllMocks();
    repo = {
      createQueryBuilder: jest.fn(),
      findOne: jest.fn().mockResolvedValue(null),
      create:  jest.fn((v: any) => v),
      save:    jest.fn((v: any) => Promise.resolve({ id: 'plan-1', ...v })),
      update:  jest.fn().mockResolvedValue({ affected: 1 }),
    };
    stripe().products.create.mockResolvedValue({ id: 'prod_1' });
    stripe().products.update.mockResolvedValue({ id: 'prod_1' });
    stripe().prices.create.mockResolvedValue({ id: 'price_new' });
    stripe().prices.update.mockResolvedValue({ id: 'price_old' });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingPlansService,
        { provide: ConfigService, useValue: { get: (k: string) => (k === 'STRIPE_SECRET_KEY' ? 'sk_test' : undefined) } },
        { provide: DATA_SOURCE, useValue: { getRepository: () => repo } },
      ],
    }).compile();

    service = module.get(BillingPlansService);
  });

  describe('create', () => {
    it('creates Product + Price in Stripe and persists the ids', async () => {
      const plan = await service.create({ slug: 'pro', name: 'Pro', amount: 29900, currency: 'brl', interval: 'month' });
      expect(stripe().products.create).toHaveBeenCalledTimes(1);
      expect(stripe().prices.create).toHaveBeenCalledWith(expect.objectContaining({
        product: 'prod_1', unit_amount: 29900, currency: 'brl', recurring: { interval: 'month' },
      }));
      expect(repo.update).toHaveBeenCalledWith('plan-1', expect.objectContaining({
        stripe_product_id: 'prod_1', stripe_price_id: 'price_new',
      }));
      expect(plan.stripe_price_id).toBe('price_new');
    });

    it('rejeita amount <= 0', async () => {
      await expect(service.create({ slug: 'x', name: 'X', amount: 0 })).rejects.toThrow(BadRequestException);
    });

    it('rejects an invalid currency', async () => {
      await expect(service.create({ slug: 'x', name: 'X', amount: 100, currency: 'BRL' })).rejects.toThrow(BadRequestException);
    });

    it('rejects an invalid interval', async () => {
      await expect(service.create({ slug: 'x', name: 'X', amount: 100, interval: 'week' })).rejects.toThrow(BadRequestException);
    });

    it('rejeita slug duplicado', async () => {
      repo.findOne.mockResolvedValueOnce({ id: 'dup', slug: 'pro' });
      await expect(service.create({ slug: 'pro', name: 'Pro', amount: 100 })).rejects.toThrow(BadRequestException);
    });
  });

  describe('listPublic (Decision Gate item 1 — public landing route)', () => {
    function mockPlansQuery(rows: Record<string, unknown>[]) {
      const qb = {
        orderBy: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(rows),
      };
      repo.createQueryBuilder.mockReturnValue(qb);
      return qb;
    }

    it('never returns internal admin fields (strict allow-list)', async () => {
      mockPlansQuery([
        {
          id: 'plan-1',
          slug: 'pro',
          name: 'Pro',
          description: 'Plano profissional',
          amount: 29900,
          currency: 'brl',
          interval: 'month',
          features: ['Recurso A', 'Recurso B'],
          stripe_product_id: 'prod_secret',
          stripe_price_id: 'price_secret',
          limits: { artists: 50 },
          active: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ]);

      const result = await service.listPublic();

      expect(result).toEqual([
        {
          slug: 'pro',
          name: 'Pro',
          description: 'Plano profissional',
          amount: 29900,
          currency: 'brl',
          interval: 'month',
          features: ['Recurso A', 'Recurso B'],
        },
      ]);
      const keys = Object.keys(result[0]!);
      expect(keys).not.toContain('id');
      expect(keys).not.toContain('stripe_product_id');
      expect(keys).not.toContain('stripe_price_id');
      expect(keys).not.toContain('limits');
      expect(keys).not.toContain('active');
      expect(keys).not.toContain('created_at');
      expect(keys).not.toContain('updated_at');
    });

    it('considers active plans only (list() already filters active=true by default)', async () => {
      const qb = mockPlansQuery([]);
      await service.listPublic();
      expect(qb.where).toHaveBeenCalledWith('p.active = true');
    });

    it('normaliza features legado (objeto {labels}) para array, igual list()', async () => {
      mockPlansQuery([
        {
          id: 'plan-1', slug: 'legacy', name: 'Legacy', description: null,
          amount: 9900, currency: 'brl', interval: 'month',
          features: { labels: ['X', 'Y'] },
        },
      ]);

      const result = await service.listPublic();
      expect(result[0]!.features).toEqual(['X', 'Y']);
    });
  });

  describe('update', () => {
    const existing = {
      id: 'plan-1', slug: 'pro', name: 'Pro', description: null,
      amount: 29900, currency: 'brl', interval: 'month', active: true,
      features: {}, limits: {}, stripe_product_id: 'prod_1', stripe_price_id: 'price_1',
    };

    it('creates a NEW Price when the amount changes and deactivates the old one (without recreating the Product)', async () => {
      repo.findOne.mockResolvedValueOnce({ ...existing });
      await service.update('plan-1', { amount: 39900 });
      expect(stripe().products.create).not.toHaveBeenCalled();    // product already exists → update
      expect(stripe().products.update).toHaveBeenCalledWith('prod_1', expect.any(Object));
      expect(stripe().prices.create).toHaveBeenCalledTimes(1);    // novo price
      expect(stripe().prices.update).toHaveBeenCalledWith('price_1', { active: false }); // desativa antigo
    });

    it('does NOT recreate the Price when only the name changes', async () => {
      repo.findOne.mockResolvedValueOnce({ ...existing });
      await service.update('plan-1', { name: 'Pro Plus' });
      expect(stripe().prices.create).not.toHaveBeenCalled();
      expect(stripe().products.update).toHaveBeenCalledTimes(1);
    });
  });
});
