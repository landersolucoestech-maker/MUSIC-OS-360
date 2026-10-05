# Feature Backlog

## External provider governance (2026-08-23) — DONE

`GET /integrations/providers` is the source of truth for the state of each **external provider**,
derived by the backend from real data (platform env + tenant credentials/OAuth +
health of the last call) and exposed as `ExternalProviderStatus`
(`dependency_not_met` / `available_not_connected` / `connected` / `requires_reauth` /
`provider_error`) in `@music-os-360/types`.

- Sources: `apps/api/src/modules/integrations/governance/integration-capability.registry.ts` (technical capability derived from the code) and `integration-policy.service.ts` (policy resolved from the persisted `platform_integrations` governance), exposed by `GET /integrations/providers`. The former `external-providers.catalog.ts` file no longer exists.
- It is **not** a catalog of platform features nor feature flags. Internal modules and
  infrastructure (internal AI, PostHog/Sentry, BullMQ/jobs, storage/uploads, internal finance/CRM/
  tickets/projects, OAuth infra) are explicitly out — a test locks this.
- Individual streaming does **not** come back as a configurable integration; Soundcharts is the governed
  provider for platform metrics. Also locked by a test.
- Outside the catalog because they have no backend adapter: **UBC, ECAD, NFe** (the hooks are disabled
  stubs) and **Clicksign**. Governing them would suggest that credentials are enough — which is false.
  They remain real pending items below.
- The frontend branches on the enum (`useExternalProviders`), never on human text. The badge now
  distinguishes "Indisponível" (unavailable), "Reconexão necessária" (reconnection required) and "Erro no provedor" (provider error) (PT-BR UI copy), which used to be
  all three collapsed into "Desconectado" (disconnected).



Audited on: 2026-05-20 (groups/priorities preserved; see the provenance note below).

> **Rule**: implement each item on `dev` (the only branch, see `CLAUDE.md` and `docs/engineering/git-safety.md`), going through the normal PR checklist. None of these items has recoverable source code today — they are feature ideas to be reimplemented from scratch.

> **Provenance note**: this list originally documented a set of agent-session branches (an old development flow) that no longer exist — neither locally nor on the remote. There are no commits to recover or port; the identifiers of those branches were replaced by neutral sequential IDs (`BACKLOG-NNN`). The content of each item (the feature idea) is preserved below.

---

## Group 1 — Contract Signing (Clicksign / DocuSign) — ACTIVE

**Course correction (2026-08-23)**: an earlier review on this same date marked this group as
OBSOLETE and removed `ClicksignConfigDialog.tsx`. That decision was **revoked**: a
partial implementation is not a nonexistent feature. The file was restored (identical to HEAD) and the group is
active backlog again.

The "Decision Gate item 13" cited in `useSigningProviders.ts` relied on incorrect
evidence — that `signing.adapter.ts` "always fails for all three" would prove that Clicksign/DocuSign
are not real. That adapter fails **for Autentique as well** (it is a deliberate frontend stub:
the real flow goes through the backend), so it was never evidence about the reality of any
provider. The real state, verified in the code:

- **Autentique** — real and complete provider. `apps/api/src/modules/integrations/autentique/`
  (422-line service: `sendForSignature`, `handleWebhook`, `configure`, credentials
  encrypted in `IntegrationEntity`, timeout/retry/dead-letter), `SendForSigningDialog.tsx`,
  webhook → `CONTRACT_SIGNED` event.
- **DocuSign** — **COMPLETE (2026-08-23)**. OAuth already existed
  (`integrations.controller.ts:283-323`); the signing adapter was implemented in
  `apps/api/src/modules/integrations/docusign/` (service + controller + spec), mirroring the
  AutentiqueService: v2.1 envelope creation, `account_id`/`base_uri` resolution via
  `/oauth/userinfo` (cached in the OAuthConnection metadata), Connect webhook with HMAC-SHA256
  base64 over the raw body, idempotent ingest via `WebhookService`, tenant resolution by
  administrative read + `runInTenantContext`, and emission of `CONTRACT_SENT_FOR_SIGNATURE` /
  `CONTRACT_SIGNED`. Selectable in `SendForSigningDialog`. Requires
  `DOCUSIGN_WEBHOOK_SECRET` + real credentials to actually operate.
