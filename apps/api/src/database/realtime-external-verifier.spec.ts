import { evaluateRealtimeState, type RealtimePolicyRow } from './realtime-external-verifier';

const CANONICAL_TENANT_POLICY: RealtimePolicyRow = {
  policyname: 'tenant_can_receive_broadcast',
  roles: ['authenticated'],
  cmd: 'SELECT',
  qual: "((realtime.messages.extension = 'broadcast'::text) AND (realtime.topic() = (('tenant:'::text || (((auth.jwt() -> 'app_metadata'::text) ->> 'org_id'::text)))))",
  with_check: null,
};

const CANONICAL_USER_POLICY: RealtimePolicyRow = {
  policyname: 'user_can_receive_own_broadcast',
  roles: ['authenticated'],
  cmd: 'SELECT',
  qual: "((realtime.messages.extension = 'broadcast'::text) AND (realtime.topic() = ('user:'::text || ((auth.jwt() ->> 'sub'::text)))))",
  with_check: null,
};

describe('evaluateRealtimeState', () => {
  it('APPLIED_AND_VERIFIED: RLS enabled, both canonical policies with correct predicates', () => {
    const result = evaluateRealtimeState({
      tableExists: true,
      rlsEnabled: true,
      owner: 'supabase_realtime_admin',
      currentUser: 'postgres',
      policies: [CANONICAL_TENANT_POLICY, CANONICAL_USER_POLICY],
    });
    expect(result.state).toBe('APPLIED_AND_VERIFIED');
  });

  it('PENDING_EXTERNAL_PRIVILEGE: RLS disabled, no policy, role is not owner (real case confirmed in Part 72)', () => {
    const result = evaluateRealtimeState({
      tableExists: true,
      rlsEnabled: false,
      owner: 'supabase_realtime_admin',
      currentUser: 'postgres',
      policies: [],
    });
    expect(result.state).toBe('PENDING_EXTERNAL_PRIVILEGE');
    expect(result.reason).toContain('não é a owner');
  });

  it('PENDING_EXTERNAL_PRIVILEGE: RLS disabled, no policy, even when the role is already owner (just not applied yet)', () => {
    const result = evaluateRealtimeState({
      tableExists: true,
      rlsEnabled: false,
      owner: 'postgres',
      currentUser: 'postgres',
      policies: [],
    });
    expect(result.state).toBe('PENDING_EXTERNAL_PRIVILEGE');
    expect(result.reason).toContain('ainda não foi aplicada');
  });

  it('PENDING_EXTERNAL_PRIVILEGE: RLS already enabled by Supabase default but no policy yet (real case confirmed against Supabase DEV in Part 72 — not DRIFT)', () => {
    const result = evaluateRealtimeState({
      tableExists: true,
      rlsEnabled: true,
      owner: 'supabase_realtime_admin',
      currentUser: 'postgres',
      policies: [],
    });
    expect(result.state).toBe('PENDING_EXTERNAL_PRIVILEGE');
  });

  it('UNSAFE_PUBLIC_ACCESS: any policy with USING (true), even when the others are correct', () => {
    const result = evaluateRealtimeState({
      tableExists: true,
      rlsEnabled: true,
      owner: 'supabase_realtime_admin',
      currentUser: 'postgres',
      policies: [CANONICAL_TENANT_POLICY, { ...CANONICAL_USER_POLICY, qual: 'true' }],
    });
    expect(result.state).toBe('UNSAFE_PUBLIC_ACCESS');
  });

  it('DRIFT: RLS enabled but one of the two canonical policies is missing', () => {
    const result = evaluateRealtimeState({
      tableExists: true,
      rlsEnabled: true,
      owner: 'supabase_realtime_admin',
      currentUser: 'postgres',
      policies: [CANONICAL_TENANT_POLICY],
    });
    expect(result.state).toBe('DRIFT');
  });

  it('DRIFT: RLS enabled with an extra unrecognized policy', () => {
    const result = evaluateRealtimeState({
      tableExists: true,
      rlsEnabled: true,
      owner: 'supabase_realtime_admin',
      currentUser: 'postgres',
      policies: [CANONICAL_TENANT_POLICY, CANONICAL_USER_POLICY, { policyname: 'algo_inesperado', roles: [], cmd: 'SELECT', qual: 'x = 1', with_check: null }],
    });
    expect(result.state).toBe('DRIFT');
  });

  it('DRIFT: policies exist but RLS is disabled (inconsistent state)', () => {
    const result = evaluateRealtimeState({
      tableExists: true,
      rlsEnabled: false,
      owner: 'supabase_realtime_admin',
      currentUser: 'postgres',
      policies: [CANONICAL_TENANT_POLICY, CANONICAL_USER_POLICY],
    });
    expect(result.state).toBe('DRIFT');
  });

  it('INVALID_POLICY: nomes corretos mas predicado divergente (ex.: comparando org_id errado)', () => {
    const result = evaluateRealtimeState({
      tableExists: true,
      rlsEnabled: true,
      owner: 'supabase_realtime_admin',
      currentUser: 'postgres',
      policies: [
        { ...CANONICAL_TENANT_POLICY, qual: "realtime.messages.extension = 'broadcast'" }, // falta 'tenant:'/'app_metadata'/'org_id'
        CANONICAL_USER_POLICY,
      ],
    });
    expect(result.state).toBe('INVALID_POLICY');
  });

  it('throws a clear error when the table does not exist — never fakes one of the 5 states in that case', () => {
    expect(() => evaluateRealtimeState({
      tableExists: false,
      rlsEnabled: false,
      owner: '',
      currentUser: '',
      policies: [],
    })).toThrow(/não existe neste projeto/);
  });
});
