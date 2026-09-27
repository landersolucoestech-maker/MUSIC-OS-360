# TASK 9 — Distribution Orchestration (DistroKid, TuneCore, ONErpm, TooLost, FUGA)

## What & Why
The system has a releases module (`/lancamentos`) in the frontend but no backend to orchestrate the actual delivery to distributors. Distributors such as DistroKid, TuneCore, ONErpm, TooLost and FUGA have their own APIs for validating metadata, submitting releases and tracking status. Without this layer, releases remain only internal records with no actual delivery to the digital platforms.

## STRICT scope
The module serves ONLY to:
- validate the release metadata (title, ISRC, UPC, artists, genre, date)
- organize and validate assets (WAV/FLAC audio, JPEG 3000x3000 artwork)
- submit the release to the selected distributor
- track status (pending → processing → distributed → failed)

DO NOT implement: royalties, payout, DSP accounting, fingerprinting, anti-fraud, content ID, own DSP ingestion, financial ledger.

## Done looks like
- `DistributionProvider` interface in `packages/shared-types`: `validateRelease()`, `uploadAssets()`, `publishRelease()`, `syncStatus()`
- Implemented adapters: `DistroKidAdapter`, `TuneCoreAdapter`, `ONErpmAdapter`, `TooLostAdapter`, `FUGAAdapter` — each implements `DistributionProvider`; in the initial phase the adapters are skeletons that log the operation and return status `pending` (real integrations via a per-tenant API key when available)
- `DistributionOrchestratorService`: receives `releaseId + tenantId + provider`, validates metadata via `ReleasesService`, validates assets via `UploadsService`, calls the correct adapter, persists the status in the `distribution_submissions` table
- `distribution_submissions` table: `id`, `tenant_id`, `release_id`, `provider`, `status` (pending/processing/distributed/failed), `external_id`, `submitted_at`, `last_sync_at`, `error_message`
- `POST /distribution/submit` endpoint: receives `{ releaseId, provider }`, validates the release, starts the process
- `GET /distribution/status/:submissionId` endpoint: returns the current status
- `POST /distribution/sync/:submissionId` endpoint: triggers a status sync with the distributor
- Frontend: the releases page connects to the real endpoint (replacing the mock); the "Distribuir" (Distribute) button opens a distributor selector and calls `POST /distribution/submit`
- `tsc --noEmit` without errors

## Out of scope
- Real implementation of the distributors' APIs (only the structure/skeleton of the adapters)
- Payments to the distributors (manual billing by the tenant)
- Advanced distribution reports
- Integration with ECAD/ABRAMUS

## Steps
1. **Drizzle schema** — create the `distribution_submissions` table with the fields described above; generate and apply the migration via drizzle-kit
2. **DistributionProvider interface** — create `packages/shared-types/src/distribution.ts` with the `DistributionProvider` interface, the `DistributionProviderName` enum, the `ReleaseSubmission` type, the `SubmissionStatus` type
3. **Skeleton adapters** — create `apps/api/src/modules/distribution/adapters/` with one file per distributor; each adapter implements `DistributionProvider`; `validateRelease()` checks the mandatory fields (title, ISRC, UPC, artist, genre, date); `publishRelease()` logs and returns `{ externalId: uuid(), status: 'pending' }`; `syncStatus()` returns the current status from the database
4. **DistributionOrchestratorService** — create a service that: loads the release via Drizzle, validates the mandatory fields, selects the adapter by `provider`, calls `validateRelease()` + `uploadAssets()` + `publishRelease()`, persists to `distribution_submissions`; handles errors with a descriptive message per step
5. **DistributionController + Module** — create the controller with the 3 endpoints; create `DistributionModule` with the provider, register it in `AppModule`; protect the endpoints with `TenantGuard` + `@RequireRole('editor')`
6. **Frontend** — update `client/src/modules/releases/` to use `POST /distribution/submit` on the distribution button and `GET /distribution/status/:id` to display the status; display a status badge per submission in the releases listing

## Relevant files
- `apps/api/src/modules/releases/` (existing releases module)
- `apps/api/src/database/schema.ts`
- `apps/api/src/app.module.ts`
- `packages/shared-types/`
- `client/src/modules/releases/pages/`

## Depends on
- Task #661 (auth chain — tenantId required)
- Task #665 (backend modules — CRUD pattern to follow)
