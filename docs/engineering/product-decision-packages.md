# Product decision packages (foundation closure)

Date: 2026-10-03. Mode: read-only investigation. Nothing below is implemented; no decision is invented. Each package gives the owner the facts that cannot be deduced from the repository and the exact question to answer. Real-environment counts are `EXTERNAL_REQUIREMENT` (no dev, staging or production database is reachable from this workspace); the disposable base (333 migrations applied) has 0 rows in every table cited.

Domain separations preserved in every option: Project is not Release; Release is not Distribution (status); Release is not Registry; Release is not Phonogram; Phonogram is not Work; Work shares are not Phonogram shares; external distributor/society data is not internal company finance.

---

## D-01 Release status

```text
DECISION_ID: D-01 (BLK-RELEASES-STATUS-CHECK)
DOMAIN: releases (commercial packaging of released music)
CURRENT_STATE: ReleaseStatus has 10 values (draft, metadata_pending, assets_pending, review, approved, scheduled, distributed, released, archived, cancelled). releases.status is varchar(50) default 'draft' with NO CHECK constraint. Four legacy values (rejeitado, takedown, take_down, remocao) were left untouched by migration 20260928000019 because no ReleaseStatus equivalent exists.
CURRENT_DATA: disposable base: 0 releases. Production/staging: EXTERNAL_REQUIREMENT (census SQL in docs/engineering/release-status-census.md section 3, with the lower(trim()) variant).
CURRENT_IMPLEMENTATION: enum packages/types/src/enums.ts; labels status-labels.pt-br.ts; workflow releases.workflow.ts (states = Object.values(ReleaseStatus)); DTO @IsEnum; the web display map release-status.tsx tolerates only the four legacy values (display rejected / takedown) and shows anything else as incomplete. Takedowns are a separate entity with their own status (takedowns.status has rejected). No writer of the four values exists (form does not write status; API accepts only enum values).
CANONICAL_RULES_ALREADY_KNOWN: Release != Distribution; a takedown rejection is already modeled in takedowns; releases has no platform_status column; cancelled is reachable only from pre-scheduled states; a CHECK may be added only after a census proves 0 rows outside the set.
WHAT_IS_UNDEDUCIBLE: whether the business wants a Release to carry its own terminal "rejected by distributor" and "taken down" state; whether any real rows hold the four values; if they do, the per-tenant meaning of each row.
OPTION_A: add rejected and taken_down to ReleaseStatus (workflow transitions, roles, events, labels), backfill rejeitado -> rejected and takedown/take_down/remocao -> taken_down keeping metadata.legacy_status, then chk_releases_status with 12 values.
OPTION_B: move the four values to cancelled keeping metadata.legacy_status, then chk_releases_status with the 10 current values.
OPTION_C: keep the four values as unmapped residue, no CHECK, until a stated date or condition.
OPTION_D: conditional on the census: if it shows 0 rows with the four values, add only chk_releases_status with the 10 current values and no data migration.
CONSEQUENCES_A: second source of truth next to takedowns/distribution unless transitions are defined to derive from them; new RBAC and audit edges; terminal-state removal later is destructive; old web builds map the new values to incomplete during the window.
CONSEQUENCES_B: rejected and taken-down releases become cancelled, a semantic loss (cancelled means cancelled before launch; a taken-down release was live); reversible only through metadata.legacy_status while untouched.
MIGRATION_IMPACT: A: data migration + enum + CHECK(12). B: data-only migration + CHECK(10). C: none. D (census shows 0 rows): CHECK(10) only.
API_IMPACT: A: DTO, filter, workflow, events, external-data export emit new values. B: none. C: none.
FRONTEND_IMPACT: A: map + labels + filters + legacy test; B: remove the legacy alias block once census is 0; C: none.
DATA_IMPACT: A/B rewrite release rows with business meaning (L5); C none.
SECURITY_IMPACT: A adds transitions needing role decisions; B/C none beyond audit of the rewrite.
TEST_IMPACT: A: release-status tests, workflow specs, role matrix, contract spec, migration spec, verify script. B: migration spec + verify script, remove legacy web tests with aliases.
REVERSIBILITY: B and A reversible only while metadata.legacy_status exists and rows were not edited afterwards; removal of enum values after production use is destructive.
EXACT_OWNER_DECISION_REQUIRED: "After reading the per-tenant census of releases.status in staging and production: choose (A) rejected and taken_down become ReleaseStatus values with these transitions [from -> to, roles] and PT-BR labels [labels]; (B) rows rejeitado/takedown/take_down/remocao become cancelled accepting the loss of the rejected/taken-down distinction; (C) keep as residue until [date/condition]; or (D) census is 0, add chk_releases_status with the 10 current values only. Authorization covers [staging | production] and names the executor." Full wording and consequence tables: docs/engineering/release-status-census.md.
```

