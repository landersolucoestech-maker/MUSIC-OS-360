import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Aligns `projects` with the real contract of the active form (ProjetoFormModal.tsx).
 *
 * CRITICAL finding confirmed (2026-07-18 audit): `useProjetos()` writes via
 * `storage.create("projetos", ...)` → `TABLE_ENDPOINT["projetos"] = "/projects"`
 * → `CreateProjectDto`. The real payload is 100% Portuguese
 * (titulo/tipo/status/observacoes/descricao/genero/artista_id); the old DTO
 * only accepted English fields (title/type/artistId/budget/currency/
 * startsAt/deadlineAt/releasedAt) — zero overlap. With
 * forbidNonWhitelisted, every project create/edit returned 400. Even
 * if the old DTO had been whitelisted, the service spread the DTO directly
 * (`...dto`) onto the entity, whose physical columns were already `nome`/`tipo`/
 * `status`/`descricao` (Portuguese) — the old DTO fields would never have
 * persisted anyway.
 *
 * `nome` renamed to `titulo` (required canonical contract: the real name in the
 * active form). DEV has no business data (0 rows) — RENAME
 * COLUMN is safe and loses no data regardless.
 *
 * `musicas[]` (rich per-track list: name, soloFeat, originalRemix,
 * instrumental, duration, genre, language, composers[], performers[],
 * producers[], lyrics, audioUrl) was serialized with JSON.stringify() inside
 * `projects.descricao` (free text) — forbidden by the product rule.
 * Normalized into `project_tracks` (one row per track) +
 * `project_track_participants` (composers/performers/producers, which
 * have the same structure — free-text name, no link to a registered artist — and
 * differ only by role, hence a single table with `role`).
 */
export class ProjectsFormFieldAlignment20260718000013 implements MigrationInterface {
  name = 'ProjectsFormFieldAlignment20260718000013';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── 1. Fail-fast: aborts if `descricao` holds content that is neither the
    //    legacy JSON marker of musicas[] nor simple free text (it should never
    //    happen, but we do not presume a format without checking).
    const rows: Array<{ id: string; descricao: string }> = await queryRunner.query(`
      SELECT id, descricao FROM projects
      WHERE descricao IS NOT NULL AND btrim(descricao) <> ''
    `);
    const legacyMusicasByProject = new Map<string, unknown[]>();
    for (const row of rows) {
      const trimmed = row.descricao.trim();
      if (trimmed.startsWith('[')) {
        let parsed: unknown;
        try {
          parsed = JSON.parse(trimmed);
        } catch {
          throw new Error(
            `ProjectsFormFieldAlignment: projeto ${row.id} tem descricao iniciando com "[" mas não é JSON ` +
            `válido — migration abortada; verificar manualmente antes de reexecutar.`,
          );
        }
        if (!Array.isArray(parsed)) {
          throw new Error(
            `ProjectsFormFieldAlignment: projeto ${row.id} tem descricao JSON que não é array — ` +
            `formato desconhecido, migration abortada.`,
          );
        }
        for (const item of parsed) {
          if (typeof item !== 'object' || item === null || !('nome' in (item as object))) {
            throw new Error(
              `ProjectsFormFieldAlignment: projeto ${row.id} tem item de musicas[] sem a chave ` +
              `"nome" — formato desconhecido, migration abortada.`,
            );
          }
        }
        legacyMusicasByProject.set(row.id, parsed as unknown[]);
      }
      // Otherwise: real free text — preserved, nothing to migrate.
    }

    // ── 2. Renames nome → titulo (canonical contract) and adds new columns ──────
    await queryRunner.query(`
      ALTER TABLE "projects" RENAME COLUMN "nome" TO "titulo"
    `);
    await queryRunner.query(`
      ALTER TABLE "projects"
        ADD COLUMN IF NOT EXISTS "observacoes" text,
        ADD COLUMN IF NOT EXISTS "genero" varchar(100)
    `);

