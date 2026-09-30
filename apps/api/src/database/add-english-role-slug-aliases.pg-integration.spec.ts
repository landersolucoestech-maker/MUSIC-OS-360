/**
 * Opt-in Postgres round trip for 20260930000001_AddEnglishRoleSlugAliases.
 *
 * Skipped unless RUN_PG_INTEGRATION=1 (never part of the default test run). Point PG_INTEGRATION_URL at a
 * DISPOSABLE Postgres database (superuser/BYPASSRLS): the suite DROPs and recreates schema "public".
 *
 *   RUN_PG_INTEGRATION=1 PG_INTEGRATION_URL=postgres://postgres@127.0.0.1:5432/postgres \
 *     npx jest src/database/add-english-role-slug-aliases.pg-integration.spec.ts
 *
 * Fixture: the real CreateRolesAndRolePermissions migration plus simplified org_members /
 * tenant_invitations / role_inheritance tables (not the full migration chain).
 */
import { Client } from 'pg';
import { CreateRolesAndRolePermissions20260610000002 } from './migrations/20260610000002_CreateRolesAndRolePermissions';
import { AddEnglishRoleSlugAliases20260930000001 } from './migrations/20260930000001_AddEnglishRoleSlugAliases';

const enabled = process.env.RUN_PG_INTEGRATION === '1' && !!process.env.PG_INTEGRATION_URL;
const AL = ['legal', 'sales', 'producer', 'collaborator', 'hr_manager'];

