# MUSIC OS 360 — Naming Normalization Discovery Log

**Scope:** full-schema English-normalization mandate. **Method:** 4 parallel read-only discovery passes over `apps/api/src/database/entities.ts` (3645 lines / 136 entities, split in quarters), zero code changed yet. **Baseline:** `dev @ 56b55c46f35d92cabdd8a98bebf7fdfe3a9c1cac`.

This document is the mandatory canonicalization step (§B of the mission) — it must exist and be reviewable before any rename executes. It is a discovery artifact, not a changelog: nothing described here has been applied to code yet except where explicitly marked EXECUTED.

---

## 1. Table names

Zero Portuguese table names found anywhere in `entities.ts`. All 136 `@Entity('...')` table names are already English. **No table renames required.** The normalization work is entirely at the column level.

## 2. The flagship cross-table FK family — `artist_id` vs `artista_id`

**Concept: Artist** (FK to `artists.id`)

| Variant | Where used |
|---|---|
| `artist_id` (English) | `artist_platform_profiles`, `artist_metric_snapshots`, `career_stage_snapshots`, `market_benchmark_snapshots`, `marketing_projects`, `marketing_assets`, `audiovisual_projects` |
| `artista_id` (Portuguese) | `works`, `phonograms`, `contracts`, `transactions`, `campaigns`, `briefings` (unused/unmapped relation), `events`, `projects`, `releases` (backs the English-named `ReleaseEntity.artist` relation — `@JoinColumn({name:'artista_id'})`), `shares`, `takedowns`, `artist_goals`, `content_detections`, `ecad_reports`, `licenses` |

**Canonical decision: `artist_id`** (matches the already-English relation property names on every entity — e.g. `ReleaseEntity.artist`, `ShareEntity`'s artist relation — and matches the in-module tables' existing spelling).

**This is THE highest-value, best-understood rename in the whole inventory** — already cross-validated by two independent prior audits plus this discovery pass, with the full list of 15 affected tables confirmed three times.

## 3. The `work`/`obra` FK family

**Concept: Work** (FK to `works.id`)

