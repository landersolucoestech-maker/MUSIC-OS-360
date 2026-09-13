import { Injectable, Inject } from '@nestjs/common';
import { ConfigService }      from '@nestjs/config';
import { DataSource }         from 'typeorm';
import { DATA_SOURCE }        from '../../../database/database.module';
import { EncryptionService }  from '../../../core/security/encryption.service';
import { IntegrationBaseService } from '../integration-base.service';

const GOOGLE_AUTH  = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN = 'https://oauth2.googleapis.com/token';
const GAD_API      = 'https://googleads.googleapis.com/v17';
const PROVIDER     = 'google_ads';
const SCOPES       = 'https://www.googleapis.com/auth/adwords';

interface GAdsCreds {
  developer_token: string;
  customer_id:     string;
}

@Injectable()
export class GoogleAdsService extends IntegrationBaseService {
  constructor(
    @Inject(DATA_SOURCE) ds: DataSource | null,
    enc: EncryptionService,
    private readonly config: ConfigService,
  ) {
    super(ds, enc);
  }

  isConfigured(): boolean {
    return !!(this.config.get('GOOGLE_ADS_CLIENT_ID') && this.config.get('GOOGLE_ADS_CLIENT_SECRET'));
  }

  async configure(tenantId: string, developerToken: string, customerId: string): Promise<void> {
    await this.saveCredentials(tenantId, PROVIDER, { developer_token: developerToken, customer_id: customerId });
  }

  async getProviderStatus(tenantId: string) {
    return this.getStatus(tenantId, PROVIDER);
  }

  async disconnectProvider(tenantId: string, userId: string): Promise<void> {
    await this.disconnect(tenantId, PROVIDER);
    await this.disconnectOAuth(tenantId, userId, PROVIDER);
  }

  getOAuthUrl(tenantId: string, userId: string): string {
    const clientId    = this.config.get<string>('GOOGLE_ADS_CLIENT_ID')    ?? '';
    const redirectUri = this.config.get<string>('GOOGLE_ADS_REDIRECT_URI') ?? '';
    const state       = this.buildSignedState({ tenantId, userId, provider: PROVIDER });
    const params      = new URLSearchParams({
      client_id: clientId, redirect_uri: redirectUri, scope: SCOPES,
      response_type: 'code', access_type: 'offline', prompt: 'consent', state,
    });
    return `${GOOGLE_AUTH}?${params}`;
  }

  async handleOAuthCallback(code: string, state: string): Promise<void> {
    const payload      = this.verifySignedState(state);
    const { tenantId, userId } = payload;
    const clientId     = this.config.get<string>('GOOGLE_ADS_CLIENT_ID')     ?? '';
    const clientSecret = this.config.get<string>('GOOGLE_ADS_CLIENT_SECRET') ?? '';
    const redirectUri  = this.config.get<string>('GOOGLE_ADS_REDIRECT_URI')  ?? '';

    const res = await this.fetch(GOOGLE_TOKEN, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: 'authorization_code' }),
    });
    const data = await res.json() as any;
    if (data.error) throw new Error(data.error_description ?? data.error);

    await this.saveOAuthTokens({ tenantId, userId, provider: PROVIDER, accessToken: data.access_token, refreshToken: data.refresh_token, expiresIn: data.expires_in, scopes: SCOPES });
    this.logger.log(`Google Ads OAuth: ${userId}@${tenantId} conectado`);
  }

  async getCampaigns(tenantId: string, userId: string) {
    const creds = await this.loadCredentials<GAdsCreds>(tenantId, PROVIDER);
    if (!creds) return { error: 'Google Ads não configurado (developer_token)' };

    const conn = await this.getOAuthConnection(tenantId, userId, PROVIDER);
    if (!conn) return { error: 'Google Ads OAuth não conectado' };

    const query = `
      SELECT campaign.id, campaign.name, campaign.status,
             campaign.advertising_channel_type, metrics.impressions,
             metrics.clicks, metrics.cost_micros, metrics.ctr
      FROM campaign WHERE campaign.status != 'REMOVED'
      ORDER BY metrics.impressions DESC LIMIT 25
    `;

    const res = await this.fetch(`${GAD_API}/customers/${creds.customer_id}/googleAds:search`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${conn.accessToken}`, 'developer-token': creds.developer_token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });

    if (!res.ok) return { error: `Google Ads API error: ${res.status}` };
    const d = await res.json() as any;
    return (d.results ?? []).map((r: any) => ({
      id: r.campaign?.id ?? '', name: r.campaign?.name ?? '', status: r.campaign?.status ?? '',
      channelType: r.campaign?.advertisingChannelType ?? '', impressions: r.metrics?.impressions ?? 0,
      clicks: r.metrics?.clicks ?? 0, costMicros: r.metrics?.costMicros ?? 0, ctr: r.metrics?.ctr ?? 0,
    }));
  }
}
