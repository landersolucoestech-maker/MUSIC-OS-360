/**
 * apps/api/test/helpers/tenant-fixtures.ts
 *
 * Minimal, reusable test-data factory for tenant/org/user/artist fixtures.
 * IDs are counter-seeded (deterministic, not crypto-random) so isolation
 * tests stay reproducible across runs — never sourced from real/production
 * identifiers and never a single hardcoded literal reused across specs.
 */

let seq = 0;

function nextSeq(prefix: string): string {
  seq += 1;
  return `${prefix}-${seq.toString(16).padStart(6, '0')}`;
}

export interface TestTenant {
  tenantId: string;
  orgId: string;
}

/** A tenant + its owning org, as a matched pair (two calls never collide). */
export function createTestTenant(overrides: Partial<TestTenant> = {}): TestTenant {
  const n = nextSeq('tenant');
  return {
    tenantId: overrides.tenantId ?? n,
    orgId: overrides.orgId ?? n.replace('tenant-', 'org-'),
  };
}

export interface TestUser {
  userId: string;
  role: string;
}

export function createTestUser(overrides: Partial<TestUser> = {}): TestUser {
  return {
    userId: overrides.userId ?? nextSeq('user'),
    role: overrides.role ?? 'viewer',
  };
}

export interface TestArtist {
  id: string;
  stageName: string;
}

/** Row id is a real UUID (many controllers run ParseUUIDPipe on it). */
export function createTestArtist(overrides: Partial<TestArtist> = {}): TestArtist {
  const id = overrides.id ?? crypto.randomUUID();
  return {
    id,
    stageName: overrides.stageName ?? `Artista de teste ${id.slice(0, 8)}`,
  };
}

/** Only for specs that assert on the sequence itself; most specs don't need this. */
export function resetTestFixtureSequence(): void {
  seq = 0;
}