---

## D-02 Transactions v2 ledger

```text
DECISION_ID: D-02 (BLK-TRANSACTIONS-V2-CUTOVER)
DOMAIN: internal company finance (not external royalties, not distributor/society statements)
CURRENT_STATE: two ledgers. `transactions` (v1) is live: entity TransactionEntity, English columns (CZ-041), module modules/transactions, consumers financial-classification automation, analytics, contract-events handler (writes TransactionEntity), financial-categories delete guard, report computed fields (accounting-summary), report export query builder and import path, the audit interceptor (maps the transaction entity to the table), the invoices legacy-fields import of PAYMENT_METHODS, the event-wired financial-rules module, web accounting module. `financial_transactions` (v2, migration 20260718000004, Phase 13A) has no entity, no module, no writer; its only reader is the delete guard of financial-categories (counts rows by category). The v2 design also created transaction_allocations (parallel dimensions project/artist/phonogram/release, largest-remainder), financial accounts, counterparties, cost centers, budgets and performance_metric_entries (migrations M0-M9); financial_categories (M2) IS live and v1 links to it through transactions.financial_category_id (logical, no FK).
CURRENT_DATA: disposable base: transactions 0, financial_transactions 0. Real: EXTERNAL_REQUIREMENT.
CURRENT_IMPLEMENTATION: v1 stores one date (transaction_date), a free-text category/subcategory plus financial_category_id and snapshot, cost_center and bank accounts as strings, installment fields flattened on the row, single optional FKs artist_id/contract_id/project_id/event_id, status TransactionStatus. v2 requires amount > 0 with sign from type/category nature, three dates (competence mandatory, due, settlement), typed account/counterparty/cost-center FKs, installment groups, reversal as a linked inverse row, settled immutability, optimistic locking, allocations in parallel dimensions never summed across dimensions. Every canonical-form-order rebuild migration of artists/projects/phonograms/releases/contracts/events had to recreate the composite FKs of the v2 tables (maintenance cost).
CANONICAL_RULES_ALREADY_KNOWN: company finance never mixes with external royalty or distributor/society data (performance_metric_entries are explicitly never a transaction, invariant I12); v1 columns are already canonical English; financial_categories is the single category source. A recorded Product Owner position exists in the frozen gap register (docs/backend-v2/gap-resolution/canonical-gap-register.json, GAP-0009, poDecisionReference REMOVE_SECOND_ACCOUNTING_LAYER, PO-VERIFY-027): the rewrite architecture will not use financial_transactions, financial_accounts, cost_centers, counterparties, transaction_allocations, performance_metric_entries, budgets or budget_revisions, and `transactions` remains the single canonical ledger. It is a historical record and it did not authorize any drop: it must be re-confirmed for the current system. The same register keeps GAP-0009 open (entityLinks gap against `transactions`) and forbids proposing transaction_allocations as its solution, so the position is not a closure of that gap.
WHAT_IS_UNDEDUCIBLE: whether the recorded 2026 position (keep `transactions`, no second ledger) still stands and authorizes retiring the v2 tables (it is a dated record, the migrations still exist and nothing was dropped); whether accrual accounting (competence date), reversals-as-inverse-rows, accounts and parallel allocation dimensions are required product capabilities now; whether real tenants have data that must move.
OPTION_A: keep transactions as the ledger; retire the v2 ledger tables (financial_transactions, transaction_allocations and the v2 accounts/counterparties/cost-center/budget tables the owner declares unused) through an archive-first destructive migration; keep financial_categories.
OPTION_B: cut over to financial_transactions: entity + module + API, migration plan v1 -> v2 (type/status mapping, sign convention, date triple, category/cost-center/account resolution, installment grouping, allocation backfill), dual-write window, then retire v1 columns.
OPTION_C: keep v1 as ledger and add the specific v2 capabilities the owner names (for example allocations or reversal) as columns/tables on v1; retire the rest of v2.
CONSEQUENCES_A: aligned with the recorded Product Owner position; simplest; loses the accrual and allocation design; removes FK maintenance burden; destructive for empty tables (low data risk if the census is 0).
CONSEQUENCES_B: largest change: every transaction consumer (web accounting, analytics, automation, contracts handler, reports, exports) changes; sign convention and dates need accounting rules; risk of silent amount/date semantic drift.
MIGRATION_IMPACT: A: archive-then-drop of v2 tables. B: schema entity + data migration + later drop of v1 columns. C: additive columns/tables + drop of unused v2 tables.
API_IMPACT: A none. B new module/DTOs/contract, deprecation window for v1. C additive fields.
FRONTEND_IMPACT: A none. B accounting module rewrite of services and mappers. C forms for the chosen capabilities.
DATA_IMPACT: A: 0 rows disposable, real EXTERNAL_REQUIREMENT. B: all real transactions migrated. C: none until used.
SECURITY_IMPACT: tenant isolation and RLS exist on v2 (M7); B must preserve RLS and optimistic locking; A removes attack surface.
TEST_IMPACT: B: contract, migration, reconciliation (totals equal before/after) and accounting-rule tests; A: migration + static specs that mention v2; C: tests of the added capabilities.
REVERSIBILITY: A reversible from the archive while kept; B reversible only during the dual-write window; C additive.
EXACT_OWNER_DECISION_REQUIRED: "Confirm or revoke the recorded position GAP-0009 / PO-VERIFY-027 (`transactions` is the single ledger, no second accounting layer). Which table is the company ledger: (A) `transactions` stays, retire the v2 ledger tables [list the tables to retire]; (B) cut over to `financial_transactions` with these accounting rules [sign convention, which of competence/due/settlement date is the reporting date, reversal rule] and this migration window; or (C) `transactions` stays and gains these v2 capabilities [list]. Confirm that external distributor/society royalty data stays outside both ledgers. The census of real rows in both tables is attached [EXTERNAL_REQUIREMENT]."
```