| Variant | Where used |
|---|---|
| `work_id` (English) | `work_participants` |
| `obra_id` (Portuguese) | `phonograms`, `licenses`, `shares` (backs `ShareEntity.work`'s `@JoinColumn({name:'obra_id'})` — English relation, Portuguese column), `takedowns`, `content_detections`, `ecad_reports` |

**Canonical decision: `work_id`.**

## 4. The `recording`/`fonograma` FK family

| Variant | Where used |
|---|---|
| (no English variant found yet) | `shares.fonograma_id` → FK to `phonograms` |

**Canonical decision: `recording_id`** — REQUIRES_REVIEW: the target table itself is named `phonograms` (English), not `recordings`. Renaming the FK column to `recording_id` while the target table stays `phonograms` creates a new inconsistency (FK name implies a `recordings` table that doesn't exist). **Open question for a product decision, not resolved by this discovery pass**: either (a) keep the FK as `phonogram_id` for column-to-table consistency, or (b) rename the `phonograms` table itself to `recordings` too (a much larger, separate blast radius — every `phonograms` reference in the whole codebase, not just this one FK). Flagging rather than guessing.

## 5. The `client`/`cliente` FK family

| Variant | Where used |
|---|---|
| `client_id` (English) | `clients` is the table itself; used correctly as a bare `id` there |
| `cliente_id` (Portuguese) | `contracts`, `leads`, `invoices`, `licenses` |

**Canonical decision: `client_id`.**

## 6. The `project`/`projeto`, `campaign`/`campanha`, `release`/`lancamento` FK families

- `projeto_id` (works) → canonical `project_id` (already used correctly elsewhere, e.g. `project_tracks.project_id`).
- `campanha_id` (briefings, backs `BriefingEntity.campaign`'s JoinColumn) → canonical `campaign_id`.
- `lancamento_id` (contracts, shares) → canonical `release_id` — REQUIRES_REVIEW: confirm both usages actually target the `releases` table (not a distinct "lançamento" business concept) before executing; not verified by this discovery pass.

## 7. Repeated generic-noun families (same PT word, many tables, one canonical English word each)

These are not PT/EN pairs coexisting — they're the same Portuguese word reused consistently across unrelated tables. One canonical mapping applies uniformly to all occurrences listed:

| Portuguese | Canonical English | Tables (non-exhaustive per discovery) |
|---|---|---|
| `titulo` | `title` | works, phonograms, contracts, briefings, events, projects, releases, takedowns, artist_goals |
| `tipo` | `type` | works, phonograms, contracts, transactions, invoices, campaigns, events, projects, releases, takedowns, artist_goals, content_detections, ecad_reports, leave_requests, licenses, financial_rules |
| `observacoes` | `notes` | artists, phonograms, contracts, transactions, clients, events, projects, releases, shares, takedowns, inventory_items, licenses |
| `descricao` | `description` | invoices, lead_interactions, campaigns, events, projects, takedowns, contract_templates, financial_rules |
| `duracao` | `duration` | works, phonograms |
| `genero`/`genero_musical` | `genre`/`music_genre` | artists, phonograms, projects, project_tracks, releases |
| `idioma` | `language` | works (⚠ collides with existing English `works.language`, see §9), project_tracks, releases |
| `nome` | `name` | employees, inventory_items, financial_rules, clients, leads, work_participants, project_tracks, project_track_participants |
| `categoria` | `category` | inventory_items, financial_rules |
| `data_inicio`/`data_fim` | `start_date`/`end_date` | contracts, campaigns, events, leave_requests, licenses, artist_goals |
| `valor` | `amount`/`value` | contracts, transactions, invoices, financial_rules, licenses |
| `cidade`/`estado`/`pais` | `city`/`state`/`country` | clients, leads |
| `documentos` | `documents` | artists, contracts, shares |
| `ativo` | `active`/`is_active` | contract_templates, financial_rules (outliers — rest of schema already uses English `active`/`is_active`) |
| `ordem` | `sort_order` | work_participants, project_tracks, project_track_participants (outliers — rest of schema already uses English `sort_order`, e.g. contract_service_types, knowledge_categories) |

## 8. Concept: Holder (rights-holder / titular / detentor) — the clearest single-entity example of the mixed-spelling problem

`ShareEntity` alone has **three different spellings of the same concept in one row**: `titular_nome` (name), `detentor` (name, different word), `rights_holder_id` (already-English FK to a separate holders table). Canonical decision: `holder_name` for the free-text name fields (`titular_nome`, `detentor` — REQUIRES a data-reconciliation decision on which of the two is actually populated/authoritative before merging, not resolvable from schema alone), `holder_document` for `titular_doc`. `rights_holder_id` (already English) is untouched.

## 9. Confirmed same-table PT/EN duplicate-column collisions — DO NOT blind-rename, resolve data first

These are NOT simple renames — both columns already exist and (per the discovery agents) may both be populated. Renaming the Portuguese one without reconciling would either collide (two columns wanting the same name) or silently orphan data:

| Table | Portuguese column | Existing English twin | Resolution needed before rename |
|---|---|---|---|
| works | `idioma` | `language` | Confirm which is authoritative; likely `idioma` is legacy, `language` is the maintained column — verify via a data audit, not assumption |
| works | `outros_titulos` | `alternative_titles` | same |
| works | `letra_completa` | `lyrics` | same |
| works | `criada_por_ia` | `ai_used` | possibly different semantics (boolean flag vs. a fuller AI-usage record) — needs product clarification, not just a data check |
| works | `instrumental` (varchar) | `is_instrumental` (boolean) | different TYPE, not just name — a straight rename is impossible without a type-coercion migration |
| phonograms | `data_lancamento` | `release_date` | same pattern as works |
| phonograms | `gravacao_original` | `recording_date` | same |
| phonograms | `duracao_seg` | `duration_seconds` | different granularity (component vs. total) — REQUIRES_REVIEW, may not actually be the same concept |
| phonograms | `arquivo_audio` (jsonb) | `audio_file_id` (presumably a FK/id) | different type/shape — needs review |
| phonograms | `pais_origem` | `country_of_recording` | uncertain if same concept |
| invoices | `data_vencimento` + `vencimento` (both PT) | `due_date` (English, Stripe-sourced) | **three columns, same apparent concept** — highest-priority data-reconciliation case in the whole inventory |
| invoices | `forma_pagamento` + `tipo_pagamento` | — | two PT columns for what looks like one concept, no English twin, but internally duplicated |
| shares | `papel` | `role` | legacy form field vs. newer registry field — same "role of party" concept, needs data-reconciliation decision (which one is the write path SharesService.create/update actually uses — per this session's own earlier audit work on shares.service.ts, `papel` is the one actually written) |
| shares | `tipo` | `share_type` | same pattern |
| financial_rules | `ativo` | (n/a, but sibling table `finance_category_keyword_rules.active` uses English for the identical boolean concept) | straightforward rename, no collision |

**None of these 13 collision cases should be executed as part of a mechanical batch rename.** Each requires either a live-data check (which value wins) or a product decision (are these actually the same concept). Attempting to auto-resolve these would violate the mission's own explicit prohibition on masking inconsistencies with silent fallbacks/casts — the correct fix here is a deliberate, reviewed decision per case, not an automated pass.

## 10. Brazil-specific fiscal/legal terms — REQUIRES_REVIEW, no generalization guessed

`cpf_encrypted`/`cpf_cnpj_encrypted` (tax ID), `numero_nota_fiscal` (fiscal invoice number), `cfop` (Brazilian fiscal operation code, an acronym), and the whole `invoices.tomador_*` family (payer/service-recipient fields under Brazilian NFS-e fiscal law — `tomador_cnpj`, `tomador_razao_social`, `tomador_inscricao_estadual`, `tomador_inscricao_municipal`, `tomador_email`, `tomador_endereco`, `tomador_cidade`, `tomador_uf`, `tomador_cep`) plus the ISS/PIS/COFINS/INSS/IR/CSLL tax-amount columns are Brazilian legal/fiscal domain terms without a clean 1:1 English translation. Proposed generic English names are given in the raw discovery data (e.g. `payer_name`, `payer_tax_id`, `iss_amount`) but these are compliance-adjacent fields generated for Brazilian government fiscal reporting (NFS-e) — renaming them risks obscuring the exact legal field they map to for anyone auditing tax compliance later. **Recommend explicit product/compliance sign-off before renaming this specific cluster**, separate from the rest of the batch.

## 11. Items NOT flagged (confirmed already-correct English)

The entire back quarter of the schema (lines 2800–3645: marketing strategy/asset tables, audiovisual production tables, financial-category tables, workflow-execution tables, integration tables) is already fully English — zero findings. This significantly bounds the total remaining work to roughly the first three-quarters of `entities.ts` (organizations/tenants/RBAC/billing/artists/works/phonograms/contracts through employees/payroll/leads/campaigns/events/projects/releases/shares/takedowns/support/invoices/clients).

## 12. Cross-cutting known issue found during discovery (not new, but confirmed again)

`LeadEntity` has three properties (`tipoServico`, `origemLead`, `probabilidadeFechamento`) that are camelCase TypeScript names already mapped via `@Column({ name: '...' })` to already-English-renamed physical columns (per a prior migration, `RebuildLeadsInCanonicalFormOrder20260719000011`). The TS property names themselves are stale relative to their own columns and should be renamed to `serviceType`/`leadSource`/`closeProbability` as a low-risk, code-only (no migration needed) cleanup.

---

## Execution plan (batches, per the mission's own §16)

1. **Batch 1 (this document)** — discovery + canonicalization map. DONE.
2. **Batch 2 — Artist FK family** (§2): 15 tables, 1 migration (column rename `artista_id`→`artist_id` per table, `IF EXISTS` guarded), entity property updates, service/DTO/raw-SQL updates, frontend type updates, alias-resolver updates, tests, full regression. **DONE** — commit `986739c6`.
3. **Batch 3 — Work FK family** (§3: `obra_id`→`work_id`, 6 tables — phonograms, licenses, shares, takedowns, content_detections, ecad_reports). Note: this is the FK to `works.id`, a separate concept from §4's `fonograma_id`/`phonogram_id`↔`recording_id` open question (shares.fonograma_id was NOT touched — that question remains open). **DONE** — migration `20260905000004_RenameObraIdToWorkId`, commit `c9d00001`. `apps/web/src/shared/governance/entities.ts` flagged and excluded (whole-file PT-vocabulary governance doc — entity keys themselves are PT: `Obra`, `Fonograma`, `Share`, `Artista` — needs its own dedicated batch, not a mechanical column-rename pass).
4. **Batch 4 — Client/Project/Campaign/Release FK families** (§5–6). **DONE** — migration `20260905000005_RenameClientProjectCampaignReleaseFks`, commit `67c6b7d1`. Resolved the `lancamento_id`→`release_id` REQUIRES_REVIEW flag (confirmed same concept as `releases`/`ReleaseEntity`, no separate Lancamento entity exists). Also caught and fixed several camelCase/PascalCase compound identifiers a case-sensitive substring rename alone would miss (e.g. `artistaProjetoId`, `linkedProjetoId`) — worth double-checking for this pattern in every remaining batch.
5. **Batch 5 — Generic-noun families** (§7) — **IN PROGRESS.** Sub-concept 1 (`titulo`→`title`) **DONE** — migration `20260905000006_RenameTituloToTitle`, 10 tables (works, phonograms, contracts, briefings, events, projects, releases, takedowns, artist_goals, licenses — each has its own independent title field, no shared FK). Verified safe for a case-sensitive whole-word sed by confirming the codebase convention: UI-facing display text always uses capitalized/accented `Título`, never bare lowercase `titulo` — so `\btitulo\b` and (with a small protected-token exclusion list) `Titulo` were both safe to bulk-rename as code identifiers.
   - **Real risk realized, and how it was caught**: a blind sed silently collapses PT/EN fallback chains like `x.titulo ?? x.title` into `x.title ?? x.title` (a tautology — no compile error, wrong behavior). Caught by grepping every line touched by the diff containing the word "title" twice and reviewing each; found and fixed ~4 instances across FonogramaFormModal.tsx, FonogramaViewModal.tsx, LancamentoViewModal.tsx, registro-musicas.mapper.ts. **This check must be repeated for every remaining generic-noun sub-concept in this batch**, not just this one.
   - `contract-legacy-alias.util.ts` and `phonogram-legacy-alias.util.ts` (+ their specs) needed a canonical/legacy **swap**, not a blind rename: canonical was PT `titulo`, legacy-accepted-alias was EN `title`; after the physical rename, canonical is `title` and `titulo` becomes the (still-accepted) legacy alias — mirrors exactly how `OBRA_ID_SPEC`/`ARTISTA_ID_SPEC` were handled in Batches 2–3. The DTOs (`create-contract.dto.ts`, `create-phonogram.dto.ts`) each carried a duplicate `title` key after the sed (one already-EN legacy field, one renamed-from-`titulo` field) — resolved by keeping one canonical `title` (no longer deprecated) and renaming the other back to `titulo` (now deprecated, `Use "title"`).
   - `contracts.service.ts`/`phonograms.service.ts` test suites needed real logic fixes traced through actual `jest` failures (not just regex triage): `phonograms.service.ts`'s `buildEntityPayload` had `delete out['title']` (should delete `out['titulo']`, since `title` is now canonical and must survive the merge) and an error body still labeling `legacy: 'title'` (should be `'titulo'`). `report-form-contracts.ts`'s `formFieldAliases` maps for `contracts`/`phonograms` had collapsed to a no-op `title: 'title'` self-mapping (originally `title: 'titulo'`) — replaced with `titulo: 'title'`. Confirms: **after a canonical/legacy swap in this mission, always grep the whole repo for every place that maps the OLD legacy name to the OLD canonical name — those mappings invert, they don't just rename.**
   - Excluded and left untouched: 8 more `rebuild-*-canonical-form-order.migration.spec.ts` files (contracts, events, licenses, phonograms, projects, releases, takedowns, works) asserting on historical migration SQL text; `apps/web/src/shared/governance/entities.ts` (already flagged); the separate `outros_titulos`/`alternative_titles` collision-case column (§9) and the unrelated `titulo_detectado` field on `content_detections` — both share the substring `titulo` but are different concepts, protected during the sed via a temporary-placeholder technique in the handful of files where they coexist with the in-scope `titulo`.
   - Full gate green: typecheck/lint (0 errors) both packages, 251/2237 backend tests, 99/750 frontend tests, both builds, case-insensitive residue search clean.
   - Sub-concept 2 (`tipo`→`type`) **DONE** — migration `20260905000007_RenameTipoToType`, 18 tables (works, phonograms, contracts, transactions, invoices, lead_interactions, campaigns, events, projects, releases, shares, takedowns, artist_goals, content_detections, ecad_reports, leave_requests, licenses, financial_rules). Same canonical/legacy swap applied to `contract-legacy-alias.util.ts`'s `TIPO_SPEC`→`TYPE_SPEC` (canonical `tipo`→`type`, legacy alias now `tipo`).
    - **Critical finding that revises the earlier "bare lowercase = always code identifier" hypothesis**: that heuristic held for `titulo` (Portuguese UI labels for "title" are near-universally capitalized/accented — `Título` — so a bare lowercase `titulo` was reliably a code identifier) but **does NOT hold for `tipo`**, because "tipo" is an extremely common Portuguese word that appears in the middle of ordinary lowercase sentences (`"Qual tipo de obra você está cadastrando?"`, `"Selecione o tipo de serviço"`) without any capitalization cue. A blind word-boundary sed genuinely corrupted live UI text into broken PT/EN mixes (`"Qual type de obra..."`) in `ObraTipoSelectorModal.tsx` and several `"Selecione o type de..."` placeholder/toast strings across ~10 files, plus ~20 code-comment prose corruptions (`"o type de guarda"`, `"tipo de entidade"` → `"type de entidade"`, etc.) and 2 whole dead-code regression-guard test files (`artista-tipo-canonical.guard.test.ts`, `artist-tipo-removed.guard.spec.ts`) that test the *absence* of a historically-removed, unrelated `tipo` field and got their assertions flipped to the wrong string entirely. All were found and fixed by: (1) grepping every touched file for `type` embedded in a quoted string alongside Portuguese function words (`de|do|da|para|selecione|qual...`), (2) reading each hit's context, (3) reverting the 2 dead-code guard files wholesale (`git checkout --`) since they test a removed concept unrelated to this rename. **Any future sub-concept renaming a short, everyday Portuguese word (as opposed to a distinctive noun like `titulo`/`obra`) must repeat this UI-text sweep — do not assume the titulo batch's safety argument transfers.**
    - Also found and fixed 2 real logic bugs the sed introduced (same pattern as the titulo batch): `query-contract.dto.ts` and `create-contract.dto.ts` each grew a duplicate `type` key (one pre-existing EN-legacy field, one renamed-from-`tipo` field) — resolved via the same keep-canonical/rename-other-to-legacy pattern. `report-form-contracts.ts`'s `formFieldAliases` for `contracts` had collapsed into a `type: 'type'` no-op (was `type: 'tipo'`) — replaced with `tipo: 'type'`.
    - One rename accidentally **fixed a real pre-existing bug** rather than just relabeling it: `EventsService.list()`'s `type` filter never worked via HTTP because the DTO declared `type` while the service read the PT-named column directly — renaming the column to `type` made the names match, so the filter now actually works. Updated `events.service.spec.ts`'s test (previously titled "...NÃO é aplicado", asserting the bug) to assert the corrected behavior instead of leaving a stale assertion contradicting reality.
    - 2 more `rebuild-*-canonical-form-order.migration.spec.ts` files excluded this round (leave_requests, plus the ones already covered by titulo's list that also mention tipo).
    - Full gate green: typecheck/lint (0 errors) both packages, 251/2237 backend tests, 99/750 frontend tests, both production builds.
  - Sub-concept 3 (`data_inicio`/`data_fim`→`start_date`/`end_date`) **DONE** — migration `20260905000008_RenameDataInicioFimToStartEndDate`, 6 tables (contracts, campaigns, events [end_date only — its start field is already `starts_at`/`data`, a separate unrelated migration-in-progress], artist_goals, licenses, leave_requests). Confirmed the pre-batch risk assessment: compound multi-word tokens (joined by `_` or camelCase) essentially never appear as natural Portuguese prose, so this batch found **zero** UI-text corruption and **zero** tautology/duplicate-key bugs — a much smoother execution than `titulo`/`tipo`. This confirms the risk axis that matters is "is this a bare common word" (titulo/tipo — high risk) vs. "is this an already-compound token" (data_inicio, data_fim — low risk), independent of table count.
    - `contracts` needed a real structural fix, not just a rename: `contract-legacy-alias.util.ts`'s date pair already had TWO pre-existing accepted spellings (PT canonical `data_inicio`/`data_fim` + an EN legacy alias `startsAt`/`expiresAt` that predates this migration, unrelated to it). A straight 2-way canonical/legacy swap would have silently dropped recognition of whichever spelling didn't win the coin flip — a real backward-compatibility regression, not just a rename. Fixed by **generalizing `resolvePair` from a 2-way to an N-way comparison** (`PairSpec.legacy` now accepts `string | string[]`): `start_date` is canonical, `['data_inicio', 'startsAt']` are both still-accepted legacy aliases (same for `end_date`/`data_fim`/`expiresAt`). Verified the generalization is behavior-preserving for the existing 2-way specs (title/type/artist_id/arquivo_url/valor) — full spec suite (67 tests) passes unchanged.
    - **General lesson for the remaining sub-concepts**: before assuming a 2-way canonical/legacy swap is safe, grep the target alias-resolver file's `PairSpec` legacy value — if it's a genuinely different word (not just a case variant of the PT name being replaced, the way `type`/`tipo` are), a third name may already be in play and dropping it needs either an N-way extension (this batch's approach) or an explicit, documented decision to accept the regression.
    - Full gate green: typecheck/lint (0 errors) both packages, 251/2239 backend tests (2 new), both production builds; frontend suite run in progress at time of writing, to be confirmed before commit.
  - **Not yet executed**: the remaining 9 generic-noun sub-concepts (`observacoes`→`notes`, `descricao`→`description`, `duracao`→`duration`, `genero`→`genre`, `nome`→`name`, `categoria`→`category`, `valor`→`amount`/`value`, `cidade`/`estado`/`pais`→`city`/`state`/`country`, `documentos`→`documents`, `ativo`→`active`/`is_active`, `ordem`→`sort_order` — note this is more than 9 items; the count includes the city/state/country trio as one entry). `valor`/`arquivo_url` are ALSO already present in `contract-legacy-alias.util.ts` as dual PT/EN pairs — expect the canonical/legacy-swap treatment (check first whether either already has a third distinct spelling in play, per the lesson above). Before executing ANY of these, assess each word's everyday-Portuguese-prose risk the way this batch did for `tipo` vs. `data_inicio`: short, bare, common words (`nome`, `valor`, `ativo`, `estado` — the last also being a false-friend homonym with "state" in the "condition" sense) are high risk for UI-text corruption; compound/technical words (`duracao` is a plausible middle ground — check it explicitly) are lower risk.
6. **Batch 6 — Holder family** (§8) — blocked on a data-reconciliation query (which of `titular_nome`/`detentor` is actually populated per row) before any code change.
7. **Batch 7 — PT/EN collision resolution** (§9) — blocked on per-case product/data decisions, cannot be mechanically batched.
8. **Batch 8 — Brazilian fiscal-term cluster** (§10) — blocked on compliance sign-off.
9. **Batch 9 — Final global residue search + full regression + report.**

Given the scale confirmed by this discovery (roughly 150+ column renames across ~30 tables, several requiring data reconciliation before they can even be attempted), this is realistically a multi-session program of work, not a single-pass mechanical rename — consistent with the mission's own acknowledgment that batching is an execution strategy, not a scope reduction. Batch 2 begins next.
