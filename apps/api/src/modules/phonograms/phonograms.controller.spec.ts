/**
 * phonograms.controller.spec.ts
 *
 * C2: prova o contrato HTTP real — PhonogramsController e PhonogramsService
 * REAIS, ValidationPipe real (mesmas opções globais: transform/whitelist/
 * forbidNonWhitelisted), somente o repository (via DATA_SOURCE) e as
 * dependências externas (EventsService) mockados. Não conecta ao
 * Supabase/Postgres real. Mesmo padrão de contracts.controller.spec.ts (C1).
 */
import 'reflect-metadata';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { PhonogramsController } from './phonograms.controller';
import { PhonogramsService } from './phonograms.service';
import { DATA_SOURCE } from '../../database/database.module';
import { EventsService } from '../../core/events/events.service';

function makeQb(rows: Record<string, unknown>[]) {
  const qb: Record<string, jest.Mock> = {};
  const chain = () => qb;
  qb['where'] = jest.fn(chain);
  qb['andWhere'] = jest.fn(chain);
  qb['orderBy'] = jest.fn(chain);
  qb['skip'] = jest.fn(chain);
  qb['take'] = jest.fn(chain);
  qb['getOne'] = jest.fn(async () => rows[0] ?? null);
  qb['getManyAndCount'] = jest.fn(async () => [rows, rows.length]);
  return qb;
}

describe('PhonogramsController — contrato HTTP real (C2)', () => {
  let app: INestApplication;
  let repo: { create: jest.Mock; save: jest.Mock; update: jest.Mock; createQueryBuilder: jest.Mock };

  beforeAll(async () => {
    repo = {
      create: jest.fn((data: unknown) => ({ ...(data as object) })),
      save: jest.fn(async (entity: unknown) => ({ id: 'phono-new', status: 'pending', ...(entity as object) })),
      update: jest.fn(async () => ({ affected: 1 })),
      createQueryBuilder: jest.fn(() => makeQb([])),
    };

    const fakeDs = { getRepository: jest.fn(() => repo) };

    const moduleRef = await Test.createTestingModule({
      controllers: [PhonogramsController],
      providers: [
        PhonogramsService,
        { provide: DATA_SOURCE, useValue: fakeDs },
        { provide: EventsService, useValue: { emitTyped: jest.fn() } },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
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
      .post('/phonograms')
      .send({ isrc: 'BR-MSC-24-00001' })
      .expect(400)
      .expect((res) => {
        expect(res.body.message?.code ?? res.body.code).toBe('PHONOGRAM_TITLE_REQUIRED');
      });
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('create somente com title (canônico) → aceito, chega ao repository mock', async () => {
    await request(app.getHttpServer())
      .post('/phonograms')
      .send({ title: 'Fonograma Canônico' })
      .expect(201);
    expect(repo.create).toHaveBeenCalledTimes(1);
    expect(repo.create.mock.calls[0][0].title).toBe('Fonograma Canônico');
  });

  it('title/titulo conflitantes → 400, repository não chamado', async () => {
    await request(app.getHttpServer())
      .post('/phonograms')
      .send({ title: 'A', titulo: 'B' })
      .expect(400)
      .expect((res) => {
        expect(res.body.message?.code ?? res.body.code).toBe('PHONOGRAM_ALIAS_CONFLICT');
      });
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('query com workId legado continua funcional (200)', async () => {
    await request(app.getHttpServer())
      .get('/phonograms')
      .query({ workId: '123e4567-e89b-12d3-a456-426614174000' })
      .expect(200);
  });

  it('query work_id/workId conflitantes → 400', async () => {
    await request(app.getHttpServer())
      .get('/phonograms')
      .query({
        work_id: '123e4567-e89b-12d3-a456-426614174000',
        workId: '223e4567-e89b-12d3-a456-426614174000',
      })
      .expect(400)
      .expect((res) => {
        expect(res.body.message?.code ?? res.body.code).toBe('PHONOGRAM_ALIAS_CONFLICT');
      });
  });
});

describe('Swagger/OpenAPI — metadados de depreciação dos aliases (C2)', () => {
  let schemas: Record<string, { properties?: Record<string, { deprecated?: boolean }> }>;
  let queryParams: Array<{ name: string; deprecated?: boolean }>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [PhonogramsController],
      providers: [
        PhonogramsService,
        { provide: DATA_SOURCE, useValue: { getRepository: jest.fn(() => ({})) } },
        { provide: EventsService, useValue: {} },
      ],
    }).compile();

    const swaggerApp = moduleRef.createNestApplication();
    await swaggerApp.init();
    const { SwaggerModule, DocumentBuilder } = await import('@nestjs/swagger');
    const document = SwaggerModule.createDocument(swaggerApp, new DocumentBuilder().setTitle('t').setVersion('1').build());
    schemas = document.components?.schemas as typeof schemas;
    queryParams = (document.paths?.['/phonograms']?.get?.parameters ?? []) as typeof queryParams;
    await swaggerApp.close();
  });

  it('CreatePhonogramDto: titulo, workId e artistId estão deprecated (title passou a canônico em 2026-09-05)', () => {
    const props = schemas['CreatePhonogramDto'].properties!;
    for (const field of ['titulo', 'workId', 'artistId']) {
      expect(props[field]?.deprecated).toBe(true);
    }
  });

  it('CreatePhonogramDto: title, work_id e artist_id NÃO estão deprecated', () => {
    const props = schemas['CreatePhonogramDto'].properties!;
    for (const field of ['title', 'work_id', 'artist_id']) {
      expect(props[field]?.deprecated).toBeUndefined();
    }
  });

  it('QueryPhonogramDto: workId e artistId estão deprecated; work_id e artist_id não (parâmetros de query em /phonograms)', () => {
    const byName = Object.fromEntries(queryParams.map((p) => [p.name, p]));
    expect(byName['workId']?.deprecated).toBe(true);
    expect(byName['artistId']?.deprecated).toBe(true);
    expect(byName['work_id']?.deprecated).toBeFalsy();
    expect(byName['artist_id']?.deprecated).toBeFalsy();
  });
});