- **Clicksign** — real UI (`ClicksignConfigDialog.tsx` + `useClicksign.ts`), but **no backend at
  all** in `apps/api/src`. `useClicksign.ts` is today an honest stub that reports
  `connected: false` (the previous version fabricated `connected: true` via sessionStorage — that
  was the dishonest part and was rightly removed). The entire backend module is missing.

Neither of the two should be re-exposed in `useSigningProviders` before the corresponding backend
is real — exposing a selectable provider that does not deliver would be fabricating functionality.

| ID | Feature | Status |
|----|---------|--------|
| `BACKLOG-001` | Clicksign and DocuSign configuration dialogs | Clicksign: dialog restored, awaiting backend. DocuSign: connects via OAuth (`/integrations/oauth/status?platform=docusign`), no dedicated dialog needed |
| `BACKLOG-002` | Signing-platform badge on each contract | Exists (`SigningPlatformBadge.tsx`); re-validate the label for DocuSign now that there are 2 real providers |
| `BACKLOG-003` | Wire Clicksign and DocuSign into the signing flow | **DocuSign: DONE** (2026-08-23) — `signing.service.ts` routes by provider and the dialog exposes both. Clicksign: pending, requires the complete backend module |

---

## Group 2 — ECAD Catalog

**Priority**: High — core catalog functionality

| ID | Feature |
|----|---------|
| `BACKLOG-004` | ECAD status badge in the works list |
| `BACKLOG-005` | ECAD status badge in the phonograms list |
| `BACKLOG-006` | Filter by ECAD status in the phonograms list |
| `BACKLOG-007` | Filter by ECAD status in the works list (handle empty/whitespace) |
| `BACKLOG-008` | Bulk filling of ECAD codes with error handling |

**What to do**: implement it on `dev`.

---

## Group 3 — Rights Monitoring

**Priority**: High — ECAD monitoring module

