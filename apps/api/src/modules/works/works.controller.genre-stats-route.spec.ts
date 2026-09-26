/**
 * works.controller.genre-stats-route.spec.ts
 *
 * CZ-020: proves the real HTTP contract for WorksController's genre-stats
 * route — 'stats/genres' is canonical, 'stats/generos' is a TEMPORARY
 * compatibility alias registered on the SAME handler (web/api deploy
 * independently). Real WorksController + real WorksService, only the
 * repository (via DATA_SOURCE) mocked. Same pattern as
 * phonograms.controller.spec.ts (C2).
 */
import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { WorksController } from './works.controller';
import { WorksService } from './works.service';
import { DATA_SOURCE } from '../../database/database.module';
import { EventsService } from '../../core/events/events.service';

function makeGenreQb(rows: Record<string, unknown>[]) {
  const qb: Record<string, jest.Mock> = {};
  const chain = () => qb;
  qb['select'] = jest.fn(chain);
  qb['where'] = jest.fn(chain);
  qb['andWhere'] = jest.fn(chain);
  qb['orderBy'] = jest.fn(chain);
  qb['getRawMany'] = jest.fn(async () => rows);
  return qb;
}

describe('WorksController — genre stats route alias (CZ-020)', () => {
  let app: INestApplication;
  let repo: { createQueryBuilder: jest.Mock };

  beforeAll(async () => {
    repo = { createQueryBuilder: jest.fn(() => makeGenreQb([])) };
    const fakeDs = { getRepository: jest.fn(() => repo) };

    const moduleRef = await Test.createTestingModule({
      controllers: [WorksController],
      providers: [
        WorksService,
        { provide: DATA_SOURCE, useValue: fakeDs },
        { provide: EventsService, useValue: { emitTyped: jest.fn() } },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use((req: { tenant?: unknown }, _res: unknown, next: () => void) => {
      req.tenant = { id: 'tenant-1', org_id: 'org-1' };
      next();
    });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => jest.clearAllMocks());

  it('GET /works/stats/genres (canonical) and /works/stats/generos (temporary alias) both resolve to the same handler', async () => {
    const genreRows = [{ musicGenre: 'mpb' }, { musicGenre: 'samba' }];
    repo.createQueryBuilder
      .mockReturnValueOnce(makeGenreQb(genreRows) as never)
      .mockReturnValueOnce(makeGenreQb(genreRows) as never);

    const canonical = await request(app.getHttpServer()).get('/works/stats/genres').expect(200);
    const legacyAlias = await request(app.getHttpServer()).get('/works/stats/generos').expect(200);

    expect(canonical.body).toEqual(['mpb', 'samba']);
    expect(legacyAlias.body).toEqual(canonical.body);
  });
});
