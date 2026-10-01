import {
  BackfillMarketingVocabularyToEnglish20260930000026 as Migration,
  MARKETING_BACKFILL_MAPS,
  canonicalMarketingMetadataForBackfill,
} from './migrations/20260930000026_BackfillMarketingVocabularyToEnglish';
import { ALL_MIGRATIONS } from './migrations';
import {
  LEGACY_MARKETING_AI_KINDS,
  LEGACY_MARKETING_BRIEFING_TYPES,
  LEGACY_MARKETING_CAMPAIGN_TYPES,
  LEGACY_MARKETING_CHANNELS,
  LEGACY_MARKETING_PROJECT_UI_STATUSES,
  LEGACY_MARKETING_PROJECT_UI_TYPES,
  LEGACY_MARKETING_TARGETS,
  LEGACY_MARKETING_TASK_KINDS,
} from '../modules/marketing/marketing-vocabulary';
import { fakeRunner, makeFakeDb, type Row } from './jsonb-row-backfill.fake';

const ID = (n: number) => `00000000-0000-0000-0000-0000000000${String(n).padStart(2, '0')}`;
const CHANNELS = Object.keys(LEGACY_MARKETING_CHANNELS);
const meta = (r: Row) => (r['metadata'] ?? {}) as Record<string, any>;

/** Same candidate semantics as the SQL predicates (the transform is the real decision). */
function isCandidate(table: string, r: Row): boolean {
  const m = meta(r);
  const channelHit = (list: unknown) => Array.isArray(list) && list.some((c) => CHANNELS.includes(c));
  switch (table) {
    case 'marketing_projects': return m.uiType in LEGACY_MARKETING_PROJECT_UI_TYPES || m.uiStatus in LEGACY_MARKETING_PROJECT_UI_STATUSES || channelHit(m.channels);
    case 'marketing_tasks': return String(r['kind']) in LEGACY_MARKETING_TASK_KINDS || m.uiType in LEGACY_MARKETING_TASK_KINDS || m.targetType in LEGACY_MARKETING_TARGETS;
    case 'campaigns': {
      const p = m.marketingBuilder?.payload ?? {};
      return r['type'] === 'marketing_builder' && (['PROJETO_MUSICAL', 'ARTISTA', 'EMPRESA'].includes(p.promotedEntityType) || p.type in LEGACY_MARKETING_CAMPAIGN_TYPES || channelHit(p.platforms));
    }
    case 'briefings': return m.type in LEGACY_MARKETING_BRIEFING_TYPES || channelHit(m.channels);
    case 'marketing_content_posts': return channelHit(m.channels);
    case 'activity_logs': return r['entity_type'] === 'marketing_ai' && (m.kind in LEGACY_MARKETING_AI_KINDS || m.targetType in LEGACY_MARKETING_TARGETS || channelHit(m.channels));
    default: return false;
  }
}

