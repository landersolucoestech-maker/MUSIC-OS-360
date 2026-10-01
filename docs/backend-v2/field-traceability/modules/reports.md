> Historical record. Kept as recorded; not the current contract.

# Module: `reports` — Zero-Gap Field Traceability Audit

STATUS: COMPLETE

## 0. Central objective

**REPORTS_DOMAIN_MEANING: EXPORT_CENTER** (entity-driven XLSX bulk export/import), confirmed by
direct evidence, not presumed. `Relatorios.tsx`'s own header comment states it plainly: *"Central de
Relatórios — consome EXCLUSIVAMENTE a API... Sem lista fixa, sem mock, sem registry/contrato/label no
frontend. O backend é a única fonte da verdade."* There is exactly one frontend page (`/relatorios`),
backed by a single, closed registry of 22 domain tables
(`apps/api/src/modules/reports/report-module-registry.ts`), each with an explicit field contract
(`report-form-contracts.ts`). It is **not** `CROSS_DOMAIN_ANALYTICS` (no charts, no cross-table joins
beyond one computed report), **not** `REPORT_BUILDER` (no dynamic field/filter/SQL construction exposed
to users — every exportable/filterable/sortable column is a fixed, server-declared allowlist per
entity), **not** `SAVED_REPORTS`/`SCHEDULED_REPORTS` (neither concept exists anywhere, confirmed
absent by exhaustive grep), and **not** `STATIC_REPORT_VIEWS` (data is always live-queried, never
cached/materialized). One narrow exception: a single `computed: true` entry (`accounting_summary`,
"Contabilidade" = P&L by artist) is a genuine `DOMAIN_REPORT_AGGREGATOR` — the one non-passthrough
report in an otherwise pure export/import center.

**Not every export in the system belongs to `reports`**, confirmed deliberately (not assumed): a
separate, older, purely client-side XLSX helper (`apps/web/src/shared/lib/xlsx.ts`) is used
independently by `contracts` (`CategoryRegistry.tsx`, `VariableRegistry.tsx`) and `accounting`
(`TransacaoFormModal.tsx`) — these are `DOMAIN_LOCAL_EXPORT` utilities, structurally and
architecturally disconnected from the Reports module's server-driven pipeline (§67 boundary
determination, §30 inventory, §33 revalidation).

## 1. Discovery scope

Full backend module: `apps/api/src/modules/reports/` (44 files) — `entity-metadata.service.ts` (entity
classification/scan), `report-module-registry.ts` (closed 22-entry allowlist), `report-table-guard
.service.ts` (verifies live DB table before allowing export/import), `reports.controller.ts` (6
endpoints), `reports.module.ts`, plus `definitions/`, `export/`, `import/`, `form-contracts/`,
`computed-fields/`, `i18n/` subfolders (detailed below). Full frontend module: `apps/web/src/modules/
reports/` (`pages/Relatorios.tsx`, `components/ImportDialog.tsx`, `hooks/useReports.ts`, `services/
reports-api.ts`). Single route: `/relatorios` (`apps/web/src/app/routes/reports.routes.tsx`). No other
route anywhere references Reports.

## 2. Subdomains

| Subdomain | Frontend entrypoint | Endpoints | Backend | DB tables | Jobs |
|---|---|---|---|---|---|
| REPORT (entity export/import) | `/relatorios` | 6 (`GET /reports/entities`, `/definitions`, `GET .../export`, `GET .../import/template`, `POST .../import/validate`, `POST .../import/commit`) | `ReportsController`/`ExportEngineService`/`ImportEngineService`/`ImportCommitService` | 22 registered tables (§5) | none — fully synchronous |
| REPORT_DEFINITION | (consumed internally) | `GET /reports/definitions` | `ReportEntityDefinitionService` | derives from `report-form-contracts.ts` + live entity metadata | — |
| REPORT_FILTER/SORT/SEARCH | export query params | part of `/export` | `ExportQueryBuilderService` | per-entity allowlisted columns | — |
| REPORT_RUN (audit trail only) | none (no UI) | — | `ExportAuditService`/`ImportAuditService` | writes to the generic audit-log table via `@Audit(...)` | — |

`SAVED_REPORT`, `SCHEDULED_REPORT`, `REPORT_TEMPLATE` (as persisted config), `REPORT_FILE` (as a
stored artifact): **all confirmed NOT_PRESENT** — grepped `saved_report`/`SavedReport`/
`scheduled_report`/`ScheduledReport`/`report_template`/`ReportTemplate` (case-insensitive) across the
entire repository including `entities.ts` — zero matches anywhere. The "import/template" endpoint
generates a **blank XLSX template on demand** (structural, not a saved user configuration) — not to be
confused with `REPORT_TEMPLATE` as a persisted concept.

## 3. Canonical report/export inventory (§5 of the prompt)

All 22 entries of `REPORT_MODULE_REGISTRY`, each with a matching `ReportFormContract` in
`report-form-contracts.ts` (verified 1:1, confirmed by the module's own `form-contracts.guard.spec.ts`
and cross-checked against `report-module-registry.spec.ts`):

