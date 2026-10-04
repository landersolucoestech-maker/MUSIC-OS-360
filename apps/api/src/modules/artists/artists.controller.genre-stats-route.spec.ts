/**
 * artists.controller.genre-stats-route.spec.ts
 *
 * CZ-020: proves the real HTTP contract for ArtistsController's genre-stats
 * route — 'stats/genres' is canonical, 'stats/generos' is a TEMPORARY
 * compatibility alias registered on the SAME handler (web/api deploy
 * independently). Real ArtistsController + real ArtistsService, only the
 * repository (via DATA_SOURCE) and unrelated collaborator services (not
 * used by distinctMusicGenres) stubbed. Same pattern as
 * phonograms.controller.spec.ts (C2).
 */
import 'reflect-metadata';
import { INestApplication, RequestMethod } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { ArtistsController } from './artists.controller';
import { ArtistsService } from './artists.service';
import { ArtistPlatformProfilesService } from './platform-profiles/artist-platform-profiles.service';
import { ArtistMetricSnapshotsService } from './platform-profiles/artist-metric-snapshots.service';
import { ArtistExternalProfileSyncService } from './platform-profiles/artist-external-profile-sync.service';
import { CareerStageService } from './platform-profiles/analytics/career-stage.service';
import { MarketBenchmarkService } from './platform-profiles/analytics/market-benchmark.service';
import { AudienceHealthAutomation } from '../../core/automation/audience-health.automation';
import { DATA_SOURCE } from '../../database/database.module';
import { EncryptionService } from '../../core/security/encryption.service';
import { EventsService } from '../../core/events/events.service';
import { PlanLimitService } from '../../core/billing/plan-limit.service';

describe('ArtistsController — stats route aliases (CZ-020, CZ-024)', () => {
  let app: INestApplication;
  let fakeDs: { getRepository: jest.Mock; query: jest.Mock };

  beforeAll(async () => {
    // ArtistsService.distinctMusicGenres uses this.ds!.query(...) directly
    // (raw SQL), not a repository query builder.
    fakeDs = { getRepository: jest.fn(() => ({})), query: jest.fn(async () => []) };

    const moduleRef = await Test.createTestingModule({
      controllers: [ArtistsController],
      providers: [
        ArtistsService,
        { provide: DATA_SOURCE, useValue: fakeDs },
        { provide: EncryptionService, useValue: {} },
        { provide: EventsService, useValue: { emitTyped: jest.fn() } },
        { provide: PlanLimitService, useValue: {} },
        { provide: ArtistPlatformProfilesService, useValue: {} },
        { provide: ArtistMetricSnapshotsService, useValue: {} },
        { provide: ArtistExternalProfileSyncService, useValue: {} },
        { provide: CareerStageService, useValue: {} },
        { provide: MarketBenchmarkService, useValue: {} },
        { provide: AudienceHealthAutomation, useValue: {} },
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

  it('GET /artists/stats/genres (canonical) and /artists/stats/generos (temporary alias) both resolve to the same handler', async () => {
    const genreRows = [{ music_genre: 'rock' }, { music_genre: 'pop' }];
    fakeDs.query
      .mockResolvedValueOnce(genreRows)
      .mockResolvedValueOnce(genreRows);

    const canonical = await request(app.getHttpServer()).get('/artists/stats/genres').expect(200);
    const legacyAlias = await request(app.getHttpServer()).get('/artists/stats/generos').expect(200);

    expect(canonical.body).toEqual(['rock', 'pop']);
    expect(legacyAlias.body).toEqual(canonical.body);
  });

  // CZ-024: same pattern for the relationship KPIs — 'stats/relationship' is
  // canonical, 'stats/vinculo' a TEMPORARY alias on the same handler.
  it('GET /artists/stats/relationship (canonical) and /artists/stats/vinculo (temporary alias) both resolve to the same handler', async () => {
    const rows = [{ relationship: 'exclusive', cnt: '2' }, { relationship: 'independent', cnt: '3' }];
    fakeDs.query.mockResolvedValueOnce(rows).mockResolvedValueOnce(rows);

    const canonical = await request(app.getHttpServer()).get('/artists/stats/relationship').expect(200);
    const legacyAlias = await request(app.getHttpServer()).get('/artists/stats/vinculo').expect(200);

    expect(canonical.body).toEqual({ exclusive: 2, partner: 0, independent: 3, total: 5 });
    expect(legacyAlias.body).toEqual(canonical.body);
  });

  // Route metadata: both paths are registered on ONE handler, so removing/renaming the legacy path (or the canonical
  // one) fails here even if the HTTP stack is stubbed differently.
  it.each([
    ['relationshipStats', 'stats/relationship', 'stats/vinculo'],
    ['distinctMusicGenres', 'stats/genres', 'stats/generos'],
  ])('route metadata: %s is registered at the canonical path and at the temporary alias', (handlerName, canonicalPath, aliasPath) => {
    const handler = (ArtistsController.prototype as unknown as Record<string, object>)[handlerName];
    expect(handler).toBeDefined();
    expect(Reflect.getMetadata('path', handler)).toEqual([canonicalPath, aliasPath]);
    expect(Reflect.getMetadata('method', handler)).toBe(RequestMethod.GET);
  });
});
