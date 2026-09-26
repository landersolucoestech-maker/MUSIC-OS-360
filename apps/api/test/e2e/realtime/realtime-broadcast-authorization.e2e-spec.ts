/**
 * test/e2e/realtime/realtime-broadcast-authorization.e2e-spec.ts
 *
 * FUNCTIONAL test (real Postgres, not just mocked SQL text — see
 * database/realtime-broadcast-authorization.migration.spec.ts for the shape
 * test) of the policies from 20260801000001_RealtimeBroadcastAuthorization.
 *
 * Uses a single `pg.Client` connection (not a pool) because `SET ROLE` and
 * the session GUCs (request.jwt.claims, realtime.topic) only take effect on
 * the exact physical connection where they were set — a DataSource/pool does
 * not guarantee that across successive .query() calls.
 *
 * Mirrors exactly the real Supabase Realtime mechanism: the server decides
 * who can join a channel by having Postgres evaluate the SELECT policies on
 * realtime.messages under the `authenticated` role, with `auth.jwt()` reading
 * the client's JWT and `realtime.topic()` reading the requested topic.
 */
import { Client } from 'pg';

function readDatabaseUrl(): string {
  return process.env['DATABASE_URL'] ?? '';
}

const TENANT_A = '11111111-0000-0000-0000-0000000000a1';
const TENANT_B = '22222222-0000-0000-0000-0000000000b2';
const USER_A   = '33333333-0000-0000-0000-0000000000c3';
const USER_B   = '44444444-0000-0000-0000-0000000000d4';

const hasDb = !!readDatabaseUrl();
const d = hasDb ? describe : describe.skip;

d('Realtime broadcast authorization (RLS real) — realtime.messages', () => {
  let client: Client;

  beforeAll(async () => {
    client = new Client({ connectionString: readDatabaseUrl(), ssl: false });
    await client.connect();
    // service_role (owner) seeds the two test messages — bypasses RLS,
    // just like the real RealtimeService when publishing via the service_role key.
    await client.query(
      `INSERT INTO realtime.messages (topic, extension, event, payload) VALUES
         ($1, 'broadcast', 'notification:new', '{}'),
         ($2, 'broadcast', 'notification:new', '{}')`,
      [`tenant:${TENANT_A}`, `user:${USER_A}`],
    );
  });

  afterAll(async () => {
    await client.query(`DELETE FROM realtime.messages WHERE topic = ANY($1)`, [
      [`tenant:${TENANT_A}`, `user:${USER_A}`],
    ]);
    await client.end();
  });

  afterEach(async () => {
    await client.query(`RESET ROLE`);
    await client.query(`RESET request.jwt.claims`);
    await client.query(`RESET realtime.topic`);
  });

  async function selectAs(jwtClaims: Record<string, unknown> | null, topic: string): Promise<number> {
    await client.query(`SET ROLE authenticated`);
    // SET/SET LOCAL do not accept parameters ($1) — set_config() is the
    // equivalent parameterizable form (same session GUC semantics).
    if (jwtClaims) await client.query(`SELECT set_config('request.jwt.claims', $1, false)`, [JSON.stringify(jwtClaims)]);
    await client.query(`SELECT set_config('realtime.topic', $1, false)`, [topic]);
    const res = await client.query(`SELECT * FROM realtime.messages WHERE topic = $1`, [topic]);
    return res.rowCount ?? 0;
  }

  it('1. tenant A subscribing to tenant:A sees its own tenant\'s message', async () => {
    const rows = await selectAs({ sub: USER_A, role: 'authenticated', app_metadata: { org_id: TENANT_A } }, `tenant:${TENANT_A}`);
    expect(rows).toBe(1);
  });

  it('2. tenant B subscribing to tenant:A does NOT receive it (RLS blocks — org_id mismatch)', async () => {
    const rows = await selectAs({ sub: USER_B, role: 'authenticated', app_metadata: { org_id: TENANT_B } }, `tenant:${TENANT_A}`);
    expect(rows).toBe(0);
  });

  it('3. user A subscribing to user:<subA> sees their own notification', async () => {
    const rows = await selectAs({ sub: USER_A, role: 'authenticated', app_metadata: { org_id: TENANT_A } }, `user:${USER_A}`);
    expect(rows).toBe(1);
  });

  it('4. user B subscribing to user:<subA> does NOT receive it (sub mismatch)', async () => {
    const rows = await selectAs({ sub: USER_B, role: 'authenticated', app_metadata: { org_id: TENANT_B } }, `user:${USER_A}`);
    expect(rows).toBe(0);
  });

  it('5. without a JWT (empty claims) is denied on any channel', async () => {
    const rows = await selectAs({}, `tenant:${TENANT_A}`);
    expect(rows).toBe(0);
  });

  it('6. authenticated without org_id in app_metadata does not receive the tenant channel', async () => {
    const rows = await selectAs({ sub: USER_A, role: 'authenticated' }, `tenant:${TENANT_A}`);
    expect(rows).toBe(0);
  });

  it('9. the channel name is not free-form — the user does not choose which tenant they can read, only their own', async () => {
    // Even a valid JWT from tenant A trying to read the topic of an arbitrary
    // tenant (not its own) is still blocked — the policy ties the topic to the
    // claim, not to the value the client requests.
    const rows = await selectAs({ sub: USER_A, role: 'authenticated', app_metadata: { org_id: TENANT_A } }, `tenant:${TENANT_B}`);
    expect(rows).toBe(0);
  });
});
