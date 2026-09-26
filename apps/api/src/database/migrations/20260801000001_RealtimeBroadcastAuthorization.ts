import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 20260801000001_RealtimeBroadcastAuthorization  (Part 66 — WS→Supabase Realtime)
 *
 * Replaces the Socket.IO WsGateway with Supabase Realtime Broadcast, since
 * Vercel Functions cannot hold a persistent WebSocket connection between
 * invocations. Realtime enforces access to a channel topic via RLS policies
 * on `realtime.messages` (see https://supabase.com/docs/guides/realtime/authorization) —
 * Postgres itself decides who may join `tenant:<org_id>` / `user:<sub>`.
 *
 * Topic naming preserves exactly what WsGateway used for its Socket.IO rooms
 * (`tenant:${org_id}`, `user:${sub}` — see core/websocket/ws.gateway.ts),
 * so the JWT claim path is identical to every other RLS policy in this
 * project: `auth.jwt()->'app_metadata'->>'org_id'` (see
 * 20260520000020_RLSPolicies's private_get_tenant_id()).
 *
 * Only a SELECT (receive) policy is added — no INSERT (send) policy. All
 * broadcasts are sent server-side by the API using the service_role key,
 * which bypasses RLS entirely; no client (in the old Socket.IO model or
 * this one) is ever authorized to emit a domain event directly. This is
 * strictly narrower than the old model, not equivalent-or-wider.
 *
 * Requires "Allow public access" to be disabled in Supabase Dashboard →
 * Project Settings → Realtime for these policies to actually be enforced
 * (a project-level toggle with no SQL/Management-API equivalent exposed to
 * this migration) — tracked as a manual, per-project step in
 * docs/STAGING_ARCHITECTURE.md; without it, "private" channels silently
 * degrade to public and this migration's RLS has no effect.
 */
export class RealtimeBroadcastAuthorization20260801000001 implements MigrationInterface {
  name = 'RealtimeBroadcastAuthorization20260801000001';

  async up(qr: QueryRunner): Promise<void> {
    await qr.query(`ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY`);

    await qr.query(`DROP POLICY IF EXISTS "tenant_can_receive_broadcast" ON realtime.messages`);
    await qr.query(`
      CREATE POLICY "tenant_can_receive_broadcast" ON realtime.messages
      FOR SELECT TO authenticated
      USING (
        realtime.messages.extension = 'broadcast'
        AND realtime.topic() = 'tenant:' || (auth.jwt()->'app_metadata'->>'org_id')
      )
    `);

    await qr.query(`DROP POLICY IF EXISTS "user_can_receive_own_broadcast" ON realtime.messages`);
    await qr.query(`
      CREATE POLICY "user_can_receive_own_broadcast" ON realtime.messages
      FOR SELECT TO authenticated
      USING (
        realtime.messages.extension = 'broadcast'
        AND realtime.topic() = 'user:' || (auth.jwt()->>'sub')
      )
    `);
  }

  async down(qr: QueryRunner): Promise<void> {
    await qr.query(`DROP POLICY IF EXISTS "user_can_receive_own_broadcast" ON realtime.messages`);
    await qr.query(`DROP POLICY IF EXISTS "tenant_can_receive_broadcast" ON realtime.messages`);
    await qr.query(`ALTER TABLE realtime.messages DISABLE ROW LEVEL SECURITY`);
  }
}