(enabled ? describe : describe.skip)('AddEnglishRoleSlugAliases (real Postgres)', () => {
  let c: Client;
  const runner = { query: async (s: string, p?: unknown[]) => (await c.query(s, p as never)).rows };
  const mig = new AddEnglishRoleSlugAliases20260930000001();
  let t1: string;
  let t2: string;

  const tx = async (fn: () => Promise<void>): Promise<string | null> => {
    await c.query('BEGIN');
    try {
      await fn();
      await c.query('COMMIT');
      return null;
    } catch (e) {
      await c.query('ROLLBACK');
      return (e as Error).message;
    }
  };
  const up = () => tx(() => mig.up(runner as never));
  const down = () => tx(() => mig.down(runner as never));
  const total = async () => (await c.query('select count(*)::int n from roles')).rows[0].n as number;
  const reset = async () => {
    await c.query(`DELETE FROM org_members; DELETE FROM tenant_invitations; DELETE FROM role_permissions; DELETE FROM role_inheritance;`);
    await c.query(`DELETE FROM roles WHERE slug = ANY($1) OR tenant_id IS NOT NULL`, [AL]);
    await c.query(`UPDATE roles SET archived_at = NULL`);
  };
  const aliasRow = (slug: string) => c.query(`select is_assignable, archived_at from roles where slug=$1 and tenant_id is null and deleted_at is null`, [slug]);

  beforeAll(async () => {
    c = new Client({ connectionString: process.env.PG_INTEGRATION_URL });
    await c.connect();
    await c.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
    await c.query(`CREATE TABLE tenants (id uuid PRIMARY KEY DEFAULT gen_random_uuid()); CREATE TABLE permissions (id uuid PRIMARY KEY DEFAULT gen_random_uuid());`);
    await new CreateRolesAndRolePermissions20260610000002().up(runner as never);
    await c.query(`ALTER TABLE roles ADD COLUMN archived_at timestamptz;
      CREATE TABLE org_members (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, role varchar(50) NOT NULL, role_id uuid REFERENCES roles(id) ON DELETE RESTRICT);
      CREATE TABLE tenant_invitations (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), role_id uuid NOT NULL REFERENCES roles(id) ON DELETE RESTRICT);
      CREATE TABLE role_inheritance (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), child_role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE, parent_role_id uuid NOT NULL REFERENCES roles(id) ON DELETE RESTRICT);`);
    t1 = (await c.query('insert into tenants default values returning id')).rows[0].id;
    t2 = (await c.query('insert into tenants default values returning id')).rows[0].id;
  });
  afterAll(async () => {
    await c?.end();
  });
  beforeEach(reset);

  it('baseline has 20 global roles', async () => expect(await total()).toBe(20));

  it('refuses an archived tenant custom role with an alias slug', async () => {
    await c.query(`insert into roles(tenant_id,slug,name,hierarchy_level,archived_at) values($1,'legal','x',5,now())`, [t1]);
    expect(await up()).toMatch(/tenant_custom_role/);
  });

  it('refuses a custom role in ANY tenant and writes nothing', async () => {
    await c.query(`insert into roles(tenant_id,slug,name,hierarchy_level) values($1,'producer','x',5)`, [t2]);
    expect(await up()).toMatch(/producer:tenant_custom_role=1/);
    expect(await total()).toBe(21);
  });

  it('ignores a soft-deleted global row and creates 5 live inert aliases', async () => {
    await c.query(`insert into roles(tenant_id,slug,name,hierarchy_level,deleted_at) values(NULL,'sales','x',45,now())`);
    expect(await up()).toBeNull();
    expect((await c.query(`select count(*)::int n from roles where slug=any($1) and deleted_at is null and is_assignable=false`, [AL])).rows[0].n).toBe(5);
  });

  it('MINOR-2: a pre-existing exact alias with is_assignable=true is forced to false', async () => {
    await c.query(`insert into roles(tenant_id,slug,name,hierarchy_level,canonical_role_id,is_system,is_assignable) select NULL,'sales',name,hierarchy_level,id,true,true from roles where slug='comercial' and tenant_id is null`);
    expect(await up()).toBeNull();
    expect((await aliasRow('sales')).rows[0].is_assignable).toBe(false);
  });

  it('MINOR-2: a pre-existing archived exact alias is un-archived and inert', async () => {
    await c.query(`insert into roles(tenant_id,slug,name,hierarchy_level,canonical_role_id,is_system,is_assignable,archived_at) select NULL,'sales',name,hierarchy_level,id,true,true,now() from roles where slug='comercial' and tenant_id is null`);
    expect(await up()).toBeNull();
    const row = (await aliasRow('sales')).rows[0];
    expect(row.is_assignable).toBe(false);
    expect(row.archived_at).toBeNull();
  });

  it('the repair never touches tenant-scoped rows or non-alias global roles', async () => {
    await up();
    await c.query(`update roles set is_assignable=true where slug='admin' and tenant_id is null`);
    expect(await up()).toBeNull();
    expect((await c.query(`select is_assignable from roles where slug='admin' and tenant_id is null`)).rows[0].is_assignable).toBe(true);
  });

  it('second up() is a no-op; down() refuses when an alias has role_permissions', async () => {
    expect(await up()).toBeNull();
    const sid = (await c.query(`select id from roles where slug='sales'`)).rows[0].id;
    const p = (await c.query('insert into permissions default values returning id')).rows[0].id;
    await c.query('insert into role_permissions(role_id,permission_id) values($1,$2)', [sid, p]);
    expect(await up()).toBeNull();
    expect(await down()).toMatch(/role_permissions/);
  });

  it('refuses a member holding an English slug in another tenant', async () => {
    await c.query(`insert into org_members(tenant_id,role) values($1,'hr_manager')`, [t2]);
    expect(await up()).toMatch(/hr_manager:org_members.role=1/);
  });

  it('refuses a global alias with a mismatched level and a global non-alias row', async () => {
    await c.query(`insert into roles(tenant_id,slug,name,hierarchy_level,canonical_role_id) select NULL,'legal',name,99,id from roles where slug='juridico' and tenant_id is null`);
    expect(await up()).toMatch(/global_row_not_expected_alias/);
    await reset();
    await c.query(`insert into roles(tenant_id,slug,name,hierarchy_level) values(NULL,'legal','x',55)`);
    expect(await up()).toMatch(/global_row_not_expected_alias/);
  });

  it('refuses a role without BYPASSRLS', async () => {
    await c.query(`DROP ROLE IF EXISTS lowpriv_alias_it; CREATE ROLE lowpriv_alias_it NOSUPERUSER NOBYPASSRLS LOGIN; GRANT ALL ON ALL TABLES IN SCHEMA public TO lowpriv_alias_it;`);
    await c.query('BEGIN');
    await c.query('SET LOCAL ROLE lowpriv_alias_it');
    let msg: string | null = null;
    try {
      await mig.up(runner as never);
    } catch (e) {
      msg = (e as Error).message;
    }
    await c.query('ROLLBACK');
    await c.query('DROP OWNED BY lowpriv_alias_it; DROP ROLE lowpriv_alias_it;');
    expect(msg).toBeTruthy();
  });

  it('up / second up / down / up round trip: 25 / 25 / 20 / 25 roles', async () => {
    expect(await up()).toBeNull();
    expect(await total()).toBe(25);
    expect(await up()).toBeNull();
    expect(await total()).toBe(25);
    expect(await down()).toBeNull();
    expect(await total()).toBe(20);
    expect(await up()).toBeNull();
    expect(await total()).toBe(25);
  });
});
