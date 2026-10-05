import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { GENERIC_OAUTH_PROVIDER_IDS, INTEGRATION_PROVIDER_IDS } from '@music-os-360/types';
import { OAuthExchangeDto, OAuthInitDto } from './integrations.dto';

const platformErrors = (cls: new () => object, platform: unknown, extra: object = {}) =>
  validateSync(plainToInstance(cls, { platform, ...extra }) as object).filter((e) => e.property === 'platform');

describe('OAuth provider allow-lists derive from IntegrationProviderId', () => {
  it('OAuthInitDto accepts exactly the shared provider ids', () => {
    for (const id of INTEGRATION_PROVIDER_IDS) expect(platformErrors(OAuthInitDto, id)).toHaveLength(0);
    for (const bad of ['spotify', 'META_ADS', 'constructor', '__proto__', 'toString', '']) {
      expect(platformErrors(OAuthInitDto, bad)).not.toHaveLength(0);
    }
  });
  it('OAuthExchangeDto accepts the generic subset only (no Spotify ids)', () => {
    const extra = { code: 'c', exchange_token: 't' };
    for (const id of GENERIC_OAUTH_PROVIDER_IDS) expect(platformErrors(OAuthExchangeDto, id, extra)).toHaveLength(0);
    for (const bad of ['spotify_ads', 'corp_spotify', 'constructor', '__proto__']) {
      expect(platformErrors(OAuthExchangeDto, bad, extra)).not.toHaveLength(0);
    }
  });
  it('keeps the previously hard-coded membership', () => {
    expect(INTEGRATION_PROVIDER_IDS).toHaveLength(15);
    expect(GENERIC_OAUTH_PROVIDER_IDS).toHaveLength(13);
  });
});
