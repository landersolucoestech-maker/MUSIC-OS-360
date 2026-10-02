import {
  CONFIRM_ENV,
  CONFIRM_TOKEN,
  MEMBER_ONLY_PAIR,
  ROLE_SLUG_PAIRS,
  CanonicalizeRoleSlugsInPlaceAndBackfillMembers20260930000030 as Draft,
} from './20260930000030_CanonicalizeRoleSlugsInPlaceAndBackfillMembers';

// Legacy role slugs persisted in org_members.role are rewritten to the canonical English slug.
describe('role slug draft legacy values (legacy in, canonical out)', () => {
  const OLD = process.env[CONFIRM_ENV];
  beforeEach(() => { process.env[CONFIRM_ENV] = CONFIRM_TOKEN; });
  afterAll(() => { if (OLD === undefined) delete process.env[CONFIRM_ENV]; else process.env[CONFIRM_ENV] = OLD; });

  const expected: Array<[string, string]> = [
    ['juridico', 'legal'],
    ['comercial', 'sales'],
    ['produtor', 'producer'],
    ['colaborador', 'collaborator'],
    ['rh_manager', 'hr_manager'],
  ];

  it('declares the legacy to canonical pairs', () => {
    expect(ROLE_SLUG_PAIRS.map(([l, c]) => [l, c])).toEqual(expected);
    expect([...MEMBER_ONLY_PAIR]).toEqual(['artista', 'artist']);
  });

  it('up() rewrites members holding each legacy slug to the canonical slug', async () => {
    const calls: Array<{ text: string; params?: unknown[] }> = [];
    const served = new Set<string>();
    const query = jest.fn(async (text: string, params?: unknown[]) => {
      calls.push({ text, params });
      if (text.includes('rolbypassrls')) return [{ bypass: true }];
      if (text.includes('DELETE FROM "roles" e')) return expected.map((_, i) => ({ id: `d${i}` }));
      if (text.includes('UPDATE "roles" l SET "slug"')) return expected.map((_, i) => ({ id: `r${i}` }));
      if (text.includes('SELECT m."id" FROM "org_members" m')) {
        const from = (params as string[])[0];
        if (served.has(from)) return [];
        served.add(from);
        return [{ id: `00000000-0000-0000-0000-00000000000${served.size}` }];
      }
      if (text.includes('AS renamed')) return [{ renamed: 5, aliases: 5 }];
      return [];
    });
    await new Draft().up({ query } as never);
    const updates = calls
      .filter((c) => c.text.includes('UPDATE "org_members" SET "role" = $2'))
      .map((c) => [(c.params as unknown[])[2], (c.params as unknown[])[1]]);
    expect(updates).toEqual([...expected, ['artista', 'artist']]);
  });

  it('refuses to run unconfirmed (no write without the gate)', async () => {
    delete process.env[CONFIRM_ENV];
    const query = jest.fn(async () => []);
    await expect(new Draft().up({ query } as never)).rejects.toThrow(/gated draft/);
    expect(query).not.toHaveBeenCalled();
  });
});
