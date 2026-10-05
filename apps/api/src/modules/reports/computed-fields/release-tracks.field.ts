/**
 * modules/reports/computed-fields/release-tracks.field.ts  ·  Part 89
 *
 * Dedicated resolver for the "Faixas do Lançamento" child sheet
 * (RELEASES_CONTRACT.childSheets). The tracks live inside
 * releases.metadata.tracks (legacy key `faixas`, still read; not normalized into its own table, unlike
 * Projects/project_tracks). Each track uses the `title` key in the form's real
 * storage (ReleaseFormModal.tsx) — exposed as `trackTitle` in the child
 * sheet so it does not collide with the release's (parent row) `title` column.
 *
 * Documented simplification (Part 89): each track's additional
 * producers/musicians/artists are arrays of objects ({nome,role}/{nome,
 * instrumento}) — out of reach of this child sheet in this Part (not included
 * as columns). Only composers (already a simple list of names) are
 * exported/imported.
 */
import { BadRequestException } from '@nestjs/common';
import type { DataSource, QueryRunner } from 'typeorm';
import { normalizeIsrc, isValidIsrc } from '../../registry/validators/registry-validators';
import { canonicalReleaseTrack } from '../../../common/compat/release-metadata';

interface ReleaseTrackItem {
  trackTitle: string;
  isAlternateVersion: unknown;
  versionType: unknown;
  versionCustomName: unknown;
  composers: string[];
  aiAssistanceLevel: unknown;
  instrumental: unknown;
  releaseTrackLanguage: unknown;
  lyrics: unknown;
  explicit: unknown;
  isrc: unknown;
  trackArtist: unknown;
}

export async function fetchReleaseTracksForExport(
  ds: DataSource,
  tenantId: string,
  releaseIds: string[],
): Promise<Map<string, ReleaseTrackItem[]>> {
  const out = new Map<string, ReleaseTrackItem[]>();
  if (releaseIds.length === 0) return out;
  const rows = (await ds.query(
    `SELECT "id", COALESCE(NULLIF("metadata"->'tracks', 'null'::jsonb), "metadata"->'faixas') AS tracks FROM "releases" WHERE "tenant_id" = $1 AND "id" = ANY($2::uuid[])`,
    [tenantId, releaseIds],
  )) as { id: string; tracks: unknown }[];
  for (const row of rows) {
    // Dual-read: a row not yet backfilled (20260930000019) still carries the Portuguese track keys.
    const raw = Array.isArray(row.tracks)
      ? (row.tracks as unknown[]).map((t) => (canonicalReleaseTrack(t).value ?? {}) as Record<string, unknown>)
      : [];
    out.set(
      row.id,
      raw.map((f) => ({
        trackTitle: String(f.title ?? ''),
        isAlternateVersion: f.isAlternateVersion ?? null,
        versionType: f.versionType ?? null,
        versionCustomName: f.versionCustomName ?? null,
        composers: Array.isArray(f.composers) ? (f.composers as string[]) : [],
        aiAssistanceLevel: f.aiAssistanceLevel ?? null,
        instrumental: f.instrumental ?? null,
        releaseTrackLanguage: f.language ?? null,
        lyrics: f.lyrics ?? null,
        explicit: f.explicit ?? null,
        isrc: f.isrc ?? null,
        trackArtist: f.artist ?? null,
      })),
    );
  }
  return out;
}

export async function writeReleaseTracksForImport(
  qr: QueryRunner,
  tenantId: string,
  releaseId: string,
  trackRows: unknown,
): Promise<void> {
  const list = Array.isArray(trackRows) ? trackRows : [];
  const stored = list.map((raw, i) => {
    const f = (raw ?? {}) as Record<string, unknown>;
    // find-532335a9: per-track ISRC inside the "Faixas do Lançamento" child
    // sheet bypassed ImportCommitService.assertValidIsrc()/normalizeIsrc()
    // entirely (those only walk the general/non-repeating columns) — the
    // same real ISRC could land here in a different textual form than the
    // manual-entry or general-column import paths.
    let isrc: string | null = null;
    if (typeof f.isrc === 'string' && f.isrc.trim() !== '') {
      const canonicalIsrc = normalizeIsrc(f.isrc);
      if (!isValidIsrc(canonicalIsrc)) {
        throw new BadRequestException(
          `Faixa ${i + 1}: ISRC inválido "${f.isrc}". Formato esperado: CCXXXYYNNNNN (12 caracteres, hífens opcionais).`,
        );
      }
      isrc = canonicalIsrc;
    }
    return {
      title: String(f.trackTitle ?? ''),
      isAlternateVersion: f.isAlternateVersion ?? null,
      versionType: f.versionType ?? null,
      versionCustomName: f.versionCustomName ?? null,
      composers: Array.isArray(f.composers) ? f.composers : [],
      aiAssistanceLevel: f.aiAssistanceLevel ?? null,
      instrumental: f.instrumental ?? null,
      language: f.releaseTrackLanguage ?? null,
      lyrics: f.lyrics ?? null,
      explicit: f.explicit ?? null,
      isrc,
      artist: f.trackArtist ?? null,
    };
  });
  await qr.query(
    `UPDATE "releases" SET "metadata" = jsonb_set(COALESCE("metadata", '{}'::jsonb) - 'faixas', '{tracks}', $1::jsonb) WHERE "id" = $2 AND "tenant_id" = $3`,
    [JSON.stringify(stored), releaseId, tenantId],
  );
}