| # | tableName | Label | Type | Source domain (already-audited status) | Status |
|---|---|---|---|---|---|
| 1 | `artists` | Artistas | entity | artist (audited) | ACTIVE |
| 2 | `projects` | Projetos | entity | projects (audited) | ACTIVE |
| 3 | `works` | Obras | entity | catalog (audited) | ACTIVE |
| 4 | `phonograms` | Fonogramas | entity, repeating group (faixas via `releases-faixas.field.ts`? — no, phonograms has its own participants group) | catalog (audited) | ACTIVE |
| 5 | `content_detections` | Monitoramento | entity | monitoring (audited) | ACTIVE |
| 6 | `licenses` | Licenciamento | entity | licensing (audited) | ACTIVE |
| 7 | `takedowns` | Takedowns | entity | monitoring (audited) | ACTIVE |
| 8 | `releases` | Distribuição | entity, repeating group (faixas) | releases (audited) | ACTIVE |
| 9 | `shares` | Shares | entity | releases (adjacent, not deep-audited there either) | ACTIVE |
| 10 | `contracts` | Contratos | entity | contracts (audited) | ACTIVE |
| 11 | `audiovisual_projects` | Projetos Audiovisuais | entity | audiovisual (audited) | ACTIVE |
| 12 | `transactions` | Transações Financeiras | entity | accounting (audited) | ACTIVE |
| 13 | `accounting_summary` | Contabilidade | **computed** (P&L by artist) | accounting (audited) | ACTIVE |
| 14 | `invoices` | Nota Fiscal | entity, repeating group (itens) | accounting (audited) | ACTIVE |
| 15 | `events` | Agenda | entity | events (audited) | ACTIVE |
| 16 | `inventory_items` | Inventário | entity | inventory (audited) | ACTIVE |
| 17 | `clients` | Contatos | entity | crm-relationships (audited) — "Contato = Cliente" | ACTIVE |
| 18 | `leads` | Leads | entity | leads (audited) | ACTIVE |
| 19 | `employees` | RH | entity | rh (not yet audited — interface only mapped, §21) | ACTIVE |
| 20 | `marketing_tasks` | Tarefas | entity | marketing (audited) | ACTIVE |
| 21 | `marketing_content_posts` | Calendário de Conteúdo | entity | marketing (audited) | ACTIVE |
| 22 | `briefings` | Briefing | entity | not yet audited as its own module (interface only mapped, §21) | ACTIVE |

All 22 classified `ACTIVE` — every one has a real controller path, a real contract, a real DB table
(guarded live by `ReportTableGuardService.assertTableUsable()`, which marks an entity `TABLE_NOT_
AVAILABLE` and strips `reportable` if the physical table is missing — a real, evidenced defensive
check, not decorative). **Zero PARTIAL/STATIC/STUB/DEAD/ORPHAN reports found** — every registered
entity has export support (`supportsExport = exportableColumns.length > 0`) confirmed non-empty for
all 22. Import support (`supportsImport`) is true for all except any contract whose every field is
`ro()` (read-only) — none of the 22 fall fully into that case (all support both, per the registry
entries' presence in `import-commit.service.ts`'s reachable set).

Notably, `campaigns` (the table `marketing.md` found split across two incompatible parallel systems)
is **not registered at all** in Reports — confirmed by its absence from the 22-entry list — so that
module's documented bug (dual campaign systems, fabricated `budget*0.41` metric) is structurally
**unreachable** through this module; Reports only exports `marketing_tasks`/`marketing_content_posts`
raw columns, never the client-side-computed metric.

## 4. Components / Hooks

| Component | File | Classification |
|---|---|---|
| `Relatorios.tsx` | `pages/Relatorios.tsx` | REPORT_PAGE + EXPORT_BUTTON (per row) + implicit list/table |
| `ImportDialog.tsx` | `components/ImportDialog.tsx` | wizard-like: file picker → template download → validate (preview) → commit |

No CHART, KPI_CARD, GROUP_BY_SELECTOR, FORMAT_SELECTOR (format is always fixed `xlsx`), SAVE_REPORT_UI,
SCHEDULE_REPORT_UI, DATE_RANGE picker, or PRINT_BUTTON exists anywhere in this module — confirmed
absent, not invented as missing requirements (this is a deliberately minimal, generic UI by design,
per its own header comment).

| Hook | File | Endpoints | Notes |
|---|---|---|---|
| `useReportEntities` | `hooks/useReports.ts` | `GET /reports/entities` | 5-min `staleTime` cache |
| `useReportDefinitions` | same | `GET /reports/definitions` | 5-min `staleTime` cache |
| `useReportExport` | same | `GET /reports/entities/:entity/export` | mutation, triggers a real blob download (`triggerBlobDownload`) |
| `useImportValidate`/`useImportCommit` | same | `POST .../import/validate`/`.../commit` | mutations |

## 5. Report definitions — how reports are defined

