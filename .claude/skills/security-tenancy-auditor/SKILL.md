---
name: security-tenancy-auditor
description: Proves end-to-end multi-tenant isolation for a named resource/flow by tracing the full auth-to-RLS chain and every async/cache/webhook side path, with explicit tenant-A-vs-tenant-B negative tests. Use whenever a new resource, background job, cache key, webhook, or cross-entity relation is added or changed, and before treating any "tenant isolation looks fine" claim as proven rather than assumed. Complements security-audit (generic scope-agnostic orchestration) with a fixed, mandatory trace and ten specific tenancy invariants that no generic security pass enumerates on its own.
---

# Security & Tenancy Auditor

## When to trigger

- A new resource/table/entity is added, or an existing one gains a new read/write path.
- A background job, queue processor, cron, webhook handler, cache layer, WebSocket channel, export,
  report, or file/storage path touches tenant-owned data.
- `database-reviewer` or `security-reviewer` flags a possible cross-tenant read/write.
- Before closing any finding that claims "tenant isolation is enforced" without a negative test.

## When NOT to trigger

- A change confined to a single tenant-agnostic global resource with no tenant column and no
  tenant-scoped consumer (verify this first — don't assume "global" from the name alone).
- Pure UI copy/styling changes with no new data path.

## Scope / non-goals

In scope: everything a request, job, or job-like async unit touches from authentication through to
the database. Not in scope: fixing an unrelated bug found along the way — record it as a finding
(category G — security, `.claude/contracts/finding-record.schema.json`) for
`implementation-engineer` instead of fixing it inline, unless it's the one thing this audit was
invoked to fix.

## Mandatory trace

```
AUTH -> SESSION/CLAIMS -> TENANT RESOLUTION -> CONTROLLER/ENTRY POINT -> SERVICE/USE CASE
     -> REPOSITORY -> QUERY -> DATABASE -> RLS
```

Also trace, when the resource/flow touches them: background workers, queues, cron jobs, webhook
handlers, caches, event consumers, WebSocket channels, exports/reports, file/storage ownership,
third-party integrations, jobs carrying a `tenantId` payload field, and relations between
tenant-owned entities (a FK/join that silently crosses a tenant boundary is as real a leak as a
missing `WHERE tenant_id =`).

## Invariants

1. Client-supplied input can never silently override the authenticated tenant identity.
2. Every tenant-owned entity is isolated on both the read path and the write path.
3. RLS existing on a table is not proof of anything by itself — confirm the policy is actually
   tenant-scoped (`USING`/`WITH CHECK` referencing the real tenant predicate) and that the
   connection used on the hot path actually engages it (a superuser-owned table bypasses `FORCE
   ROW LEVEL SECURITY`; a session-context flag that's off makes the policy a no-op even if it
   textually exists — check the real, currently-configured value for the environment under review,
   not the code-level default).
4. A join/FK between two tenant-owned entities must not let one tenant reach another's row through
   the relation, even if the direct query is correctly scoped.
5. A cache key for tenant-specific data must include tenant context; a key collision across tenants
   is a cross-tenant leak with no query involved at all.
6. A background job must carry and re-validate tenant context when it runs — a job payload merely
   containing a `tenantId` field is not the same as the work actually running inside that tenant's
   context.
7. A webhook must resolve tenant identity from a trusted, server-side mapping (a stored
   customer/account/credential record), never from an arbitrary field in the inbound payload.
8. Global (platform-owned) resources and tenant-owned resources must be explicitly and
   unambiguously distinguished in code — a resource that is "usually" tenant-owned but has one
   untenanted row is a real risk, not an edge case to ignore.
9. Negative tests (tenant A cannot read/write tenant B's data via this path) must exist for every
   invariant above that applies to the resource in scope.
10. A confirmed cross-tenant read or write is CRITICAL, full stop — no severity negotiation.

## Method

1. Delegate `repo-intelligence`'s existing system map (or run it fresh if none exists) to identify
   the real tenant-resolution mechanism, RLS configuration, and async/cache/webhook infrastructure
   for this project — do not assume a pattern from another project matches
   (`.claude/rules/architecture.md`).
2. Walk the mandatory trace end to end for the resource/flow in scope. Use `cross-layer-impact` if
   the resource spans multiple layers you need to enumerate precisely.
3. For each invariant, record: the entity/resource, its owner model, the tenant-resolution
   producer, its consumers, the actual queries/tables involved, the RLS policy (if any) and whether
   its binding mechanism is actually active in the environment under review, relevant cache/job/
   webhook paths, and existing vs. missing negative tests.
4. Delegate `database-reviewer` for the RLS/query layer, `backend-reviewer` for
   controller/service/repository wiring, `distributed-systems-reviewer` for jobs/queues/cache,
   `architecture-reviewer` if a new tenant/security boundary pattern is being introduced, and
   `security-reviewer` for the overall authorization chain.
5. Hand any missing negative test to `test-strategy-engineer` to design, then `qa-engineer` or
   `implementation-engineer` to write, per each project's actual test-file ownership
   (`.claude/ownership.json`).
6. Delegate `adversarial-reviewer` to specifically try to find a bypass of every invariant above
   before this audit is considered closed for L3+ scope.

## Evidence and findings

Record every finding via `node .claude/runtime/ops.mjs finding add --category G --severity
<CRITICAL|HIGH|MEDIUM|LOW> ...` (category G = security per
`.claude/contracts/finding-record.schema.json`). Close each with `finding disposition --id <id>
--disposition <...>`. Attach real,
executed evidence via `node .claude/runtime/ops.mjs evidence run --cmd "<the actual negative
test>" --criterion <id>` — a negative test that passes because it never actually ran (a mocked-away
tenant boundary, a stubbed RLS check) is not evidence
(`.claude/rules/testing.md` "false-green prevention").

## Negative paths (must be exercised, not just described)

- Tenant A's authenticated session attempts to read/write tenant B's resource by ID.
- A job payload with tenant A's `tenantId` is processed while the worker's own context (if any) is
  tenant B's, or missing entirely.
- A webhook payload claims an account/customer identity that doesn't map to any tenant, or maps to
  a different tenant than the caller implies.
- A cache read for tenant A's key under contention with a concurrent write for tenant B's same
  logical resource.

## PASS / FAIL / BLOCKED

- **PASS**: every applicable invariant has a real, currently-passing negative test, recorded as
  fresh evidence bound to the current workspace fingerprint, and `adversarial-reviewer` found no
  bypass.
- **FAIL**: a confirmed cross-tenant read/write, or a negative test that doesn't actually exercise
  the boundary it claims to.
- **BLOCKED**: the environment needed to prove an invariant (a real Postgres connection to verify
  RLS, a staging deployment for a webhook test) is unavailable. Never record a PASS in place of
  missing evidence (`.claude/rules/evidence-governance.md`) — leave the criterion open and state the
  blocker explicitly.

## Output

Per resource/flow: entity, owner model, tenant-resolution producer, consumers, queries/tables,
RLS/policy state, cache/job/webhook paths, existing vs. missing negative tests, findings with
severity and evidence, and a verdict. Feed CRITICAL/HIGH findings into the mission's requirement/
criterion chain (`.claude/rules/requirements-traceability.md`) rather than leaving them as
free-floating prose.
