/**
 * Resolver for the repeatable fields of the Projects form.
 * Each track becomes one row of the XLSX's single sheet.
 */
import { randomUUID } from 'crypto';
import type { DataSource, QueryRunner } from 'typeorm';
import {
  projectTrackInstrumentalLabel,
  projectTrackOriginalRemixLabel,
  projectTrackSoloFeatLabel,
  projectTrackLanguageLabel,
} from '../../projects/project-track-vocabulary';

export interface ProjectTrackFieldItem {
  trackName: string;
  soloFeat: string | null;
  originalRemix: string | null;
  instrumental: string | null;
  trackDurationMinutes: string | null;
  trackDurationSeconds: string | null;
  musicGenre: string | null;
  trackLanguage: string | null;
  composers: string[];
  performers: string[];
  producers: string[];
  lyrics: string | null;
  audioFiles: string | null;
  sort_order: number;
}

type TrackRole = 'composer' | 'performer' | 'producer';

interface TrackRow {
  id: string;
  project_id: string;
  name: string;
  solo_feat: string | null;
  original_remix: string | null;
  instrumental: string | null;
  duration_minutes: string | null;
  duration_seconds: string | null;
  music_genre: string | null;
  language: string | null;
  lyrics: string | null;
  audio_url: string | null;
  sort_order: number;
}

interface ParticipantRow {
  project_track_id: string;
  name: string;
  role: TrackRole;
}

function parseDuration(item: Record<string, unknown>): { minutes: string | null; seconds: string | null } {
  const minutes = String(item.trackDurationMinutes ?? '').trim();
  const seconds = String(item.trackDurationSeconds ?? '').trim();
  return { minutes: minutes || null, seconds: seconds || null };
}

export async function fetchProjectTracksForExport(
  ds: DataSource,
  tenantId: string,
  projectIds: string[],
): Promise<Map<string, ProjectTrackFieldItem[]>> {
  const output = new Map<string, ProjectTrackFieldItem[]>();
  if (projectIds.length === 0) return output;

  const tracks = (await ds.query(
    `SELECT "id", "project_id", "name", "solo_feat", "original_remix", "instrumental",
            "duration_minutes", "duration_seconds", "music_genre", "language", "lyrics", "audio_url", "sort_order"
       FROM "project_tracks"
      WHERE "tenant_id" = $1 AND "project_id" = ANY($2::uuid[])
      ORDER BY "sort_order" ASC`,
    [tenantId, projectIds],
  )) as TrackRow[];

  const trackIds = tracks.map((track) => track.id);
  const participants: ParticipantRow[] = trackIds.length
    ? ((await ds.query(
        `SELECT "project_track_id", "name", "role"
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
    (byTrack.get(trackId) ?? []).filter((participant) => participant.role === role).map((participant) => participant.name);

  for (const track of tracks) {
    const list = output.get(track.project_id) ?? [];
    list.push({
      trackName: track.name,
      soloFeat: projectTrackSoloFeatLabel(track.solo_feat) as string | null,
      originalRemix: projectTrackOriginalRemixLabel(track.original_remix) as string | null,
      // spreadsheet cell = PT-BR label (localized yes/no and language names); import maps it back to the canonical value
      instrumental: projectTrackInstrumentalLabel(track.instrumental) as string | null,
      trackDurationMinutes: track.duration_minutes,
      trackDurationSeconds: track.duration_seconds,
      musicGenre: track.music_genre,
      trackLanguage: projectTrackLanguageLabel(track.language) as string | null,
      composers: namesByRole(track.id, 'composer'),
      performers: namesByRole(track.id, 'performer'),
      producers: namesByRole(track.id, 'producer'),
      lyrics: track.lyrics,
      audioFiles: track.audio_url,
      sort_order: track.sort_order,
    });
    output.set(track.project_id, list);
  }

  return output;
}

export async function insertProjectTracksForImport(
  qr: QueryRunner,
  tenantId: string,
  projectId: string,
  trackRows: unknown,
): Promise<void> {
  if (!Array.isArray(trackRows)) return;

  let fallbackOrder = 0;
  for (const raw of trackRows) {
    if (raw === null || typeof raw !== 'object') continue;
    const item = raw as Record<string, unknown>;
    const name = String(item.trackName ?? '').trim();
    if (!name) continue;

    const trackId = randomUUID();
    const duration = parseDuration(item);
    const numericOrder = Number(item.sort_order);
    const order = Number.isFinite(numericOrder) ? numericOrder : fallbackOrder;
    fallbackOrder += 1;

    await qr.query(
      `INSERT INTO "project_tracks"
         ("id", "tenant_id", "project_id", "name", "solo_feat", "original_remix",
          "instrumental", "duration_minutes", "duration_seconds", "music_genre", "language", "lyrics",
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
        (item.musicGenre as string) || null,
        (item.trackLanguage as string) || null,
        (item.lyrics as string) || null,
        (item.audioFiles as string) || null,
        order,
      ],
    );

    const roleFields: Array<[TrackRole, unknown]> = [
      ['composer', item.composers],
      ['performer', item.performers],
      ['producer', item.producers],
    ];
    for (const [role, values] of roleFields) {
      if (!Array.isArray(values)) continue;
      let participantOrder = 0;
      for (const value of values) {
        if (typeof value !== 'string' || !value.trim()) continue;
        await qr.query(
          `INSERT INTO "project_track_participants"
             ("id", "tenant_id", "project_track_id", "name", "role", "sort_order")
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [randomUUID(), tenantId, trackId, value.trim(), role, participantOrder++],
        );
      }
    }
  }
}
