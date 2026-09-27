import {
  Controller, Post, Get, Delete, Body, Param, Query, Redirect,
  HttpCode, HttpStatus, Request, BadRequestException, InternalServerErrorException,
  UseInterceptors,
  Logger,
} from '@nestjs/common';
import { ConfigService }              from '@nestjs/config';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { randomUUID }    from 'crypto';
import { plainToInstance } from 'class-transformer';
import { validate }      from 'class-validator';
import { RequireRole }   from '../../core/decorators/roles.decorator';
import { Public }        from '../../core/decorators/public.decorator';
import { Audit }         from '../../core/interceptors/audit.interceptor';
import { IdempotencyInterceptor } from '../../core/interceptors/idempotency.interceptor';
import { CacheService }  from '../../core/cache/cache.service';
import { DatabaseContextService } from '../../database/database-context.service';
import { ACRCloudService }    from './acrcloud/acrcloud.service';
import { AutentiqueService }  from './autentique/autentique.service';
import { SpotifyService }     from './spotify/spotify.service';
import { YouTubeService }     from './youtube/youtube.service';
import { DeezerService }      from './deezer/deezer.service';
import { SoundCloudService }  from './soundcloud/soundcloud.service';
import { AppleMusicService }  from './apple-music/apple-music.service';
import { InstagramService }   from './instagram/instagram.service';
import { TikTokService }      from './tiktok/tiktok.service';
import { GoogleAdsService }   from './google-ads/google-ads.service';
import { AbramusService }     from './abramus/abramus.service';
import { WhatsAppCloudProvider } from './whatsapp/whatsapp-cloud.provider';
import { IntegrationBaseService } from './integration-base.service';
import { IntegrationPolicyService } from './governance/integration-policy.service';
import {
  ConfigureAutentiqueDto,
  SendForSignatureDto,
  RecognizeAudioDto,
  SpotifyConnectDto,
  SyncSpotifyArtistDto,
  OAuthInitDto,
  OAuthExchangeDto,
  RegisterAbramusWorkDto,
  ConfigureSoundCloudDto,
  OAuthCodeStateDto,
  AutentiqueWebhookDto,
} from './dto/integrations.dto';

const GENERIC_OAUTH_PLATFORMS = new Set([
  'corp_instagram', 'meta_business', 'meta_ads',
  'corp_tiktok', 'tiktok_business', 'tiktok_ads',
  'corp_youtube', 'youtube_business', 'google_business', 'google_ads', 'youtube_ads',
  'docusign', 'stripe_connect',
]);

const OAUTH_PROVIDER_ALIASES: Readonly<Record<string, string>> = {
  corp_spotify: 'spotify',
  spotify_ads: 'spotify',
};


const oauthExchangeLogger = new Logger('IntegrationsOAuthExchange');

/**
 * Provider token-exchange rejection. The provider's `error`/`error_description`
 * is an internal diagnostic (English, logged); the end user gets PT-BR copy.
 * Only the error fields are logged — never tokens or client secrets.
 */
function providerOAuthExchangeFailure(provider: string, error: unknown, description: unknown): BadRequestException {
  oauthExchangeLogger.warn(
    `[oauth/${provider}] token exchange rejected: error=${String(error ?? '-')} description=${String(description ?? '-')}`,
  );
  return new BadRequestException('Não foi possível concluir a conexão com a plataforma. Tente novamente.');
}

@ApiTags('Integrations')
@ApiBearerAuth()
@RequireRole('editor')
@Controller('integrations')
export class IntegrationsController {
  constructor(
    private readonly acrCloud:    ACRCloudService,
    private readonly autentique:  AutentiqueService,
    private readonly spotify:     SpotifyService,
    private readonly youtube:     YouTubeService,
    private readonly deezer:      DeezerService,
    private readonly soundcloud:  SoundCloudService,
    private readonly appleMusic:  AppleMusicService,
    private readonly instagram:   InstagramService,
    private readonly tiktok:      TikTokService,
    private readonly googleAds:   GoogleAdsService,
    private readonly abramus:     AbramusService,
    private readonly whatsapp:    WhatsAppCloudProvider,
    private readonly integrationBase: IntegrationBaseService,
    private readonly config:      ConfigService,
    private readonly cache:       CacheService,
    private readonly integrationPolicy: IntegrationPolicyService,
    // find-b4201eb2: oauth/exchange is @Public — without the interceptor's tenant
    // context, the write to oauth_connections (FORCE RLS) is denied.
    private readonly dbContext: DatabaseContextService,
  ) {}

  // ─── OAuth init (authenticated) ────────────────────────────────────────────

  /**
   * Step 1 of the marketing OAuth flow.
   * Must be called by an authenticated user before the popup is opened.
   * Issues a short-lived, single-use `exchange_token` that is stored server-side
   * in the in-memory cache.  The token is later presented to POST /oauth/exchange,
   * binding the code exchange to this authenticated session.  This prevents the
   * exchange endpoint from being used as an open token-exchange broker.
   */
  @Post('oauth/init')
  @RequireRole('editor')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Issues a single-use exchange_token to start the marketing OAuth flow' })
  oauthInit(@Body() dto: OAuthInitDto, @Request() req: any): { exchange_token: string } {
    const token = randomUUID();
    // The authenticated caller's tenantId/userId travel with the exchange_token so
    // oauthExchange knows whom to associate the persisted token with (corporate
    // Meta — see the isInstagram branch below).
    this.cache.set(`oauth_exchange:${token}`, {
      platform: dto.platform,
      tenantId: req.tenant?.id ?? req.tenantId,
      userId:   req.auth?.userId ?? req.userId,
    }, 10 * 60 * 1000);
    return { exchange_token: token };
  }

  // ─── OAuth exchange (public, requires server-issued exchange_token) ─────────