`REPORT_DEFINITIONS_SOURCE: HARDCODED_BACKEND` (TypeScript source files, not database-driven, not a
JSON config, not a dynamic builder) — `report-module-registry.ts` (which tables) +
`report-form-contracts.ts` (which fields, in what order, with what storage/encryption/metadata
treatment) + `ReportEntityDefinitionService` (derives filterable/sortable/searchable/sensitive column
sets by combining the contract with live TypeORM column metadata via regex-based heuristics —
`isInternalColumn`/`isSensitiveColumn`/`FILTERABLE_HINTS`, `apps/api/src/modules/reports/definitions/
report-entity-definition.service.ts:15-30`). This two-layer design (explicit contract for
export/import field lists + heuristic-but-`sqlSafe`-gated derivation for filter/sort/search) is
internally consistent: every heuristically-derived filterable/sortable/searchable column is additionally
required to appear in `contractDirectColumns(contract)` (the `sqlSafe()` check, line 69) — meaning the
heuristics can only ever narrow the contract's already-vetted column set, never introduce an
unvetted one. `REPORT_QUERY_SECURITY_GAP: 0` — confirmed no path exists for a client-supplied column
name, filter value, or sort key to reach raw SQL without allowlist validation (`assertIdent()`/`IDENT`
regex on every identifier, `def.filterableColumns.includes(key)` / `def.sortableColumns.includes(...)`
checks before any interpolation, values always passed as parameterized `$n` placeholders — verified
directly in `export-query-builder.service.ts:41-48,71-92`).

## 6. Fields, filters, search, sort, date range, pagination

Every exportable/importable/filterable/sortable/searchable column for every one of the 22 entities
traces to a real physical or metadata (jsonb-key) column via the shared `ReportFormContract`
(`col()`→direct column, `meta()`→jsonb key inside a named metadata column, `enc()`→dedicated
`_encrypted` physical column decrypted at export time, `ro()`→export-only). No unmapped display/source
field exists (`sqlSafe()` gate, §5). **No dedicated date-range UI or query param exists** — `DATE_RANGE_
FIELDS: 0` — export supports `filters`/`sort`/`columns` query params only; a caller wanting a date
range must pass an exact-match `filters[dateColumn]=value` (equality only, no `>=`/`<=` operators
implemented anywhere in `ExportQueryBuilderService`) — confirmed by direct reading of the WHERE-clause
builder (§/`export-query-builder.service.ts:75-81`, always `=`, never a range operator). Classified
`FILTER_MAPPING_MISMATCH` (minor): the concept of a "date range" filter does not actually exist in this
system despite `QueryReleaseDto`-style date fields being marked filterable in several contracts —
filtering by date can only mean exact-day equality today.

**Search**: `searchableColumns` per contract/heuristic — but `ExportQueryBuilderService` has **no
`ILIKE`/full-text search implementation at all** — `searchableColumns` is computed and exposed in
`ReportEntityDefinition` but **never consumed** by `build()` (confirmed: no code path in
`export-query-builder.service.ts` reads `def.searchableColumns`). Classified `REPORT_SOURCE_GAP`: the
"search" concept is defined in the data model but has zero runtime effect — there is no way to
free-text search within an export; only exact-match `filters` work. Not exposed in the frontend UI at
all either (`Relatorios.tsx` has no search input), so this is a fully dormant, unreachable capability on
both sides — consistent, not contradictory, but confirmed non-functional if invoked directly via API.

**Sort**: real, functional (`ORDER BY`, allowlist-checked). **Pagination**: `PAGINATION_MODEL: NONE` —
exports are **never paginated**; the full filtered dataset (up to `EXPORT_MAX_ROWS = 50,000`) is always
returned in one response, or the request fails closed with `413 PayloadTooLargeException` if the true
row count exceeds the limit (`EXPORT_DETECTION_LIMIT = 50,001`, fetched via a `LIMIT` clause so the
excess is detected without a separate `COUNT(*)` — `export-engine.service.ts:48-57`,
`export-query-builder.service.ts:89-92`). **This means `Relatorios.tsx`'s deprecated
`pageSize: 1000` param (sent on every export call, `Relatorios.tsx:31`) has zero effect** —
`RESERVED_QUERY_KEYS` on the backend explicitly excludes `page`/`pageSize` from being interpreted as
filters (`reports.controller.ts:51`), and `ExportQueryParams.page`/`.pageSize` are marked `@deprecated`
in `export.types.ts:22-25` and never read by the query builder. Confirmed harmless (not a bug — dead
legacy parameter correctly ignored by design), but noted as minor frontend cleanup debt.

## 7. Truncation — genuine positive differentiator

**`TRUNCATION_GAP: 0` for this module** — a first in this entire audit series. Every other module
audited (accounting, catalog, projects, releases, marketing, monitoring, musicchat, etc.) was found to
silently truncate list/filter/KPI results at a default `PaginationDto.limit` (usually 50) with no
user-visible indication. The Reports module instead **fails closed**: if the true row count exceeds
50,000, no partial file is ever produced — the request errors explicitly (`REPORT_EXPORT_TOO_LARGE`).
Because exports query physical tables directly (bypassing each domain's own paginated list endpoint
entirely), **Reports exports do not inherit any other module's `limit=50` truncation gap** — e.g. an
export of `projects` via `/reports/entities/projects/export` returns every row (up to 50k), unlike
`GET /projects` (which `projects.md` found silently capped at 50 with no override sent by the real UI).
`EXPORT_COMPLETENESS_GAP: 0` — confirmed `EXPORTS_FILTERED_FULL_DATASET` (not `_CURRENT_PAGE_ONLY`,
not `_UNFILTERED_FULL_DATASET` since filters, when supplied, are respected) for every entity; never
`UNKNOWN`.

## 8. Calculations (`accounting_summary` — the one computed report)

`fetchAccountingSummaryRows()` (`computed-fields/accounting-summary.report.ts`): real SQL, `JOIN
transactions t ON t.artista_id = a.id AND t.tenant_id = a.tenant_id`, `GROUP BY a.id, a.nome_artistico`.