---

## D-03 Shares registry

```text
DECISION_ID: D-03 (BLK-SHARES-REGISTRY-CREATION)
DOMAIN: rights (Work shares and Phonogram shares) and registry submission (ABRAMUS/ECAD)
CURRENT_STATE: one `shares` table mixes three concepts told apart only by heuristics: internal release shares (share_type internal_release), external receivables (external_receivable) and registry splits (share_type IS NULL, "NULL = registry split", transitional rule in share-eligibility.util.ts). Obra (Work) shares and Fonograma (Phonogram) shares are the same table, distinguished by which of work_id / phonogram_id is set (both nullable, no exclusivity CHECK). The registry block (rights_holder_id, publisher_id, role, territory, instrument, credited_name, is_primary, is_featured, start_date, end_date) came with migration 20260601000001; migration 20260601000002 backfilled rights_holders from existing shares and linked shares.rights_holder_id (best effort); a rights_holders entity, service and controller exist.
CURRENT_DATA: disposable base: shares 0, releases 0. Real: EXTERNAL_REQUIREMENT (census: rows per share_type NULL/non-NULL, per work_id/phonogram_id, non-null counts of each registry column).
CURRENT_IMPLEMENTATION: readers: society-payload-builder.service.ts (credited_name ?? holder_name, role ?? party_role, territory), registry validators and external-data-exchange via isRegistryEligibleShare. Producers: the web ShareFormModal sends only share_type internal_release or external_receivable (never NULL, never a registry field), so the UI is not a producer of registry splits; rights_holder_id is also copied unchanged by the rebuild migration 20260719000014. Writers in application code: none for the registry block (CreateShareDto.role is an English alias mapped onto party_role and deleted before persistence); the only writer of rights_holder_id is the 2026-06 migration.
CANONICAL_RULES_ALREADY_KNOWN: Work shares != Phonogram shares; a registry split is not a financial share; percentages follow chk_shares_percentage_range; any change of a share affects payments and needs human approval.
WHAT_IS_UNDEDUCIBLE: whether the product will create registry splits inside this system (versus importing them), and the explicit marker for them (a 'registry' share_type token versus NULL); whether Obra and Fonograma shares keep sharing one table; how historical NULL rows (financial rows written before share_type existed) are classified.
OPTION_A: build the registry-share creation flow end to end (DTO fields, service writes, rights_holder linkage, UI), add an explicit share_type 'registry' with CHECK, backfill historical NULL rows after a census, and add an exclusivity rule work_id XOR phonogram_id.
OPTION_B: declare the registry block unused: stop reading it in payload builders, retire rights_holder_id/publisher_id/role/territory/instrument/credited_name/is_primary/is_featured/start_date/end_date through an archive-first destructive migration, keep NULL semantics replaced by explicit token.
OPTION_C: keep the block as is (no creation path) until the registry integration is scheduled; no change.
CONSEQUENCES_A: registry submissions get real data; requires rights and legal review of eligibility and percentage totals per right type (100% per Work and per Phonogram separately); migration of ambiguous NULL rows is an owner call.
CONSEQUENCES_B: removes a half-built feature and its readers; registry payloads would depend only on holder_name/party_role/percentage; destroys the (possibly backfilled) rights_holder links.
MIGRATION_IMPACT: A: CHECKs + backfill (L5 data). B: destructive column drops (archive first). C none.
API_IMPACT: A: new DTO fields and creation endpoint behavior; B: payload builder and validators lose fields; C none.
FRONTEND_IMPACT: A: share form gains registry section; B none; C none.
DATA_IMPACT: A: reclassification of NULL rows; B: loss of linkage if any; C none.
SECURITY_IMPACT: shares carry holder documents (personal data): any new creation path needs authorization and PII review; tenant isolation unchanged.
TEST_IMPACT: A: creation contract, eligibility, total-100 per right type, negative tests; B: payload-builder specs, migration spec; C none.
REVERSIBILITY: A additive until backfill; B reversible from the archive while kept; C n/a.
EXACT_OWNER_DECISION_REQUIRED: "For registry splits (ABRAMUS/ECAD): (A) create them in this system with the explicit marker share_type='registry' and these rules for Obra shares [rules] and Phonogram shares [rules], and classify historical NULL rows as [rule]; (B) the registry block is unused and may be retired after archive; or (C) leave as is until [date/condition]. State whether Obra and Fonograma shares stay in one table. The census of real shares is attached [EXTERNAL_REQUIREMENT]."
```

