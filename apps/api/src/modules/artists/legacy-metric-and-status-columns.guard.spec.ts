/**
 * legacy-metric-and-status-columns.guard.spec.ts
 *
 * Proteção permanente: as 9 colunas físicas removidas de `artists` por
 * RemoveArtistLegacyMetricColumns20260821000001 (spotify_ouvintes,
 * youtube_inscritos, deezer_fas, instagram_seguidores, tiktok_seguidores,
 * apple_music_albuns, soundcloud_seguidores, instagram, tiktok) nunca foram
 * mapeadas por ArtistEntity — o valor real desses campos de formulário
 * sempre viveu em `artists.metadata` (jsonb), via
 * METADATA_FIELDS/report-form-contracts.ts. Se `ArtistEntity` ganhar um
 * `@Column` para qualquer um desses nomes, o TypeORM volta a fazer SELECT
 * dessas colunas — e elas não existem mais no banco a partir da migration
 * acima. Isso não pode acontecer sem uma decisão explícita (nova migration
 * de ADD COLUMN + justificativa), nunca por acidente.
 *
 * NÃO confundir com os nomes de campo de metadata/DTO — `spotify_ouvintes`,
 * `youtube_inscritos`, `deezer_fas`, `instagram_seguidores` e
 * `tiktok_seguidores` continuam sendo chaves legítimas de `metadata` e
 * propriedades de CreateArtistDto/UpdateArtistDto (contadores manuais do
 * formulário) — só a COLUNA FÍSICA (`@Column` em ArtistEntity) é proibida.
 *
 * `status_cadastro` foi DELIBERADAMENTE EXCLUÍDA desta lista — ao contrário
 * das 9 acima, ela É mapeada por ArtistEntity e é escrita por
 * `LeadEventsHandler` (módulo leads) na conversão de lead→artista. Este
 * guard também prova que ela permanece mapeada, para que ninguém a remova
 * futuramente sem repetir essa checagem.
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
  // A próxima declaração @Entity(...) depois de ArtistEntity marca o fim da classe.
  const nextEntity = content.indexOf('@Entity(', start + 1);
  if (nextEntity === -1) throw new Error('Não encontrei o fim de ArtistEntity em entities.ts');
  return content.slice(start, nextEntity);
}

function propertyIsDeclared(source: string, column: string): boolean {
  const propertyDeclaration = new RegExp(`\\b${column}\\s*[?!]?\\s*:\\s*`);
  return propertyDeclaration.test(source);
}

describe('Guarda permanente: colunas físicas removidas de artists nunca voltam a ArtistEntity', () => {
  const artistEntitySource = readArtistEntitySource();

  it.each(REMOVED_COLUMNS)(
    'ArtistEntity não declara @Column para "%s" (removida por RemoveArtistLegacyMetricColumns20260821000001)',
    (column) => {
      expect(propertyIsDeclared(artistEntitySource, column)).toBe(false);
    },
  );

  it('status_cadastro CONTINUA mapeada — mantida de propósito (write real de LeadEventsHandler), não remover sem reauditar', () => {
    expect(propertyIsDeclared(artistEntitySource, 'status_cadastro')).toBe(true);
    const handlerPath = path.resolve(__dirname, '../leads/handlers/lead-events.handler.ts');
    const handlerSource = fs.readFileSync(handlerPath, 'utf8');
    expect(handlerSource).toMatch(/status_cadastro\s*:\s*ArtistStatusCadastro\.ACTIVE/);
  });

  it('a migration de remoção existe e está registrada em migrations/index.ts', () => {
    const migrationPath = path.resolve(
      __dirname,
      '../../database/migrations/20260821000001_RemoveArtistLegacyMetricColumns.ts',
    );
    expect(fs.existsSync(migrationPath)).toBe(true);

    const indexPath = path.resolve(__dirname, '../../database/migrations/index.ts');
    const indexSource = fs.readFileSync(indexPath, 'utf8');
    expect(indexSource).toMatch(/RemoveArtistLegacyMetricColumns20260821000001/);
  });

  it('verify-canonical-column-order.ts não lista mais as colunas removidas para artists (mas mantém status_cadastro)', () => {
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