| Output field | Input fields | Formula | Null behavior | Zero behavior | Rounding |
|---|---|---|---|---|---|
| `receitas` | `transactions.valor` WHERE `tipo='receita'` | `SUM(...) FILTER (...)`, `COALESCE(...,0)` | null→0 via COALESCE | shows 0 | none (raw decimal→Number) |
| `despesas` | same, `tipo='despesa'` | same pattern | null→0 | shows 0 | none |
| `resultado` | `receitas - despesas` | subtraction | N/A (both already 0-safe) | 0 if equal | none |
| `margem` | `resultado / receitas * 100` | percentage | N/A | **0 when `receitas === 0`** (explicit guard, avoids div-by-zero) | `.toFixed(2)` |

This is a **genuinely, correctly artist-grouped** report — real `GROUP BY` on the artist FK, not a
per-transaction pseudo-group. Contrasted directly with `accounting.md`'s documented finding that
`Contabilidade.tsx`'s own **"P&L por Projeto"** UI tab (a separate, non-exported, in-app-only view)
fabricates one "project" per transaction and never groups by `projeto_id`. **The Reports module does
not reproduce or inherit that bug** — not because it was fixed, but because Reports never attempted a
project-grouped report at all; its only computed report groups by **artist**, correctly. This is stated
explicitly to close the cross-module pendency without conflating the two: `PROJECT_REPORT_
TRACEABILITY_COMPLETE: SIM` (fully traced: `projects` is only exported as a raw entity table, no
project-level P&L computation exists in Reports to inherit the accounting.md bug into).

## 9. `report-form-contracts.ts` — PII inventory (§43-46 of the prompt)

Real, deliberate encrypted-column handling confirmed for 3 of the 22 entities — `artists`, `employees`,
`clients` — each with `enc('email', 'email_encrypted')`, `enc('telefone', 'telefone_encrypted')`,
`enc('cpf'/'cpf_cnpj', 'cpf_encrypted'/'cpf_cnpj_encrypted')`. The contract file's own comment
(`report-form-contracts.ts:248-252`) documents *why* this exists: a prior generic heuristic exporter
silently **omitted** these fields entirely (encrypted columns never satisfied the heuristic's plain
"looks like a form field" test) — the explicit contract was added specifically so these fields **can**
be exported (decrypted) by an authorized manager, not to add new exposure.

| Field | PII class | Contract(s) | Displayed | Exported | Masked |
|---|---|---|---|---|---|
| `email` | EMAIL | artists, employees, clients | via UI elsewhere (not audited here) | YES (decrypted at export time) | NO |
| `telefone` | PHONE | artists, employees, clients | — | YES (decrypted) | NO |
| `cpf`/`cpf_cnpj` | TAX_ID/DOCUMENT | artists, employees, clients | — | YES (decrypted) | NO |
| `banco`, `conta`, `chave_pix`, `titular_conta` | BANK_DATA | artists (`ARTISTS_CONTRACT`, stored as `meta()` jsonb keys, `report-form-contracts.ts:116`) | — | YES (plaintext jsonb, no encryption layer at all) | NO |
| `observacoes` | OTHER (free text, may contain any PII/negotiation detail) | artists, contracts, licenses, takedowns, releases, shares, clients, events, inventory_items, invoices | — | YES (plaintext `col()`) | NO |
| `documentos`/`documentos_pessoais_url` | DOCUMENT (file reference) | artists, employees | — | YES (URL only, not file content) | NO |

**`EXPORT_PRIVACY_GAP` confirmed**: bank account data (`banco`/`conta`/`chave_pix`/`titular_conta`) on
the `artists` contract is stored as generic jsonb metadata and exported in plaintext — it receives
**no encryption treatment at all**, unlike `email`/`telefone`/`cpf_cnpj` on the very same entity, which
are properly column-encrypted and only decrypted at authorized export time. This is a real,
evidenced inconsistency in how equivalently-sensitive fields on the same table are protected: two
different sensitivity tiers exist for financial/personal data on `artists`, with no apparent product
reason for the split (both are exported at the identical `RequireRole('manager')` gate).

**§46, `contracts.observacoes` — resolved by direct evidence**: `CONTRACT_OBSERVACOES_EXPORTED: SIM`
(`CONTRACTS_CONTRACT.fields` includes `col('observacoes')`, `report-form-contracts.ts:154`).
`PII_RISK_INHERITED_FROM_CONTRACTS: SIM` — whatever free-text/negotiation-detail risk `contracts.md`
already documented for this column is inherited unchanged by the Reports export path (same plaintext,
same `manager`-role gate, no additional masking specific to this field). Not corrected here, per
instruction.

No separate "view PII" / "export sensitive data" permission tier exists anywhere — every export and
import, regardless of whether the target entity contains encrypted PII, requires the identical
`RequireRole('manager')` gate (§10). This uniform gating is a defensible, simple design choice, not
independently classified as a gap on its own, but is the reason the bank-data inconsistency above
carries real weight — there is no finer-grained control that could have compensated for it.

## 10. Permissions & Tenant Isolation