---

## D-04 Leads internal notes

```text
DECISION_ID: D-04 (BLK-LEADS-INTERNAL-NOTES)
DOMAIN: CRM leads
CURRENT_STATE: the premise recorded in the ledger (the lead form writes `observacoesInternas` into metadata) is no longer true. Verified 2026-10-03: no web code reads or writes `internalNotes` or `observacoesInternas` for leads (git grep over apps/web, packages, e2e, scripts: 0 hits; the lead form mapper writes crmInternalData with priority, leadSource, responsiblePerson, marketingCampaign, nextFollowUpAt, estimatedValue, temperature only; LeadViewModal does not render notes). The only remaining occurrence is the API read/write vocabulary `CRM_KEYS` in lead-vocabulary.ts (observacoesInternas -> internalNotes, and probabilidadeFechamento -> closeProbability, which the form also does not send) used by canonicalCrmInternalData on write and by migration 20260928000011 to rename keys inside stored rows.
CURRENT_DATA: stored crm_internal_data.internalNotes: EXTERNAL_REQUIREMENT (census: count of leads whose crm_internal_data ? 'internalNotes' or ? 'observacoesInternas'). Disposable: 0 leads.
CURRENT_IMPLEMENTATION: producers: none in the web; the API accepts the key from any caller of POST/PATCH leads (free-form jsonb). Consumers: none. Lead interactions (lead_interactions.notes) are a separate notes mechanism (not traced by the independent review). Other readers of crm_internal_data: the web leads hooks, LeadsPage and LeadsTable (other keys), the reports import canonicalizer (canonicalCrmInternalData) and the report form contract, which lists the leads crm columns without internalNotes or closeProbability; the pt-BR label `internalNotes` is shared with artists (a different concept).
CANONICAL_RULES_ALREADY_KNOWN: internal CRM follow-up data lives in crm_internal_data with English keys; per-interaction notes are lead_interactions.notes.
WHAT_IS_UNDEDUCIBLE: whether any stored lead carries internal notes the business wants to keep, and whether a per-lead free-text internal note is a wanted feature (distinct from interaction notes).
OPTION_A: remove the dead key: drop internalNotes (and the unused closeProbability) from the write vocabulary after the census; if stored values exist, archive them first.
OPTION_B: make it a real feature: persisted internal notes field end to end (DTO, column or documented jsonb key, form input, view, permission, audit).
OPTION_C: keep the vocabulary entry as a read-only legacy mapping for stored rows; stop accepting it on write.
CONSEQUENCES_A: removes an accepted-but-ignored write path; callers sending it get it dropped; stored values (if any) archived.
CONSEQUENCES_B: new field with PII/permission implications (internal notes about people).
MIGRATION_IMPACT: A: none if census 0; otherwise archive + key strip (data). B: optional column. C none.
API_IMPACT: A/C: write path rejects or ignores the key. B: new documented field.
FRONTEND_IMPACT: A/C none (already absent). B: form + view.
DATA_IMPACT: A: strip of a jsonb key (non-destructive if archived). B none. C none.
SECURITY_IMPACT: B: notes about leads are personal data: role gating and audit. A/C reduce surface.
TEST_IMPACT: A/C: vocabulary spec update; B: contract + form tests.
REVERSIBILITY: A reversible from the archive; B additive; C n/a.
EXACT_OWNER_DECISION_REQUIRED: "Leads internal notes: (A) the field is dead, remove the write path (and archive any stored values found by the census); (B) build it as a real feature with these permissions [roles]; or (C) keep only as legacy read mapping. Stored values found in [environments]: [count]."
```

