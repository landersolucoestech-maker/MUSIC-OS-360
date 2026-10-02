import { CanonicalizeLegacyReleaseStatuses20260928000019 as ReleaseStatuses } from './migrations/20260928000019_CanonicalizeLegacyReleaseStatuses';
import { CanonicalizeClientsToEnglish20260928000023 as Clients } from './migrations/20260928000023_CanonicalizeClientsToEnglish';
import { CanonicalizeArtistsToEnglish20260928000022 as Artists } from './migrations/20260928000022_CanonicalizeArtistsToEnglish';

// The opt-in script (scripts/verify-cz042-cz043-migrations.ts) inserts legacy-shape rows into a disposable
// database; here the same real migrations run against a recording runner so the legacy -> canonical
// mapping is asserted without a database.
type Call = { sql: string; params?: unknown[] };
function recorder(): { calls: Call[]; runner: never } {
  const calls: Call[] = [];
  const query = jest.fn(async (sql: string, params?: unknown[]) => {
    calls.push({ sql, params });
    if (sql.includes('rolbypassrls')) return [{ bypass: true }];
    return [];
  });
  return { calls, runner: { query } as never };
}

describe('CZ-042/CZ-043 migrations legacy shapes (legacy in, canonical out)', () => {
  it.each([
    ['rascunho', 'draft'],
    ['em_producao', 'draft'],
    ['planejado', 'scheduled'],
    ['em_analise', 'review'],
    ['aprovado', 'approved'],
    ['publicado', 'released'],
    ['distribuida', 'distributed'],
    ['cancelado', 'cancelled'],
    ['arquivado', 'archived'],
  ])('release status %s is rewritten to %s keeping the legacy spelling in metadata', async (legacy, canonical) => {
    const { calls, runner } = recorder();
    await new ReleaseStatuses().up(runner);
    const hit = calls.find((c) => c.sql.includes('legacy_status') && c.params?.[0] === canonical && c.params?.[1] === legacy);
    expect(hit).toBeDefined();
  });

  it('release down() restores only whitelisted legacy/canonical pairs', async () => {
    const { calls, runner } = recorder();
    await new ReleaseStatuses().down(runner);
    const restore = calls.find((c) => c.sql.includes("'legacy_status'") && Array.isArray(c.params))!;
    expect(restore.params).toEqual(expect.arrayContaining(['rascunho', 'draft', 'publicado', 'released']));
  });

  it.each([
    ['pessoa_fisica', 'individual'],
    ['pessoa_juridica', 'company'],
    ['person', 'individual'],
  ])('client person_type %s becomes %s and the legacy columns are renamed', async (legacy, canonical) => {
    const { calls, runner } = recorder();
    await new Clients().up(runner);
    expect(calls.some((c) => c.sql.includes('"person_type" = $1') && c.params?.[0] === canonical && c.params?.[1] === legacy)).toBe(true);
    const sql = calls.map((c) => c.sql).join('\n');
    expect(sql).toContain('razao_social');
    expect(sql).toContain('legal_name');
  });

  it('artist legacy columns are renamed to the canonical names', async () => {
    const { calls, runner } = recorder();
    await new Artists().up(runner);
    const sql = calls.map((c) => c.sql).join('\n');
    expect(sql).toContain('nome_artistico');
    expect(sql).toContain('stage_name');
    expect(sql).toContain('tipo_perfil');
    expect(sql).toContain('profile_type');
  });
});
