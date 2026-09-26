import { v5 as uuidv5 } from 'uuid';
import {
  TENANT_ZERO_ORG_ID,
  TENANT_ZERO_TENANT_ID,
  TENANT_ZERO_SLUG,
  TENANT_ZERO_NAME,
  TENANT_ZERO_SYNTHETIC_OWNER_AUTH_USER_ID,
  TENANT_ZERO_SYNTHETIC_OWNER_EMAIL,
} from './tenant-zero.constants';

const MUSICOS360_NAMESPACE_UUID = '142d39d6-8454-4ba1-b2f0-695b120ae83f';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('tenant-zero.constants', () => {
  it('derives org/tenant IDs deterministically via UUIDv5 from the frozen namespace', () => {
    // Recomputes independently — proves the exports are not loose
    // literals, but the result of the documented formula.
    expect(TENANT_ZERO_ORG_ID).toBe(uuidv5(`${TENANT_ZERO_SLUG}:organization`, MUSICOS360_NAMESPACE_UUID));
    expect(TENANT_ZERO_TENANT_ID).toBe(uuidv5(`${TENANT_ZERO_SLUG}:tenant`, MUSICOS360_NAMESPACE_UUID));
    expect(TENANT_ZERO_SYNTHETIC_OWNER_AUTH_USER_ID).toBe(uuidv5(`${TENANT_ZERO_SLUG}:synthetic-owner`, MUSICOS360_NAMESPACE_UUID));
  });

  it('produces valid UUIDv5 values (correct version and variant)', () => {
    expect(TENANT_ZERO_ORG_ID).toMatch(UUID_RE);
    expect(TENANT_ZERO_TENANT_ID).toMatch(UUID_RE);
    expect(TENANT_ZERO_SYNTHETIC_OWNER_AUTH_USER_ID).toMatch(UUID_RE);
  });

  it('org, tenant and synthetic owner never collide with each other', () => {
    const ids = [TENANT_ZERO_ORG_ID, TENANT_ZERO_TENANT_ID, TENANT_ZERO_SYNTHETIC_OWNER_AUTH_USER_ID];
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('canonical name/slug are stable (regression against an accidental rename)', () => {
    expect(TENANT_ZERO_SLUG).toBe('lander-records');
    expect(TENANT_ZERO_NAME).toBe('LANDER RECORDS');
  });

  it('the synthetic owner uses the example.com domain — never a real customer domain', () => {
    expect(TENANT_ZERO_SYNTHETIC_OWNER_EMAIL.endsWith('@lander-records.example.com')).toBe(true);
  });

  it('canonical IDs are frozen: changing the namespace or seed breaks compatibility', () => {
    // Explicit snapshot — if this test fails, the namespace or the seed changed
    // and EVERY environment (DEV/STAGING/PROD) needs a data migration plan.
    expect(TENANT_ZERO_ORG_ID).toMatchSnapshot();
    expect(TENANT_ZERO_TENANT_ID).toMatchSnapshot();
  });
});
