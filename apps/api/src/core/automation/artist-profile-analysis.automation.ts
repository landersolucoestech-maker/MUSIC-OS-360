/**
 * core/automation/artist-profile-analysis.automation.ts
 *
 * NATIVE, INTERNAL and INVISIBLE automation:
 *   artist.created → artist-profile-analysis → saves the diagnosis in
 *   artists.metadata.aiProfileAnalysis
 *
 * All common orchestration (metadata + skill_runs idempotency, auditing,
 * envelope, persistence, fail-safe) lives in `runNativeSkillAutomation`. Only the
 * specific parts live here: loading the artist, assembling the input and the UPDATE of the
 * `artists` table.
 *
 * Guarantees inherited from the runner: non-blocking execution, an AI failure never reverts
 * artist.created, double idempotency guard (running/success block; failed
 * allows a retry), and no side effects (no tasks, no notifications, no
 * status change, no change to the artist's official strategy, no new tables).
 */

import { Injectable, Inject, Optional } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { DataSource, EntityManager } from 'typeorm';
import { DATA_SOURCE } from '../../database/database.module';
import { DatabaseContextService } from '../../database/database-context.service';
import { DOMAIN_EVENTS } from '../events/events.service';
import type { DomainEvent } from '../events/events.service';
import type { ArtistCreatedPayload } from '../events/domain-events.types';
import { SkillRunService } from '../skills/skill-run.service';
import { AIService } from '../../modules/ai/ai.service';
import {
  ARTIST_PROFILE_ANALYSIS_SYSTEM_PROMPT,
  buildArtistProfileAnalysisPrompt,
  parseArtistProfileAnalysisResponse,
  validateArtistProfileAnalysisInput,
  type ArtistProfileAnalysisInput,
  type ArtistPlatformProfile,
} from '@music-os-360/ai-skills';
import { runNativeSkillAutomation } from './native-skill-automation.runner';

const SKILL_NAME = 'artist-profile-analysis';

interface ArtistRow {
  nome_artistico: string;
  music_genre: string | null;
  spotify_url: string | null;
  youtube_url: string | null;
  deezer_url: string | null;
  apple_music_url: string | null;
  soundcloud_url: string | null;
  notes: string | null;
  metadata: Record<string, unknown> | null;
}

/** Derives the platform profiles from the artist's social/streaming columns. */
function buildPlatforms(artist: ArtistRow): ArtistPlatformProfile[] {
  const platforms: ArtistPlatformProfile[] = [];
  const add = (platform: string, handle: string | null) => {
    if (handle) platforms.push({ platform, handle });
  };
  add('spotify', artist.spotify_url);
  add('youtube', artist.youtube_url);
  add('deezer', artist.deezer_url);
  add('apple_music', artist.apple_music_url);
  add('soundcloud', artist.soundcloud_url);
  return platforms;
}

@Injectable()
export class ArtistProfileAnalysisAutomation {
  private readonly ds: DataSource | null;

  constructor(
    @Inject(DATA_SOURCE) @Optional() ds: DataSource | null,
    private readonly skillRun: SkillRunService,
    private readonly ai: AIService,
    @Optional() private readonly dbContext?: DatabaseContextService,
  ) {
    this.ds = ds ?? null;
  }

  @OnEvent(DOMAIN_EVENTS.ARTIST_CREATED, { async: true })
  async onArtistCreated(event: DomainEvent<ArtistCreatedPayload>): Promise<void> {
    const tenantId = event.tenantId;
    const payload = event.payload;
    const artistId = payload?.artistId;

    await runNativeSkillAutomation<ArtistRow, ArtistProfileAnalysisInput>(
      { ds: this.ds, dbContext: this.dbContext, skillRun: this.skillRun, ai: this.ai },
      {
        eventName: DOMAIN_EVENTS.ARTIST_CREATED,
        skillName: SKILL_NAME,
        tenantId,
        userId: payload?.createdBy ?? null,
        entityType: 'artist',
        entityId: artistId,
        metadataKey: 'aiProfileAnalysis',
        systemPrompt: ARTIST_PROFILE_ANALYSIS_SYSTEM_PROMPT,
        load: (manager) => this.loadArtist(tenantId, artistId, manager),
        getMetadata: (row) => (row.metadata ?? {}) as Record<string, unknown>,
        buildInput: (row) => this.buildInput(row),
        validateInput: validateArtistProfileAnalysisInput,
        buildPrompt: buildArtistProfileAnalysisPrompt,
        parseResponse: parseArtistProfileAnalysisResponse,
        saveMetadata: (next, manager) => this.persistMetadata(tenantId, artistId, next, manager),
      },
    );
  }

  // ── Persistence (read/write of artists.metadata via DataSource) ─────────────

  private async loadArtist(
    tenantId: string,
    artistId: string,
    manager: EntityManager,
  ): Promise<ArtistRow | null> {
    if (!this.ds) return null;
    const rows = (await manager.query(
      `SELECT nome_artistico, music_genre, spotify_url, youtube_url,
              deezer_url, apple_music_url, soundcloud_url, notes, metadata
         FROM artists
        WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL
        LIMIT 1`,
      [artistId, tenantId],
    )) as ArtistRow[];
    return rows?.[0] ?? null;
  }

  private async persistMetadata(
    tenantId: string,
    artistId: string,
    nextMetadata: Record<string, unknown>,
    manager: EntityManager,
  ): Promise<void> {
    if (!this.ds) return;
    await manager.query(
      `UPDATE artists SET metadata = $1::jsonb, updated_at = NOW()
        WHERE id = $2 AND tenant_id = $3 AND deleted_at IS NULL`,
      [JSON.stringify(nextMetadata), artistId, tenantId],
    );
  }

  // ── Montagem do input da skill ──────────────────────────────────────────────

  private buildInput(artist: ArtistRow): ArtistProfileAnalysisInput {
    const md = (artist.metadata ?? {}) as Record<string, unknown>;
    const strArray = (v: unknown): string[] | undefined =>
      Array.isArray(v) && v.length > 0 ? v.map((x) => String(x)) : undefined;

    const input: ArtistProfileAnalysisInput = {
      artistName: artist.nome_artistico,
      language: 'pt-BR',
    };

    if (artist.music_genre) input.genre = artist.music_genre;
    if (typeof md.audience === 'string') input.audience = md.audience;

    const strengths = strArray(md.strengths);
    if (strengths) input.strengths = strengths;
    const weaknesses = strArray(md.weaknesses);
    if (weaknesses) input.weaknesses = weaknesses;

    const platforms = buildPlatforms(artist);
    if (platforms.length > 0) input.platforms = platforms;

    const context = typeof md.context === 'string' ? md.context : artist.notes;
    if (context) input.context = context;

    return input;
  }
}
