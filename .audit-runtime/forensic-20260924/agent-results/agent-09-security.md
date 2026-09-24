# AGENT-09 — Security/Auth/Tenancy Local Audit

subagent_type: security-reviewer
input_snapshot: HEAD 8c477787c043bdf0ceecf9feafe27a17fc932a3c
tool_uses: 49
duration_ms: 529458
status: COMPLETED

## 1. Auth/tenant-resolution path traced precisely
JwtAuthGuard (apps/api/src/core/guards/auth.guard.ts): Bearer extraction :242-248, JWKS/ES256 verify with issuer+audience check :205-240. Tenant resolution EXACT: auth.guard.ts:179-185 -- orgId comes only from verified JWT app_metadata.org_id claim, never client input. Dev-token HS256 bypass at :158-171 gated by isProdLike(), cannot activate in prod/staging. TenantGuard (tenant.guard.ts:64-113) cross-checks X-Tenant-ID against JWT-resolved tenant and rejects on membership mismatch -- client header never trusted alone. Global guard chain (app.module.ts:250-283): RateLimitGuard -> JwtAuthGuard -> MustChangePasswordGuard -> TenantGuard -> BillingEnforcementGuard -> RolesGuard -> PermissionsGuard, applied globally via APP_GUARD.

## 2. Controller auth-guard coverage: real negative, proven
All 85 *.controller.ts files enumerated. Only opt-out is @Public() (12 files use it). Every @Public() route individually verified as deliberate and safe: HMAC-verified webhooks, /health, dev-auth (hard prod-gated), explicit public registration routes, OAuth callbacks protected by signed/expiring state tokens. Zero instances of a route accidentally missing a guard while siblings have one.

## 3. Background jobs/webhooks: fail-closed tenant handling, proven
ai-jobs.processor.ts:47-50 and external-data.processor.ts:32 fail-closed on missing job.data.tenantId, payloads only server-enqueued. WhatsApp webhook HMAC-verifies signature before resolving tenant server-side via phone number lookup (never client input). Stripe webhook signature-validated in BillingService. external-data.controller.ts has an explicit in-code comment stating tenant is never taken from a caller header. Autentique webhook secret-header-verified. No issue found across all checked entry points.

## 4. server/ai-proxy.ts: CONFIRMED independently, matches prior finding exactly
Wildcard CORS (line 131, every response including preflight), zero auth on both endpoints, OPENAI_API_KEY-billed calls gated by nothing. Repo-wide grep for the wildcard CORS pattern: exactly 1 source hit (this file) -- confirmed not a repo-wide pattern. Zero deployment reachability (same evidence as before: no docker-compose/Dockerfile/package.json/CI reference). Used the project's OWN real security tooling and evidence mechanism: recorded finding find-10c37104 (category G, severity HIGH) and a security-reviewer PASS evidence record evid-0ae53f86 in .claude/ops/state.json, per evidence-governance.md's sanctioned mechanism.

## 5. Hardcoded secrets: real scan run, one hit correctly triaged as false positive, zero real hits
Ran .claude/runtime/security-verification-engine.mjs (project's real secret-scan tool). One hit: apple-music.service.spec.ts:10, a synthetic EC test key with an explicit in-code comment stating it's not a real credential -- confirmed FALSE_POSITIVE by reading the file. Additional targeted grep for hardcoded *_KEY/*_SECRET/*_TOKEN/*_PASSWORD literals outside spec/mock files: zero hits. All credential access goes through ConfigService/process.env.
npm audit / OSV-Scanner: could not run (pnpm monorepo has no package-lock.json; OSV-Scanner skipped per networkAllowed:false policy) -- honestly flagged as a tooling/environment gap, not presented as a clean scan.

## Classification summary
- Auth/tenant resolution: VERIFIED CORRECT, real evidence
- Controller guard coverage: VERIFIED CLEAN (real negative, 85/85 checked)
- Job/webhook tenant sourcing: VERIFIED CLEAN
- server/ai-proxy.ts: CONFIRMED (matches prior finding, now also recorded in the project's own evidence ledger)
- Hardcoded secrets: VERIFIED CLEAN (1 false positive correctly triaged, 0 real hits)
- Dependency vulnerability scan: BLOCKED_EXTERNAL (no lockfile / network policy) -- new blocker, honestly disclosed
