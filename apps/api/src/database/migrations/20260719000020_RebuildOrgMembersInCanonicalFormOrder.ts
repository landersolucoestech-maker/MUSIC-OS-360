import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Physical rebuild of `org_members` — 2026-07-19 audit.
 *
 * There is no real creation form: members are created via the
 * invite flow (`UsersService.invite()` → Supabase auth admin + `create()`) and via
 * workspace bootstrap (`tenant-bootstrap.resolver.ts`,
 * `workspace-provisioning.service.ts`, `dev-auth.controller.ts`). The
 * `UsuarioFormModal.tsx` screen today only EDITS (full_name/phone/role) and the
 * `useUsuarios.ts` hook still uses `storage.ts` (in-memory mock) instead of the
 * real `UsersService` — a pre-existing wiring gap, recorded as
 * pending, out of scope for this physical rebuild (which follows the
 * real backend contract: `CreateUserDto`/`UsersService.create()`).
 *
 * Canonical order: `phone` (added later via an isolated migration, stuck
 * after the audit block) goes back to the functional zone, next to
 * email/full_name. `role` is the legacy slug still read by
 * `UsersService.list()` — kept functional. `role_id`/`department_id`/
 * `position_id` are technical (FK) provisioning relations
 * (roles/departments/positions), without a visual field — technical zone. `org_id`
 * is a technical relation (no declared FK — a pre-existing gap, not
 * invented here). `joined_at` is a business timestamp set by the
 * bootstrap, not by the user. Audit block fixed to
 * `created_at, updated_at, created_by, updated_by, deleted_at`. Zero
 * columns removed — all proven to be written by real code
 * (service, bootstrap resolver or dev-auth).
 */
export class RebuildOrgMembersInCanonicalFormOrder20260719000020 implements MigrationInterface {
  name = 'RebuildOrgMembersInCanonicalFormOrder20260719000020';

  private readonly newColumns = `
    id             uuid NOT NULL DEFAULT gen_random_uuid(),
    tenant_id      uuid NOT NULL,
    auth_user_id   varchar NOT NULL,
    email          varchar NOT NULL,
    full_name      varchar,
    phone          varchar,
    role           varchar NOT NULL DEFAULT 'viewer',
    is_active      boolean NOT NULL DEFAULT true,
    org_id         uuid NOT NULL,
    role_id        uuid,
    department_id  uuid,
    position_id    uuid,
    joined_at      timestamp,
    created_at     timestamp NOT NULL DEFAULT now(),
    updated_at     timestamp NOT NULL DEFAULT now(),
    created_by     uuid,
    updated_by     uuid,
    deleted_at     timestamptz
  `;

  private readonly copyColumns = [
    'id', 'tenant_id', 'auth_user_id', 'email', 'full_name', 'phone', 'role', 'is_active',
    'org_id', 'role_id', 'department_id', 'position_id', 'joined_at',
    'created_at', 'updated_at', 'created_by', 'updated_by', 'deleted_at',
  ].join(', ');

