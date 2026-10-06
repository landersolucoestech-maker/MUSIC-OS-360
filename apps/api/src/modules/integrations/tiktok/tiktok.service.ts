import { Injectable, Inject } from '@nestjs/common';
import { ConfigService }      from '@nestjs/config';
import { DataSource }         from 'typeorm';
import { DATA_SOURCE }        from '../../../database/database.module';
import { EncryptionService }  from '../../../core/security/encryption.service';
import { IntegrationBaseService } from '../integration-base.service';

import { integrationFailure, codeForUpstreamStatus } from '../integration-failure';
const TT_ADS_API    = 'https://business-api.tiktok.com/open_api/v1.3';
const TT_OAUTH      = 'https://www.tiktok.com/v2/auth/authorize';
const TT_TOKEN      = 'https://open.tiktokapis.com/v2/oauth/token';
const PROVIDER_ADS  = 'tiktok_ads';
const PROVIDER_ORG  = 'tiktok';

interface AdsCreds {
  app_id:        string;
  secret:        string;
  advertiser_id: string;
  access_token:  string;
}

@Injectable()
export class TikTokService extends IntegrationBaseService {
  constructor(
    @Inject(DATA_SOURCE) ds: DataSource | null,
    enc: EncryptionService,
    private readonly config: ConfigService,
  ) {
    super(ds, enc);
  }

  isConfigured(): boolean {
    return !!(this.config.get('TIKTOK_CLIENT_KEY') && this.config.get('TIKTOK_CLIENT_SECRET'));
  }

  async configureAds(tenantId: string, appId: string, secret: string, advertiserId: string, accessToken: string): Promise<void> {
    // Connected only after the Ads API accepts the access token for this advertiser.
    await this.saveCredentials(tenantId, PROVIDER_ADS, { app_id: appId, secret, advertiser_id: advertiserId, access_token: accessToken }, async () => {
      const qs = new URLSearchParams({ advertiser_id: advertiserId, fields: '["campaign_id"]', page_size: '1' }).toString();
      const res = await this.fetch(`${TT_ADS_API}/campaign/get/?${qs}`, { headers: { 'Access-Token': accessToken } });
      if (!res.ok) throw new Error(`TikTok Ads rejected the access token (status ${res.status})`);
      const body = await res.json() as { code?: number; message?: string };
      if (body.code !== 0) throw new Error(`TikTok Ads rejected the access token: ${body.message ?? 'error'}`);
    });
  }

  async getAdsStatus(tenantId: string) { return this.getStatus(tenantId, PROVIDER_ADS); }
  async disconnectAds(tenantId: string): Promise<void> { await this.disconnect(tenantId, PROVIDER_ADS); }

  async getAdsCampaigns(tenantId: string) {
    const creds = await this.loadCredentials<AdsCreds>(tenantId, PROVIDER_ADS);
    if (!creds) return integrationFailure(this.logger, 'PROVIDER_NOT_CONFIGURED');

    const res = await this.fetch(
      `${TT_ADS_API}/campaign/get/?advertiser_id=${creds.advertiser_id}&fields=["campaign_id","campaign_name","status","budget","objective_type"]`,
      { headers: { 'Access-Token': creds.access_token } },
    );
    if (!res.ok) return integrationFailure(this.logger, codeForUpstreamStatus(res.status), `upstream status ${res.status}`);
    const d = await res.json() as any;
    if (d.code !== 0) return integrationFailure(this.logger, 'INTEGRATION_CALL_FAILED', d.message);
    return d.data?.list ?? [];
  }

  async getAdsInsights(tenantId: string, startDate: string, endDate: string) {
    const creds = await this.loadCredentials<AdsCreds>(tenantId, PROVIDER_ADS);
    if (!creds) return integrationFailure(this.logger, 'PROVIDER_NOT_CONFIGURED');

    const body = {
      advertiser_id: creds.advertiser_id,
      report_type: 'BASIC', data_level: 'AUCTION_CAMPAIGN',
      dimensions: ['campaign_id', 'stat_time_day'],
      metrics: ['spend', 'impressions', 'clicks', 'ctr', 'cpc', 'reach'],
      start_date: startDate, end_date: endDate, page_size: 100,
    };

    const res = await this.fetch(`${TT_ADS_API}/report/integrated/get/`, {
      method: 'POST',
      headers: { 'Access-Token': creds.access_token, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) return integrationFailure(this.logger, codeForUpstreamStatus(res.status), `upstream status ${res.status}`);
    const d = await res.json() as any;
    return d.data?.list ?? [];
  }

  getOAuthUrl(tenantId: string, userId: string): string {
    const clientKey   = this.config.get<string>('TIKTOK_CLIENT_KEY')   ?? '';
    const redirectUri = this.config.get<string>('TIKTOK_REDIRECT_URI') ?? '';
    const state       = this.buildSignedState({ tenantId, userId, provider: PROVIDER_ORG });
    const params      = new URLSearchParams({
      client_key: clientKey, redirect_uri: redirectUri, scope: 'user.info.basic,video.list',
      response_type: 'code', state,
    });
    return `${TT_OAUTH}?${params}`;
  }

  async handleOAuthCallback(code: string, state: string): Promise<void> {
    const payload      = this.verifySignedState(state);
    const { tenantId, userId } = payload;
    const clientKey    = this.config.get<string>('TIKTOK_CLIENT_KEY')    ?? '';
    const clientSecret = this.config.get<string>('TIKTOK_CLIENT_SECRET') ?? '';
    const redirectUri  = this.config.get<string>('TIKTOK_REDIRECT_URI')  ?? '';

    const res = await this.fetch(TT_TOKEN, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_key: clientKey, client_secret: clientSecret, code, grant_type: 'authorization_code', redirect_uri: redirectUri }),
    });
    const data = await res.json() as any;
    if (data.error) throw new Error(data.error_description ?? data.error);

    await this.saveOAuthTokens({ tenantId, userId, provider: PROVIDER_ORG, accessToken: data.access_token, refreshToken: data.refresh_token, expiresIn: data.expires_in, scopes: data.scope });
    this.logger.log(`TikTok OAuth: ${userId}@${tenantId} connected`);
  }

  /** Status of the organic connection (same pattern as InstagramService.getProviderStatus) —
   * missing since the original organic OAuth implementation; the frontend had no
   * way to know whether the account was connected beyond the callback flow itself. */
  async getOrganicStatus(tenantId: string, userId: string) {
    return this.getOAuthStatus(tenantId, userId, PROVIDER_ORG);
  }

  async disconnectOrganic(tenantId: string, userId: string): Promise<void> {
    await this.disconnectOAuth(tenantId, userId, PROVIDER_ORG);
  }
}