function dataset(): Record<string, Array<Record<string, any>>> {
  return {
    marketing_projects: [
      { id: ID(1), tenant_id: 't', updated_at: 'U1', metadata: { uiType: 'lancamento_musical', uiStatus: 'em_andamento', channels: ['instagram', 'portal_noticias'], objective: 'portal_noticias', owner: 'Ana' } },
      { id: ID(2), tenant_id: 't', updated_at: 'U2', metadata: { uiType: 'music_release', uiStatus: 'active', channels: ['instagram'] } },
      { id: ID(3), tenant_id: 't', updated_at: 'U3', metadata: { uiType: 'Meu tipo', uiStatus: 'Em Andamento' } },
    ],
    marketing_tasks: [
      { id: ID(10), tenant_id: 't', kind: 'capa', updated_at: 'U', metadata: { targetType: 'empresa', uiType: 'capa', sector: 'Design', title: 'capa' } },
      { id: ID(11), tenant_id: 't', kind: 'cover_art', updated_at: 'U', metadata: { targetType: 'artist' } },
      { id: ID(12), tenant_id: 't', kind: null, updated_at: 'U', metadata: { targetType: 'artista' } },
      { id: ID(13), tenant_id: 't', kind: 'Meu tipo', updated_at: 'U', metadata: { uiType: 'Meu tipo' } },
    ],
    campaigns: [
      { id: ID(20), tenant_id: 't', type: 'marketing_builder', updated_at: 'U', metadata: { marketingBuilder: { payload: { promotedEntityType: 'PROJETO_MUSICAL', type: 'trafego_pago', platforms: ['instagram', 'campanha'], notes: '{"status":"rascunho"}', objective: 'TRAFFIC' }, validation: { valid: true } } } },
      { id: ID(21), tenant_id: 't', type: 'marketing_builder', updated_at: 'U', metadata: { marketingBuilder: { payload: { promotedEntityType: 'RELEASE', type: 'music_release', platforms: ['META_ADS'] } } } },
      { id: ID(22), tenant_id: 't', type: 'other', updated_at: 'U', metadata: { marketingBuilder: { payload: { type: 'trafego_pago' } } } },
    ],
    briefings: [
      { id: ID(30), tenant_id: 't', updated_at: 'U', metadata: { type: 'portal_noticias', channels: ['reuniao'], objective: 'x' } },
      { id: ID(31), tenant_id: 't', updated_at: 'U', metadata: { type: 'campaign' } },
    ],
    marketing_content_posts: [
      { id: ID(40), tenant_id: 't', updated_at: 'U', metadata: { channels: ['instagram', 'evento_externo'], approval: 'approved' } },
      { id: ID(41), tenant_id: 't', updated_at: 'U', metadata: {} },
    ],
    activity_logs: [
      { id: ID(50), tenant_id: 't', entity_type: 'marketing_ai', updated_at: 'U', metadata: { kind: 'analise_artista', targetType: 'artista', channels: ['bastidores'], prompt: 'artista' } },
      { id: ID(51), tenant_id: 't', entity_type: 'event', updated_at: 'U', metadata: { kind: 'roteiro', targetType: 'artista' } },
    ],
  };
}