  public async up(queryRunner: QueryRunner): Promise<void> {
    const [{ total }] = await queryRunner.query(`SELECT count(*)::int AS total FROM org_members`);

    await queryRunner.query(`CREATE TABLE org_members_new (${this.newColumns})`);
    await queryRunner.query(`INSERT INTO org_members_new (${this.copyColumns}) SELECT ${this.copyColumns} FROM org_members`);

    const [{ c: newCount }] = await queryRunner.query(`SELECT count(*)::int AS c FROM org_members_new`);
    if (Number(newCount) !== Number(total)) {
      throw new Error(`RebuildOrgMembersInCanonicalFormOrder: count mismatch (original=${total}, new=${newCount}) — aborted.`);
    }

    await queryRunner.query(`ALTER TABLE org_members_new ADD CONSTRAINT org_members_new_pkey PRIMARY KEY (id)`);
    await queryRunner.query(`ALTER TABLE org_members_new ADD CONSTRAINT fk_org_members_role_new FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE RESTRICT`);
    await queryRunner.query(`ALTER TABLE org_members_new ADD CONSTRAINT fk_org_members_department_new FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL`);
    await queryRunner.query(`ALTER TABLE org_members_new ADD CONSTRAINT fk_org_members_position_new FOREIGN KEY (position_id) REFERENCES positions(id) ON DELETE SET NULL`);
    await queryRunner.query(`ALTER TABLE org_members_new ADD CONSTRAINT org_members_new_tenant_id_auth_user_id_key UNIQUE (tenant_id, auth_user_id)`);
    await queryRunner.query(`CREATE INDEX idx_org_members_department_id_new ON org_members_new (department_id)`);
    await queryRunner.query(`CREATE INDEX idx_org_members_position_id_new ON org_members_new (position_id)`);
    await queryRunner.query(`CREATE INDEX idx_org_members_role_id_new ON org_members_new (role_id)`);
    await queryRunner.query(`CREATE INDEX idx_org_members_tenant_id_new ON org_members_new (tenant_id)`);
    await queryRunner.query(`CREATE INDEX member_auth_user_idx_new ON org_members_new (auth_user_id)`);
    await queryRunner.query(`CREATE UNIQUE INDEX member_tenant_user_idx_new ON org_members_new (tenant_id, auth_user_id)`);

    // The dependent FK must be dropped before the rename dance.
    await queryRunner.query(`ALTER TABLE membership_job_functions DROP CONSTRAINT fk_mjf_membership`);

    await queryRunner.query(`ALTER TABLE org_members RENAME TO org_members_old`);
    await queryRunner.query(`ALTER TABLE org_members_old RENAME CONSTRAINT org_members_pkey TO org_members_old_pkey`);
    await queryRunner.query(`ALTER TABLE org_members_old RENAME CONSTRAINT fk_org_members_role TO fk_org_members_role_old`);
    await queryRunner.query(`ALTER TABLE org_members_old RENAME CONSTRAINT fk_org_members_department TO fk_org_members_department_old`);
    await queryRunner.query(`ALTER TABLE org_members_old RENAME CONSTRAINT fk_org_members_position TO fk_org_members_position_old`);
    await queryRunner.query(`ALTER TABLE org_members_old RENAME CONSTRAINT org_members_tenant_id_auth_user_id_key TO org_members_old_tenant_id_auth_user_id_key`);
    await queryRunner.query(`ALTER INDEX idx_org_members_department_id RENAME TO idx_org_members_department_id_old`);
    await queryRunner.query(`ALTER INDEX idx_org_members_position_id RENAME TO idx_org_members_position_id_old`);
    await queryRunner.query(`ALTER INDEX idx_org_members_role_id RENAME TO idx_org_members_role_id_old`);
    await queryRunner.query(`ALTER INDEX idx_org_members_tenant_id RENAME TO idx_org_members_tenant_id_old`);
    await queryRunner.query(`ALTER INDEX member_auth_user_idx RENAME TO member_auth_user_idx_old`);
    await queryRunner.query(`ALTER INDEX member_tenant_user_idx RENAME TO member_tenant_user_idx_old`);

    await queryRunner.query(`ALTER TABLE org_members_new RENAME TO org_members`);
    await queryRunner.query(`ALTER INDEX org_members_new_pkey RENAME TO org_members_pkey`);
    await queryRunner.query(`ALTER TABLE org_members RENAME CONSTRAINT fk_org_members_role_new TO fk_org_members_role`);
    await queryRunner.query(`ALTER TABLE org_members RENAME CONSTRAINT fk_org_members_department_new TO fk_org_members_department`);
    await queryRunner.query(`ALTER TABLE org_members RENAME CONSTRAINT fk_org_members_position_new TO fk_org_members_position`);
    await queryRunner.query(`ALTER TABLE org_members RENAME CONSTRAINT org_members_new_tenant_id_auth_user_id_key TO org_members_tenant_id_auth_user_id_key`);
    await queryRunner.query(`ALTER INDEX idx_org_members_department_id_new RENAME TO idx_org_members_department_id`);
    await queryRunner.query(`ALTER INDEX idx_org_members_position_id_new RENAME TO idx_org_members_position_id`);
    await queryRunner.query(`ALTER INDEX idx_org_members_role_id_new RENAME TO idx_org_members_role_id`);
    await queryRunner.query(`ALTER INDEX idx_org_members_tenant_id_new RENAME TO idx_org_members_tenant_id`);
    await queryRunner.query(`ALTER INDEX member_auth_user_idx_new RENAME TO member_auth_user_idx`);
    await queryRunner.query(`ALTER INDEX member_tenant_user_idx_new RENAME TO member_tenant_user_idx`);

    await queryRunner.query(`ALTER TABLE membership_job_functions ADD CONSTRAINT fk_mjf_membership FOREIGN KEY (membership_id) REFERENCES org_members(id) ON DELETE CASCADE`);

    await queryRunner.query(`ALTER TABLE org_members ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE org_members FORCE ROW LEVEL SECURITY`);
    await queryRunner.query(`
      CREATE POLICY tenant_isolation ON org_members
        AS PERMISSIVE FOR ALL TO authenticated
        USING (tenant_id = private_get_tenant_id()) WITH CHECK (tenant_id = private_get_tenant_id())
    `);
    await queryRunner.query(`
      CREATE POLICY super_admin_full_access ON org_members
        AS PERMISSIVE FOR ALL TO authenticated
        USING (app_is_super_admin()) WITH CHECK (app_is_super_admin())
    `);

    await queryRunner.query(`ALTER TABLE org_members OWNER TO musicos_migrator`);
    await queryRunner.query(`GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON org_members TO musicos_migrator`);

    await queryRunner.query(`DROP TABLE org_members_old`);
    await queryRunner.query(`ANALYZE org_members`);
  }

