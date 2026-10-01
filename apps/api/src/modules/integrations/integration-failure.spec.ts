import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { isApiErrorCode } from '@music-os-360/types';
import { codeForUpstreamStatus, integrationFailure } from './integration-failure';
import { TikTokService } from './tiktok/tiktok.service';
import { YouTubeService } from './youtube/youtube.service';
import { DeezerService } from './deezer/deezer.service';
import { SoundCloudService } from './soundcloud/soundcloud.service';
import { GoogleAdsService } from './google-ads/google-ads.service';
import { InstagramService } from './instagram/instagram.service';

const RAW_PROVIDER_TEXT = 'Invalid access_token=abc123 for user foo@bar.com (provider internal detail)';

function cfg(values: Record<string, string> = {}): ConfigService {
  return { get: jest.fn((k: string) => values[k]) } as unknown as ConfigService;
}

/** The HTTP body must be exactly `{ error }` with a stable code: no raw text anywhere. */
function expectStableFailure(body: unknown, code: string) {
  expect(body).toEqual({ error: code });
  expect(isApiErrorCode((body as { error: string }).error)).toBe(true);
  expect(JSON.stringify(body)).not.toMatch(/abc123|foo@bar|provider internal/i);
}

describe('integration failure bodies (HTTP 200) carry stable codes, never raw text', () => {
  let fetchMock: jest.Mock;
  beforeEach(() => {
    fetchMock = jest.fn();
    (global as any).fetch = fetchMock;
  });

  it('maps upstream statuses to stable codes', () => {
    expect(codeForUpstreamStatus(401)).toBe('PROVIDER_UNAUTHORIZED');
    expect(codeForUpstreamStatus(403)).toBe('PROVIDER_UNAUTHORIZED');
    expect(codeForUpstreamStatus(429)).toBe('PROVIDER_RATE_LIMITED');
    expect(codeForUpstreamStatus(500)).toBe('INTEGRATION_CALL_FAILED');
  });

  it('integrationFailure logs redacted English detail and returns only the code', () => {
    const logger = { warn: jest.fn() } as any;
    const body = integrationFailure(logger, 'INTEGRATION_CALL_FAILED', RAW_PROVIDER_TEXT);
    expectStableFailure(body, 'INTEGRATION_CALL_FAILED');
    const line = String(logger.warn.mock.calls[0][0]);
    expect(line).toContain('INTEGRATION_CALL_FAILED');
    expect(line).not.toContain('foo@bar.com');
    expect(line).not.toContain('abc123');
  });

  it('TikTok Ads: relays no provider message (was d.message)', async () => {
    const svc = new TikTokService(null, {} as any, cfg());
    jest.spyOn(svc as any, 'loadCredentials').mockResolvedValue({ advertiser_id: '1', access_token: 't' });
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ code: 40001, message: RAW_PROVIDER_TEXT }) });
    expectStableFailure(await svc.getAdsCampaigns('tenant'), 'INTEGRATION_CALL_FAILED');
  });

  it('TikTok Ads: not configured / upstream status', async () => {
    const svc = new TikTokService(null, {} as any, cfg());
    const load = jest.spyOn(svc as any, 'loadCredentials').mockResolvedValue(null);
    expectStableFailure(await svc.getAdsCampaigns('tenant'), 'PROVIDER_NOT_CONFIGURED');
    expectStableFailure(await svc.getAdsInsights('tenant', 'a', 'b'), 'PROVIDER_NOT_CONFIGURED');
    load.mockResolvedValue({ advertiser_id: '1', access_token: 't' });
    fetchMock.mockResolvedValue({ ok: false, status: 429 });
    expectStableFailure(await svc.getAdsInsights('tenant', 'a', 'b'), 'PROVIDER_RATE_LIMITED');
  });

  it('YouTube: not configured, upstream status, not found', async () => {
    expectStableFailure(await new YouTubeService(cfg()).getChannelStats('c'), 'PROVIDER_NOT_CONFIGURED');
    const svc = new YouTubeService(cfg({ YOUTUBE_API_KEY: 'k' }));
    fetchMock.mockResolvedValueOnce({ ok: false, status: 403 });
    expectStableFailure(await svc.getChannelStats('c'), 'PROVIDER_UNAUTHORIZED');
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ items: [] }) });
    expectStableFailure(await svc.getChannelStats('c'), 'PROVIDER_RESOURCE_NOT_FOUND');
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ items: [] }) });
    expectStableFailure(await svc.getVideoStats('v'), 'PROVIDER_RESOURCE_NOT_FOUND');
  });

  it('Deezer: upstream status', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500 });
    expectStableFailure(await new DeezerService().getArtistStats('1'), 'INTEGRATION_CALL_FAILED');
  });

  it('SoundCloud: not configured, upstream status', async () => {
    expectStableFailure(await new SoundCloudService(null, {} as any, cfg()).resolveUser('https://soundcloud.com/x'), 'PROVIDER_NOT_CONFIGURED');
    fetchMock.mockResolvedValue({ ok: false, status: 401 });
    const svc = new SoundCloudService(null, {} as any, cfg({ SOUNDCLOUD_CLIENT_ID: 'cid' }));
    expectStableFailure(await svc.resolveUser('https://soundcloud.com/x'), 'PROVIDER_UNAUTHORIZED');
  });

  it('Google Ads: not configured / not connected', async () => {
    const svc = new GoogleAdsService(null, {} as any, cfg());
    const load = jest.spyOn(svc as any, 'loadCredentials').mockResolvedValue(null);
    expectStableFailure(await svc.getCampaigns('t', 'u'), 'PROVIDER_NOT_CONFIGURED');
    load.mockResolvedValue({ developer_token: 'd', customer_id: '1' });
    jest.spyOn(svc as any, 'getOAuthConnection').mockResolvedValue(null);
    expectStableFailure(await svc.getCampaigns('t', 'u'), 'PROVIDER_NOT_CONNECTED');
  });

  it('Instagram: relays no Graph API message (was pages.error.message)', async () => {
    const svc = new InstagramService(null, {} as any, cfg());
    jest.spyOn(svc as any, 'getOAuthConnection').mockResolvedValue({ accessToken: 'tok', expires_at: null });
    const reauth = jest.spyOn(svc as any, 'markOAuthNeedsReauth').mockResolvedValue(undefined);
    fetchMock.mockResolvedValue({ json: async () => ({ error: { code: 190, message: RAW_PROVIDER_TEXT } }) });
    expectStableFailure(await svc.getAccountMetrics('t', 'u'), 'PROVIDER_UNAUTHORIZED');
    expect(reauth).toHaveBeenCalled();
    fetchMock.mockResolvedValue({ json: async () => ({ error: { code: 1, message: RAW_PROVIDER_TEXT } }) });
    expectStableFailure(await svc.getAccountMetrics('t', 'u'), 'INTEGRATION_CALL_FAILED');
    fetchMock.mockResolvedValue({ json: async () => ({ data: [] }) });
    expectStableFailure(await svc.getAccountMetrics('t', 'u'), 'PROVIDER_RESOURCE_NOT_FOUND');
    jest.spyOn(svc as any, 'getOAuthConnection').mockResolvedValue(null);
    expectStableFailure(await svc.getAccountMetrics('t', 'u'), 'PROVIDER_NOT_CONNECTED');
  });
});