describe('BackfillMarketingVocabularyToEnglish20260930000026', () => {
  const migration = new Migration();
  beforeEach(() => jest.spyOn(console, 'log').mockImplementation(() => undefined));
  afterEach(() => jest.restoreAllMocks());

  it('is registered and its frozen maps equal the application maps', () => {
    expect(ALL_MIGRATIONS).toContain(Migration);
    expect(MARKETING_BACKFILL_MAPS).toEqual({
      TARGET: LEGACY_MARKETING_TARGETS,
      PROJECT_TYPE: LEGACY_MARKETING_PROJECT_UI_TYPES,
      PROJECT_STATUS: LEGACY_MARKETING_PROJECT_UI_STATUSES,
      CAMPAIGN_TYPE: LEGACY_MARKETING_CAMPAIGN_TYPES,
      BRIEFING_TYPE: LEGACY_MARKETING_BRIEFING_TYPES,
      CHANNEL: LEGACY_MARKETING_CHANNELS,
      TASK_KIND: LEGACY_MARKETING_TASK_KINDS,
      AI_KIND: LEGACY_MARKETING_AI_KINDS,
    });
  });

  it.each(['up', 'down'] as const)('%s() stops at the RLS-bypass guard before any other SQL', async (direction) => {
    const db = makeFakeDb(dataset() as never, { bypass: false });
    await expect(migration[direction](fakeRunner(db) as never)).rejects.toThrow(/BYPASSRLS/);
    expect(db.statements).toHaveLength(1);
  });

  it('rewrites only the machine keys, preserves every other key and user text, never touches updated_at', async () => {
    const tables = dataset();
    const db = makeFakeDb(tables as never);
    await migration.up(fakeRunner(db, isCandidate) as never);

    expect(tables.marketing_projects[0].metadata).toEqual({ uiType: 'music_release', uiStatus: 'active', channels: ['instagram', 'news_portal'], objective: 'portal_noticias', owner: 'Ana' });
    expect(tables.marketing_projects[1].metadata).toEqual({ uiType: 'music_release', uiStatus: 'active', channels: ['instagram'] });
    expect(tables.marketing_projects[2].metadata).toEqual({ uiType: 'Meu tipo', uiStatus: 'Em Andamento' }); // not an exact legacy value: never guessed

    expect(tables.marketing_tasks[0]).toMatchObject({ kind: 'cover', metadata: { targetType: 'company', uiType: 'cover', sector: 'Design', title: 'capa' } });
    expect(tables.marketing_tasks[1]).toMatchObject({ kind: 'cover_art', metadata: { targetType: 'artist' } }); // API-written kind untouched
    expect(tables.marketing_tasks[2]).toMatchObject({ kind: null, metadata: { targetType: 'artist' } });
    expect(tables.marketing_tasks[3]).toMatchObject({ kind: 'Meu tipo', metadata: { uiType: 'Meu tipo' } });

    expect(tables.campaigns[0].metadata.marketingBuilder).toEqual({
      payload: { promotedEntityType: 'MUSIC_PROJECT', type: 'paid_traffic', platforms: ['instagram', 'campaign'], notes: '{"status":"rascunho"}', objective: 'TRAFFIC' },
      validation: { valid: true },
    });
    expect(tables.campaigns[1].metadata.marketingBuilder.payload).toEqual({ promotedEntityType: 'RELEASE', type: 'music_release', platforms: ['META_ADS'] });
    expect(tables.campaigns[2].metadata.marketingBuilder.payload.type).toBe('trafego_pago'); // not a marketing_builder row

    expect(tables.briefings[0].metadata).toEqual({ type: 'news_portal', channels: ['meeting'], objective: 'x' });
    expect(tables.marketing_content_posts[0].metadata).toEqual({ channels: ['instagram', 'external_event'], approval: 'approved' });
    expect(tables.activity_logs[0].metadata).toEqual({ kind: 'artist_analysis', targetType: 'artist', channels: ['behind_the_scenes'], prompt: 'artista' });
    expect(tables.activity_logs[1].metadata).toEqual({ kind: 'roteiro', targetType: 'artista' }); // not a marketing_ai row

    for (const rows of Object.values(tables)) for (const row of rows) expect(String(row['updated_at'])).toMatch(/^U/);
    for (const s of db.statements) expect(s.sql).not.toMatch(/updated_at|DROP |DELETE |TRUNCATE|ADD CONSTRAINT/i);
    expect(db.log.map((l) => l.table_name).sort()).toEqual(['activity_logs', 'briefings', 'campaigns', 'marketing_content_posts', 'marketing_projects', 'marketing_tasks', 'marketing_tasks'].sort());
  });

  it('is idempotent: a second up() writes nothing', async () => {
    const tables = dataset();
    const db = makeFakeDb(tables as never);
    const runner = fakeRunner(db, isCandidate);
    await migration.up(runner as never);
    const writes = () => db.statements.filter((s) => s.sql.startsWith('UPDATE ')).length;
    const before = writes();
    await migration.up(runner as never);
    expect(writes()).toBe(before);
  });

  it('down() restores BEFORE for untouched rows only (a row edited after up() keeps the edit)', async () => {
    const tables = dataset();
    const original = JSON.parse(JSON.stringify(tables)) as typeof tables;
    const db = makeFakeDb(tables as never);
    const runner = fakeRunner(db, isCandidate);
    await migration.up(runner as never);
    tables.marketing_projects[0].metadata = { ...tables.marketing_projects[0].metadata, owner: 'Edited' }; // user edit after up()
    await migration.down(runner as never);

    expect(tables.marketing_projects[0].metadata.owner).toBe('Edited');
    expect(tables.marketing_projects[0].metadata.uiType).toBe('music_release'); // edited row is never reverted
    expect(tables.marketing_tasks[0]).toEqual(original.marketing_tasks[0]);
    expect(tables.campaigns[0]).toEqual(original.campaigns[0]);
    expect(tables.briefings[0]).toEqual(original.briefings[0]);
    expect(tables.marketing_content_posts[0]).toEqual(original.marketing_content_posts[0]);
    expect(tables.activity_logs[0]).toEqual(original.activity_logs[0]);
  });

  it('is a pure vocabulary rewrite: logs carry counts only, no CHECK is added', async () => {
    const db = makeFakeDb(dataset() as never);
    await migration.up(fakeRunner(db, isCandidate) as never);
    for (const [line] of (console.log as unknown as jest.Mock).mock.calls) expect(String(line)).not.toMatch(/lancamento|portal_noticias|capa|empresa|news_portal/);
  });

  it('canonicalMarketingMetadataForBackfill ignores non-object metadata and returns null on canonical rows', () => {
    expect(canonicalMarketingMetadataForBackfill('marketing_projects', null)).toBeNull();
    expect(canonicalMarketingMetadataForBackfill('marketing_projects', [])).toBeNull();
    expect(canonicalMarketingMetadataForBackfill('campaigns', { marketingBuilder: 'x' })).toBeNull();
    expect(canonicalMarketingMetadataForBackfill('briefings', { type: 'campaign', channels: ['instagram'] })).toBeNull();
  });
});
