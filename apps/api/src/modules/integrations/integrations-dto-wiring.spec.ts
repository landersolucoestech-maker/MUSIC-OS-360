/**
 * integrations-dto-wiring.spec.ts
 *
 * Proves the real HTTP contract (real global ValidationPipe: whitelist/
 * forbidNonWhitelisted/transform) for the 4 routes that switched to
 * RegisterAbramusWorkDto / ConfigureSoundCloudDto / OAuthCodeStateDto /
 * AutentiqueWebhookDto instead of `any`/inline types. Same pattern as
 * phonograms.controller.spec.ts (C2): real controller, real ValidationPipe,
 * only the external services mocked. No guards (RequireRole is not
 * enforced outside the real AppModule, same pattern as the rest of the module).
 */
import { DatabaseContextService } from '../../database/database-context.service';
import 'reflect-metadata';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { IntegrationsController } from './integrations.controller';
import { ACRCloudService } from './acrcloud/acrcloud.service';
import { AutentiqueService } from './autentique/autentique.service';
import { SpotifyService } from './spotify/spotify.service';
import { YouTubeService } from './youtube/youtube.service';
import { DeezerService } from './deezer/deezer.service';
import { SoundCloudService } from './soundcloud/soundcloud.service';
import { AppleMusicService } from './apple-music/apple-music.service';
import { InstagramService } from './instagram/instagram.service';
import { TikTokService } from './tiktok/tiktok.service';
import { GoogleAdsService } from './google-ads/google-ads.service';
import { AbramusService } from './abramus/abramus.service';
import { WhatsAppCloudProvider } from './whatsapp/whatsapp-cloud.provider';
import { IntegrationBaseService } from './integration-base.service';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '../../core/cache/cache.service';
import { IntegrationPolicyService } from './governance/integration-policy.service';
import { IdempotencyStore } from '../../core/interceptors/idempotency.store';