  /**
   * Step 2 of the marketing OAuth flow (called from popup callback page).
   *
   * Although this endpoint is `@Public()` (no Bearer auth — the popup window has
   * no access to the user's session), it is protected by the server-issued
   * `exchange_token` from POST /oauth/init.  That token:
   *   1. Can only be issued by an authenticated user (step 1).
   *   2. Is single-use — consumed immediately on first valid request.
   *   3. Expires after 10 minutes.
   *
   * The redirect_uri is constructed from APP_URL config — it is never accepted
   * from the client, preventing open-redirect / token-hijacking attacks.
   */
  @Post('oauth/exchange')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Exchanges the OAuth code and persists encrypted credentials on the server' })
  async oauthExchange(@Body() dto: OAuthExchangeDto): Promise<{ connected: true; platform: string }> {
    const { code, platform, exchange_token } = dto;

    if (!GENERIC_OAUTH_PLATFORMS.has(platform)) {
      throw new BadRequestException(`Plataforma não suportada para troca OAuth: ${platform}`);
    }

    const cacheKey = `oauth_exchange:${exchange_token}`;
    const entry = this.cache.get<{ platform: string; tenantId?: string; userId?: string }>(cacheKey);
    if (!entry) {
      throw new BadRequestException('exchange_token inválido ou expirado. Inicie a autorização novamente.');
    }
    if (entry.platform !== platform) {
      throw new BadRequestException('exchange_token não corresponde à plataforma solicitada.');
    }
    this.cache.delete(cacheKey);

    if (!entry.tenantId || !entry.userId) {
      throw new BadRequestException('Contexto autenticado ausente para persistir a conexão OAuth.');
    }

    const appUrl = this.config.get<string>('APP_URL') ?? 'http://localhost:5000';
    const redirect_uri = `${appUrl}/oauth/callback`;

    const isInstagram = platform === 'corp_instagram' || platform === 'meta_business' || platform === 'meta_ads';
    const isTikTok = platform === 'corp_tiktok' || platform === 'tiktok_business' || platform === 'tiktok_ads';
    const isYouTube = platform === 'corp_youtube' || platform === 'youtube_business' || platform === 'google_business' || platform === 'google_ads' || platform === 'youtube_ads';

    const asString = (value: unknown): string | undefined =>
      typeof value === 'string' && value.length > 0 ? value : undefined;
    const asNumber = (value: unknown): number | undefined =>
      typeof value === 'number' && Number.isFinite(value) ? value : undefined;

    const persist = async (params: {
      accessToken: string;
      refreshToken?: string;
      expiresIn?: number;
      scopes?: string;
    }): Promise<{ connected: true; platform: string }> => {
      // tenantId comes from the server-side exchange cache entry (issued to an
      // authenticated user in step 1), never from this request's body.
      await this.dbContext.runInTenantContext({ tenantId: entry.tenantId!, orgId: null, role: null }, () => this.integrationBase.saveOAuthTokens({
        tenantId: entry.tenantId!,
        userId: entry.userId!,
        provider: platform,
        accessToken: params.accessToken,
        refreshToken: params.refreshToken,
        expiresIn: params.expiresIn,
        scopes: params.scopes,
      }));
      return { connected: true, platform };
    };

    try {
      if (isInstagram) {
        const appId = this.config.get<string>('META_APP_ID') ?? '';
        const appSecret = this.config.get<string>('META_APP_SECRET') ?? '';
        if (!appId || !appSecret) {
          throw new BadRequestException('META_APP_ID / META_APP_SECRET não configurados');
        }

        const url = `https://graph.facebook.com/v18.0/oauth/access_token?client_id=${appId}&redirect_uri=${encodeURIComponent(redirect_uri)}&client_secret=${appSecret}&code=${code}`;
        const res = await fetch(url);
        const json = await res.json() as Record<string, unknown>;
        if (!res.ok || json['error']) {
          const errObj = json['error'] as Record<string, unknown> | undefined;
          throw providerOAuthExchangeFailure('meta', errObj?.['type'] ?? res.status, errObj?.['message']);
        }

        const shortToken = asString(json['access_token']);
        if (!shortToken) throw new BadRequestException('Meta não retornou access_token');

        const longRes = await fetch(
          `https://graph.facebook.com/v18.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${shortToken}`,
        );
        const longJson = await longRes.json() as Record<string, unknown>;
        const accessToken = longRes.ok && !longJson['error']
          ? asString(longJson['access_token']) ?? shortToken
          : shortToken;
        const expiresIn = longRes.ok && !longJson['error']
          ? asNumber(longJson['expires_in'])
          : undefined;

        return persist({
          accessToken,
          expiresIn: expiresIn ?? 5_184_000,
          scopes: 'pages_show_list,ads_management,business_management,read_insights,instagram_basic',
        });
      }

      if (isTikTok) {
        const clientKey = this.config.get<string>('TIKTOK_CLIENT_KEY') ?? '';
        const clientSecret = this.config.get<string>('TIKTOK_CLIENT_SECRET') ?? '';
        if (!clientKey || !clientSecret) {
          throw new BadRequestException('TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET não configurados');
        }

        const res = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_key: clientKey,
            client_secret: clientSecret,
            code,
            grant_type: 'authorization_code',
            redirect_uri,
          }),
        });
        const json = await res.json() as Record<string, unknown>;
        if (!res.ok || json['error']) {
          throw providerOAuthExchangeFailure('tiktok', json['error'] ?? res.status, json['error_description']);
        }

        const accessToken = asString(json['access_token']);
        if (!accessToken) throw new BadRequestException('TikTok não retornou access_token');
        return persist({
          accessToken,
          refreshToken: asString(json['refresh_token']),
          expiresIn: asNumber(json['expires_in']),
          scopes: asString(json['scope']),
        });
      }

      if (isYouTube) {
        const clientId = this.config.get<string>('GOOGLE_CLIENT_ID') ??
          this.config.get<string>('GOOGLE_ADS_CLIENT_ID') ?? '';
        const clientSecret = this.config.get<string>('GOOGLE_CLIENT_SECRET') ??
          this.config.get<string>('GOOGLE_ADS_CLIENT_SECRET') ?? '';
        if (!clientId || !clientSecret) {
          throw new BadRequestException('GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET não configurados');
        }

        const res = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri,
            grant_type: 'authorization_code',
          }),
        });
        const json = await res.json() as Record<string, unknown>;
        if (!res.ok || json['error']) {
          throw providerOAuthExchangeFailure('google', json['error'] ?? res.status, json['error_description']);
        }

        const accessToken = asString(json['access_token']);
        if (!accessToken) throw new BadRequestException('Google não retornou access_token');
        return persist({
          accessToken,
          refreshToken: asString(json['refresh_token']),
          expiresIn: asNumber(json['expires_in']),
          scopes: asString(json['scope']),
        });
      }

      if (platform === 'docusign') {
        const integrationKey = this.config.get<string>('DOCUSIGN_INTEGRATION_KEY') ?? '';
        const clientSecret = this.config.get<string>('DOCUSIGN_CLIENT_SECRET') ?? '';
        const authBaseUrl = this.config.get<string>('DOCUSIGN_AUTH_BASE_URL') ??
          'https://account-d.docusign.com';
        if (!integrationKey || !clientSecret) {
          throw new BadRequestException(
            'DOCUSIGN_INTEGRATION_KEY / DOCUSIGN_CLIENT_SECRET não configurados',
          );
        }

        const basic = Buffer.from(`${integrationKey}:${clientSecret}`).toString('base64');
        const res = await fetch(`${authBaseUrl}/oauth/token`, {
          method: 'POST',
          headers: {
            Authorization: `Basic ${basic}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            code,
            grant_type: 'authorization_code',
            redirect_uri,
          }),
        });
        const json = await res.json() as Record<string, unknown>;
        if (!res.ok || json['error']) {
          throw providerOAuthExchangeFailure('docusign', json['error'] ?? res.status, json['error_description']);
        }

        const accessToken = asString(json['access_token']);
        if (!accessToken) throw new BadRequestException('DocuSign não retornou access_token');
        return persist({
          accessToken,
          refreshToken: asString(json['refresh_token']),
          expiresIn: asNumber(json['expires_in']),
          scopes: asString(json['scope']),
        });
      }

      if (platform === 'stripe_connect') {
        const clientSecret = this.config.get<string>('STRIPE_SECRET_KEY') ?? '';
        const clientId = this.config.get<string>('STRIPE_CONNECT_CLIENT_ID') ?? '';
        if (!clientSecret || !clientId) {
          throw new BadRequestException(
            'STRIPE_SECRET_KEY / STRIPE_CONNECT_CLIENT_ID não configurados',
          );
        }

        const res = await fetch('https://connect.stripe.com/oauth/token', {
          method: 'POST',
          headers: {
            Authorization: `Basic ${Buffer.from(`${clientSecret}:`).toString('base64')}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({ code, grant_type: 'authorization_code' }),
        });
        const json = await res.json() as Record<string, unknown>;
        if (!res.ok || json['error']) {
          throw providerOAuthExchangeFailure('stripe-connect', json['error'] ?? res.status, json['error_description']);
        }

        const accessToken = asString(json['access_token']);
        if (!accessToken) throw new BadRequestException('Stripe não retornou access_token');
        return persist({
          accessToken,
          refreshToken: asString(json['refresh_token']),
          scopes: asString(json['scope']),
        });
      }

      oauthExchangeLogger.warn(`[oauth] unsupported platform for token exchange: ${platform}`);
      throw new BadRequestException('Plataforma não suportada para conexão.');
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      oauthExchangeLogger.error(`[oauth/${platform}] token exchange failed: ${(err as Error).message}`, (err as Error).stack);
      throw new InternalServerErrorException('Não foi possível concluir a conexão com a plataforma. Tente novamente.');
    }
  }

  @Get('oauth/status')
  @RequireRole('viewer')
  @ApiOperation({ summary: 'Reads the persisted OAuth connection without exposing credentials' })
  oauthStatus(@Query('platform') platform: string, @Request() req: any) {
    const provider = this.resolveOAuthProvider(platform);
    return this.integrationBase.getOAuthStatus(
      req.tenant?.id ?? req.tenantId,
      req.auth?.userId ?? req.userId,
      provider,
    );
  }

  @Delete('oauth/disconnect')
  @RequireRole('admin')
  @Audit('integration.disconnected')
  @ApiOperation({ summary: 'Removes the persisted OAuth connection (admin+)' })
  @HttpCode(HttpStatus.NO_CONTENT)
  oauthDisconnect(@Query('platform') platform: string, @Request() req: any) {
    const provider = this.resolveOAuthProvider(platform);
    return this.integrationBase.disconnectOAuth(
      req.tenant?.id ?? req.tenantId,
      req.auth?.userId ?? req.userId,
      provider,
    );
  }

  private resolveOAuthProvider(platform: string): string {
    const alias = OAUTH_PROVIDER_ALIASES[platform];
    if (alias) return alias;
    if (!GENERIC_OAUTH_PLATFORMS.has(platform)) {
      throw new BadRequestException(`Plataforma OAuth não suportada: ${platform}`);
    }
    return platform;
  }

  // ─── External provider governance ──────────────────────────────────────────

  @Get('providers')
  @RequireRole('viewer')
  @ApiOperation({
    summary: 'Integrations resolved for this client (governance + capability + audience + connection)',
    description:
      'Resolvido pelo backend a partir da governança persistida (platform_integrations), da ' +
      'capacidade técnica derivada do código e da conexão do tenant. Só retorna o que o ' +
      'cliente pode ENXERGAR (canView) — o que ele pode USAR vem em canUse e é enforced no ' +
      'backend pelo IntegrationUsageGuard, não apenas escondido na UI.',
  })
  async listExternalProviders(@Request() req: any) {
    const resolved = await this.integrationPolicy.resolveAll({
      tenantId: req.tenant?.id ?? req.tenantId,
      userId:   req.auth?.userId ?? req.userId,
      // tenants.plan is the real column (TenantPlan). plan_slug/planSlug do NOT exist —
      // reading them made mode:'plans' silently deny everyone.
      planSlug: req.tenant?.plan ?? null,
      tenantFeatures: (req.tenant?.features as Record<string, unknown> | undefined) ?? null,
    });

    // canDiscover, not canUse: an integration of a higher plan STAYS visible
    // (blocked + upgrade). Hiding it would lose the sale and misrepresent the
    // catalog. Internal/billing entries are already excluded by classification.
    const visible = resolved.filter((r) => r.canDiscover);

    // Upgrade hint discovered by query — no plan name in code.
    return Promise.all(visible.map(async (r) => ({
      slug:             r.providerKey,
      name:             r.name,
      category:         r.category,
      classification:   r.classification,
      publicationState: r.publicationState,
      technicalState:   r.technicalState,
      connectionKind:   r.connectionKind,
      entitled:         r.entitled,
      canConnect:       r.canConnect,
      canUse:           r.canUse,
      connectionState:  r.connectionStatus,
      reasonCode:       r.reasonCode,
      eligiblePlans:    r.entitled ? [] : await this.integrationPolicy.plansIncluding(r.providerKey),
      // Deliberately NOT exposed to the customer: admin notes, required_env,
      // capabilityEvidence, audiences and policy internals.
    })));
  }

  // ─── General status ────────────────────────────────────────────────────────

  @Get('status')
  @RequireRole('viewer')
  @ApiOperation({ summary: 'Status of every integration' })
  getStatus() {
    return {
      acrcloud:    { configured: this.acrCloud.isConfigured() },
      autentique:  { configured: true },
      spotify:     { configured: this.spotify.isConfigured() },
      youtube:     { configured: this.youtube.isConfigured() },
      deezer:      { configured: this.deezer.isConfigured() },
      soundcloud:  { configured: this.soundcloud.isConfigured() },
      apple_music: { configured: this.appleMusic.isConfigured() },
      instagram:   { configured: this.instagram.isConfigured() },
      tiktok:      { configured: this.tiktok.isConfigured() },
      google_ads:  { configured: this.googleAds.isConfigured() },
      abramus:     { configured: true },
    };
  }

  // ─── ACRCloud ──────────────────────────────────────────────────────────────

  @Post('acrcloud/recognize')
  @RequireRole('editor')
  @Audit('integration.acr_recognized')
  @ApiOperation({ summary: 'Identify a song by audio (ACRCloud)' })
  @HttpCode(HttpStatus.OK)
  recognizeAudio(@Body() dto: RecognizeAudioDto) {
    return this.acrCloud.recognize(dto.audioBase64);
  }

  // ─── Autentique ────────────────────────────────────────────────────────────

  @Post('autentique/configure')
  @RequireRole('admin')
  @Audit('integration.connected')
  @ApiOperation({ summary: 'Configure the Autentique API token (admin+)' })
  @HttpCode(HttpStatus.OK)
  configureAutentique(@Request() req: any, @Body() dto: ConfigureAutentiqueDto) {
    return this.autentique.configure(req.tenant?.id ?? req.tenantId, dto.apiToken);
  }

  @Post('autentique/send')
  @RequireRole('editor')
  @UseInterceptors(IdempotencyInterceptor)
  @Audit('integration.document_sent')
  @ApiOperation({ summary: 'Send a contract for signing via Autentique' })
  sendForSignature(@Request() req: any, @Body() dto: SendForSignatureDto) {
    return this.autentique.sendForSignature({
      tenantId:   req.tenant?.id ?? req.tenantId,
      contractId: dto.contractId,
      name:       dto.name,
      fileBase64: dto.fileBase64,
      signers:    dto.signers,
    });
  }

  @Post('autentique/webhook')
  @RequireRole('editor')
  @ApiOperation({ summary: 'Autentique webhook (signature completed)' })
  @HttpCode(HttpStatus.OK)
  async autentiqueWebhook(@Body() payload: any) {
    // `payload: any` is deliberate: the global ValidationPipe (whitelist:true,
    // forbidNonWhitelisted:true) runs for EVERY route and cannot be overridden by a
    // method-level @UsePipes (both pipes run — a local @UsePipes does not replace
    // the global one, it only adds to it). Typing it as AutentiqueWebhookDto here
    // would re-enable the global forbidNonWhitelisted and reject the extra fields
    // Autentique actually sends. Instead we manually validate the declared fields
    // (event/event_id/document_id) without a whitelist, keeping tolerance for
    // unmodeled provider fields — same behavior as AutentiqueController.webhook.
    const dto = plainToInstance(AutentiqueWebhookDto, payload);
    const errors = await validate(dto, { whitelist: false, forbidNonWhitelisted: false });
    if (errors.length > 0) {
      throw new BadRequestException(
        errors.flatMap((e) => Object.values(e.constraints ?? {})),
      );
    }
    return this.autentique.handleWebhook(payload);
  }

  // ─── Spotify ───────────────────────────────────────────────────────────────

  @Get('spotify/auth')
  @RequireRole('editor')
  @ApiOperation({ summary: 'Start the Spotify OAuth flow' })
  spotifyAuthUrl(@Request() req: any) {
    return { url: this.spotify.getAuthUrl(req.tenant?.id ?? req.tenantId, req.auth?.userId ?? req.userId) };
  }

  @Get('spotify/callback')
  @Public()
  @Redirect()
  @ApiOperation({ summary: 'Callback OAuth Spotify (redirect do Spotify)' })
  async spotifyCallbackGet(@Query('code') code: string, @Query('state') state: string) {
    const frontendUrl = process.env['FRONTEND_URL'] ?? 'http://localhost:5000';
    try {
      await this.spotify.handleCallback(code, state);
      return { url: `${frontendUrl}/settings/integrations?spotify=connected` };
    } catch {
      return { url: `${frontendUrl}/settings/integrations?spotify=error` };
    }
  }

  @Post('spotify/callback')
  @RequireRole('editor')
  @Audit('integration.connected')
  @ApiOperation({ summary: 'Callback OAuth Spotify (POST manual)' })
  @HttpCode(HttpStatus.OK)
  spotifyCallback(@Body() dto: SpotifyConnectDto) {
    return this.spotify.handleCallback(dto.code, dto.state);
  }

  @Post('spotify/sync-artist')
  @RequireRole('editor')
  @Audit('integration.spotify_synced')
  @ApiOperation({ summary: 'Sync artist metrics on Spotify' })
  @HttpCode(HttpStatus.OK)
  syncSpotifyArtist(@Request() req: any, @Body() dto: SyncSpotifyArtistDto) {
    return this.spotify.syncArtistMetrics(req.tenant?.id ?? req.tenantId, dto.spotifyUrl);
  }

  @Delete('spotify/disconnect')
  @RequireRole('admin')
  @Audit('integration.disconnected')
  @ApiOperation({ summary: 'Disconnect the Spotify account (admin+)' })
  @HttpCode(HttpStatus.NO_CONTENT)
  spotifyDisconnect(@Request() req: any) {
    return this.spotify.disconnect(req.tenant?.id ?? req.tenantId, req.auth?.userId ?? req.userId);
  }

  // ─── YouTube ───────────────────────────────────────────────────────────────

  @Get('youtube/status')
  @RequireRole('viewer')
  @ApiOperation({ summary: 'YouTube integration status' })
  youtubeStatus() {
    return { configured: this.youtube.isConfigured() };
  }

  @Get('youtube/channel/:id')
  @RequireRole('editor')
  @ApiOperation({ summary: 'YouTube channel statistics' })
  getYouTubeChannel(@Param('id') id: string) {
    return this.youtube.getChannelStats(id);
  }

  @Get('youtube/video/:id')
  @RequireRole('editor')
  @ApiOperation({ summary: 'YouTube video statistics' })
  getYouTubeVideo(@Param('id') id: string) {
    return this.youtube.getVideoStats(id);
  }

  @Get('youtube/search')
  @RequireRole('viewer')
  @ApiOperation({ summary: 'Search YouTube videos' })
  searchYouTube(@Query('q') q: string, @Query('limit') limit?: string) {
    return this.youtube.searchVideos(q, limit ? +limit : 10);
  }

  // ─── Deezer ────────────────────────────────────────────────────────────────

  @Get('deezer/artist/:id')
  @RequireRole('viewer')
  @ApiOperation({ summary: 'Artist statistics on Deezer' })
  getDeezerArtist(@Param('id') id: string) {
    return this.deezer.getArtistStats(id);
  }

  @Get('deezer/artist/:id/top')
  @RequireRole('viewer')
  @ApiOperation({ summary: 'Artist top tracks on Deezer' })
  getDeezerTopTracks(@Param('id') id: string, @Query('limit') limit?: string) {
    return this.deezer.getTopTracks(id, limit ? +limit : 10);
  }

  @Get('deezer/album/:id')
  @RequireRole('viewer')
  @ApiOperation({ summary: 'Album data on Deezer' })
  getDeezerAlbum(@Param('id') id: string) {
    return this.deezer.getAlbum(id);
  }

  @Get('deezer/search')
  @RequireRole('viewer')
  @ApiOperation({ summary: 'Search artists on Deezer' })
  searchDeezer(@Query('q') q: string, @Query('limit') limit?: string) {
    return this.deezer.searchArtist(q, limit ? +limit : 5);
  }

  // ─── SoundCloud ────────────────────────────────────────────────────────────

  @Post('soundcloud/configure')
  @RequireRole('admin')
  @Audit('integration.connected')
  @ApiOperation({ summary: 'Configure SoundCloud credentials (admin+)' })
  @HttpCode(HttpStatus.OK)
  configureSoundCloud(
    @Request() req: any,
    @Body() body: ConfigureSoundCloudDto,
  ) {
    return this.soundcloud.configure(req.tenant?.id ?? req.tenantId, body.clientId, body.clientSecret);
  }

  @Get('soundcloud/status')
  @RequireRole('viewer')
  @ApiOperation({ summary: 'SoundCloud integration status' })
  soundCloudStatus(@Request() req: any) {
    return this.soundcloud.getProviderStatus(req.tenant?.id ?? req.tenantId);
  }

  @Delete('soundcloud/disconnect')
  @RequireRole('admin')
  @Audit('integration.disconnected')
  @ApiOperation({ summary: 'Disconnect SoundCloud (admin+)' })
  @HttpCode(HttpStatus.NO_CONTENT)
  soundCloudDisconnect(@Request() req: any) {
    return this.soundcloud.disconnectProvider(req.tenant?.id ?? req.tenantId);
  }

  @Get('soundcloud/user')
  @RequireRole('editor')
  @ApiOperation({ summary: 'Resolve a SoundCloud user profile by URL' })
  resolveSoundCloudUser(@Query('url') url: string) {
    return this.soundcloud.resolveUser(url);
  }

  @Get('soundcloud/track/:id')
  @RequireRole('editor')
  @ApiOperation({ summary: 'SoundCloud track statistics' })
  getSoundCloudTrack(@Param('id') id: string) {
    return this.soundcloud.getTrackStats(id);
  }

  @Get('soundcloud/search')
  @RequireRole('viewer')
  @ApiOperation({ summary: 'Search SoundCloud tracks' })
  searchSoundCloud(@Query('q') q: string, @Query('limit') limit?: string) {
    return this.soundcloud.searchTracks(q, limit ? +limit : 10);
  }

  // ─── Apple Music ───────────────────────────────────────────────────────────

  @Post('apple-music/configure')
  @RequireRole('admin')
  @Audit('integration.connected')
  @ApiOperation({ summary: 'Configure the Apple Music Developer Token (admin+)' })
  @HttpCode(HttpStatus.OK)
  configureAppleMusic(
    @Request() req: any,
    @Body() body: { teamId: string; keyId: string; privateKey: string },
  ) {
    return this.appleMusic.configure(req.tenant?.id ?? req.tenantId, body.teamId, body.keyId, body.privateKey);
  }

  @Get('apple-music/status')
  @RequireRole('viewer')
  @ApiOperation({ summary: 'Apple Music integration status' })
  appleMusicStatus(@Request() req: any) {
    return this.appleMusic.getProviderStatus(req.tenant?.id ?? req.tenantId);
  }

  @Delete('apple-music/disconnect')
  @RequireRole('admin')
  @Audit('integration.disconnected')
  @ApiOperation({ summary: 'Disconnect Apple Music (admin+)' })
  @HttpCode(HttpStatus.NO_CONTENT)
  appleMusicDisconnect(@Request() req: any) {
    return this.appleMusic.disconnectProvider(req.tenant?.id ?? req.tenantId);
  }

  @Get('apple-music/artist/:id')
  @RequireRole('editor')
  @ApiOperation({ summary: 'Look up an artist in the Apple Music catalog' })
  getAppleMusicArtist(
    @Request() req: any,
    @Param('id') id: string,
    @Query('storefront') storefront?: string,
  ) {
    return this.appleMusic.getArtistFromCatalog(req.tenant?.id ?? req.tenantId, id, storefront ?? 'br');
  }

  @Get('apple-music/search')
  @RequireRole('editor')
  @ApiOperation({ summary: 'Search the Apple Music catalog' })
  searchAppleMusic(
    @Request() req: any,
    @Query('q') q: string,
    @Query('types') types?: string,
    @Query('storefront') storefront?: string,
    @Query('limit') limit?: string,
  ) {
    return this.appleMusic.searchCatalog(
      req.tenant?.id ?? req.tenantId, q, types ?? 'artists,albums', storefront ?? 'br', limit ? +limit : 10,
    );
  }

  // ─── WhatsApp Cloud API (Meta) ──────────────────────────────────────────────

  @Post('whatsapp/configure')
  @RequireRole('admin')
  @Audit('integration.connected')
  @ApiOperation({ summary: 'Configure the WhatsApp Cloud API (admin+)' })
  @HttpCode(HttpStatus.OK)
  configureWhatsApp(
    @Request() req: any,
    @Body() body: { phoneNumberId: string; accessToken: string; wabaId: string },
  ) {
    return this.whatsapp.configure(req.tenant?.id ?? req.tenantId, body.phoneNumberId, body.accessToken, body.wabaId);
  }

  @Get('whatsapp/status')
  @RequireRole('viewer')
  @ApiOperation({ summary: 'WhatsApp integration status' })
  whatsappStatus(@Request() req: any) {
    return this.whatsapp.getProviderStatus(req.tenant?.id ?? req.tenantId);
  }

  @Delete('whatsapp/disconnect')
  @RequireRole('admin')
  @Audit('integration.disconnected')
  @ApiOperation({ summary: 'Disconnect WhatsApp (admin+)' })
  @HttpCode(HttpStatus.NO_CONTENT)
  whatsappDisconnect(@Request() req: any) {
    return this.whatsapp.disconnectProvider(req.tenant?.id ?? req.tenantId);
  }

  @Post('whatsapp/send')
  @RequireRole('editor')
  @Audit('integration.whatsapp_message_sent')
  @ApiOperation({ summary: 'Send a text message via the WhatsApp Cloud API' })
  sendWhatsAppMessage(
    @Request() req: any,
    @Body() body: { to: string; body: string },
  ) {
    return this.whatsapp.sendTextMessage(req.tenant?.id ?? req.tenantId, body.to, body.body);
  }

  // ─── Instagram ─────────────────────────────────────────────────────────────

  @Get('instagram/auth')
  @RequireRole('editor')
  @ApiOperation({ summary: 'Start the Instagram (Meta) OAuth flow' })
  instagramAuthUrl(@Request() req: any) {
    return { url: this.instagram.getAuthUrl(req.tenant?.id ?? req.tenantId, req.auth?.userId ?? req.userId) };
  }

  @Post('instagram/callback')
  @RequireRole('editor')
  @Audit('integration.connected')
  @ApiOperation({ summary: 'Callback OAuth Instagram' })
  @HttpCode(HttpStatus.OK)
  instagramCallback(@Body() body: OAuthCodeStateDto) {
    return this.instagram.handleCallback(body.code, body.state);
  }

  @Get('instagram/status')
  @RequireRole('viewer')
  @ApiOperation({ summary: 'Instagram integration status' })
  instagramStatus(@Request() req: any) {
    return this.instagram.getProviderStatus(req.tenant?.id ?? req.tenantId, req.auth?.userId ?? req.userId);
  }

  @Get('instagram/metrics')
  @RequireRole('editor')
  @ApiOperation({ summary: 'Instagram Business account metrics' })
  instagramMetrics(@Request() req: any) {
    return this.instagram.getAccountMetrics(req.tenant?.id ?? req.tenantId, req.auth?.userId ?? req.userId);
  }

  @Delete('instagram/disconnect')
  @RequireRole('admin')
  @Audit('integration.disconnected')
  @ApiOperation({ summary: 'Disconnect Instagram (admin+)' })
  @HttpCode(HttpStatus.NO_CONTENT)
  instagramDisconnect(@Request() req: any) {
    return this.instagram.disconnectProvider(req.tenant?.id ?? req.tenantId, req.auth?.userId ?? req.userId);
  }

  // ─── Corporate Meta (Business/Ads/Instagram — see oauth/exchange above) ──

  private static readonly META_CORP_PLATFORMS = ['corp_instagram', 'meta_business', 'meta_ads'];

  @Get('meta-corporate/status')
  @RequireRole('viewer')
  @ApiOperation({ summary: 'Corporate Meta connection status (Business/Ads/Instagram)' })
  metaCorporateStatus(@Query('platform') platform: string, @Request() req: any) {
    if (!IntegrationsController.META_CORP_PLATFORMS.includes(platform)) {
      throw new BadRequestException(`Plataforma Meta corporativa inválida: ${platform}`);
    }
    return this.instagram.getProviderStatus(req.tenant?.id ?? req.tenantId, req.auth?.userId ?? req.userId, platform);
  }

  @Delete('meta-corporate/disconnect')
  @RequireRole('admin')
  @Audit('integration.disconnected')
  @ApiOperation({ summary: 'Disconnect the corporate Meta account (admin+) — tries to revoke it at Meta' })
  @HttpCode(HttpStatus.NO_CONTENT)
  metaCorporateDisconnect(@Query('platform') platform: string, @Request() req: any) {
    if (!IntegrationsController.META_CORP_PLATFORMS.includes(platform)) {
      throw new BadRequestException(`Plataforma Meta corporativa inválida: ${platform}`);
    }
    return this.instagram.disconnectProvider(req.tenant?.id ?? req.tenantId, req.auth?.userId ?? req.userId, platform);
  }

  // ─── TikTok Ads ────────────────────────────────────────────────────────────

  @Post('tiktok/ads/configure')
  @RequireRole('admin')
  @Audit('integration.connected')
  @ApiOperation({ summary: 'Configure TikTok Ads (admin+)' })
  @HttpCode(HttpStatus.OK)
  configureTikTokAds(
    @Request() req: any,
    @Body() body: { appId: string; secret: string; advertiserId: string; accessToken: string },
  ) {
    return this.tiktok.configureAds(
      req.tenant?.id ?? req.tenantId, body.appId, body.secret, body.advertiserId, body.accessToken,
    );
  }

  @Get('tiktok/ads/status')
  @RequireRole('viewer')
  @ApiOperation({ summary: 'TikTok Ads integration status' })
  tiktokAdsStatus(@Request() req: any) {
    return this.tiktok.getAdsStatus(req.tenant?.id ?? req.tenantId);
  }

  @Delete('tiktok/ads/disconnect')
  @RequireRole('admin')
  @Audit('integration.disconnected')
  @ApiOperation({ summary: 'Disconnect TikTok Ads (admin+)' })
  @HttpCode(HttpStatus.NO_CONTENT)
  tiktokAdsDisconnect(@Request() req: any) {
    return this.tiktok.disconnectAds(req.tenant?.id ?? req.tenantId);
  }

  @Get('tiktok/ads/campaigns')
  @RequireRole('editor')
  @ApiOperation({ summary: 'List TikTok Ads campaigns' })
  tiktokAdsCampaigns(@Request() req: any) {
    return this.tiktok.getAdsCampaigns(req.tenant?.id ?? req.tenantId);
  }

  @Get('tiktok/ads/insights')
  @RequireRole('editor')
  @ApiOperation({ summary: 'TikTok Ads campaign insights' })
  tiktokAdsInsights(
    @Request() req: any,
    @Query('start_date') startDate: string,
    @Query('end_date') endDate: string,
  ) {
    return this.tiktok.getAdsInsights(req.tenant?.id ?? req.tenantId, startDate, endDate);
  }

  // ─── TikTok organic ────────────────────────────────────────────────────────

  @Get('tiktok/auth')
  @RequireRole('editor')
  @ApiOperation({ summary: 'Start the organic TikTok OAuth flow' })
  tiktokAuthUrl(@Request() req: any) {
    return { url: this.tiktok.getOAuthUrl(req.tenant?.id ?? req.tenantId, req.auth?.userId ?? req.userId) };
  }

  @Post('tiktok/callback')
  @RequireRole('editor')
  @Audit('integration.connected')
  @ApiOperation({ summary: 'Organic TikTok OAuth callback' })
  @HttpCode(HttpStatus.OK)
  tiktokCallback(@Body() body: OAuthCodeStateDto) {
    return this.tiktok.handleOAuthCallback(body.code, body.state);
  }

  @Get('tiktok/status')
  @RequireRole('viewer')
  @ApiOperation({ summary: 'Organic TikTok integration status' })
  tiktokStatus(@Request() req: any) {
    return this.tiktok.getOrganicStatus(req.tenant?.id ?? req.tenantId, req.auth?.userId ?? req.userId);
  }

  @Delete('tiktok/disconnect')
  @RequireRole('admin')
  @Audit('integration.disconnected')
  @ApiOperation({ summary: 'Disconnect organic TikTok (admin+)' })
  @HttpCode(HttpStatus.NO_CONTENT)
  tiktokDisconnect(@Request() req: any) {
    return this.tiktok.disconnectOrganic(req.tenant?.id ?? req.tenantId, req.auth?.userId ?? req.userId);
  }

  // ─── Google Ads ────────────────────────────────────────────────────────────

  @Post('google-ads/configure')
  @RequireRole('admin')
  @Audit('integration.connected')
  @ApiOperation({ summary: 'Configure Google Ads (admin+)' })
  @HttpCode(HttpStatus.OK)
  configureGoogleAds(
    @Request() req: any,
    @Body() body: { developerToken: string; customerId: string },
  ) {
    return this.googleAds.configure(req.tenant?.id ?? req.tenantId, body.developerToken, body.customerId);
  }

  @Get('google-ads/auth')
  @RequireRole('editor')
  @ApiOperation({ summary: 'Start the Google Ads OAuth flow' })
  googleAdsAuthUrl(@Request() req: any) {
    return { url: this.googleAds.getOAuthUrl(req.tenant?.id ?? req.tenantId, req.auth?.userId ?? req.userId) };
  }

  @Post('google-ads/callback')
  @RequireRole('editor')
  @Audit('integration.connected')
  @ApiOperation({ summary: 'Callback OAuth Google Ads' })
  @HttpCode(HttpStatus.OK)
  googleAdsCallback(@Body() body: OAuthCodeStateDto) {
    return this.googleAds.handleOAuthCallback(body.code, body.state);
  }

  @Get('google-ads/status')
  @RequireRole('viewer')
  @ApiOperation({ summary: 'Google Ads integration status' })
  googleAdsStatus(@Request() req: any) {
    return this.googleAds.getProviderStatus(req.tenant?.id ?? req.tenantId);
  }

  @Delete('google-ads/disconnect')
  @RequireRole('admin')
  @Audit('integration.disconnected')
  @ApiOperation({ summary: 'Disconnect Google Ads (admin+)' })
  @HttpCode(HttpStatus.NO_CONTENT)
  googleAdsDisconnect(@Request() req: any) {
    return this.googleAds.disconnectProvider(req.tenant?.id ?? req.tenantId, req.auth?.userId ?? req.userId);
  }

  @Get('google-ads/campaigns')
  @RequireRole('editor')
  @ApiOperation({ summary: 'List Google Ads campaigns' })
  googleAdsCampaigns(@Request() req: any) {
    return this.googleAds.getCampaigns(req.tenant?.id ?? req.tenantId, req.auth?.userId ?? req.userId);
  }

  // ─── Abramus ───────────────────────────────────────────────────────────────

  @Post('abramus/configure')
  @RequireRole('admin')
  @Audit('integration.connected')
  @ApiOperation({ summary: 'Configure Abramus credentials (admin+)' })
  @HttpCode(HttpStatus.OK)
  configureAbramus(
    @Request() req: any,
    @Body() body: { username: string; password: string; baseUrl: string },
  ) {
    return this.abramus.configure(req.tenant?.id ?? req.tenantId, body.username, body.password, body.baseUrl);
  }

  @Get('abramus/status')
  @RequireRole('viewer')
  @ApiOperation({ summary: 'Abramus integration status' })
  abramusStatus(@Request() req: any) {
    return this.abramus.getProviderStatus(req.tenant?.id ?? req.tenantId);
  }

  @Delete('abramus/disconnect')
  @RequireRole('admin')
  @Audit('integration.disconnected')
  @ApiOperation({ summary: 'Disconnect Abramus (admin+)' })
  @HttpCode(HttpStatus.NO_CONTENT)
  abramusDisconnect(@Request() req: any) {
    return this.abramus.disconnectProvider(req.tenant?.id ?? req.tenantId);
  }

  @Get('abramus/search-artist')
  @RequireRole('editor')
  @ApiOperation({ summary: 'Look up an artist in Abramus' })
  abramusSearchArtist(
    @Request() req: any,
    @Query('q') q: string,
    @Query('limit') limit?: string,
  ) {
    return this.abramus.searchArtist(req.tenant?.id ?? req.tenantId, q, limit ? +limit : 10);
  }

  @Get('abramus/search-work')
  @RequireRole('editor')
  @ApiOperation({ summary: 'Look up a work in Abramus' })
  abramusSearchWork(
    @Request() req: any,
    @Query('q') q: string,
    @Query('limit') limit?: string,
  ) {
    return this.abramus.searchWork(req.tenant?.id ?? req.tenantId, q, limit ? +limit : 10);
  }

  @Post('abramus/register-work')
  @RequireRole('manager')
  @UseInterceptors(IdempotencyInterceptor)
  @Audit('integration.abramus_work_registered')
  @ApiOperation({ summary: 'Register a work in Abramus (manager+)' })
  abramusRegisterWork(@Request() req: any, @Body() body: RegisterAbramusWorkDto) {
    // AbramusService.registerWork uses `title` (not `titulo`) in the real Abramus
    // API call — mapped explicitly here to keep that existing wire contract while
    // the request body becomes validated.
    return this.abramus.registerWork(req.tenant?.id ?? req.tenantId, {
      title: body.titulo,
      compositor: body.compositor,
      iswc: body.iswc,
      genero: body.genero,
      duracao: body.duracao,
      editora: body.editora,
      coautores: body.coautores,
    });
  }

  @Get('abramus/statements')
  @RequireRole('manager')
  @ApiOperation({ summary: 'Copyright statements in Abramus (manager+)' })
  abramusStatements(
    @Request() req: any,
    @Query('periodo') periodo?: string,
    @Query('limit') limit?: string,
  ) {
    return this.abramus.getStatements(req.tenant?.id ?? req.tenantId, periodo, limit ? +limit : 20);
  }
}
