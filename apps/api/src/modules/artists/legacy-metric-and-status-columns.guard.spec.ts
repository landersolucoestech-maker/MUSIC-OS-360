/**
 * legacy-metric-and-status-columns.guard.spec.ts
 *
 * Permanent guard: the 9 physical columns removed from `artists` by
 * RemoveArtistLegacyMetricColumns20260821000001 (spotify_ouvintes,
 * youtube_inscritos, deezer_fas, instagram_seguidores, tiktok_seguidores,
 * apple_music_albuns, soundcloud_seguidores, instagram, tiktok) were never
 * mapped by ArtistEntity — the real value of these form fields has always
 * lived in `artists.metadata` (jsonb), via
 * METADATA_FIELDS/report-form-contracts.ts. If `ArtistEntity` gains a
 * `@Column` for any of these names, TypeORM goes back to SELECTing those
 * columns — and they no longer exist in the database since the migration
 * above. This cannot happen without an explicit decision (a new ADD COLUMN
 * migration + justification), never by accident.
 *
 * Do NOT confuse this with the metadata/DTO field names — `spotify_ouvintes`,
 * `youtube_inscritos`, `deezer_fas`, `instagram_seguidores` and
 * `tiktok_seguidores` remain legitimate `metadata` keys and
 * CreateArtistDto/UpdateArtistDto properties (manual form counters) — only
 * the PHYSICAL COLUMN (`@Column` on ArtistEntity) is forbidden.
 *
 * `status_cadastro` was DELIBERATELY EXCLUDED from this list — unlike the 9
 * above, it IS mapped by ArtistEntity and is written by `LeadEventsHandler`
 * (leads module) on lead→artist conversion. This guard also proves it
 * remains mapped, so nobody removes it in the future without repeating this
 * check.
 */
import * as fs from 'fs';
import * as path from 'path';

const REMOVED_COLUMNS = [
  'spotify_ouvintes',
  'youtube_inscritos',
  'deezer_fas',
  'instagram_seguidores',
  'tiktok_seguidores',
  'apple_music_albuns',
  'soundcloud_seguidores',
  'instagram',
  'tiktok',
];

function readArtistEntitySource(): string {
  const entitiesPath = path.resolve(__dirname, '../../database/entities.ts');
  const content = fs.readFileSync(entitiesPath, 'utf8');
  const start = content.indexOf("@Entity('artists')");
  if (start === -1) throw new Error("Não encontrei @Entity('artists') em entities.ts");
  // The next @Entity(...) declaration after ArtistEntity marks the end of the class.
  const nextEntity = content.indexOf('@Entity(', start + 1);
  if (nextEntity === -1) throw new Error('Não encontrei o fim de ArtistEntity em entities.ts');
  return content.slice(start, nextEntity);
}

function propertyIsDeclared(source: string, column: string): boolean {
  const propertyDeclaration = new RegExp(`\\b${column}\\s*[?!]?\\s*:\\s*`);
  return propertyDeclaration.test(source);
}

describe('Permanent guard: physical columns removed from artists never come back to ArtistEntity', () => {
  const artistEntitySource = readArtistEntitySource();

  it.each(REMOVED_COLUMNS)(
    'ArtistEntity does not declare @Column for "%s" (removed by RemoveArtistLegacyMetricColumns20260821000001)',
    (column) => {
      expect(propertyIsDeclared(artistEntitySource, column)).toBe(false);
    },
  );

  it('status_cadastro REMAINS mapped — kept on purpose (real write from LeadEventsHandler), do not remove without re-auditing', () => {
    expect(propertyIsDeclared(artistEntitySource, 'status_cadastro')).toBe(true);
    const handlerPath = path.resolve(__dirname, '../leads/handlers/lead-events.handler.ts');
    const handlerSource = fs.readFileSync(handlerPath, 'utf8');
    expect(handlerSource).toMatch(/status_cadastro\s*:\s*ArtistStatusCadastro\.ACTIVE/);
  });

  it('the removal migration exists and is registered in migrations/index.ts', () => {
    const migrationPath = path.resolve(
      __dirname,
      '../../database/migrations/20260821000001_RemoveArtistLegacyMetricColumns.ts',
    );
    expect(fs.existsSync(migrationPath)).toBe(true);

    const indexPath = path.resolve(__dirname, '../../database/migrations/index.ts');
    const indexSource = fs.readFileSync(indexPath, 'utf8');
    expect(indexSource).toMatch(/RemoveArtistLegacyMetricColumns20260821000001/);
  });

  it('verify-canonical-column-order.ts no longer lists the removed columns for artists (but keeps status_cadastro)', () => {
    const scriptPath = path.resolve(__dirname, '../../../scripts/verify-canonical-column-order.ts');
    const source = fs.readFileSync(scriptPath, 'utf8');
    const artistsBlockMatch = source.match(/artists:\s*\[([\s\S]*?)\],\n\s*works:/);
    expect(artistsBlockMatch).not.toBeNull();
    const artistsBlock = artistsBlockMatch![1];
    for (const column of REMOVED_COLUMNS) {
      expect(artistsBlock).not.toMatch(new RegExp(`'${column}'`));
    }
    expect(artistsBlock).toMatch(/'status_cadastro'/);
  });
});