---

## D-05 External-source columns

```text
DECISION_ID: D-05 (BLK-EXTERNAL-SOURCE-SCAFFOLD)
DOMAIN: catalog (works and phonograms) and external identifiers
CURRENT_STATE: six scaffold columns exist: works and phonograms external_source, external_source_id, external_source_synced_at (baseline 2026-06-21, renamed from origem_externa* by migration 20260928000024). They are mapped in the entities, labelled in the pt-BR report field labels (field-labels.pt-br.ts) and declared read-only in the report contracts (external_source and external_source_synced_at; external_source_id not declared) and typed in web catalog.types.ts. No DTO field, no writer, no frontend use, no integration.
CURRENT_DATA: disposable: 0 rows. Real: EXTERNAL_REQUIREMENT (census: non-null counts per column).
CURRENT_IMPLEMENTATION: the live model for external identifiers is the separate external_identifiers table (entity_type, entity_id, provider, identifier_type, identifier_value, is_primary) with its own service, controller, validators and cross-tenant security spec, plus external_data_submissions and webhook events in core/external-data (distributor, society and payout providers are unconfigured placeholders). The scaffold columns duplicate that model and carry the only synced-at timestamp.
CANONICAL_RULES_ALREADY_KNOWN: one concept, one source of truth (naming-canonical rule); external provider data is evidence, never internal truth; identifiers of a Work, a Phonogram and a Release stay separate.
WHAT_IS_UNDEDUCIBLE: whether an external catalog sync that needs a per-entity "last synced at" is planned and whether it will use these columns or external_identifiers.
OPTION_A: drop the six columns (archive first) and, if a sync timestamp is later needed, add it to external_identifiers (provider-scoped).
OPTION_B: keep the columns for a planned catalog-sync integration (record owner and date).
OPTION_C: keep for now, remove them from the report contracts and web types so they are inert, decide later.
CONSEQUENCES_A: removes duplicate source of truth; report contracts lose two read-only columns; requires the real census to be 0 or archived.
CONSEQUENCES_B: keeps scaffolding with no producer; must be given an owner and a deadline or it stays a finding.
MIGRATION_IMPACT: A: archive-then-drop (L5 destructive, own approval). B/C none.
API_IMPACT: A: report contract and entity change; B none; C contract change.
FRONTEND_IMPACT: A/C: remove optional fields from catalog.types.ts. B none.
DATA_IMPACT: A: values (if any) archived then dropped. B/C none.
SECURITY_IMPACT: none specific; fewer unused columns.
TEST_IMPACT: A: report-contract specs, verify-canonical-column-order, entity specs, migration spec.
REVERSIBILITY: A reversible from the archive while kept; B/C reversible.
EXACT_OWNER_DECISION_REQUIRED: "External-source columns of works and phonograms: (A) drop the six columns (archive first), using external_identifiers as the single model for external ids; (B) keep for the planned catalog sync [owner, date, which model carries last-synced-at]; or (C) keep inert for now. Real non-null counts in [environments]: [numbers]."
```