describe('IntegrationsController DTO wiring (HTTP contract, ValidationPipe real)', () => {
  let app: INestApplication;
  let abramus: { registerWork: jest.Mock };
  let soundcloud: { configure: jest.Mock };
  let autentique: { handleWebhook: jest.Mock };
  let instagram: { handleCallback: jest.Mock };

  beforeAll(async () => {
    abramus = { registerWork: jest.fn().mockResolvedValue({ ok: true }) };
    soundcloud = { configure: jest.fn().mockResolvedValue(undefined) };
    autentique = { handleWebhook: jest.fn().mockResolvedValue({ ok: true }) };
    instagram = {
      handleCallback: jest.fn().mockResolvedValue({ connected: true }),
    };

    const noop = {};

    const moduleRef = await Test.createTestingModule({
      controllers: [IntegrationsController],
      providers: [
        { provide: ACRCloudService, useValue: noop },
        { provide: AutentiqueService, useValue: autentique },
        { provide: SpotifyService, useValue: noop },
        { provide: YouTubeService, useValue: noop },
        { provide: DeezerService, useValue: noop },
        { provide: SoundCloudService, useValue: soundcloud },
        { provide: AppleMusicService, useValue: noop },
        { provide: InstagramService, useValue: instagram },
        { provide: TikTokService, useValue: noop },
        { provide: GoogleAdsService, useValue: noop },
        { provide: AbramusService, useValue: abramus },
        { provide: WhatsAppCloudProvider, useValue: noop },
        { provide: IntegrationBaseService, useValue: noop },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: CacheService, useValue: { get: jest.fn(), set: jest.fn(), delete: jest.fn() } },
        { provide: IntegrationPolicyService, useValue: noop },
        { provide: DatabaseContextService, useValue: { runInTenantContext: jest.fn((_c: unknown, w: () => unknown) => w()) } },
        IdempotencyStore,
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.use((req: { tenant?: unknown; auth?: unknown }, _res: unknown, next: () => void) => {
      req.tenant = { id: 'tenant-1' };
      req.auth = { userId: 'user-1' };
      next();
    });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => jest.clearAllMocks());

  describe('POST /integrations/abramus/register-work', () => {
    const post = (body: object) => request(app.getHttpServer()).post('/integrations/abramus/register-work').send(body);

    it('absent title (and titulo) → 400, service not called', async () => {
      await post({ composer: 'Fulano' }).expect(400);
      expect(abramus.registerWork).not.toHaveBeenCalled();
    });

    it('absent composer (and compositor) → 400, service not called', async () => {
      await post({ title: 'Obra X' }).expect(400);
      expect(abramus.registerWork).not.toHaveBeenCalled();
    });

    it('web-shaped canonical body → 201, service receives the canonical shape', async () => {
      await post({
        title: 'Obra X', composer: 'Fulano', co_composers: ['Beltrano'], iswc: 'T-123',
        genre: 'Pop', duration: '3:20', publisher: 'Editora Y',
      }).expect(201);
      expect(abramus.registerWork).toHaveBeenCalledWith('tenant-1', {
        title: 'Obra X', composer: 'Fulano', co_composers: ['Beltrano'], iswc: 'T-123',
        genre: 'Pop', duration: '3:20', publisher: 'Editora Y',
      });
    });

    it('legacy Portuguese body still accepted → mapped to canonical', async () => {
      await post({
        titulo: 'Obra X', compositor: 'Fulano', coautores: ['Beltrano'], genero: 'Pop',
        duracao: '3:20', editora: 'Editora Y',
      }).expect(201);
      expect(abramus.registerWork).toHaveBeenCalledWith('tenant-1', {
        title: 'Obra X', composer: 'Fulano', co_composers: ['Beltrano'], iswc: undefined,
        genre: 'Pop', duration: '3:20', publisher: 'Editora Y',
      });
    });

    it('canonical wins when both canonical and legacy names are sent', async () => {
      await post({ title: 'Novo', titulo: 'Velho', composer: 'Novo C', compositor: 'Velho C' }).expect(201);
      expect(abramus.registerWork).toHaveBeenCalledWith('tenant-1', expect.objectContaining({
        title: 'Novo', composer: 'Novo C',
      }));
    });

    it('unknown key → 400', async () => {
      await post({ title: 'Obra X', composer: 'Fulano', unknownField: 1 }).expect(400);
      expect(abramus.registerWork).not.toHaveBeenCalled();
    });
  });

  describe('POST /integrations/soundcloud/configure', () => {
    it('absent clientSecret → 400, service not called', async () => {
      await request(app.getHttpServer())
        .post('/integrations/soundcloud/configure')
        .send({ clientId: 'abc' })
        .expect(400);
      expect(soundcloud.configure).not.toHaveBeenCalled();
    });

    it('valid payload → 200', async () => {
      await request(app.getHttpServer())
        .post('/integrations/soundcloud/configure')
        .send({ clientId: 'abc', clientSecret: 'def' })
        .expect(200);
      expect(soundcloud.configure).toHaveBeenCalledWith('tenant-1', 'abc', 'def');
    });
  });

  describe('POST /integrations/instagram/callback (OAuthCodeStateDto)', () => {
    it('absent state → 400, service not called', async () => {
      await request(app.getHttpServer())
        .post('/integrations/instagram/callback')
        .send({ code: 'abc123' })
        .expect(400);
      expect(instagram.handleCallback).not.toHaveBeenCalled();
    });

    it('valid payload → 200', async () => {
      await request(app.getHttpServer())
        .post('/integrations/instagram/callback')
        .send({ code: 'abc123', state: 'xyz' })
        .expect(200);
      expect(instagram.handleCallback).toHaveBeenCalledWith('abc123', 'xyz');
    });
  });

  describe('POST /integrations/autentique/webhook (whitelist:false escopado)', () => {
    it('event with an invalid type → 400, service not called', async () => {
      await request(app.getHttpServer())
        .post('/integrations/autentique/webhook')
        .send({ event: 123, event_id: 'e1', document_id: 'd1' })
        .expect(400);
      expect(autentique.handleWebhook).not.toHaveBeenCalled();
    });

    it('an extra unmodeled provider field → accepted (200), not 400', async () => {
      await request(app.getHttpServer())
        .post('/integrations/autentique/webhook')
        .send({
          event: 'document.signed', event_id: 'e1', document_id: 'd1',
          unmodeled_autentique_field: true,
        })
        .expect(200);
      expect(autentique.handleWebhook).toHaveBeenCalled();
    });
  });
});
