import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Physical rebuild of `projects` in the canonical order of the real form
 * (ProjetoFormModal) — 2026-07-19 audit. Same pattern as the previous ones
 * (artists/works/phonograms/releases).
 *
 * Real visual order: "Tipo de Lançamento" (tipo) → "Nome do EP/Álbum"
 * (titulo, conditional; for a single it comes from musicas[0].nome) → the
 * tracks section (subform normalized into `project_tracks`, no column of its own here;
 * `genero` is derived from musicas[0].genero and persisted as a filter
 * shortcut) → "Observações" → "Status" (the form's last field).
 *
 * `artista_id` is never sent by ProjetoFormModal (create/edit) — it is only
 * written by the bulk import (Projetos.tsx, a real XLSX flow, not an orphan) —
 * kept as a technical relation after the interactive form's fields.
 *
 * `orcamento` and `descricao` are accepted by CreateProjectDto/UpdateProjectDto
 * (real validation) but have no active writer in any UI (descricao
 * was superseded by musicas[]/project_tracks; orcamento was never
 * wired to a field) — kept as legacy/reserved, not removed
 * (unlike data_inicio/data_fim, which are proven orphans).
 *
 * `data_inicio`/`data_fim` are removed in this migration: proven orphans
 * — absent from CreateProjectDto/UpdateProjectDto, never read/written in
 * any controller/service/UI of the `projects` domain (full grep in
 * apps/api/src and apps/web/src/modules/projects, same fail-fast
 * validation pattern used for `artists.org_slug` in migration 20260719000001).
 */
export class RebuildProjectsInCanonicalFormOrder20260719000005 implements MigrationInterface {
  name = 'RebuildProjectsInCanonicalFormOrder20260719000005';

  private readonly newColumns = `
    id                  uuid NOT NULL DEFAULT gen_random_uuid(),
    tenant_id           uuid NOT NULL,
    tipo                varchar(100) NOT NULL,
    titulo              varchar(255) NOT NULL,
    genero              varchar(100),
    observacoes         text,
    status              varchar(50) NOT NULL DEFAULT 'planejamento',
    artista_id          uuid,
    orcamento           decimal(15,2),
    descricao           text,
    metadata            jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at          timestamp NOT NULL DEFAULT now(),
    updated_at          timestamp NOT NULL DEFAULT now(),
    created_by          varchar(255),
    updated_by          varchar(255),
    deleted_at          timestamp
  `;

  private readonly copyColumns = [
    'id', 'tenant_id', 'tipo', 'titulo', 'genero', 'observacoes', 'status', 'artista_id',
    'orcamento', 'descricao', 'metadata', 'created_at', 'updated_at', 'created_by',
    'updated_by', 'deleted_at',
  ].join(', ');

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 0. Fail-fast validation: data_inicio/data_fim must be genuinely empty.
    const [{ non_null }] = await queryRunner.query(
      `SELECT count(data_inicio)::int + count(data_fim)::int AS non_null FROM projects`,
    );
    if (Number(non_null) > 0) {
      throw new Error(
        `RebuildProjectsInCanonicalFormOrder: projects.data_inicio/data_fim têm ${non_null} valor(es) ` +
        `não-nulo(s) — colunas presumidas órfãs, mas há dado real. Migration abortada.`,
      );
    }
    const [{ total }] = await queryRunner.query(`SELECT count(*)::int AS total FROM projects`);

    await queryRunner.query(`CREATE TABLE projects_new (${this.newColumns})`);
    await queryRunner.query(`INSERT INTO projects_new (${this.copyColumns}) SELECT ${this.copyColumns} FROM projects`);

    const [{ c: newCount }] = await queryRunner.query(`SELECT count(*)::int AS c FROM projects_new`);
    if (Number(newCount) !== Number(total)) {
      throw new Error(`RebuildProjectsInCanonicalFormOrder: contagem divergente (original=${total}, nova=${newCount}) — abortada.`);
    }

    await queryRunner.query(`ALTER TABLE projects_new ADD CONSTRAINT projects_new_pkey PRIMARY KEY (id)`);
    await queryRunner.query(`ALTER TABLE projects_new ADD CONSTRAINT uq_projects_tenant_id_id_new UNIQUE (tenant_id, id)`);
    await queryRunner.query(`CREATE INDEX idx_projects_tenant_id_new ON projects_new (tenant_id)`);
    await queryRunner.query(`CREATE INDEX idx_projects_tenant_active_new ON projects_new (tenant_id, deleted_at, created_at DESC) WHERE (deleted_at IS NULL)`);

    await queryRunner.query(`ALTER TABLE transaction_allocations DROP CONSTRAINT fk_txalloc_project`);
    await queryRunner.query(`ALTER TABLE budgets DROP CONSTRAINT fk_budgets_project`);
    await queryRunner.query(`ALTER TABLE performance_metric_entries DROP CONSTRAINT fk_metric_project`);
    await queryRunner.query(`ALTER TABLE marketing_projects DROP CONSTRAINT fk_marketing_projects_financial_project`);
    await queryRunner.query(`ALTER TABLE audiovisual_projects DROP CONSTRAINT fk_audiovisual_projects_financial_project`);
    await queryRunner.query(`ALTER TABLE project_tracks DROP CONSTRAINT project_tracks_project_id_fkey`);

    await queryRunner.query(`ALTER TABLE projects RENAME TO projects_old`);
    await queryRunner.query(`ALTER TABLE projects_old RENAME CONSTRAINT projects_pkey TO projects_old_pkey`);
    await queryRunner.query(`ALTER TABLE projects_old RENAME CONSTRAINT uq_projects_tenant_id_id TO uq_projects_tenant_id_id_old`);
    await queryRunner.query(`ALTER INDEX idx_projects_tenant_id RENAME TO idx_projects_tenant_id_old`);
    await queryRunner.query(`ALTER INDEX idx_projects_tenant_active RENAME TO idx_projects_tenant_active_old`);

    await queryRunner.query(`ALTER TABLE projects_new RENAME TO projects`);
    await queryRunner.query(`ALTER INDEX projects_new_pkey RENAME TO projects_pkey`);
    await queryRunner.query(`ALTER TABLE projects RENAME CONSTRAINT uq_projects_tenant_id_id_new TO uq_projects_tenant_id_id`);
    await queryRunner.query(`ALTER INDEX idx_projects_tenant_id_new RENAME TO idx_projects_tenant_id`);
    await queryRunner.query(`ALTER INDEX idx_projects_tenant_active_new RENAME TO idx_projects_tenant_active`);

    await queryRunner.query(`ALTER TABLE transaction_allocations ADD CONSTRAINT fk_txalloc_project FOREIGN KEY (tenant_id, project_id) REFERENCES projects(tenant_id, id)`);
    await queryRunner.query(`ALTER TABLE budgets ADD CONSTRAINT fk_budgets_project FOREIGN KEY (tenant_id, project_id) REFERENCES projects(tenant_id, id)`);
    await queryRunner.query(`ALTER TABLE performance_metric_entries ADD CONSTRAINT fk_metric_project FOREIGN KEY (tenant_id, project_id) REFERENCES projects(tenant_id, id)`);
    await queryRunner.query(`ALTER TABLE marketing_projects ADD CONSTRAINT fk_marketing_projects_financial_project FOREIGN KEY (tenant_id, financial_project_id) REFERENCES projects(tenant_id, id)`);
    await queryRunner.query(`ALTER TABLE audiovisual_projects ADD CONSTRAINT fk_audiovisual_projects_financial_project FOREIGN KEY (tenant_id, financial_project_id) REFERENCES projects(tenant_id, id)`);
    await queryRunner.query(`ALTER TABLE project_tracks ADD CONSTRAINT project_tracks_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE`);

    await queryRunner.query(`ALTER TABLE projects ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE projects FORCE ROW LEVEL SECURITY`);
    await queryRunner.query(`
      CREATE POLICY super_admin_full_access ON projects
        AS PERMISSIVE FOR ALL TO authenticated
        USING (app_is_super_admin()) WITH CHECK (app_is_super_admin())
    `);
    await queryRunner.query(`
      CREATE POLICY tenant_isolation ON projects
        AS PERMISSIVE FOR ALL TO authenticated
        USING (tenant_id = private_get_tenant_id()) WITH CHECK (tenant_id = private_get_tenant_id())
    `);

    await queryRunner.query(`ALTER TABLE projects OWNER TO musicos_migrator`);
    await queryRunner.query(`GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON projects TO musicos_migrator`);

    await queryRunner.query(`DROP TABLE projects_old`);
    await queryRunner.query(`ANALYZE projects`);
  }

  private readonly originalColumns = `
    id                  uuid NOT NULL DEFAULT gen_random_uuid(),
    tenant_id           uuid NOT NULL,
    titulo              varchar(255) NOT NULL,
    tipo                varchar(100) NOT NULL,
    status              varchar(50) NOT NULL DEFAULT 'planejamento',
    artista_id          uuid,
    data_inicio         timestamp,
    data_fim            timestamp,
    orcamento           decimal(15,2),
    descricao           text,
    metadata            jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at          timestamp NOT NULL DEFAULT now(),
    updated_at          timestamp NOT NULL DEFAULT now(),
    deleted_at          timestamp,
    created_by          varchar(255),
    updated_by          varchar(255),
    observacoes         text,
    genero              varchar(100)
  `;

  private readonly restoreCopyColumns = [
    'id', 'tenant_id', 'titulo', 'tipo', 'status', 'artista_id', 'orcamento', 'descricao',
    'metadata', 'created_at', 'updated_at', 'created_by', 'updated_by', 'observacoes', 'genero',
  ].join(', ');

  public async down(queryRunner: QueryRunner): Promise<void> {
    const [{ total }] = await queryRunner.query(`SELECT count(*)::int AS total FROM projects`);

    await queryRunner.query(`CREATE TABLE projects_restore (${this.originalColumns})`);
    // data_inicio/data_fim no longer exist in `projects` (removed in up(),
    // proven orphans) — always NULL on reversal, same pattern as
    // org_slug in RebuildArtistsInCanonicalFormOrder20260719000001.
    await queryRunner.query(`INSERT INTO projects_restore (${this.restoreCopyColumns}) SELECT ${this.restoreCopyColumns} FROM projects`);

    const [{ c: restoredCount }] = await queryRunner.query(`SELECT count(*)::int AS c FROM projects_restore`);
    if (Number(restoredCount) !== Number(total)) {
      throw new Error(`RebuildProjectsInCanonicalFormOrder.down: contagem divergente (original=${total}, restaurada=${restoredCount}) — abortado.`);
    }

    await queryRunner.query(`ALTER TABLE projects_restore ADD CONSTRAINT projects_restore_pkey PRIMARY KEY (id)`);
    await queryRunner.query(`ALTER TABLE projects_restore ADD CONSTRAINT uq_projects_tenant_id_id_restore UNIQUE (tenant_id, id)`);
    await queryRunner.query(`CREATE INDEX idx_projects_tenant_id_restore ON projects_restore (tenant_id)`);
    await queryRunner.query(`CREATE INDEX idx_projects_tenant_active_restore ON projects_restore (tenant_id, deleted_at, created_at DESC) WHERE (deleted_at IS NULL)`);

    await queryRunner.query(`ALTER TABLE transaction_allocations DROP CONSTRAINT fk_txalloc_project`);
    await queryRunner.query(`ALTER TABLE budgets DROP CONSTRAINT fk_budgets_project`);
    await queryRunner.query(`ALTER TABLE performance_metric_entries DROP CONSTRAINT fk_metric_project`);
    await queryRunner.query(`ALTER TABLE marketing_projects DROP CONSTRAINT fk_marketing_projects_financial_project`);
    await queryRunner.query(`ALTER TABLE audiovisual_projects DROP CONSTRAINT fk_audiovisual_projects_financial_project`);
    await queryRunner.query(`ALTER TABLE project_tracks DROP CONSTRAINT project_tracks_project_id_fkey`);

    await queryRunner.query(`ALTER TABLE projects RENAME TO projects_canonical`);
    await queryRunner.query(`ALTER TABLE projects_canonical RENAME CONSTRAINT projects_pkey TO projects_canonical_pkey`);
    await queryRunner.query(`ALTER TABLE projects_canonical RENAME CONSTRAINT uq_projects_tenant_id_id TO uq_projects_tenant_id_id_canonical`);
    await queryRunner.query(`ALTER INDEX idx_projects_tenant_id RENAME TO idx_projects_tenant_id_canonical`);
    await queryRunner.query(`ALTER INDEX idx_projects_tenant_active RENAME TO idx_projects_tenant_active_canonical`);

    await queryRunner.query(`ALTER TABLE projects_restore RENAME TO projects`);
    await queryRunner.query(`ALTER INDEX projects_restore_pkey RENAME TO projects_pkey`);
    await queryRunner.query(`ALTER TABLE projects RENAME CONSTRAINT uq_projects_tenant_id_id_restore TO uq_projects_tenant_id_id`);
    await queryRunner.query(`ALTER INDEX idx_projects_tenant_id_restore RENAME TO idx_projects_tenant_id`);
    await queryRunner.query(`ALTER INDEX idx_projects_tenant_active_restore RENAME TO idx_projects_tenant_active`);

    await queryRunner.query(`ALTER TABLE transaction_allocations ADD CONSTRAINT fk_txalloc_project FOREIGN KEY (tenant_id, project_id) REFERENCES projects(tenant_id, id)`);
    await queryRunner.query(`ALTER TABLE budgets ADD CONSTRAINT fk_budgets_project FOREIGN KEY (tenant_id, project_id) REFERENCES projects(tenant_id, id)`);
    await queryRunner.query(`ALTER TABLE performance_metric_entries ADD CONSTRAINT fk_metric_project FOREIGN KEY (tenant_id, project_id) REFERENCES projects(tenant_id, id)`);
    await queryRunner.query(`ALTER TABLE marketing_projects ADD CONSTRAINT fk_marketing_projects_financial_project FOREIGN KEY (tenant_id, financial_project_id) REFERENCES projects(tenant_id, id)`);
    await queryRunner.query(`ALTER TABLE audiovisual_projects ADD CONSTRAINT fk_audiovisual_projects_financial_project FOREIGN KEY (tenant_id, financial_project_id) REFERENCES projects(tenant_id, id)`);
    await queryRunner.query(`ALTER TABLE project_tracks ADD CONSTRAINT project_tracks_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE`);

    await queryRunner.query(`ALTER TABLE projects ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE projects FORCE ROW LEVEL SECURITY`);
    await queryRunner.query(`
      CREATE POLICY super_admin_full_access ON projects
        AS PERMISSIVE FOR ALL TO authenticated
        USING (app_is_super_admin()) WITH CHECK (app_is_super_admin())
    `);
    await queryRunner.query(`
      CREATE POLICY tenant_isolation ON projects
        AS PERMISSIVE FOR ALL TO authenticated
        USING (tenant_id = private_get_tenant_id()) WITH CHECK (tenant_id = private_get_tenant_id())
    `);

    await queryRunner.query(`ALTER TABLE projects OWNER TO musicos_migrator`);
    await queryRunner.query(`GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON projects TO musicos_migrator`);

    await queryRunner.query(`DROP TABLE projects_canonical`);
    await queryRunner.query(`ANALYZE projects`);
  }
}