---

## D-06 Unwired UI handlers and test-only resolver

```text
DECISION_ID: D-06 (BLK-UNWIRED-UI-SCAFFOLD)
DOMAIN: frontend (schedule, settings users, contracts utils)
CURRENT_STATE: four pieces of code call the legacy-compatibility helpers but nothing reachable in production runs them: (1) Schedule.tsx handleExcelExport / handleExcelImport (no button or input references them, excelInputRef is never attached) and the unused `type` property of schedulerEvents; (2) Settings.tsx user status filter (state can only be set to "all status" through clearUserFilters, no UI setter exists); (3) apps/web contract-variables resolver (no production importer, used only by its tests).
CURRENT_DATA: none (client-side only).
CANONICAL_RULES_ALREADY_KNOWN: one concept, one authoritative implementation; no permanent scaffolding disguised as a fix (naming-canonical rule); spreadsheet exchange is XLSX only (csv-engineer rule).
WHAT_IS_UNDEDUCIBLE: whether the Schedule spreadsheet import/export, the Settings user status filter and contract variable resolution are planned features.
OPTION_A: delete the dead handlers, filter branch and resolver (and their tests).
OPTION_B: wire them as real features (UI control, permission check, tests) with an owner and date.
OPTION_C: keep as inert scaffolding with an owner and a deadline (stays a recorded finding until then).
CONSEQUENCES_A: smaller surface, removes the unproven legacy-compat call sites; features must be rebuilt if wanted later.
CONSEQUENCES_B: product work; import must follow the import-automation preview/approval rules.
MIGRATION_IMPACT: none.
API_IMPACT: none for A and C; B may reuse the existing import endpoints.
FRONTEND_IMPACT: A removes code; B adds UI; C none.
DATA_IMPACT: none.
SECURITY_IMPACT: B: import handlers must validate files and neutralize formulas; A/C none.
TEST_IMPACT: A removes the resolver tests; B adds behavior tests; C none. The wiring-proof exemptions in docs/naming/audit/compat-wiring-exemptions.json name this decision and are removed when it is decided.
REVERSIBILITY: A recoverable from git history; B/C reversible.
EXACT_OWNER_DECISION_REQUIRED: "Schedule spreadsheet import/export, Settings user status filter, contract variable resolver: for each, (A) delete, (B) wire as a feature [owner, date], or (C) keep inert [owner, deadline]."
```
