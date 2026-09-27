# V5 — Backend and Infrastructure Fixes

## What & Why
Fix HrService (a critical encryption bug where the frontend tried to send fields that were
already encrypted — impossible because the key lives only on the server), add pagination
to the three services that lack it, generate and apply the migration for the 6 new tables that
exist in the schema but not in the database, clean up PENDING_TABLES in the api-client,
add a FeatureGate to the Agenda, and create the YouTube and Deezer services in the backend.

## Done looks like
- HR: creating/editing an employee accepts `email`, `telefone`, `cpf` in clear text; the server
  encrypts them before persisting; on read, it returns them decrypted (without exposing _encrypted)
- artist-goals, content-detections, ecad-reports list with `{ data, meta: { total, offset, limit } }`
- Migration generated and applied: the 6 new tables exist in the Neon database
- api-client.ts: `PENDING_TABLES = {}` empty; the 4 entries moved to `TABLE_ENDPOINT`
- Agenda.tsx wrapped with `<FeatureGate feature="moduleEvents">`
- The `/integrations/youtube/*` and `/integrations/deezer/*` endpoints respond in the backend
- API `tsc --noEmit`: 0 errors after all the changes

## Out of scope
- New integration services (SoundCloud, Apple Music, Instagram, TikTok, Google Ads,
  Abramus) — that is the next task
- Migration of the frontend hooks — another task
- Automated tests

## Steps
1. **Fix HrService — DTOs** — Replace `CreateEmployeeDto` and `UpdateEmployeeDto`:
   the `email_encrypted`, `telefone_encrypted`, `cpf_encrypted` fields become `email`,
   `telefone`, `cpf` (clear text). The `cpf_encrypted` field in the DTO was impossible for
   the frontend to fill in, since it has no access to the encryption key.
2. **Fix HrService — inject EncryptionService** — Add `private readonly enc: EncryptionService`
   to the HrService constructor (EncryptionService is `@Global()` via CoreModule, there is no need
   to import the module). Create `mapEmployee()`, which decrypts before returning. In `create` and
   `update`, call `enc.encryptNullable()` on the sensitive fields.
3. **Fix HrService — pagination** — Add `count`, `offset`, `limit` to `listEmployees`
   and return `{ data, meta }`. Update the controller to accept query params.
4. **Pagination in artist-goals** — Replace `async list(tenantId)` with a version with the filters
   `artista_id`, `status`, `offset`, `limit`, returning `{ data, meta }`. Add `count`
   to the drizzle-orm import. Update the controller.
5. **Pagination in content-detections** — Same operation: filters `status`, `plataforma`,
   `offset`, `limit`. Update the controller.
6. **Pagination in ecad-reports** — Filters `periodo`, `status`, `offset`, `limit`. Update the controller.
7. **Generate and apply the migration** — Run `npx drizzle-kit generate` and then
   `npx drizzle-kit push` to create the 6 tables (`artist_goals`, `content_detections`,
   `ecad_reports`, `employees`, `payroll_entries`, `leave_requests`) in the Neon database.
8. **Clean up PENDING_TABLES in the api-client** — Move the 4 entries to TABLE_ENDPOINT
   with the correct paths (`/artist-goals`, `/ecad-reports`, `/content-detections`,
   `/hr/employees`). Set `PENDING_TABLES = {}`.
9. **FeatureGate on the Agenda** — Wrap the return of `Agenda.tsx` with
   `<FeatureGate feature="moduleEvents" featureName="Agenda & Eventos">`.
10. **Create YouTubeService** — Create `apps/api/src/modules/integrations/youtube/youtube.service.ts`
    with `getChannelStats`, `getVideoStats`, `searchVideos` using YOUTUBE_API_KEY from the env.
    Add `YOUTUBE_API_KEY: z.string().optional()` to env.schema.ts.
11. **Create DeezerService** — Create `apps/api/src/modules/integrations/deezer/deezer.service.ts`
    with `getArtistStats`, `searchArtist`, `getTopTracks`, `getAlbum` using the public API.
12. **Register YouTube and Deezer** — Add both to the `providers` and `exports` of
    `IntegrationsModule`. Add them to the `IntegrationsController` constructor and create
    the endpoints: `GET youtube/status`, `GET youtube/channel/:id`, `GET youtube/video/:id`,
    `GET youtube/search`, `GET deezer/artist/:id`, `GET deezer/artist/:id/top`,
    `GET deezer/album/:id`, `GET deezer/search`. Add `Query` to the import if it is missing.
13. **Final TypeCheck** — Run `cd apps/api && npx tsc --noEmit` and fix any
    TypeScript error.

## Relevant files
- `apps/api/src/modules/hr/hr.service.ts`
- `apps/api/src/modules/hr/dto/create-employee.dto.ts`
- `apps/api/src/modules/hr/dto/update-employee.dto.ts`
- `apps/api/src/modules/hr/hr.controller.ts`
- `apps/api/src/modules/artist-goals/artist-goals.service.ts`
- `apps/api/src/modules/artist-goals/artist-goals.controller.ts`
- `apps/api/src/modules/content-detections/content-detections.service.ts`
- `apps/api/src/modules/content-detections/content-detections.controller.ts`
- `apps/api/src/modules/ecad-reports/ecad-reports.service.ts`
- `apps/api/src/modules/ecad-reports/ecad-reports.controller.ts`
- `apps/api/src/core/security/encryption.service.ts`
- `apps/api/src/core/config/env.schema.ts`
- `apps/api/src/modules/integrations/integrations.module.ts`
- `apps/api/src/modules/integrations/integrations.controller.ts`
- `client/src/shared/lib/api-client.ts`
- `client/src/modules/events/pages/Agenda.tsx`
- `client/src/shared/components/FeatureGate.tsx`