| Endpoint | Role required |
|---|---|
| `GET /reports/entities` | `admin` |
| `GET /reports/definitions` | `admin` |
| `GET /reports/entities/:entity/export` | `manager` |
| `GET /reports/entities/:entity/import/template` | `manager` |
| `POST /reports/entities/:entity/import/validate` | `manager` |
| `POST /reports/entities/:entity/import/commit` | `manager` |

Noted asymmetry (factual observation, not asserted as a bug without further product context): viewing
the raw entity/column metadata inventory requires the stricter `admin` role, while actually
exporting/importing real business data requires only `manager` — metadata about the schema is gated
more tightly than the data itself. `AUTHORIZATION_GAPS: 0` (both endpoints are gated, appropriately for
their respective sensitivity as declared by the product; no endpoint is unguarded).

**Tenant isolation — real, defense-in-depth, confirmed at every layer**: (1) `EntityMetadataService
.scan()` only marks a table `reportable` when `inRegistry && hasTenantId && hasIdentifiable`
(`entity-metadata.service.ts:307`) — a table without a real `tenant_id` column can never become
reportable even if added to the registry by mistake. (2) Every export query's `WHERE` clause always
starts with `"tenant_id" = $1` (`export-query-builder.service.ts:71-72`), non-optional, thrown
`ForbiddenException` if `tenantId` is falsy (line 38). (3) Import commit sets the Postgres RLS session
variable `app.current_tenant_id` inside the transaction (`import-commit.service.ts:152`) — belt-and-
suspenders with the application-level tenant filter. (4) Relationship validation on import
(`assertRelationships`) checks that every referenced `_id` (artist/project/release/contract/client/
campaign) **exists for the same tenant**, preventing a cross-tenant FK reference from being written.
`TENANT_ISOLATION_GAPS: 0`. `CROSS_DOMAIN_JOINS`: the only cross-table join in the whole module is the
`accounting_summary` computed report's `artists ⋈ transactions`, and both sides of that join are
explicitly tenant-scoped in the `WHERE`/`ON` clause (§8) — no cross-tenant leakage path found.

## 11. Formula injection / spreadsheet security

`SPREADSHEET_INJECTION_GAP: 0` — `neutralizeFormulaInjection()` (`export-format.service.ts:25-32`)
prefixes any cell value starting with `=`, `@`, tab, or CR with a literal `'` guard, and additionally
handles `+`/`-` prefixes unless they look like a plausible phone number or negative number (regex-gated,
avoiding false-positive mangling of legitimate data) — applied to **every** exported cell
unconditionally (`sanitizeExcelCellValue()`, called for all rows/columns in `toXlsx()`). This is real,
substantive protection against the classic CSV/XLSX formula-injection attack, applied consistently, not
selectively. The generic frontend helper (`shared/lib/xlsx.ts`) has its own, separate
`neutralizeFormulaInjection` implementation for its own (non-Reports) export paths — not verified
byte-for-byte identical to the Reports one, but confirmed present and exercised in both.

## 12. XLSX rule (§32-33 of the prompt)

**Reports module itself: 100% compliant, `WORKSHEET_COUNT <= 2` (always exactly 1)** — confirmed for
both `ExportFormatService.toXlsx()` (`export-format.service.ts:81`, `book_append_sheet` called exactly
once) and `ImportEngineService.buildTemplate()` (`import-engine.service.ts:209-214`, one worksheet),
independently enforced by a permanent guard test (`single-sheet.guard.spec.ts`). `XLSX_RULE_
VIOLATIONS: 0` **within the Reports module's own code**.