| ID | Feature |
|----|---------|
| `BACKLOG-009` | Performance detail page with ECAD timeline (#595) |
| `BACKLOG-010` | Connect performances with the real ISRC/work from the catalog |
| `BACKLOG-011` | Filter by date, artist and XLSX export in the performances table |
| `BACKLOG-012` | Automated tests: detail modal + catalog lookup |

**What to do**: implement it on `dev`.

---

## Group 4 — Integrations & Streaming Platforms — ALREADY IMPLEMENTED

**Real status (verified 2026-08-23)**: Both items already exist in the current code. Google Drive
no longer appears on the integrations page. All 5 configuration dialogs exist and are
wired (`SpotifyConfigDialog.tsx`, `YouTubeConfigDialog.tsx`, `DeezerConfigDialog.tsx`,
`SoundCloudConfigDialog.tsx`, `AppleMusicConfigDialog.tsx`, each referenced by the
integrations page). Not confirmed in this verification: whether each provider's OAuth round-trip is
working end to end with real credentials (out of the scope of a verification without access to
those credentials).

| ID | Feature | Status |
|----|---------|--------|
| `BACKLOG-013` | Integrations page reorganized, removes Google Drive | Done |
| `BACKLOG-014` | Configuration dialogs for the 5 platforms | Done (UI); end-to-end OAuth not verified in this pass |

---

## Group 5 — Artist Signup

**Priority**: Medium — improvement of the signup flow

| ID | Feature |
|----|---------|
| `BACKLOG-015` | Artist signup form: multiple distributors |
| `BACKLOG-016` | Show only the filled-in distributors in the step 3 summary |

**What to do**: implement it on `dev`.

---

## Group 6 — Storage & Auth Cleanup

**Priority**: Medium — related to the Supabase migration (Phase 2 of the roadmap)

| ID | Feature |
|----|---------|
| `BACKLOG-017` | Clear legacy credential keys from sessionStorage/localStorage at startup |
| `BACKLOG-018` | Versioned migration system for cleaning browser storage (#658) |

**What to do**: implement it on `dev`. `MOCK_MODE` was already removed from the code (locked by `apps/api/src/core/config/auth-disabled-env.spec.ts`), so there is no compatibility concern with it.

---

## Group 7 — Server-side Zod Validation (Phase 5 Roadmap)

**Priority**: High — directly aligned with Phase 5 of the roadmap

| ID | Feature |
|----|---------|
| `BACKLOG-019` | Server-side validation for the POST, PUT and PATCH endpoints of transactions + documentation (the backend validates with class-validator DTOs, see `docs/engineering/backend.md`; the original Zod proposal is superseded) |

**What to do**: implement it on `dev`. Larger scope — review carefully before implementing.

---

## Group 8 — Frontend Tests (Phase 6 Roadmap)

**Priority**: High — directly aligned with Phase 6 of the roadmap

| ID | Feature |
|----|---------|
| `BACKLOG-020` | Unit tests for the transaction form business rules + test scripts in the web app |

**What to do**: implement it on `dev`.

---

## Group 9 — Accounting Refactor

**Priority**: Medium

| ID | Feature |
|----|---------|
| `BACKLOG-021` | Invoice-note form modal: modular architecture (the original component name no longer exists in `apps/web/src`) |

**What to do**: implement it on `dev`.

---

## Group 10 — Marketing / Calendar

**Priority**: Low

| ID | Feature |
|----|---------|
| `BACKLOG-022` | CalendarCards with real engagement stats of publications |

**What to do**: implement it on `dev`.

---

## Group 11 — Social Media Publishing

**Priority**: Low — advanced feature, evaluate scope

| ID | Feature |
|----|---------|
| `BACKLOG-023` | Connect real publishing to Instagram, TikTok and YouTube when the integrations are active |

**What to do**: Evaluate whether the scope is within the planned integrations before implementing. Larger scope — more complex.

---

## Group 12 — Contract Template UI

**Priority**: Low (check whether it is already incorporated)

| ID | Feature |
|----|---------|
| `BACKLOG-024` | Side-by-side layout in the contract template (Task #86) |

**What to do**: Check whether it was already incorporated in the recent contract commits in `dev`. It can be discarded if so.

---

## Status

| ID | Group | Priority | Status |
|----|-------|-----------|--------|
| BACKLOG-001 | Contract Signing | High | Active: Clicksign dialog restored, awaiting backend (see Group 1) |
| BACKLOG-002 | Contract Signing | High | Re-evaluate for Autentique (verified 2026-08-23) |
| BACKLOG-003 | Contract Signing | High | DocuSign done; Clicksign pending (see Group 1) |
| BACKLOG-019 | Zod Validation | High | Backlog |
| BACKLOG-020 | Frontend Tests | High | Backlog |
| BACKLOG-012 | Rights Monitoring | High | Backlog |
| BACKLOG-009 | Rights Monitoring | High | Backlog |
| BACKLOG-010 | Rights Monitoring | High | Backlog |
| BACKLOG-011 | Rights Monitoring | High | Backlog |
| BACKLOG-004 | ECAD Catalog | High | Backlog |
| BACKLOG-005 | ECAD Catalog | High | Backlog |
| BACKLOG-006 | ECAD Catalog | High | Backlog |
| BACKLOG-007 | ECAD Catalog | High | Backlog |
| BACKLOG-008 | ECAD Catalog | High | Backlog |
| BACKLOG-015 | Artist Signup | Medium | Backlog |
| BACKLOG-016 | Artist Signup | Medium | Backlog |
| BACKLOG-013 | Integrations | Medium | Done (verified 2026-08-23) |
| BACKLOG-014 | Integrations | Medium | Done (UI) — OAuth E2E not verified (2026-08-23) |
| BACKLOG-017 | Storage Cleanup | Medium | Backlog |
| BACKLOG-018 | Storage Cleanup | Medium | Backlog |
| BACKLOG-021 | Accounting | Medium | Backlog |
| BACKLOG-022 | Marketing | Low | Backlog |
| BACKLOG-023 | Social Media | Low | Evaluate scope |
| BACKLOG-024 | Contract UI | Low | Check whether already incorporated |