  private readonly originalColumns = `
    id             uuid NOT NULL DEFAULT gen_random_uuid(),
    org_id         uuid NOT NULL,
    tenant_id      uuid NOT NULL,
    auth_user_id   varchar NOT NULL,
    email          varchar NOT NULL,
    full_name      varchar,
    role           varchar NOT NULL DEFAULT 'viewer',
    is_active      boolean NOT NULL DEFAULT true,
    joined_at      timestamp,
    created_at     timestamp NOT NULL DEFAULT now(),
    updated_at     timestamp NOT NULL DEFAULT now(),
    role_id        uuid,
    department_id  uuid,
    position_id    uuid,
    deleted_at     timestamptz,
    created_by     uuid,
    updated_by     uuid,
    phone          varchar
  `;

  public async down(queryRunner: QueryRunner): Promise<void> {
    const [{ total }] = await queryRunner.query(`SELECT count(*)::int AS total FROM org_members`);

    await queryRunner.query(`CREATE TABLE org_members_restore (${this.originalColumns})`);
    await queryRunner.query(`INSERT INTO org_members_restore (${this.copyColumns}) SELECT ${this.copyColumns} FROM org_members`);

    const [{ c: restoredCount }] = await queryRunner.query(`SELECT count(*)::int AS c FROM org_members_restore`);
    if (Number(restoredCount) !== Number(total)) {
      throw new Error(`RebuildOrgMembersInCanonicalFormOrder.down: count mismatch (original=${total}, restored=${restoredCount}) — aborted.`);
    }

    await queryRunner.query(`ALTER TABLE org_members_restore ADD CONSTRAINT org_members_restore_pkey PRIMARY KEY (id)`);
    await queryRunner.query(`ALTER TABLE org_members_restore ADD CONSTRAINT fk_org_members_role_restore FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE RESTRICT`);
    await queryRunner.query(`ALTER TABLE org_members_restore ADD CONSTRAINT fk_org_members_department_restore FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL`);
    await queryRunner.query(`ALTER TABLE org_members_restore ADD CONSTRAINT fk_org_members_position_restore FOREIGN KEY (position_id) REFERENCES positions(id) ON DELETE SET NULL`);
    await queryRunner.query(`ALTER TABLE org_members_restore ADD CONSTRAINT org_members_restore_tenant_id_auth_user_id_key UNIQUE (tenant_id, auth_user_id)`);
    await queryRunner.query(`CREATE INDEX idx_org_members_department_id_restore ON org_members_restore (department_id)`);
    await queryRunner.query(`CREATE INDEX idx_org_members_position_id_restore ON org_members_restore (position_id)`);
    await queryRunner.query(`CREATE INDEX idx_org_members_role_id_restore ON org_members_restore (role_id)`);
    await queryRunner.query(`CREATE INDEX idx_org_members_tenant_id_restore ON org_members_restore (tenant_id)`);
    await queryRunner.query(`CREATE INDEX member_auth_user_idx_restore ON org_members_restore (auth_user_id)`);
    await queryRunner.query(`CREATE UNIQUE INDEX member_tenant_user_idx_restore ON org_members_restore (tenant_id, auth_user_id)`);

    await queryRunner.query(`ALTER TABLE membership_job_functions DROP CONSTRAINT fk_mjf_membership`);

    await queryRunner.query(`ALTER TABLE org_members RENAME TO org_members_canonical`);
    await queryRunner.query(`ALTER TABLE org_members_canonical RENAME CONSTRAINT org_members_pkey TO org_members_canonical_pkey`);
    await queryRunner.query(`ALTER TABLE org_members_canonical RENAME CONSTRAINT fk_org_members_role TO fk_org_members_role_canonical`);
    await queryRunner.query(`ALTER TABLE org_members_canonical RENAME CONSTRAINT fk_org_members_department TO fk_org_members_department_canonical`);
    await queryRunner.query(`ALTER TABLE org_members_canonical RENAME CONSTRAINT fk_org_members_position TO fk_org_members_position_canonical`);
    await queryRunner.query(`ALTER TABLE org_members_canonical RENAME CONSTRAINT org_members_tenant_id_auth_user_id_key TO org_members_canonical_tenant_id_auth_user_id_key`);
    await queryRunner.query(`ALTER INDEX idx_org_members_department_id RENAME TO idx_org_members_department_id_canonical`);
    await queryRunner.query(`ALTER INDEX idx_org_members_position_id RENAME TO idx_org_members_position_id_canonical`);
    await queryRunner.query(`ALTER INDEX idx_org_members_role_id RENAME TO idx_org_members_role_id_canonical`);
    await queryRunner.query(`ALTER INDEX idx_org_members_tenant_id RENAME TO idx_org_members_tenant_id_canonical`);
    await queryRunner.query(`ALTER INDEX member_auth_user_idx RENAME TO member_auth_user_idx_canonical`);
    await queryRunner.query(`ALTER INDEX member_tenant_user_idx RENAME TO member_tenant_user_idx_canonical`);

    await queryRunner.query(`ALTER TABLE org_members_restore RENAME TO org_members`);
    await queryRunner.query(`ALTER INDEX org_members_restore_pkey RENAME TO org_members_pkey`);
    await queryRunner.query(`ALTER TABLE org_members RENAME CONSTRAINT fk_org_members_role_restore TO fk_org_members_role`);
    await queryRunner.query(`ALTER TABLE org_members RENAME CONSTRAINT fk_org_members_department_restore TO fk_org_members_department`);
    await queryRunner.query(`ALTER TABLE org_members RENAME CONSTRAINT fk_org_members_position_restore TO fk_org_members_position`);
    await queryRunner.query(`ALTER TABLE org_members RENAME CONSTRAINT org_members_restore_tenant_id_auth_user_id_key TO org_members_tenant_id_auth_user_id_key`);
    await queryRunner.query(`ALTER INDEX idx_org_members_department_id_restore RENAME TO idx_org_members_department_id`);
    await queryRunner.query(`ALTER INDEX idx_org_members_position_id_restore RENAME TO idx_org_members_position_id`);
    await queryRunner.query(`ALTER INDEX idx_org_members_role_id_restore RENAME TO idx_org_members_role_id`);
    await queryRunner.query(`ALTER INDEX idx_org_members_tenant_id_restore RENAME TO idx_org_members_tenant_id`);
    await queryRunner.query(`ALTER INDEX member_auth_user_idx_restore RENAME TO member_auth_user_idx`);
    await queryRunner.query(`ALTER INDEX member_tenant_user_idx_restore RENAME TO member_tenant_user_idx`);

    await queryRunner.query(`ALTER TABLE membership_job_functions ADD CONSTRAINT fk_mjf_membership FOREIGN KEY (membership_id) REFERENCES org_members(id) ON DELETE CASCADE`);

    await queryRunner.query(`ALTER TABLE org_members ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE org_members FORCE ROW LEVEL SECURITY`);
    await queryRunner.query(`
      CREATE POLICY tenant_isolation ON org_members
        AS PERMISSIVE FOR ALL TO authenticated
        USING (tenant_id = private_get_tenant_id()) WITH CHECK (tenant_id = private_get_tenant_id())
    `);
    await queryRunner.query(`
      CREATE POLICY super_admin_full_access ON org_members
        AS PERMISSIVE FOR ALL TO authenticated
        USING (app_is_super_admin()) WITH CHECK (app_is_super_admin())
    `);

    await queryRunner.query(`ALTER TABLE org_members OWNER TO musicos_migrator`);
    await queryRunner.query(`GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON org_members TO musicos_migrator`);

    await queryRunner.query(`DROP TABLE org_members_canonical`);
    await queryRunner.query(`ANALYZE org_members`);
  }
}
