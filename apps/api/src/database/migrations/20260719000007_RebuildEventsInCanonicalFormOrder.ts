import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Physical rebuild of `events` in the canonical order of the real form
 * (SchedulerFormModal) — 2026-07-19 audit. Same pattern as the previous ones.
 *
 * Real visual order: Title → Event Type → Participants (real subform,
 * jsonb) → Status → Start Date/Time (`data`, dual-written to
 * `starts_at` — see migrations 20260716000001/commit "dual-write event start
 * timestamps") → End Date/Time (`data_fim`) → Venue fields
 * (conditional: name, contact, address) → Show-only fields
 * (fee/expected audience — "Capacidade do Público" maps to `capacity`,
 * which has no physical column of its own and is discarded in the service; out of
 * this migration's scope) → Description → Notes. `artista_id` is a technical
 * relation (derived from the first participant of the artist type, with no dedicated
 * visible field).
 *
 * IMPORTANT: this table is in an active, deliberate phased migration
 * (C3/E2 — dual-write `data`→`starts_at`, canonical reads only in phase E4,
 * removal of `data` only in E6). This migration does NOT touch that process: it does not
 * rename, change semantics, or remove `data`/`starts_at` — it only
 * fixes the PHYSICAL ORDER of the columns, keeping both side by side.
 *
 * `valor` is removed: a proven orphan — with no reader/writer in
 * any controller/service/DTO/UI of the events domain (superseded by
 * `valor_cache`, which is the real column used by the form) — same pattern
 * as `artists.org_slug`/`projects.data_inicio`/`audiovisual_projects.organization_id`.
 */
export class RebuildEventsInCanonicalFormOrder20260719000007 implements MigrationInterface {
  name = 'RebuildEventsInCanonicalFormOrder20260719000007';

  private readonly newColumns = `
    id                uuid NOT NULL DEFAULT gen_random_uuid(),
    tenant_id         uuid NOT NULL,
    titulo            varchar(255) NOT NULL,
    tipo              varchar(100) NOT NULL,
    participantes     jsonb,
    status            varchar(50) NOT NULL DEFAULT 'agendado',
    data              timestamp NOT NULL,
    starts_at         timestamp,
    data_fim          timestamp,
    local             varchar(255),
    contato_local     varchar(255),
    endereco          varchar(300),
    valor_cache       decimal(15,2),
    publico_esperado  integer,
    descricao         text,
    observacoes       text,
    artista_id        uuid,
    metadata          jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at        timestamp NOT NULL DEFAULT now(),
    updated_at        timestamp NOT NULL DEFAULT now(),
    created_by        varchar(255),
    updated_by        varchar(255),
    deleted_at        timestamp
  `;

  private readonly copyColumns = [
    'id', 'tenant_id', 'titulo', 'tipo', 'participantes', 'status', 'data', 'starts_at',
    'data_fim', 'local', 'contato_local', 'endereco', 'valor_cache', 'publico_esperado',
    'descricao', 'observacoes', 'artista_id', 'metadata', 'created_at', 'updated_at',
    'created_by', 'updated_by', 'deleted_at',
  ].join(', ');

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 0. Fail-fast validation: valor must be genuinely empty.
    const [{ non_null }] = await queryRunner.query(`SELECT count(valor)::int AS non_null FROM events`);
    if (Number(non_null) > 0) {
      throw new Error(
        `RebuildEventsInCanonicalFormOrder: events.valor tem ${non_null} valor(es) não-nulo(s) — ` +
        `coluna presumida órfã, mas há dado real. Migration abortada.`,
      );
    }
    const [{ total }] = await queryRunner.query(`SELECT count(*)::int AS total FROM events`);

    await queryRunner.query(`CREATE TABLE events_new (${this.newColumns})`);
    await queryRunner.query(`INSERT INTO events_new (${this.copyColumns}) SELECT ${this.copyColumns} FROM events`);

    const [{ c: newCount }] = await queryRunner.query(`SELECT count(*)::int AS c FROM events_new`);
    if (Number(newCount) !== Number(total)) {
      throw new Error(`RebuildEventsInCanonicalFormOrder: contagem divergente (original=${total}, nova=${newCount}) — abortada.`);
    }

    await queryRunner.query(`ALTER TABLE events_new ADD CONSTRAINT events_new_pkey PRIMARY KEY (id)`);
    await queryRunner.query(`ALTER TABLE events_new ADD CONSTRAINT uq_events_tenant_id_id_new UNIQUE (tenant_id, id)`);
    await queryRunner.query(`CREATE INDEX idx_events_tenant_id_new ON events_new (tenant_id)`);
    await queryRunner.query(`CREATE INDEX idx_events_tenant_data_new ON events_new (tenant_id, data)`);
    await queryRunner.query(`CREATE INDEX idx_events_tenant_active_new ON events_new (tenant_id, deleted_at, created_at DESC) WHERE (deleted_at IS NULL)`);
    await queryRunner.query(`CREATE INDEX idx_events_tenant_starts_at_new ON events_new (tenant_id, starts_at)`);

    await queryRunner.query(`ALTER TABLE financial_transactions DROP CONSTRAINT fk_fintx_event`);

    await queryRunner.query(`ALTER TABLE events RENAME TO events_old`);
    await queryRunner.query(`ALTER TABLE events_old RENAME CONSTRAINT events_pkey TO events_old_pkey`);
    await queryRunner.query(`ALTER TABLE events_old RENAME CONSTRAINT uq_events_tenant_id_id TO uq_events_tenant_id_id_old`);
    await queryRunner.query(`ALTER INDEX idx_events_tenant_id RENAME TO idx_events_tenant_id_old`);
    await queryRunner.query(`ALTER INDEX idx_events_tenant_data RENAME TO idx_events_tenant_data_old`);
    await queryRunner.query(`ALTER INDEX idx_events_tenant_active RENAME TO idx_events_tenant_active_old`);
    await queryRunner.query(`ALTER INDEX idx_events_tenant_starts_at RENAME TO idx_events_tenant_starts_at_old`);

    await queryRunner.query(`ALTER TABLE events_new RENAME TO events`);
    await queryRunner.query(`ALTER INDEX events_new_pkey RENAME TO events_pkey`);
    await queryRunner.query(`ALTER TABLE events RENAME CONSTRAINT uq_events_tenant_id_id_new TO uq_events_tenant_id_id`);
    await queryRunner.query(`ALTER INDEX idx_events_tenant_id_new RENAME TO idx_events_tenant_id`);
    await queryRunner.query(`ALTER INDEX idx_events_tenant_data_new RENAME TO idx_events_tenant_data`);
    await queryRunner.query(`ALTER INDEX idx_events_tenant_active_new RENAME TO idx_events_tenant_active`);
    await queryRunner.query(`ALTER INDEX idx_events_tenant_starts_at_new RENAME TO idx_events_tenant_starts_at`);

    await queryRunner.query(`ALTER TABLE financial_transactions ADD CONSTRAINT fk_fintx_event FOREIGN KEY (tenant_id, event_id) REFERENCES events(tenant_id, id)`);

    await queryRunner.query(`ALTER TABLE events ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE events FORCE ROW LEVEL SECURITY`);
    await queryRunner.query(`
      CREATE POLICY super_admin_full_access ON events
        AS PERMISSIVE FOR ALL TO authenticated
        USING (app_is_super_admin()) WITH CHECK (app_is_super_admin())
    `);
    await queryRunner.query(`
      CREATE POLICY tenant_isolation ON events
        AS PERMISSIVE FOR ALL TO authenticated
        USING (tenant_id = private_get_tenant_id()) WITH CHECK (tenant_id = private_get_tenant_id())
    `);

    await queryRunner.query(`ALTER TABLE events OWNER TO musicos_migrator`);
    await queryRunner.query(`GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON events TO musicos_migrator`);

    await queryRunner.query(`DROP TABLE events_old`);
    await queryRunner.query(`ANALYZE events`);
  }

  private readonly originalColumns = `
    id                uuid NOT NULL DEFAULT gen_random_uuid(),
    tenant_id         uuid NOT NULL,
    titulo            varchar(255) NOT NULL,
    tipo              varchar(100) NOT NULL,
    status            varchar(50) NOT NULL DEFAULT 'agendado',
    data              timestamp NOT NULL,
    local             varchar(255),
    artista_id        uuid,
    valor             decimal(15,2),
    observacoes       text,
    metadata          jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at        timestamp NOT NULL DEFAULT now(),
    updated_at        timestamp NOT NULL DEFAULT now(),
    deleted_at        timestamp,
    created_by        varchar(255),
    updated_by        varchar(255),
    data_fim          timestamp,
    endereco          varchar(300),
    contato_local     varchar(255),
    valor_cache       decimal(15,2),
    publico_esperado  integer,
    descricao         text,
    participantes     jsonb,
    starts_at         timestamp
  `;

  private readonly restoreCopyColumns = [
    'id', 'tenant_id', 'titulo', 'tipo', 'status', 'data', 'local', 'artista_id',
    'observacoes', 'metadata', 'created_at', 'updated_at', 'created_by', 'updated_by',
    'data_fim', 'endereco', 'contato_local', 'valor_cache', 'publico_esperado', 'descricao',
    'participantes', 'starts_at', 'deleted_at',
  ].join(', ');

  public async down(queryRunner: QueryRunner): Promise<void> {
    const [{ total }] = await queryRunner.query(`SELECT count(*)::int AS total FROM events`);

    await queryRunner.query(`CREATE TABLE events_restore (${this.originalColumns})`);
    // `valor` no longer exists (removed in up(), proven orphan) —
    // always NULL on reversal, same pattern as org_slug in
    // RebuildArtistsInCanonicalFormOrder20260719000001.
    await queryRunner.query(`INSERT INTO events_restore (${this.restoreCopyColumns}) SELECT ${this.restoreCopyColumns} FROM events`);

    const [{ c: restoredCount }] = await queryRunner.query(`SELECT count(*)::int AS c FROM events_restore`);
    if (Number(restoredCount) !== Number(total)) {
      throw new Error(`RebuildEventsInCanonicalFormOrder.down: contagem divergente (original=${total}, restaurada=${restoredCount}) — abortado.`);
    }

    await queryRunner.query(`ALTER TABLE events_restore ADD CONSTRAINT events_restore_pkey PRIMARY KEY (id)`);
    await queryRunner.query(`ALTER TABLE events_restore ADD CONSTRAINT uq_events_tenant_id_id_restore UNIQUE (tenant_id, id)`);
    await queryRunner.query(`CREATE INDEX idx_events_tenant_id_restore ON events_restore (tenant_id)`);
    await queryRunner.query(`CREATE INDEX idx_events_tenant_data_restore ON events_restore (tenant_id, data)`);
    await queryRunner.query(`CREATE INDEX idx_events_tenant_active_restore ON events_restore (tenant_id, deleted_at, created_at DESC) WHERE (deleted_at IS NULL)`);
    await queryRunner.query(`CREATE INDEX idx_events_tenant_starts_at_restore ON events_restore (tenant_id, starts_at)`);

    await queryRunner.query(`ALTER TABLE financial_transactions DROP CONSTRAINT fk_fintx_event`);

    await queryRunner.query(`ALTER TABLE events RENAME TO events_canonical`);
    await queryRunner.query(`ALTER TABLE events_canonical RENAME CONSTRAINT events_pkey TO events_canonical_pkey`);
    await queryRunner.query(`ALTER TABLE events_canonical RENAME CONSTRAINT uq_events_tenant_id_id TO uq_events_tenant_id_id_canonical`);
    await queryRunner.query(`ALTER INDEX idx_events_tenant_id RENAME TO idx_events_tenant_id_canonical`);
    await queryRunner.query(`ALTER INDEX idx_events_tenant_data RENAME TO idx_events_tenant_data_canonical`);
    await queryRunner.query(`ALTER INDEX idx_events_tenant_active RENAME TO idx_events_tenant_active_canonical`);
    await queryRunner.query(`ALTER INDEX idx_events_tenant_starts_at RENAME TO idx_events_tenant_starts_at_canonical`);

    await queryRunner.query(`ALTER TABLE events_restore RENAME TO events`);
    await queryRunner.query(`ALTER INDEX events_restore_pkey RENAME TO events_pkey`);
    await queryRunner.query(`ALTER TABLE events RENAME CONSTRAINT uq_events_tenant_id_id_restore TO uq_events_tenant_id_id`);
    await queryRunner.query(`ALTER INDEX idx_events_tenant_id_restore RENAME TO idx_events_tenant_id`);
    await queryRunner.query(`ALTER INDEX idx_events_tenant_data_restore RENAME TO idx_events_tenant_data`);
    await queryRunner.query(`ALTER INDEX idx_events_tenant_active_restore RENAME TO idx_events_tenant_active`);
    await queryRunner.query(`ALTER INDEX idx_events_tenant_starts_at_restore RENAME TO idx_events_tenant_starts_at`);

    await queryRunner.query(`ALTER TABLE financial_transactions ADD CONSTRAINT fk_fintx_event FOREIGN KEY (tenant_id, event_id) REFERENCES events(tenant_id, id)`);

    await queryRunner.query(`ALTER TABLE events ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE events FORCE ROW LEVEL SECURITY`);
    await queryRunner.query(`
      CREATE POLICY super_admin_full_access ON events
        AS PERMISSIVE FOR ALL TO authenticated
        USING (app_is_super_admin()) WITH CHECK (app_is_super_admin())
    `);
    await queryRunner.query(`
      CREATE POLICY tenant_isolation ON events
        AS PERMISSIVE FOR ALL TO authenticated
        USING (tenant_id = private_get_tenant_id()) WITH CHECK (tenant_id = private_get_tenant_id())
    `);

    await queryRunner.query(`ALTER TABLE events OWNER TO musicos_migrator`);
    await queryRunner.query(`GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON events TO musicos_migrator`);

    await queryRunner.query(`DROP TABLE events_canonical`);
    await queryRunner.query(`ANALYZE events`);
  }
}
