/**
 * contracts.controller.spec.ts
 *
 * Fase 5 / C1: prova o contrato HTTP real — ContractsController e
 * ContractsService REAIS, ValidationPipe real (mesmas opções globais:
 * transform/whitelist/forbidNonWhitelisted), somente o repository (via
 * DATA_SOURCE) e as dependências externas (Workflow/Events/PlanLimit)
 * mockados. Não conecta ao Supabase/Postgres real. Reaproveita o padrão
 * de `Test.createTestingModule` + `supertest` já usado em
 * `artists-cross-tenant.integration.spec.ts`, sem os guards de auth
 * (irrelevantes para o que este teste verifica: resolução de aliases,
 * conflito, obrigatoriedade de título).
 */
import 'reflect-metadata';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { ContractsController } from './contracts.controller';
import { ContractsService } from './contracts.service';
import { DATA_SOURCE } from '../../database/database.module';
import { WorkflowService } from '../../core/workflow/workflow.service';
import { EventsService } from '../../core/events/events.service';
import { PlanLimitService } from '../../core/billing/plan-limit.service';
import { IdempotencyStore } from '../../core/interceptors/idempotency.store';

function makeQb(rows: Record<string, unknown>[]) {
  const qb: Record<string, jest.Mock> = {};
  const chain = () => qb;
  qb['leftJoinAndMapOne'] = jest.fn(chain);
  qb['where'] = jest.fn(chain);
  qb['andWhere'] = jest.fn(chain);
  qb['orderBy'] = jest.fn(chain);
  qb['skip'] = jest.fn(chain);
  qb['take'] = jest.fn(chain);
  qb['getOne'] = jest.fn(async () => rows[0] ?? null);
  qb['getManyAndCount'] = jest.fn(async () => [rows, rows.length]);
  return qb;
}

describe('ContractsController — contrato HTTP real (Fase 5 / C1)', () => {
  let app: INestApplication;
  let repo: { create: jest.Mock; save: jest.Mock; update: jest.Mock; createQueryBuilder: jest.Mock };

  beforeAll(async () => {
    repo = {
      create: jest.fn((data: unknown) => ({ ...(data as object) })),
      save: jest.fn(async (entity: unknown) => ({ id: 'contract-new', status: 'draft', ...(entity as object) })),
      update: jest.fn(async () => ({ affected: 1 })),
      createQueryBuilder: jest.fn(() => makeQb([])),
    };

    const fakeDs = { getRepository: jest.fn(() => repo) };

    const moduleRef = await Test.createTestingModule({
      controllers: [ContractsController],
      providers: [
        ContractsService,
        { provide: DATA_SOURCE, useValue: fakeDs },
        { provide: WorkflowService, useValue: { getAllowedTransitions: jest.fn(() => []), transitionInTx: jest.fn() } },
        { provide: EventsService, useValue: { emitTyped: jest.fn() } },
        { provide: PlanLimitService, useValue: { enforce: jest.fn(async () => undefined) } },
        IdempotencyStore,
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    // Mesmas opções do ValidationPipe global (main.ts).
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    // Injeta tenant/user autenticados diretamente — os guards de auth (JWT/Tenant/Roles)
    // não são o que este teste verifica; resolução de aliases/DTO/service, sim.
    app.use((req: { tenant?: unknown; auth?: unknown }, _res: unknown, next: () => void) => {
      req.tenant = { id: 'tenant-1', org_id: 'org-1' };
      req.auth = { userId: 'user-1', sessionId: 's1', orgId: 'org-1', orgRole: 'editor', claims: {} };
      next();
    });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => jest.clearAllMocks());

  it('create sem título → 400', async () => {
    await request(app.getHttpServer())
      .post('/contracts')
      .send({ type: 'gravacao' })
      .expect(400)
      .expect((res) => {
        expect(res.body.message?.code ?? res.body.code).toBe('CONTRACT_TITLE_REQUIRED');
      });
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('create somente com title (canônico) válido → passa da validação, chega ao repository mock', async () => {
    await request(app.getHttpServer())
      .post('/contracts')
      .send({ title: 'Contrato Canônico' })
      .expect(201);
    expect(repo.create).toHaveBeenCalledTimes(1);
    expect(repo.create.mock.calls[0][0].title).toBe('Contrato Canônico');
  });

  it('title/titulo conflitantes → 400 e repository não chamado', async () => {
    await request(app.getHttpServer())
      .post('/contracts')
      .send({ title: 'A', titulo: 'B' })
      .expect(400)
      .expect((res) => {
        expect(res.body.message?.code ?? res.body.code).toBe('CONTRACT_ALIAS_CONFLICT');
      });
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('query com type (canônico) continua funcional (200, filtro aplicado)', async () => {
    await request(app.getHttpServer())
      .get('/contracts')
      .query({ type: 'gravacao' })
      .expect(200);
  });

  it('query type/tipo conflitantes → 400', async () => {
    await request(app.getHttpServer())
      .get('/contracts')
      .query({ type: 'gravacao', tipo: 'edicao' })
      .expect(400)
      .expect((res) => {
        expect(res.body.message?.code ?? res.body.code).toBe('CONTRACT_ALIAS_CONFLICT');
      });
  });
});

describe('Swagger/OpenAPI — metadados de depreciação dos aliases (Fase 5 / C1)', () => {
  let schemas: Record<string, { properties?: Record<string, { deprecated?: boolean }> }>;
  let queryParams: Array<{ name: string; deprecated?: boolean }>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ContractsController],
      providers: [
        ContractsService,
        { provide: DATA_SOURCE, useValue: { getRepository: jest.fn(() => ({})) } },
        { provide: WorkflowService, useValue: {} },
        { provide: EventsService, useValue: {} },
        { provide: PlanLimitService, useValue: {} },
        IdempotencyStore,
      ],
    }).compile();

    const swaggerApp = moduleRef.createNestApplication();
    await swaggerApp.init();
    const { SwaggerModule, DocumentBuilder } = await import('@nestjs/swagger');
    const document = SwaggerModule.createDocument(swaggerApp, new DocumentBuilder().setTitle('t').setVersion('1').build());
    schemas = document.components?.schemas as typeof schemas;
    queryParams = (document.paths?.['/contracts']?.get?.parameters ?? []) as typeof queryParams;
    await swaggerApp.close();
  });

  it('CreateContractDto: os 8 aliases legados restantes estão deprecated (title/type/start_date/end_date passaram a canônicos em 2026-09-05)', () => {
    const props = schemas['CreateContractDto'].properties!;
    for (const field of ['tipo', 'artistId', 'value', 'data_inicio', 'data_fim', 'startsAt', 'expiresAt', 'fileUrl']) {
      expect(props[field]?.deprecated).toBe(true);
    }
  });

  it('CreateContractDto: os campos canônicos NÃO estão deprecated', () => {
    const props = schemas['CreateContractDto'].properties!;
    for (const field of ['title', 'type', 'artist_id', 'valor', 'start_date', 'end_date', 'arquivo_url']) {
      expect(props[field]?.deprecated).toBeUndefined();
    }
  });

  it('QueryContractDto: tipo e artistId estão deprecated; type e artist_id não (parâmetros de query no path /contracts)', () => {
    const byName = Object.fromEntries(queryParams.map((p) => [p.name, p]));
    expect(byName['tipo']?.deprecated).toBe(true);
    expect(byName['artistId']?.deprecated).toBe(true);
    expect(byName['type']?.deprecated).toBeFalsy();
    expect(byName['artist_id']?.deprecated).toBeFalsy();
  });
});