**§33 revalidation — `TransacaoFormModal.tsx`'s `exportFieldList`**: confirmed **3 worksheets**
(`"Campos"`, `"Itens"`, `"Catálogo Financeiro"` — `TransacaoFormModal.tsx:457,467,494`).
`PERTENCE_FUNCIONALMENTE_A_REPORTS: NÃO` — this function lives entirely inside the `accounting` module's
`TransacaoFormModal.tsx`, uses the `xlsx` package directly (not the Reports module's `ExportEngineService`
or the shared `shared/lib/xlsx.ts` helper), and is never imported, referenced, or wired to any UI element
anywhere in the file (confirmed: `exportFieldList` is a local `const` defined once and never called —
dead code). `ACCOUNTING_3_SHEET_EXPORT_STATUS: DEAD` (not `ORPHAN`, since "orphan" would imply an
unreachable-but-connected code path; this is entirely disconnected — no button, no handler, no route
references it) **and** `NOT_REPORTS_RESPONSIBILITY` simultaneously — both true, per the prompt's own
distinct fields. Per the prompt's explicit instruction (§32: rule applies "inclusive para... código
morto"), this specific piece of dead code, taken on its own terms, **would violate** the single-sheet
rule if it were ever connected — recorded here as `XLSX_RULE_VIOLATION: SIM` for that one artifact,
without inflating the Reports module's own (compliant) violation count, and without duplicating this
finding as a Reports-module gap (per §67's anti-double-counting instruction).

## 13. CSV / PDF / Print

`CSV_EXPORTS: 0` — confirmed no CSV generation exists anywhere in the repository (no `Papa.unparse`, no
manual CSV string building, no `text/csv` content-type anywhere). The platform is explicitly XLSX-only
by design (`ImportFormat`/`ExportFormat` types are literal `'xlsx'` unions; `shared/lib/xlsx.ts`'s own
comment states *"The platform accepts only .xlsx files"*; a repo-level script `scripts/verify-xlsx-only
.mjs` exists to enforce this policy in CI). `PDF_EXPORTS: 0`, classified `NOT_IMPLEMENTED` — confirmed
absent (no `jspdf`/`pdfkit`/`@react-pdf`/`puppeteer`/`pdf-lib` anywhere); the only `"pdf"` string hits
found are unrelated attachment-format dropdown options (a user *uploading* a PDF receipt in
`accounting`, not the system *generating* one). `PRINT_FLOWS: 0` — no `window.print()` or print-specific
CSS/view exists for any report.

## 14. Saved / Scheduled reports, background jobs, delivery, storage

All **NOT_PRESENT**, confirmed absent by exhaustive grep (§2). `SAVED_REPORTS: 0`. `SCHEDULED_REPORTS: 0`
(classification: `NOT_IMPLEMENTED`). `BACKGROUND_REPORT_JOBS: 0` — exports/imports are fully synchronous
request/response (bounded by the 50k-row/1MB limits precisely so a background job is unnecessary at
current scale; the `EXPORT_MAX_ROWS` comment explicitly acknowledges this design tradeoff: *"Acima
deste volume a requisição síncrona deve falhar explicitamente... até que o fluxo assíncrono esteja
disponível"* — an intentionally deferred future path, not a bug). `REPORT_DELIVERY_GAP`: N/A — no
email/scheduled-delivery mechanism exists to have a gap in. `STORAGE_GAPS: 0` — no generated file is
ever persisted to any bucket/storage provider; every export streams directly to the HTTP response and
is discarded server-side immediately after (no `REPORT_FILE` artifact exists to protect or leak, so
`DOWNLOAD_SECURITY`/`CROSS_TENANT_DOWNLOAD` risk is structurally absent — there is no stored file for
Tenant A to ever access Tenant B's copy of).

## 15. Cache

`CACHE_GAP: 0` — no server-side report cache exists at all (every export/definition call is a live
query); nothing to leak between tenants. Frontend (`useReportEntities`/`useReportDefinitions`) uses a
plain TanStack Query 5-minute `staleTime` with the query key `["reports","entities"]`/`["reports",
"definitions"]` — **not tenant-scoped in the key itself**, relying instead on the fact that
`QueryClient` is torn down/recreated on tenant switch (a session-wide behavior of the app's auth/tenant
context, not specific to this module — not re-audited here per the prompt's instruction not to
re-audit the query framework itself, §50). No report *data* (only entity/definition *metadata*, which
is tenant-agnostic — the schema/contract shape is identical for every tenant) is cached client-side, so
no cross-tenant data-leak risk exists via this cache even without a tenant-scoped key.

## 16. Realtime, audit/logging, error/empty states, mocks

`REALTIME_EVENTS: 0` — no `EventsService`/`RealtimeService` injected anywhere in the module; exports are
pull-only. **Audit/logging: real** — `ExportAuditService`/`ImportAuditService` (backed by `@Audit(
'report.exported')`/`@Audit('report.import.committed')` interceptors) record `userId, tenantId, entity,
format, recordCount, status ('success'|'failed'), error?` for every export and `status: 'committed'|
'rolledback'` for every import — genuinely wired, not a stub (confirmed called on every code path in
`ExportEngineService.export()`, both success and catch branches). `MOCK_DATA_GAP: 0` — no
mock/sample/placeholder/hardcoded/random data found anywhere in this module (searched
`mock|sample|placeholder|fake|hardcoded|random` across `apps/api/src/modules/reports` and `apps/web/
src/modules/reports` — the only matches are code comments explaining the *absence* of mocking, e.g.
`Relatorios.tsx`'s own "sem mock" comment). `FALLBACK_GAP: 0` — failures are never silently converted to
0/empty/success; the export path re-throws after auditing the failure (`export-engine.service.ts:118-121,
144-147,158-161`), and the frontend surfaces a real error toast (`Relatorios.tsx:34`) plus an explicit
error state block (`data-testid="reports-error"`) distinct from the empty state
(`data-testid="reports-empty"`, shown only when `reportable.length === 0`, a real zero-state, not an
error masquerading as empty).

## 17. Cross-module report traceability (§13-21, §81 of the prompt)

- **P&L / Accounting reports**: covered in full in §8. `ACCOUNTING_REPORT_TRACEABILITY_COMPLETE: SIM`.
- **Project reports**: `projects` exported as a raw entity table only; no project-grouped computed
  report exists to inherit `accounting.md`'s "P&L por Projeto" bug. `PROJECT_REPORT_TRACEABILITY_
  COMPLETE: SIM`.
- **Artist reports**: the one computed report (`accounting_summary`) is artist-grouped and uses real
  database transaction data exclusively — no manual or externally-synced metric is blended in (no
  external provider call exists in `accounting-summary.report.ts`). `ARTIST_REPORT_TRACEABILITY_
  COMPLETE: SIM`.
- **Catalog reports** (`works`/`phonograms`): raw entity exports, contract-driven, internally consistent
  (guarded by `form-contracts.guard.spec.ts`); do not inherit any Fase-1 `catalog.md` UI-level issue
  since Reports queries physical columns directly, not through catalog's own DTOs/hooks. No
  `limit=50`-style truncation is inherited (§7). `CATALOG_REPORT_TRACEABILITY_COMPLETE: SIM`.
- **Release reports**: `releases` entity export includes the `faixas` repeating group (flattened into
  rows via `releases-faixas.field.ts`, never a second sheet) — this reads the same
  `releases.metadata.faixas` jsonb tracklist that `releases.md` found to be the *only* tracklist
  storage (no relation to `phonograms`/`works`) — Reports' export is therefore consistent with, not
  contradictory to, that finding: it exports exactly what exists, no more. Since `releases.md`'s
  critical `internal_status` bug prevents new releases from ever being created via the real UI, any
  tenant relying solely on that UI would have zero exportable release rows — Reports itself has no
  independent defect here; it correctly reflects upstream data (or the current absence of it).
  `RELEASE_REPORT_TRACEABILITY_COMPLETE: SIM`.
- **Contract reports**: `contracts` entity export, `observacoes` included (§9), no export-specific gap
  beyond the inherited PII risk already documented. `CONTRACT_REPORT_TRACEABILITY_COMPLETE: SIM`.
- **CRM/Leads reports**: `clients` ("Contatos", confirming Contato=Cliente once more, explicitly stated
  in the contract's own header comment) and `leads` both registered, both contract-driven, both
  correctly PII-encrypted where applicable (§9). `CRM_LEADS_REPORT_TRACEABILITY_COMPLETE: SIM`.
- **Marketing reports**: only `marketing_tasks`/`marketing_content_posts` registered — the `campaigns`
  table (site of `marketing.md`'s dual-system and fabricated-metric findings) is **not** in the
  registry at all, so those specific bugs are structurally unreachable through Reports; nothing to
  inherit. `MARKETING_REPORT_TRACEABILITY_COMPLETE: SIM`.
- **Other domains** (monitoring, licensing, audiovisual, events, inventory) — each mapped as a single
  registry row + contract, interface only, not re-audited: `content_detections`/`takedowns`
  (monitoring), `licenses` (licensing), `audiovisual_projects` (audiovisual), `events` (events),
  `inventory_items` (inventory) — all `ACTIVE`, all contract-backed, no domain-internal re-audit
  performed, per instruction.
- **Not-yet-audited source domains** (`employees`→RH, `briefings`): interface mapped only
  (table/contract/label confirmed real and consistent), no deeper claim made about the RH or briefing
  domains themselves, consistent with the instruction to not reauditar or presume completeness of an
  unaudited module.

## 18. Gap taxonomy summary

| Gap type | Count | Detail |
|---|---|---|
| FILTER_MAPPING_MISMATCH | 1 | no date-range operator exists, only exact-match equality (§6) |
| REPORT_SOURCE_GAP | 1 | `searchableColumns` computed but never consumed by the query builder — dormant on both sides (§6) |
| EXPORT_PRIVACY_GAP | 1 | `artists`' bank data (banco/conta/chave_pix/titular_conta) stored/exported unencrypted, inconsistent with the same entity's properly-encrypted email/phone/CPF (§9) |
| XLSX_RULE_VIOLATION | 1 | `TransacaoFormModal.tsx`'s dead `exportFieldList` (3 sheets) — NOT_REPORTS_RESPONSIBILITY, recorded without inflating the Reports module's own (compliant) count (§12) |
| REPORT_QUERY_SECURITY_GAP | 0 | confirmed none — full allowlist + parameterization (§5) |
| TRUNCATION_GAP | 0 | confirmed none — fails closed at 50k rows, first module this session without this gap (§7) |
| EXPORT_COMPLETENESS_GAP | 0 | confirmed full-filtered-dataset export, never page-only (§7) |
| SPREADSHEET_INJECTION_GAP | 0 | confirmed real, consistent neutralization (§11) |
| CACHE_GAP | 0 | no server cache; frontend metadata cache carries no tenant-data leak risk (§15) |
| FALLBACK_GAP | 0 | failures never masked as success/empty (§16) |
| MOCK_DATA_GAP | 0 | none found (§16) |
| AUTHORIZATION_GAP | 0 | both tiers gated; asymmetry noted as observation only (§10) |
| TENANT_ISOLATION_GAP | 0 | defense-in-depth confirmed at 4 independent layers (§10) |
| STORAGE_GAP | 0 | N/A — no persisted report file exists (§14) |
| SAVED_REPORT_GAP / SCHEDULED_REPORT_GAP / REPORT_DELIVERY_GAP | 0 each | features confirmed absent, not broken (§14) |
| PDF_GENERATION_GAP | 0 | N/A — confirmed no PDF generation exists anywhere (§13) |
| REALTIME_GAP | 0 | N/A — nothing claims to be realtime (§16) |
| REAL_MAPPING_GAP | 0 | — |

`UNMAPPED_*: 0` across every category. `UNKNOWN_REPORT_CLASSIFICATIONS: 0`.

## 19. Overall assessment

This is, by a clear margin, **the most rigorously engineered module found in this entire audit
series** — closed allowlists at every layer, real parameterized SQL, real tenant isolation
defense-in-depth, real formula-injection protection, a fail-closed row limit instead of the silent
`limit=50` truncation pattern found almost everywhere else, and a real audit trail. Its few genuine
gaps are narrow and specific (an inconsistent encryption tier for one field group, a dormant search
capability, one disconnected dead file belonging to a different module) rather than the structural
create/edit-breaking defects found in several other modules this session (`releases`, `projects`).

## Contadores finais (Zero-Gap)

```
MODULE_STATUS: COMPLETE
REPORTS_DOMAIN_MEANING: EXPORT_CENTER (entity-driven XLSX bulk export/import, 22-table closed registry)
  + 1 DOMAIN_REPORT_AGGREGATOR (accounting_summary, P&L by artist, computed)
SUBDOMAINS_AUDITED: 4
COMPONENTS_AUDITED: 2
HOOKS_AUDITED: 5
REPORTS_AUDITED: 22
ACTIVE_REPORTS: 22
PARTIAL_REPORTS: 0
STATIC_REPORTS: 0
STUB_REPORTS: 0
DEAD_OR_ORPHAN_REPORTS: 0
TABLE_REPORTS: 22
CHART_REPORTS: 0
KPI_REPORTS: 0
DISPLAY_FIELDS: 21 contracts x variable field counts (see report-inventory.json for exact per-entity counts)
FILTERS: per-entity, allowlisted (equality only)
DATE_RANGE_FIELDS: 0
SEARCH_FIELDS: 0 (defined but non-functional, §6)
SORT_FIELDS: per-entity, allowlisted (real)
GROUP_BY_FIELDS: 1 (accounting_summary, GROUP BY artist)
CALCULATIONS_AUDITED: 4 (receitas, despesas, resultado, margem)
CSV_EXPORTS: 0
XLSX_EXPORTS: 22 (one per registered entity)
PDF_EXPORTS: 0
PRINT_FLOWS: 0
XLSX_RULE_VIOLATIONS: 1 (external to Reports — TransacaoFormModal.tsx dead code, §12)
SAVED_REPORTS: 0
SCHEDULED_REPORTS: 0
BACKGROUND_REPORT_JOBS: 0
STORAGE_FIELDS: 0
PII_FIELDS: 6 classes found (person name via nome fields, email, phone, tax_id, bank_data, contract/free-text PII)
PII_EXPORT_FIELDS: present on artists/employees/clients (encrypted) + artists bank data (unencrypted) + observacoes across 9 contracts
PERMISSIONS_AUDITED: 2 tiers (admin: metadata; manager: export/import)
AUTHORIZATION_GAPS: 0
TENANT_ISOLATION_GAPS: 0
CODE_FIELD_ONLY: 0
DATABASE_COLUMN_ONLY: 0
TYPE_MISMATCH: 0
ENUM_MISMATCH: 0
RELATION_MISMATCH: 0
DISPLAY_MAPPING_MISMATCH: 0
FILTER_MAPPING_MISMATCH: 1
SORT_MAPPING_MISMATCH: 0
DATE_RANGE_MISMATCH: 1 (equality-only, no true range operator)
GROUPING_MISMATCH: 0
CALCULATION_MISMATCH: 0
REPORT_SOURCE_GAPS: 1
CLIENT_SIDE_AGGREGATION_GAPS: 0
PAGINATION_GAPS: 0
TRUNCATION_GAPS: 0
EXPORT_COMPLETENESS_GAPS: 0
EXPORT_COLUMN_MISMATCHES: 0
EXPORT_PRIVACY_GAPS: 1
SPREADSHEET_INJECTION_GAPS: 0
PDF_GENERATION_GAPS: 0
SAVED_REPORT_GAPS: 0
SCHEDULED_REPORT_GAPS: 0
REPORT_DELIVERY_GAPS: 0
STORAGE_GAPS: 0
CACHE_GAPS: 0
FALLBACK_GAPS: 0
MOCK_DATA_GAPS: 0
REPORT_QUERY_SECURITY_GAPS: 0
LARGE_EXPORT_GAPS: 0
REALTIME_GAPS: 0
REAL_MAPPING_GAPS: 0
ACCOUNTING_3_SHEET_EXPORT_STATUS: DEAD, NOT_REPORTS_RESPONSIBILITY
CONTRACT_OBSERVACOES_EXPORTED: SIM
PII_RISK_INHERITED_FROM_CONTRACTS: SIM
ACCOUNTING_REPORT_TRACEABILITY_COMPLETE: SIM
ARTIST_REPORT_TRACEABILITY_COMPLETE: SIM
CATALOG_REPORT_TRACEABILITY_COMPLETE: SIM
CONTRACT_REPORT_TRACEABILITY_COMPLETE: SIM
CRM_LEADS_REPORT_TRACEABILITY_COMPLETE: SIM
PROJECT_REPORT_TRACEABILITY_COMPLETE: SIM
RELEASE_REPORT_TRACEABILITY_COMPLETE: SIM
MARKETING_REPORT_TRACEABILITY_COMPLETE: SIM
UNMAPPED_REPORTS: 0
UNMAPPED_DISPLAY_FIELDS: 0
UNMAPPED_SOURCE_FIELDS: 0
UNMAPPED_FILTERS: 0
UNMAPPED_SORT_FIELDS: 0
UNMAPPED_GROUPINGS: 0
UNMAPPED_CALCULATIONS: 0
UNMAPPED_EXPORT_FIELDS: 0
UNMAPPED_PII_FIELDS: 0
UNMAPPED_STORAGE_FIELDS: 0
UNKNOWN_REPORT_CLASSIFICATIONS: 0
```

NEXT_MODULE: rh
