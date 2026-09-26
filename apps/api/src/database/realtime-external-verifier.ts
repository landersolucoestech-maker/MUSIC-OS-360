/**
 * realtime-external-verifier.ts  (Part 72)
 *
 * Pure logic evaluating the physical state of `realtime.messages` —
 * independent of the `musicos360_migrations` tracking table.
 * RealtimeBroadcastAuthorization20260801000001 is EXTERNAL_MANAGED (see
 * migration-classification.ts): its tracking row may never exist
 * even with the correct policies (applied manually via the Dashboard), and
 * a tracking expectation may exist without the physical effect actually
 * being there. This function never trusts the tracking table — it receives the
 * state already queried directly from pg_class/pg_policies (see
 * scripts/verify-realtime-external.ts, which does the real I/O).
 *
 * Pure function, testable without a database.
 */

export type RealtimeExternalState =
  | 'APPLIED_AND_VERIFIED'
  | 'PENDING_EXTERNAL_PRIVILEGE'
  | 'DRIFT'
  | 'UNSAFE_PUBLIC_ACCESS'
  | 'INVALID_POLICY';

export interface RealtimePolicyRow {
  policyname: string;
  roles: string[];
  cmd: string;
  qual: string | null;
  with_check: string | null;
}

export interface RealtimeStateInput {
  tableExists: boolean;
  rlsEnabled: boolean;
  owner: string;
  currentUser: string;
  policies: RealtimePolicyRow[];
}

export interface RealtimeStateResult {
  state: RealtimeExternalState;
  reason: string;
}

// Deliberately simple fragments: only the migration's string literals
// (20260801000001), which the Postgres deparser preserves verbatim
// regardless of how it formats the parentheses/casts of the surrounding jsonb
// operators. Matching against the whole operator expression would be fragile —
// pg_get_expr() may reformat it in ways that vary by Postgres
// version.
const EXPECTED_POLICIES: Record<string, { qualIncludes: string[] }> = {
  tenant_can_receive_broadcast: {
    qualIncludes: ["'broadcast'", "'tenant:'", "'app_metadata'", "'org_id'"],
  },
  user_can_receive_own_broadcast: {
    qualIncludes: ["'broadcast'", "'user:'", "'sub'"],
  },
};

export function evaluateRealtimeState(input: RealtimeStateInput): RealtimeStateResult {
  if (!input.tableExists) {
    throw new Error('realtime.messages does not exist in this project — confirm the project ref before interpreting any state.');
  }

  const publicPolicy = input.policies.find((p) => (p.qual ?? '').trim() === 'true');
  if (publicPolicy) {
    return { state: 'UNSAFE_PUBLIC_ACCESS', reason: `Policy "${publicPolicy.policyname}" usa USING (true) — acesso público a canais privados.` };
  }

  // No policy yet — the migration simply was not applied. This
  // holds regardless of rlsEnabled: Supabase provisions realtime.messages
  // with RLS already enabled by default (fail-closed) before any policy
  // exists (confirmed empirically in Part 72 against real DEV Supabase —
  // ALTER TABLE ENABLE ROW LEVEL SECURITY fails on ownership even though it is
  // already enabled, so "RLS=true, zero policies" is the normal initial
  // state, not a partially applied migration). Treating it as DRIFT
  // would classify Supabase's normal initial state as a regression.
  if (input.policies.length === 0) {
    const ownerNote = input.owner === input.currentUser
      ? 'a role de conexão já é a owner, mas a migration ainda não foi aplicada'
      : `a role de conexão ("${input.currentUser}") não é a owner ("${input.owner}") de realtime.messages`;
    return { state: 'PENDING_EXTERNAL_PRIVILEGE', reason: `Nenhuma policy (RLS=${input.rlsEnabled}) — ${ownerNote}.` };
  }

  const expectedNames = Object.keys(EXPECTED_POLICIES);
  const foundNames = input.policies.map((p) => p.policyname);
  const hasExactSet = expectedNames.length === foundNames.length && expectedNames.every((n) => foundNames.includes(n));

  if (!input.rlsEnabled || !hasExactSet) {
    return {
      state: 'DRIFT',
      reason: `Esperava RLS habilitada com exatamente as policies [${expectedNames.join(', ')}]; ` +
        `encontrado RLS=${input.rlsEnabled}, policies=[${foundNames.join(', ') || 'nenhuma'}].`,
    };
  }

  for (const policy of input.policies) {
    const expected = EXPECTED_POLICIES[policy.policyname];
    if (!expected) continue;
    const qual = policy.qual ?? '';
    const missing = expected.qualIncludes.filter((fragment) => !qual.includes(fragment));
    if (missing.length > 0) {
      return {
        state: 'INVALID_POLICY',
        reason: `Policy "${policy.policyname}" existe mas o predicado não contém: ${missing.join(' | ')}. Predicado atual: ${qual}`,
      };
    }
  }

  return { state: 'APPLIED_AND_VERIFIED', reason: 'RLS habilitada, exatamente as duas policies canônicas, predicados corretos, sem acesso público.' };
}
