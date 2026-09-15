import { getPersistedAuthorityMode, isPermissionEnforcementEnabled } from './rbac-authority-mode';

describe('rbac-authority-mode', () => {
  const ORIGINAL = process.env['RBAC_PERSISTED_AUTHORITY'];

  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env['RBAC_PERSISTED_AUTHORITY'];
    else process.env['RBAC_PERSISTED_AUTHORITY'] = ORIGINAL;
  });

  it('defaults to SHADOW (not enforced) when unset', () => {
    delete process.env['RBAC_PERSISTED_AUTHORITY'];
    expect(getPersistedAuthorityMode()).toBe('SHADOW');
    expect(isPermissionEnforcementEnabled()).toBe(false);
  });

  it('defaults to SHADOW (not enforced) for an invalid value', () => {
    process.env['RBAC_PERSISTED_AUTHORITY'] = 'nonsense';
    expect(getPersistedAuthorityMode()).toBe('SHADOW');
    expect(isPermissionEnforcementEnabled()).toBe(false);
  });

  it('reads ON as enforced, case/whitespace-insensitive (matches production/staging .env)', () => {
    process.env['RBAC_PERSISTED_AUTHORITY'] = ' on ';
    expect(getPersistedAuthorityMode()).toBe('ON');
    expect(isPermissionEnforcementEnabled()).toBe(true);
  });

  it('reads OFF as not enforced', () => {
    process.env['RBAC_PERSISTED_AUTHORITY'] = 'OFF';
    expect(getPersistedAuthorityMode()).toBe('OFF');
    expect(isPermissionEnforcementEnabled()).toBe(false);
  });
});