    // ── 3. Tabelas filhas ────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS project_tracks (
        id             uuid PRIMARY KEY,
        tenant_id      uuid NOT NULL,
        project_id     uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        nome           varchar(500) NOT NULL,
        solo_feat      varchar(20),
        original_remix varchar(20),
        instrumental   varchar(10),
        duracao_min    varchar(10),
        duracao_seg    varchar(10),
        genero         varchar(100),
        idioma         varchar(50),
        letra          text,
        audio_url      text,
        ordem          integer NOT NULL DEFAULT 0,
        created_at     timestamp NOT NULL DEFAULT now(),
        updated_at     timestamp NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_project_tracks_tenant_project ON project_tracks (tenant_id, project_id)`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS project_track_participants (
        id               uuid PRIMARY KEY,
        tenant_id        uuid NOT NULL,
        project_track_id uuid NOT NULL REFERENCES project_tracks(id) ON DELETE CASCADE,
        nome             varchar(255) NOT NULL,
        role             varchar(20) NOT NULL,
        ordem            integer NOT NULL DEFAULT 0,
        created_at       timestamp NOT NULL DEFAULT now(),
        CONSTRAINT chk_project_track_participants_role
          CHECK (role IN ('compositor', 'interprete', 'produtor'))
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_project_track_participants_tenant_track ON project_track_participants (tenant_id, project_track_id)`);

    // ── 4. Backfill: migrates legacy musicas[] (if any) ───────────────────────
    for (const [projectId, musicas] of legacyMusicasByProject) {
      const [{ tenant_id }] = await queryRunner.query(
        `SELECT tenant_id FROM projects WHERE id = $1`,
        [projectId],
      );
      let ordem = 0;
      for (const item of musicas as Array<Record<string, unknown>>) {
        const trackId: string = (await queryRunner.query(`SELECT gen_random_uuid() AS id`))[0].id;
        await queryRunner.query(
          `INSERT INTO project_tracks
             (id, tenant_id, project_id, nome, solo_feat, original_remix, instrumental,
              duracao_min, duracao_seg, genero, idioma, letra, audio_url, ordem)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
          [
            trackId, tenant_id, projectId,
            String(item.nome ?? ''),
            item.soloFeat ?? null, item.originalRemix ?? null, item.instrumental ?? null,
            item.duracaoMin ?? null, item.duracaoSeg ?? null,
            item.genero ?? null, item.idioma ?? null, item.letra ?? null, item.audioUrl ?? null,
            ordem++,
          ],
        );
        const roleFields: Array<['compositor' | 'interprete' | 'produtor', unknown]> = [
          ['compositor', item.compositores], ['interprete', item.interpretes], ['produtor', item.produtores],
        ];
        for (const [role, list] of roleFields) {
          if (!Array.isArray(list)) continue;
          let partOrdem = 0;
          for (const nome of list) {
            if (!nome || typeof nome !== 'string' || !nome.trim()) continue;
            await queryRunner.query(
              `INSERT INTO project_track_participants (id, tenant_id, project_track_id, nome, role, ordem)
               VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)`,
              [tenant_id, trackId, nome.trim(), role, partOrdem++],
            );
          }
        }
      }
      // descricao only contained the musicas JSON — cleared after migrating.
      await queryRunner.query(`UPDATE projects SET descricao = NULL WHERE id = $1`, [projectId]);
    }

    // ── 5. Verification: no legacy track may remain unmigrated ────────────────
    const [{ remaining }] = await queryRunner.query(`
      SELECT count(*)::int AS remaining FROM projects
      WHERE descricao IS NOT NULL AND btrim(descricao) LIKE '[%'
    `);
    if (remaining > 0) {
      throw new Error(
        `ProjectsFormFieldAlignment: ${remaining} projeto(s) ainda com descricao em formato ` +
        `JSON de musicas[] após o backfill — migration abortada antes de liberar o uso normal de descricao.`,
      );
    }

    // ── 6. RLS on the child tables (same pattern as work_participants) ─────────
    for (const table of ['project_tracks', 'project_track_participants']) {
      await queryRunner.query(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
      await queryRunner.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_policy WHERE polname = 'tenant_isolation' AND polrelid = 'public.${table}'::regclass
          ) THEN
            CREATE POLICY "tenant_isolation" ON ${table}
              FOR ALL
              USING (tenant_id = private_get_tenant_id())
              WITH CHECK (tenant_id = private_get_tenant_id());
          END IF;
        END $$;
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE projects p SET descricao = COALESCE(sub.items, p.descricao)
      FROM (
        SELECT pt.project_id, jsonb_agg(
          jsonb_build_object(
            'id', pt.id, 'nome', pt.nome, 'soloFeat', pt.solo_feat,
            'originalRemix', pt.original_remix, 'instrumental', pt.instrumental,
            'duracaoMin', pt.duracao_min, 'duracaoSeg', pt.duracao_seg,
            'genero', pt.genero, 'idioma', pt.idioma, 'letra', pt.letra, 'audioUrl', pt.audio_url,
            'compositores', COALESCE((
              SELECT jsonb_agg(nome ORDER BY ordem) FROM project_track_participants
              WHERE project_track_id = pt.id AND role = 'compositor'
            ), '[]'::jsonb),
            'interpretes', COALESCE((
              SELECT jsonb_agg(nome ORDER BY ordem) FROM project_track_participants
              WHERE project_track_id = pt.id AND role = 'interprete'
            ), '[]'::jsonb),
            'produtores', COALESCE((
              SELECT jsonb_agg(nome ORDER BY ordem) FROM project_track_participants
              WHERE project_track_id = pt.id AND role = 'produtor'
            ), '[]'::jsonb)
          ) ORDER BY pt.ordem
        )::text AS items
        FROM project_tracks pt
        GROUP BY pt.project_id
      ) sub
      WHERE p.id = sub.project_id
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS project_track_participants`);
    await queryRunner.query(`DROP TABLE IF EXISTS project_tracks`);
    await queryRunner.query(`
      ALTER TABLE "projects"
        DROP COLUMN IF EXISTS "observacoes",
        DROP COLUMN IF EXISTS "genero"
    `);
    await queryRunner.query(`ALTER TABLE "projects" RENAME COLUMN "titulo" TO "nome"`);
  }
}
