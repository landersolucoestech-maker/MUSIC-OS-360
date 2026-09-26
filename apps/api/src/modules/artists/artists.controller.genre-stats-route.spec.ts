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
import { INestApplication } from '@nestjs/common';
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

describe('ArtistsController — genre stats route alias (CZ-020)', () => {
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
});
