/**
 * integrations-dto-wiring.spec.ts
 *
 * Prova o contrato HTTP real (ValidationPipe global real: whitelist/
 * forbidNonWhitelisted/transform) para as 4 rotas que passaram a usar
 * RegisterAbramusWorkDto / ConfigureSoundCloudDto / OAuthCodeStateDto /
 * AutentiqueWebhookDto em vez de `any`/tipos inline. Mesmo padrão de
 * phonograms.controller.spec.ts (C2): controller real, ValidationPipe real,
 * apenas os services externos mockados. Sem guards (RequireRole não é
 * enforced fora do AppModule real, mesmo padrão do resto do módulo).
 */
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
    it('titulo ausente → 400, service não chamado', async () => {
      await request(app.getHttpServer())
        .post('/integrations/abramus/register-work')
        .send({ compositor: 'Fulano' })
        .expect(400);
      expect(abramus.registerWork).not.toHaveBeenCalled();
    });

    it('payload válido → 201, mapeado titulo→title no service', async () => {
      await request(app.getHttpServer())
        .post('/integrations/abramus/register-work')
        .send({ titulo: 'Obra X', compositor: 'Fulano' })
        .expect(201);
      expect(abramus.registerWork).toHaveBeenCalledWith('tenant-1', expect.objectContaining({
        title: 'Obra X',
        compositor: 'Fulano',
      }));
    });
  });

  describe('POST /integrations/soundcloud/configure', () => {
    it('clientSecret ausente → 400, service não chamado', async () => {
      await request(app.getHttpServer())
        .post('/integrations/soundcloud/configure')
        .send({ clientId: 'abc' })
        .expect(400);
      expect(soundcloud.configure).not.toHaveBeenCalled();
    });

    it('payload válido → 200', async () => {
      await request(app.getHttpServer())
        .post('/integrations/soundcloud/configure')
        .send({ clientId: 'abc', clientSecret: 'def' })
        .expect(200);
      expect(soundcloud.configure).toHaveBeenCalledWith('tenant-1', 'abc', 'def');
    });
  });

  describe('POST /integrations/instagram/callback (OAuthCodeStateDto)', () => {
    it('state ausente → 400, service não chamado', async () => {
      await request(app.getHttpServer())
        .post('/integrations/instagram/callback')
        .send({ code: 'abc123' })
        .expect(400);
      expect(instagram.handleCallback).not.toHaveBeenCalled();
    });

    it('payload válido → 200', async () => {
      await request(app.getHttpServer())
        .post('/integrations/instagram/callback')
        .send({ code: 'abc123', state: 'xyz' })
        .expect(200);
      expect(instagram.handleCallback).toHaveBeenCalledWith('abc123', 'xyz');
    });
  });

  describe('POST /integrations/autentique/webhook (whitelist:false escopado)', () => {
    it('event com tipo inválido → 400, service não chamado', async () => {
      await request(app.getHttpServer())
        .post('/integrations/autentique/webhook')
        .send({ event: 123, event_id: 'e1', document_id: 'd1' })
        .expect(400);
      expect(autentique.handleWebhook).not.toHaveBeenCalled();
    });

    it('campo extra não modelado do provedor → aceito (200), não 400', async () => {
      await request(app.getHttpServer())
        .post('/integrations/autentique/webhook')
        .send({
          event: 'document.signed', event_id: 'e1', document_id: 'd1',
          campo_da_autentique_nao_modelado: true,
        })
        .expect(200);
      expect(autentique.handleWebhook).toHaveBeenCalled();
    });
  });
});
