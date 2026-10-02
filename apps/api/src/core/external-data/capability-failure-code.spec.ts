import { API_ERROR_CODE_COPY_PT_BR, classifyFailureCode, isApiErrorCode } from '@music-os-360/types';

describe('CAPABILITY_UNAVAILABLE failure code', () => {
  it('is a stable code with PT-BR copy', () => {
    expect(isApiErrorCode('CAPABILITY_UNAVAILABLE')).toBe(true);
    expect(API_ERROR_CODE_COPY_PT_BR.CAPABILITY_UNAVAILABLE).toMatch(/provedor externo/);
  });

  it.each([
    'CAPABILITY_UNAVAILABLE: payout (NO_PROVIDER_CONFIGURED)',
    'Distributor provider not registered: x',
    'Distributor external data provider is not configured.',
  ])('classifies %s', (raw) => {
    expect(classifyFailureCode(raw)).toBe('CAPABILITY_UNAVAILABLE');
  });

  it('keeps existing mappings', () => {
    expect(classifyFailureCode('YouTube API key not configured')).toBe('PROVIDER_NOT_CONFIGURED');
    expect(classifyFailureCode('PROVIDER_NOT_CONFIGURED')).toBe('PROVIDER_NOT_CONFIGURED');
    expect(classifyFailureCode('HTTP 429')).toBe('PROVIDER_RATE_LIMITED');
    expect(classifyFailureCode('401 unauthorized')).toBe('PROVIDER_UNAUTHORIZED');
    expect(classifyFailureCode('boom')).toBe('SYNC_FAILED');
  });
});
