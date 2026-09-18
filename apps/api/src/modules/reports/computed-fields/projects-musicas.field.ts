/**
 * Resolver dos campos repetíveis do formulário de Projetos.
 * Cada música vira uma linha da única aba do XLSX.
 */
import { randomUUID } from 'crypto';
import type { DataSource, QueryRunner } from 'typeorm';

export interface MusicaFieldItem {
  nome_musica: string;
  soloFeat: string | null;
  originalRemix: string | null;
  instrumental: string | null;
  duracaoMinutos: string | null;
  duracaoSegundos: string | null;
  generoMusical: string | null;
  idiomaMusica: string | null;
  compositores: string[];
  interpretes: string[];
  produtores: string[];
  letra: string | null;
  arquivosAudio: string | null;
  sort_order: number;
}

type TrackRole = 'compositor' | 'interprete' | 'produtor';

interface TrackRow {
  id: string;
  project_id: string;
  nome: string;
  solo_feat: string | null;
  original_remix: string | null;
  instrumental: string | null;
  duracao_min: string | null;
  duracao_seg: string | null;
  genero: string | null;
  idioma: string | null;
  letra: string | null;
  audio_url: string | null;
  sort_order: number;
}

interface ParticipantRow {
  project_track_id: string;
  nome: string;
  role: TrackRole;
}

function parseDuration(item: Record<string, unknown>): { minutes: string | null; seconds: string | null } {
  const minutes = String(item.duracaoMinutos ?? '').trim();
  const seconds = String(item.duracaoSegundos ?? '').trim();
  return { minutes: minutes || null, seconds: seconds || null };
}

export async function fetchProjectsMusicasForExport(
  ds: DataSource,
  tenantId: string,
  projectIds: string[],
): Promise<Map<string, MusicaFieldItem[]>> {
  const output = new Map<string, MusicaFieldItem[]>();
  if (projectIds.length === 0) return output;

  const tracks = (await ds.query(
    `SELECT "id", "project_id", "nome", "solo_feat", "original_remix", "instrumental",
            "duracao_min", "duracao_seg", "genero", "idioma", "letra", "audio_url", "sort_order"
       FROM "project_tracks"
      WHERE "tenant_id" = $1 AND "project_id" = ANY($2::uuid[])
      ORDER BY "sort_order" ASC`,
    [tenantId, projectIds],
  )) as TrackRow[];

  const trackIds = tracks.map((track) => track.id);
  const participants: ParticipantRow[] = trackIds.length
    ? ((await ds.query(
        `SELECT "project_track_id", "nome", "role"
           FROM "project_track_participants"
          WHERE "tenant_id" = $1 AND "project_track_id" = ANY($2::uuid[])
          ORDER BY "sort_order" ASC`,
        [tenantId, trackIds],
      )) as ParticipantRow[])
    : [];

  const byTrack = new Map<string, ParticipantRow[]>();
  for (const participant of participants) {
    const list = byTrack.get(participant.project_track_id) ?? [];
    list.push(participant);
    byTrack.set(participant.project_track_id, list);
  }
  const namesByRole = (trackId: string, role: TrackRole): string[] =>
    (byTrack.get(trackId) ?? []).filter((participant) => participant.role === role).map((participant) => participant.nome);

  for (const track of tracks) {
    const list = output.get(track.project_id) ?? [];
    list.push({
      nome_musica: track.nome,
      soloFeat: track.solo_feat,
      originalRemix: track.original_remix,
      instrumental: track.instrumental,
      duracaoMinutos: track.duracao_min,
      duracaoSegundos: track.duracao_seg,
      generoMusical: track.genero,
      idiomaMusica: track.idioma,
      compositores: namesByRole(track.id, 'compositor'),
      interpretes: namesByRole(track.id, 'interprete'),
      produtores: namesByRole(track.id, 'produtor'),
      letra: track.letra,
      arquivosAudio: track.audio_url,
      sort_order: track.sort_order,
    });
    output.set(track.project_id, list);
  }

  return output;
}

export async function insertProjectsMusicasForImport(
  qr: QueryRunner,
  tenantId: string,
  projectId: string,
  musicas: unknown,
): Promise<void> {
  if (!Array.isArray(musicas)) return;

  let fallbackOrder = 0;
  for (const raw of musicas) {
    if (raw === null || typeof raw !== 'object') continue;
    const item = raw as Record<string, unknown>;
    const name = String(item.nome_musica ?? '').trim();
    if (!name) continue;

    const trackId = randomUUID();
    const duration = parseDuration(item);
    const numericOrder = Number(item.sort_order);
    const order = Number.isFinite(numericOrder) ? numericOrder : fallbackOrder;
    fallbackOrder += 1;

    await qr.query(
      `INSERT INTO "project_tracks"
         ("id", "tenant_id", "project_id", "nome", "solo_feat", "original_remix",
          "instrumental", "duracao_min", "duracao_seg", "genero", "idioma", "letra",
          "audio_url", "sort_order")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [
        trackId,
        tenantId,
        projectId,
        name,
        (item.soloFeat as string) || null,
        (item.originalRemix as string) || null,
        (item.instrumental as string) || null,
        duration.minutes,
        duration.seconds,
        (item.generoMusical as string) || null,
        (item.idiomaMusica as string) || null,
        (item.letra as string) || null,
        (item.arquivosAudio as string) || null,
        order,
      ],
    );

    const roleFields: Array<[TrackRole, unknown]> = [
      ['compositor', item.compositores],
      ['interprete', item.interpretes],
      ['produtor', item.produtores],
    ];
    for (const [role, values] of roleFields) {
      if (!Array.isArray(values)) continue;
      let participantOrder = 0;
      for (const value of values) {
        if (typeof value !== 'string' || !value.trim()) continue;
        await qr.query(
          `INSERT INTO "project_track_participants"
             ("id", "tenant_id", "project_track_id", "nome", "role", "sort_order")
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [randomUUID(), tenantId, trackId, value.trim(), role, participantOrder++],
        );
      }
    }
  }
}
