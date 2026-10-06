# Technical language normalization: before and after (comparative report)

Scope: technical names (identifiers, persisted names and values, API fields, routes, tooling messages, data files, documentation language). Every number in this document comes from a command or an artifact cited next to it. A value that could not be derived is written `NOT MEASURED` with the reason; a value that depends on work that happens after this document was written is written `PENDING FINAL REVIEW` or `PENDING FINAL EVIDENCE`. Legacy Portuguese names appear only in tables and explanations next to their canonical name.

## 1. Identification

| Item | Value | How obtained |
|---|---|---|
| Baseline | `56b55c46f35d92cabdd8a98bebf7fdfe3a9c1cac` | `git log -1 --format='%H %cI %s' 56b55c46` gives `2026-09-05T13:44:54-03:00` , subject `fix(tenancy): verify cross-tenant FK ownership before create (contracts, licensing, takedowns, shares)` (date 2026-09-05) |
| Received checkpoint | `6b6db7ae39141ce2fb5520f0e951da52971d1cc0` | `git log -1 6b6db7a` (subject `chore(naming): checkpoint technical normalization for account handoff`) |
| Commits baseline to checkpoint | 694 | `git rev-list --count 56b55c46..6b6db7a` |
| Commits checkpoint to the repository head used for the measurements | 17 | `git log --oneline 6b6db7a..HEAD \| wc -l` (HEAD at measurement time: `f5710d80af7f3fe8cac73860f44633b2a1ad1d75`) |
| Commits baseline to the repository head used for the measurements | 711 | `git rev-list --count 56b55c46..HEAD` |
| Final product SHA | `FINAL_PRODUCT_SHA_PLACEHOLDER` | filled by the orchestrator after the last product commit |
| Final repository HEAD | `FINAL_HEAD_PLACEHOLDER` | filled by the orchestrator after the last commit |

Intermediate checkpoints (`git log --format='%H %s' 6b6db7a..HEAD`, newest first):

| # | SHA | Subject |
|---:|---|---|
| 1 | `f5710d80af7f3fe8cac73860f44633b2a1ad1d75` | chore(naming): docCode keyed per token; audit baseline set to the real historical baseline 56b55c46 |
| 2 | `d64a6a5dda34a6b0dd1f4f5ce6fa55eb6ecd8d7e` | fix(naming): schema row for invoices.tipo_nota (the per-file rows no longer cover the catalog column); schema/DB gates re-run green |
| 3 | `e39ba93678e33282bd473ac92e158dd8f99c6272` | chore(naming): proofs refreshed on the final code (wiring 510 sites 0 unproven, compat 0, classify 0) |
| 4 | `bde5b74ab019f7a20d9cd668216abd5dfdcffc45` | fix(reports): shares contract excludes the canonical registry inputs (guard); compat mutation proof refreshed |
| 5 | `5c92f97cbb3b3cafb3d7c852802e3f82bd121610` | fix: canonical share DTO inputs, team-contact category labels, phantom invoice total_amount, NULLIF tracks fallback; ledger blockers, docCode and legal-term ratchets |
| 6 | `41470fc594b8cfd84247ea60ef3f927e3216eae6` | chore(ops): journal and orchestration records of the review round |
| 7 | `eb7620d5b51bfd33e3ca88888a7c4a7b6d8052e7` | test: run the shared vocabularies spec from the API test and test:ci scripts (it had no runner) |
| 8 | `3e5ab0f6a9e7f0ab1db88af19268434eb00c9871` | chore(naming): wiring proof complete (509 sites, 0 unproven); classification regenerated; naming:check green |
| 9 | `40ed08155f2e5d48b328458bf1790113ea1962bc` | test(web): rendering tests that kill the remaining wiring mutants (contact categories, HR employees); fixture ledger rows |
| 10 | `912bffd835f63c157b8b475bae4e1812f304c267` | chore(naming): compat mutation proof complete (0 rows without behavioral proof), classify at 0, fixture adjudications |
| 11 | `a26397664cf99521a263643abb3e17b2e8626e99` | feat(naming): SQL_WORD mutation operator for legacy names inside SQL text; rh proof exemptions |
| 12 | `772b4b4f01aade8eabc6174b3074471c5e010bad` | test: behavioral tests for legacy values (API/web), CI wiring of verify:musicchat-routing-keys, ledger covering tests and per-name fixture rows |
| 13 | `d1360e693fad825175fc0fd92b43090385879c29` | chore(naming): wiring proof complete (495 sites, 0 unproven) |
| 14 | `da2cf1dfbab666c6a888fdbac7ea14cfc7f73d93` | test(web): behavioral tests for the release phonogram title lookup and genre review summary; helpers moved to lib (no behavior change) |
| 15 | `915a70544e2bc384b7f9925bffbd4bc6c3a34a0c` | chore(naming): wiring proof slices for reports, clients, invoices and migrations re-proved (remaining slices running) |
| 16 | `9a486f589b96b91dbd26b147f227641c19a168af` | chore(naming): close naming gate coverage gaps (ALL-CAPS values, capitalized data positions, runtime SQL strings) |
| 17 | `fc4fa41137e4bd883115d9cee486ab777b1780d0` | chore(naming): intermediate checkpoint of the technical normalization resume (gates not green yet) |

## 2. Method and evidence sources

Detectors: the same lexicon (`scripts/naming/pt-lexicon.mjs`, `scripts/naming/pt-vocabulary.txt`), the same scanners (`scripts/naming/technical-naming-census.mjs`) and the same surfaces are run over the baseline tree (`git archive` of `56b55c46`, empty exception index) and over the current tree (real ledger). The only variable is the repository. Reference: header of `scripts/naming/normalization-audit.mjs`.

Commands run for this document (all read-only; outputs outside the repository went to a scratch directory):

| Id | Command | Result |
|---|---|---|
| C1 | `node scripts/naming/normalization-audit.mjs --baseline 56b55c46f35d92cabdd8a98bebf7fdfe3a9c1cac --out <scratch>` | per-layer table, 32,787-row matrix (re-generated on the current tree; the committed `docs/naming/audit/normalization-audit-summary.md` differs only on the `docCode` surface, see section 5) |
| C2 | `node scripts/naming/technical-naming-census.mjs --check` | exit 0; `technical-naming census: 4796 files, debt {"doc":8695,"docCode":172}` |
| C3 | `node scripts/naming/compat-boundary-audit.mjs --check` | exit 0; 4347 rows, 926 groups; the four open counters are 0; proof basis 1369 rows by mutation, 2 by the compiler only, 2522 rows by binding only |
| C4 | `node scripts/naming/compat-boundary-classify.mjs --check` | exit 0; 4347 rows; `COMPATIBILITY_WITHOUT_REQUIRED_PROOF=0`; `FIXTURE_NAMES_WITHOUT_PRODUCTION_OCCURRENCE=141`; `FIXTURE_NAMES_WITH_UNCOVERED_PRODUCTION_OCCURRENCE=0` |
| C5 | `node scripts/naming/compat-wiring-proof.mjs --check` | exit 0; 510 production call sites (44 of `applyDeprecatedFieldAliases`, 466 consumer calls), `WIRING_SITES_UNPROVEN=0` |
| C6 | `node scripts/naming/historical-records-audit.mjs --check` | exit 0; 129 records, `MISCLASSIFIED_HISTORICAL_RECORDS=0`, violations 0 |
| C7 | `node scripts/naming/validate-canonical-map.mjs` | exit 0; 70 column assertions against 132 tables |
| C8 | `node scripts/naming/render-naming-docs.mjs --check` | exit 0; 97 concepts, 0 renames, 4347 exceptions |
| C9 | `node --test scripts/naming/naming-gates-mutation.test.mjs` | 29 tests, 29 pass, 0 fail (1 clean fixture + 26 injected defects + 2 ledger/path tests) |
| C10 | `git grep -n -I -w -i -e <term> [56b55c46] -- apps/api/src apps/web/src packages scripts e2e .github supabase` for 31 legacy terms plus ledger lookup (script kept in the scratch directory) | section 20 |
| C11 | `python3` over `docs/naming/canonical-naming-map.json`, `docs/naming/audit/*.json`, `docs/naming/audit/compat-boundary-classification.tsv` | sections 4, 16 to 18, 26, 27 |
| C12 | a Node script that imports `pairsFromLedger` from `scripts/naming/compat-mutation-proof.mjs` and compares the 262 records of `compat-mutation-proof.json` with the 193 pairs the ledger cites today and with the current sha256 of each file and test | section 18 |

Freshness rule: a number is fresh when it was produced on the working tree at the HEAD named in section 1 with no product file modified (`git status --short` showed only `.claude/ops/logs/journal.ndjson` and `.claude/ops/records/orchestration/orch-4281815e.json`, which are orchestration records). The committed proof files (`compat-mutation-proof.json`, `compat-wiring-proof.json`) are bound to the sha256 of each source file and test; `compat-boundary-audit --check` and `compat-wiring-proof --check` reject stale records, so exit 0 means the proofs are fresh for the tree. Numbers that I could not re-measure (test-suite totals, live-database census, security gate) are marked as reported and identify who reported them. Any later product change makes the numbers of this document stale until C1 to C9 are re-run.

## 3. Verdict and the ten closing counters

Verdict derived from the data: **`TECHNICAL NORMALIZATION: INCOMPLETE` for this document's data set** (not VERIFIED). Reasons: `NOT_NORMALIZED` is 172 (a real, measured, non-zero value on the documentation surface `docCode`, sections 6 and 14), and four counters depend on the final independent review. The condition for VERIFIED is the list in `docs/engineering/pack/TECHNICAL_NORMALIZATION_HANDOFF.md` section 12, which requires `NOT_NORMALIZED=0` or an explicit disposition for each remaining item.

| # | Counter | Value | Command that produced it | Status |
|---:|---|---|---|---|
| 1 | NOT_NORMALIZED | **172** (all on surface `docCode`: Portuguese identifier-shaped tokens inside backtick spans or fenced blocks of current documents: 141 in `docs/runbooks/staging-to-production.md`, 31 in 16 other files) | C1: `awk -F'\t' '$8=="NOT_NORMALIZED"' <scratch>/normalization-audit-matrix.tsv \| wc -l` = 172 rows; cross-check C2 `debt.docCode` = 172 | OPEN. Not zero. They are baselined census debt (`scripts/naming/technical-naming-baseline.json`), so `naming:check` passes, but they have no ledger row and no historical banner. Needs a disposition (ledger row with class, or rewrite with the canonical name). The committed `normalization-audit-summary.md` says 176 and is stale. |
| 2 | UNJUSTIFIED_OPERATIONAL_RESIDUES | 0 | C2: every operational surface (identifier, objectKey, value, sqlString, dataFile, toolMessage, filename, dbColumn, routes, env, queue names) has zero debt; only `doc` (8695, all in banner-labelled historical records) and `docCode` (172) carry debt. Section 20 adds a per-term scan: 0 unjustified occurrences of 31 terms | Measured, 0 |
| 3 | UNCOVERED_COMPATIBILITY | 0 | C3 (`COMPATIBILITY_BOUNDARIES_WITHOUT_BEHAVIORAL_PROOF`, `OBSOLETE_BOUNDARIES`, `MISCLASSIFIED_OPERATIONAL_USAGE`, `LEGACY_FIRST_READS` all 0) and C4 (`BINDING_ONLY fixture names occurring in a production file with NO proven/exempt ledger row: 0`) | Measured, 0 |
| 4 | CROSS_LAYER_DIVERGENCES | `PENDING FINAL REVIEW`. Known and open: 1 (finding F-01 in section 25: canonical map row NC-037 names a legacy key as the canonical one) | No script measures this counter. The independent cross-layer audit findings are in section 21 | Not measurable by a script; value pending the final review |
| 5 | RELEVANT_NAMING_GATE_COVERAGE_GAPS | 0 known; `PENDING FINAL REVIEW` for completeness | C9: 26 injected defects across the layers each fail the real gate. Known scope limit: `docCode` only scans `docs/engineering/`, `docs/runbooks/`, `docs/naming/*.md`, `apps/*/*.md`, `CLAUDE.md`, `.claude/**/*.md` (`isCurrentDocForCode`, census line 582); other current Markdown is not scanned for code tokens | Measured for the tested defects |
| 6 | SOLVABLE_NAMING_BLOCKERS | 0 | C11: `blockers[]` with `status=OPEN` and `disposition=RESOLVABLE_FROM_CANONICAL_SOURCES` = 0 (OPEN total 23: 12 DESTRUCTIVE_APPROVAL_REQUIRED, 9 GENUINE_BUSINESS_DECISION, 2 EXTERNAL; RESOLVED 14) | Measured, 0 |
| 7 | COMPATIBILITY_BOUNDARIES_WITHOUT_REQUIRED_PROOF | 0 | C4: `REQUIRED_BEHAVIORAL_ROWS=1371 COMPATIBILITY_WITHOUT_REQUIRED_PROOF=0`; classes BEHAVIORALLY_PROVEN 1371, COMPILER_PROVEN 2, BINDING_ONLY 2520, EXEMPT_WITH_JUSTIFICATION 454, UNPROVEN 0 | Measured, 0 |
| 8 | WIRING_SITES_UNPROVEN | 0 | C5 (510 sites; proof file: 500 KILLED, 10 SURVIVED, the 10 survivors are covered by 11 recorded exemptions, section 17) | Measured, 0 |
| 9 | CURRENT_DOCUMENTATION_DIVERGENCES | `PENDING FINAL REVIEW`. Measured proxy: docCode 172 tokens (counter 1) plus F-01 | No script classifies a documentation statement as divergent from code. `docs/naming/audit/historical-records-audit.md` (C6) proves the 129 historical records are frozen, labelled, unconsumed and not normative | Not measurable by a script |
| 10 | FIXTURE_MOCK_DIVERGENCES | 0 unadjudicated fixture names; mock-versus-real shape divergences `PENDING FINAL REVIEW` | `docs/naming/audit/fixture-name-adjudication.json`: 870 entries (UI_TEXT 802, COMMENT_OR_DOC 43, BOUNDARY_COVERED_BY_COMPOUND_ROW 16, BOUNDARY 5, RESOLVED 4), none unadjudicated; C4 `FIXTURE_NAMES_WITH_UNCOVERED_PRODUCTION_OCCURRENCE=0` | Measured for names; shape divergence not measurable by a script |

Gate state at the final tree: `gate-engine security` = `PENDING FINAL EVIDENCE`. Completion gate = `PENDING FINAL EVIDENCE`.


## 4. Concept matrix before and after

Source: `docs/naming/canonical-naming-map.json` `concepts[]` (97 concepts in total; this table lists 41 of them: every NC concept that names a field family, chosen because each one has a legacy alias and a canonical name; the 48 `CZ-*` rows describe modules and carry no alias columns in the map). Disposition counts over all 97 (command: `python3` over `concepts[].disposition`): DONE 85, BLOCKED_PRODUCT_DECISION 6, NEEDS_PRODUCT_DECISION 3, RESOLVED 2, MIGRATION_REQUIRED 1. Rows whose map columns are empty were completed from the concept title; those cells are marked in the row text itself. NC-039 to NC-042 (decisions without alias columns: NEEDS_PRODUCT_DECISION for NC-039 to NC-041, RESOLVED for NC-042) and the external-source concepts NC-044, NC-045, NC-047, NC-048 (same shape as NC-043 and NC-046) are in the map and are not repeated here.

| ID | Concept | Legacy alias (before) | Canonical name (after) | PT-BR display label | Disposition |
|---|---|---|---|---|---|
| NC-001 | Artist reference (FK) | `artista_id` | `artist_id` (15+ tables); app `artistId`; API `artistId` | Artista | DONE |
| NC-002 | Work reference (FK) | `obra_id` | `work_id`; app `workId`; API `workId` | Obra | DONE |
| NC-003 | Client reference (FK) | `cliente_id` | `client_id`; app `clientId`; API `clientId` | Cliente | DONE |
| NC-004 | Project reference (FK) | `projeto_id` | `project_id`; app `projectId`; API `projectId` | Projeto | DONE |
| NC-005 | Campaign reference (FK) | `campanha_id` | `campaign_id`; app `campaignId`; API `campaignId` | Campanha | DONE |
| NC-006 | Release reference (FK) | `lancamento_id` | `release_id`; app `releaseId`; API `releaseId` | `Lançamento` | DONE |
| NC-007 | Phonogram reference (FK) | `fonograma_id` | `phonogram_id`; app `phonogramId`; API `phonogram_id` (`trackId` deprecated alias) | Fonograma | DONE |
| NC-008 | Title | `titulo` | `title` (10+ tables); app `title`; API `title` | `Título` | DONE |
| NC-009 | Type/category classifier (generic) | `tipo` | `type` (18+ tables); app `type`; API `type` | Tipo | DONE |
| NC-010 | Start/end dates | `data_inicio`, `data_fim` (the map also lists `startsAt`, `expiresAt` as aliases of the contracts family) | `start_date`/`end_date` (contracts, HR leave, audiovisual, goals); `starts_at` (events, campaigns, marketing projects); app `startDate`/`endDate`; `startsAt`; API same names on the wire | `Data de início / término` | DONE |
| NC-011 | Attachments/documents field | `documentos` | `documents` (artists, contracts, shares, employees); app `documents`; API `documents` | Documentos | DONE |
| NC-012 | Notes/observations | `observacoes` | `notes` (12+ tables); app `notes`; API `notes` | `Observações` | DONE |
| NC-013 | Description | `descricao` | `description` (8+ tables); app `description`; API `description` | `Descrição` | DONE |
| NC-014 | Duration (text form) | `duracao` | `duration_text` (works, phonograms); app `durationText`; API `duration_text` | `Duração` | DONE |
| NC-015 | Genre/music genre | `genero`, `genero_musical` | `music_genre` (artists, phonograms, projects, project_tracks, releases, works); app `musicGenre`; API `music_genre` | `Gênero Musical` | DONE |
| NC-016 | Name | `nome` | `name` (employees, inventory_items, financial_rules, work_participants, project_tracks, project_track_participants); app `name`; API `name` | Nome | DONE |
| NC-017 | Name — clients / leads | - | `name` (clients, leads); app `name`; API `name` | Nome | DONE |
| NC-018 | Category | `categoria` | `category` (inventory_items, financial_rules); app `category`; API `category` | Categoria | DONE |
| NC-019 | Category — transactions | - | `category`, `subcategory` (transactions); app `category`, `subcategory`; API `category`, `subcategory` | Categoria | DONE |
| NC-020 | Active flag | `ativo` | `active` (contract_templates, financial_rules); app `active`; API `active` | Ativo | DONE |
| NC-021 | Sort order | `ordem` | `sort_order` (work_participants, project_tracks, project_track_participants, contract_service_types, knowledge_categories); app `sortOrder`; API `sortOrder` | Ordem | DONE |
| NC-022 | Leads client/service type | `tipo_cliente`, `tipo_servico`, `tipoCliente`, `tipoServico` | `client_type`/`service_type` (leads only); app `clientType`/`serviceType`; API `clientType`/`serviceType` | `Tipo de cliente / Tipo de serviço` | DONE |
| NC-023 | Share party role / percentage / holder identity | `papel`, `percentual`, `titular_nome`, `titular_doc`, `direcao`, `nome_musica`, `detentor`, `destinatario` | `party_role`, `percentage`, `holder_name`, `holder_document`, `direction`, `music_title`, `holder`, `recipient`; app matching camelCase; API matching snake_case | `Papel, Percentual, Titular, Documento, Direção, Título, Participante, Destinatário` | DONE |
| NC-024 | Invoice due date (internal nota fiscal) | `vencimento`, `data_vencimento` | `due_at` (invoices); app n/a; API `due_at` (`vencimento` deprecated input alias) | Vencimento | DONE |
| NC-025 | Invoice due date (Stripe SaaS billing) | - | `due_date` (invoices, `type='stripe_subscription'` rows only); app n/a; API n/a (webhook-populated) | — | DONE |
| NC-026 | Invoice payer tax ID (CPF or CNPJ) | - | `tomador_cnpj` (invoices); app `tomador_cnpj`; API `tomador_cnpj` | CNPJ / CPF | DONE |
| NC-027 | Works registry-field pairs (`idioma`→`language`, `outros_titulos`→`alternative_t | `idioma`, `outros_titulos`, `criada_por_ia`, `instrumental`, `duracao`, `letra_completa` | `language`, `alternative_titles`, `ai_used`/`ai_tools`/`ai_prompts`, `duration_seconds`, `lyrics` | — | DONE |
| NC-028 | Phonograms registry-field pairs (`gravacao_original`→`recording_date`, `data_lan | `gravacao_original`, `data_lancamento`, `duracao_min`/`duracao_seg`, `pais_origem` | `recording_date`, `release_date`, `duration_seconds`, `country_of_recording` | — | DONE |
| NC-029 | Phonograms `arquivo_audio` (jsonb, display metadata: name/size/url) vs `audio_fi | `arquivo_audio` | `audio_file` (jsonb display metadata) distinct from `audio_file_id` (uuid FK); app `audioFile`; API `audio_file` (`arquivo_audio` deprecated input alias) | — | DONE |
| NC-030 | Phonograms `instrumental` (was varchar 'sim'/'nao') → `is_instrumental` | `instrumental` (varchar sim/nao) | `is_instrumental` | — | DONE |
| NC-031 | Works `tipo_obra` vs `type` | `tipo_obra` | `work_origin` (and `type`); app `workOrigin`; API `work_origin` (`tipo_obra` deprecated input alias) | — | DONE |
| NC-032 | Phonograms `compositores`/`interpretes`/`produtores` (3 legacy `text` columns) | `compositores`/`interpretes`/`produtores` (text columns) | participants child tables (`work_participants`, `project_track_participants`); the three text columns removed | — | DONE |
| NC-033 | Works `compositor` (singular) vs `compositores` (plural, jsonb) | `compositor` | plural jsonb participants; singular `compositor` retired | — | DONE |
| NC-034 | Phonograms `participacao` DTO shape (`@IsArray() participacao?: unknown[]`) | `participacao` | `participation` (jsonb) | — | DONE |
| NC-035 | Clients `cidade`/`estado` → `city`/`state` | `cidade`/`estado` | `city`, `state` (clients); app `city`/`state`; API `city`/`state` | — | DONE |
| NC-036 | Leads `cidade`/`estado`/`pais` → `city`/`state`/`country` | `cidade`/`estado`/`pais` | `city`, `state`, `country` (leads); app `city`/`state`/`country`; API `city`/`state`/`country` | — | DONE |
| NC-037 | Leads dual-storage (seven physical columns versus a jsonb copy) | `origem_lead`, `responsavel`, `prioridade`, `temperatura`, `probabilidade_fechamento`, `proximo_follow_up` | physical columns dropped; CRM data in the `crm_internal_data` jsonb column (the ledger concept now uses that name; finding F-01 closed); app jsonb key vocabulary in `lead-vocabulary.ts`; API per map | `—` | DONE |
| NC-038 | `shares.type` vs `party_role` | `type` (shares) | `party_role`; app `party_role`; API `party_role` | — | RESOLVED |
| NC-043 | `works.external_source` | `works.origem_externa` | works.external_source; app external_source; API external_source | `Origem externa` | BLOCKED_PRODUCT_DECISION |
| NC-046 | `phonograms.external_source` | `phonograms.origem_externa` | phonograms.external_source; app external_source; API external_source | `Origem externa` | BLOCKED_PRODUCT_DECISION |
| NC-049 | Lead interaction timestamp | `lead_interactions.data` | `lead_interactions.occurred_at`; app `occurred_at` (entity), `occurredAt` (web); API `occurred_at` | `Data da interação` | DONE |

## 5. Quantitative table by layer, baseline versus final

Source: C1 (`node scripts/naming/normalization-audit.mjs --baseline 56b55c46f35d92cabdd8a98bebf7fdfe3a9c1cac --out <scratch>`), identical to `docs/naming/audit/normalization-audit-summary.json` except where noted below. Baseline scanned 2743 files, final tree 4796 files; 4701 files changed between them. Unit: one census item (identifier, object key, string value, route, file name, data-file name, tool message; a Markdown document counts its Portuguese prose lines) with its occurrence count. `audited = normalized + remaining` on every row; `audited` of an item is `max(baseline, final)`; `normalized = max(0, baseline - final)`; `remaining = final`.

| Layer | Items audited | Files changed | Normalized | Remaining: legitimate boundary | Remaining: historical record | NOT_NORMALIZED |
|---|---:|---:|---:|---:|---:|---:|
| DATABASE | 858 | 290 | 824 | 34 | 0 | 0 |
| BACKEND_API | 8,821 | 713 | 6,694 | 2,127 | 0 | 0 |
| FRONTEND | 24,026 | 987 | 22,507 | 1,519 | 0 | 0 |
| SHARED_PACKAGES | 472 | 168 | 434 | 38 | 0 | 0 |
| TESTS_FIXTURES_MOCKS | 13,414 | 992 | 6,650 | 6,764 | 0 | 0 |
| TOOLING_SCRIPTS_CI | 336 | 313 | 273 | 63 | 0 | 0 |
| DOCUMENTATION | 21,278 | 1,238 | 10,378 | 2,033 | 8,695 | 172 |
| **TOTAL** | **69,205** | **4,701** | **47,760** | **12,578** | **8,695** | **172** |

Difference to the committed summary (`docs/naming/audit/normalization-audit-summary.md`): the committed file shows DOCUMENTATION legitimate 2029 and NOT_NORMALIZED 176 (total 12,574 and 176); the re-run on the current tree gives 2033 and 172 (total 12,578 and 172). The committed summary predates the last census change and should be regenerated with `pnpm naming:audit` (a writer, not run here).

Reading: the layer with the largest residue is TESTS_FIXTURES_MOCKS (6,764 remaining, all `LEGITIMATE_COMPATIBILITY_BOUNDARY`): legacy names kept on purpose as fixture inputs of the compatibility proofs (section 16). The only layer with `NOT_NORMALIZED` is DOCUMENTATION, on the `docCode` surface.

## 6. Quantitative table by surface

Same source as section 5 (the matrix `normalization-audit-matrix.tsv` re-generated by C1, grouped by the `surface` column; command: `python3` over the TSV). `Baseline` is the sum of baseline occurrence counts of the census items; `Audited` is the sum of `max(baseline, final)`.

| Surface | Items | Baseline | Audited | Normalized | Remaining | Legitimate boundary | Historical record | NOT_NORMALIZED |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| apiRoute | 7 | 4 | 7 | 0 | 7 | 7 | 0 | 0 |
| comment | 989 | 5,707 | 5,707 | 5,707 | 0 | 0 | 0 | 0 |
| dataFile | 2,590 | 2,570 | 2,590 | 574 | 2,016 | 2,016 | 0 | 0 |
| dbColumn | 411 | 399 | 411 | 377 | 34 | 34 | 0 | 0 |
| directory | 5 | 5 | 5 | 5 | 0 | 0 | 0 | 0 |
| doc | 273 | 18,219 | 19,068 | 10,340 | 8,728 | 33 | 8,695 | 0 |
| docCode | 183 | 7 | 183 | 7 | 176 | 4 | 0 | 172 |
| eventQueueJob | 35 | 37 | 37 | 37 | 0 | 0 | 0 | 0 |
| filename | 245 | 245 | 245 | 245 | 0 | 0 | 0 | 0 |
| frontendRoute | 276 | 203 | 348 | 203 | 145 | 145 | 0 | 0 |
| identifier | 8,641 | 12,316 | 12,836 | 11,940 | 896 | 896 | 0 | 0 |
| objectKey | 6,717 | 6,838 | 10,195 | 6,408 | 3,787 | 3,787 | 0 | 0 |
| sqlString | 210 | 237 | 326 | 232 | 94 | 94 | 0 | 0 |
| testTitle | 2,295 | 2,304 | 2,305 | 2,304 | 1 | 1 | 0 | 0 |
| toolMessage | 524 | 520 | 524 | 493 | 31 | 31 | 0 | 0 |
| value | 9,386 | 9,405 | 14,418 | 8,888 | 5,530 | 5,530 | 0 | 0 |
| **TOTAL** | **32,787** | **59,016** | **69,205** | **47,760** | **21,445** | **12,578** | **8,695** | **172** |

Observation on `docCode`: the surface has 7 baseline items and 183 final items (176 remaining, 4 of them with a ledger row, 172 NOT_NORMALIZED). The data do not show why the baseline count is so low (documents added during the mission versus lines that carry a legacy marker in the baseline and are skipped by the scanner); that was not investigated. The `comment` surface (5,707 baseline, 0 final) and `testTitle` (2,304 baseline, 1 final) are fully normalized.


## 7. Vertical propagation: database, domain, backend, API, frontend, tests, docs, tooling

Each family below is traced through every layer. `BEFORE` is read with `git show 56b55c46:<path>` (or `git grep -n ... 56b55c46`), `AFTER` with `git grep -n` on the current tree. A cell `none` means the command returned no hit for that layer.

### 7.1 Family A: foreign keys to catalog and CRM aggregates (`artista_id` becomes `artist_id`; map concepts NC-001 to NC-007)

| Layer | BEFORE | AFTER |
|---|---|---|
| Database | `56b55c46:apps/api/src/database/entities.ts:713` `artista_id: string \| null` | `apps/api/src/database/entities.ts:588` `artist_id: string`; migration `apps/api/src/database/migrations/20260905000003_RenameArtistaIdToArtistId.ts` (not present at the baseline) |
| Domain (`packages/types`) | no FK field; status enum `EX_ARTISTA = "ex_artista"` (`56b55c46:packages/types/src/enums.ts:72`) | `FORMER_ARTIST = "former_artist"` (`packages/types/src/enums.ts:84`) |
| Backend | `56b55c46:apps/api/src/modules/artist-goals/artist-goals.controller.ts:26` `@Query('artista_id') artista_id` | `apps/api/src/modules/artist-goals/artist-goals.controller.ts:26` `@Query('artist_id') artist_id`; service filter at `artist-goals.service.ts:25` |
| API | query parameter `artista_id` (same line as backend) | canonical `artist_id`; deprecated aliases are accepted through `applyDeprecatedFieldAliases` where a DTO still lists them (44 wired call sites, C5) |
| Frontend | `56b55c46:apps/web/src/modules/accounting/components/transacao-form/hooks/useFinancialRules.ts:15` `interface Evento { ... artista_id ... titulo ... }` | `apps/web/src/modules/accounting/components/transaction-form/hooks/useFinancialRules.ts:15` `interface Event { ... artist_id ... title ... }` (file and folder renamed) |
| Tests | `56b55c46:apps/api/src/core/automation/project-planning.automation.spec.ts:68` `artista_id: null` | `apps/api/src/core/automation/project-planning.automation.spec.ts:70` `artist_id: null` |
| Docs | `56b55c46:docs/ESPECIFICACAO_TECNICA_ESTADO_ATUAL_SISTEMA.md:42` maps `artistId -> artista_id` | `docs/engineering/pack/CANONICAL_TECHNICAL_VOCABULARY.md:26` Artist row: canonical `artist_id`, legacy alias `artista_id` |
| Tooling | `56b55c46:scripts/phase2-crud-validation.mjs:236` SQL `select id, tenant_id, artista_id, titulo ...` | script no longer matches `artist_id` or `artista_id`; the name is registered in `docs/naming/canonical-naming-map.json:554` (NC-001 `legacyAliases`) and gated by the census |

Counts for the family at the baseline and now (section 20): `artista_id` 522 occurrences (313 in production files) became 117 (0 in production files; 105 are immutable migration history and 12 are tests).

### 7.2 Family B: works classification (`tipo_obra` becomes `work_origin`; NC-031)

| Layer | BEFORE | AFTER |
|---|---|---|
| Database | `56b55c46:apps/api/src/database/entities.ts:748` `tipo_obra: string \| null` | `apps/api/src/database/entities.ts:795` `work_origin`; migration `20260921000001_FixWorksTypeTipoObraCollision.ts` |
| Domain | `tipo_obra` coexisted with the generic `type` classifier (collision recorded as NC-031) | `work_origin` is the origin of the work; `type` stays the generic classifier (`docs/engineering/pack/CANONICAL_TECHNICAL_VOCABULARY.md:52`) |
| Backend | `56b55c46:apps/api/src/modules/works/dto/query-work.dto.ts:19` `tipo_obra?: string` | `apps/api/src/modules/works/work-legacy-fields.ts:26` `tipo_obra: 'work_origin'` (deprecated input alias); legacy values `autoral`, `referencia` mapped at `:56` to `original`, `reference` |
| API | `56b55c46:apps/api/src/modules/works/dto/create-work.dto.ts:89` `tipo_obra?: string` | `apps/api/src/modules/works/dto/create-work.dto.ts:97` canonical `work_origin` (`@ApiPropertyOptional({ enum: WORK_ORIGINS })`) and `:117` `tipo_obra` marked `DEPRECATED('work_origin')` |
| Frontend | `56b55c46:apps/web/src/modules/catalog/components/ObraFormModal.tsx:186` reads `obra.tipo_obra` | `apps/web/src/modules/catalog/components/WorkFormModal.tsx:198` `work?.work_origin`; `WorkOriginBadge.tsx:4` PT-BR badge of `works.work_origin` |
| Tests | no deprecation test | `apps/api/src/modules/works/dto/create-work.dto.legacy-compat.spec.ts:49` (`['tipo_obra', 'work_origin', 'autoral', 'original', ...]`); `apps/api/src/modules/works/work-contract.spec.ts:57` rejects unknown `work_origin` values |
| Docs | vocabulary did not exist | `docs/engineering/pack/CANONICAL_TECHNICAL_VOCABULARY.md:15` Work row and `:52` |
| Tooling | no census | ledger rows for `create-work.dto.ts` and the spec, compat mutation proof for `work-legacy-fields.ts` (section 18) |

### 7.3 Family C: invoice due date (`data_vencimento`/`vencimento` become `due_at`; NC-024, NC-025)

| Layer | BEFORE | AFTER |
|---|---|---|
| Database | `56b55c46:apps/api/src/database/entities.ts:1058` `data_vencimento` (timestamp) and `:1072` `vencimento` (date), two columns for one concept | `apps/api/src/database/entities.ts:1125` `due_at`; migration `20260920000005_ConsolidateInvoiceDueDateColumns.ts` |
| Domain | none | `invoices.due_date` stays Stripe-owned and is never merged with `due_at` (vocabulary document line 46; NC-025) |
| Backend | none | `apps/api/src/modules/invoices/invoice-legacy-fields.ts:18` `vencimento: 'due_at'` |
| API | `56b55c46:apps/api/src/modules/invoices/dto/invoices.dto.ts:42` `vencimento?: string` | `apps/api/src/modules/invoices/dto/invoices.dto.ts:49` `due_at` and `:91` deprecated `vencimento` (`description: 'Use "due_at".'`) |
| Frontend | `56b55c46:apps/web/src/modules/accounting/types/accounting.types.ts:77` `data_vencimento?` | `apps/web/src/modules/accounting/types/accounting.types.ts:116` `due_at?` |
| Tests | none | `apps/api/src/modules/invoices/invoice-contract.spec.ts:25` legacy input `vencimento`, `:61` canonical `due_at`; `invoice-stripe-due-date.guard.spec.ts` pins the Stripe field |
| Docs | none | `docs/engineering/pack/CANONICAL_TECHNICAL_VOCABULARY.md:24` and `:46` |
| Tooling | none | `data_vencimento` appears 16 times in the scanned scope now: 15 in migration history and 1 in a test; 0 in production code (section 20) |

### 7.4 Further families (same layers, one line each)

| Family | BEFORE (baseline) | AFTER (current) | Layers with proof |
|---|---|---|---|
| Share party fields (NC-023) | `56b55c46:apps/api/src/database/entities.ts:1470` `titular_nome` and `:1496` `nome_musica`; `56b55c46:apps/api/src/modules/shares/shares.service.ts:91` writes `out['titular_nome']` | `apps/api/src/database/entities.ts:1534` `holder_name`, `:1560` `music_title`; `apps/api/src/modules/shares/dto/shares.dto.ts:18,49` canonical inputs and `:25` deprecated alias; migration `20260913000001_RenameSharePartyFieldsToEnglish.ts` | database, backend, API, tests (`shares-canonical-input.spec.ts`, `share-contract.spec.ts:97`) |
| Release tracks (CZ-016) | `56b55c46:apps/api/src/modules/reports/computed-fields/registry.ts:45` computed field `'releases.faixas'` implemented in `releases-faixas.field.ts` | file `release-tracks.field.ts`; canonical `metadata.tracks`, legacy `faixas` read through `COALESCE(NULLIF("metadata"->'tracks', 'null'::jsonb), "metadata"->'faixas')` at `release-tracks.field.ts:45` and removed on write at `:114` | backend, tests (`release-tracks.field.legacy-key.spec.ts`) |
| Lead interaction timestamp (NC-049) | `lead_interactions.data` (a date column named with the Portuguese word) | `occurred_at`, migration `20261003000001` (described in `docs/naming/audit/normalization-audit-report.md`) | database, entity, web reader |
| Artist team-contact categories | web showed `Outro` for legacy slugs | `apps/web/src/modules/artist/lib/team-contact-category.ts` maps legacy slugs to canonical slugs and PT-BR labels; test `team-contact-category.test.ts` | frontend, tests |

## 8. Database

| Item | Value | Source |
|---|---|---|
| Database layer, census items | 858 audited, 824 normalized, 34 legitimate boundary, 0 NOT_NORMALIZED | C1 (section 5) |
| Entity columns (`dbColumn` surface) | baseline 399, final remaining 34 (all with a ledger row), 377 normalized | C1 (section 6) |
| Migration files in `apps/api/src/database/migrations` | 174 at the baseline, 340 now (167 added, 117 modified, 1 deleted; includes `*.spec.ts` files) | `git ls-tree -r --name-only <rev> -- apps/api/src/database/migrations \| wc -l`; `git diff --name-status 56b55c46 HEAD -- apps/api/src/database/migrations` |
| Naming migrations (examples) | `20260905000003` to `20260905000008` (FK, `titulo`, `tipo`, `data_inicio/fim` renames), `20260910000010` to `20260910000026` (status backfill and restrict migrations to English values), `20260913000001` (share fields), `20260918000001` to `20260918000011` (`ordem`, `ativo`, `duracao`, `categoria`, `nome` renames) | `git diff --name-only --diff-filter=A 56b55c46 HEAD -- apps/api/src/database/migrations` |
| Canonical map versus entities | 70 column assertions against 132 tables, valid | C7 |
| Schema naming baseline | `total: 0, debt: 0` | `scripts/naming/schema-naming-baseline.json` |
| Live catalog census | 5221 catalog objects, 0 Portuguese names, 39 excepted rows, PostgreSQL 16 local | reported by the orchestrator from the last local run of `node scripts/naming/schema-naming-census.mjs --check`; NOT re-run by this report author (a PostgreSQL server accepts connections locally, but no migrated database identity or credentials were provided, and I did not point the census at an unidentified database). The committed older report `docs/naming/audit/normalization-audit-report.md` records 5204 objects at an earlier tree. CI step: `.github/workflows/ci.yml:293-294` ("Schema naming census"), residue census at `:295-296` |
| Schema boundary proof | 2 of 2 database-schema boundary mutants killed on a real migrated PostgreSQL; baseline script 6/6 checks | `docs/naming/audit/schema-boundary-proof.json` (generated 2026-10-06T00:29:20Z); section 18 |
| Persisted legacy structure still in the schema | 119 ledger rows of kind `PERSISTED_LEGACY_STRUCTURE` (39 behaviorally proven, 80 binding-only); removal needs destructive approval: 12 OPEN blockers with `DESTRUCTIVE_APPROVAL_REQUIRED` (section 27) | `compat-boundary-classification.tsv`; `canonical-naming-map.json` `blockers[]` |

The drop of every `legacy_*` mirror column, PII scrub and `events.data` removal are destructive and are not executed (blockers in section 27). Nothing in this document is evidence of a production data change.

## 9. Domain model

Authority: `docs/engineering/pack/CANONICAL_TECHNICAL_VOCABULARY.md` (68 lines, derived from the map, `entities.ts`, `enums.ts`). Evidence for each aggregate in the code (`git grep -n "class <Name>Entity" apps/api/src/database/entities.ts`):

| Aggregate | Entity (line) | Table | Distinct from |
|---|---|---|---|
| Project | `ProjectEntity` (1399) | `projects` | Release, Distribution |
| ProjectTrack | `ProjectTrackEntity` (1430), participants `ProjectTrackParticipantEntity` (1464) | `project_tracks`, `project_track_participants` | Phonogram, release track |
| Release | `ReleaseEntity` (1482), join table at 1518 | `releases`, `release_works` | Project, Phonogram |
| Work | `WorkEntity` (742) | `works` | Phonogram |
| Phonogram | `PhonogramEntity` (860) | `phonograms` | Work, Release |
| ReleaseTrack | no entity (`git grep "ReleaseTrackEntity"` returns nothing) | `releases.metadata.tracks` (jsonb) | ProjectTrack, Phonogram |
| Distribution | no aggregate | only `releases.distributor` and status `distributed` | Release, Project |
| Contract | `ContractEntity` (948): `artist_id`, `client_id`, `release_id` at lines 954 to 956; no `work_id`, no `phonogram_id` | `contracts` | License, API contract |
| Share | `ShareEntity` (1529) | `shares` | financial transaction |

Divergences recorded (all in the vocabulary document, section 4 and 6, and in the map blockers; none is hidden):

- `works.isrc` exists although an ISRC identifies a recording (BLK-WORKS-ISRC-OWNERSHIP, owner decision).
- Shares participant role has live names `type`, `party_role`, `role`, and `share_type` is a different concept (BLK-SHARES-TYPE-SEMANTICS; NC-039 `shares.role` NEEDS_PRODUCT_DECISION).
- A Work contract, a Phonogram contract and a Distribution contract are not modeled separately: `contracts` has one table with a free `type` slug; a contract kind per aggregate is an owner decision (vocabulary section 3 item 8, section 6).
- Whether a Release links to Phonograms is UNVERIFIED (`release_works` exists, no `release_phonograms`).
- `events.data` versus `starts_at` (CZ-029): the entity maps only `starts_at`; the physical column and its sync trigger remain until the destructive drop (BLK-C3-E6).
- PT-BR display terms for ProjectTrack and ReleaseTrack are UNVERIFIED (the map has no `displayPtBr` for CZ-015, CZ-016, CZ-031).

## 10. Backend

| Item | Value | Source |
|---|---|---|
| BACKEND_API layer | 8,821 items audited, 6,694 normalized, 2,127 legitimate boundary, 0 NOT_NORMALIZED; 713 files changed | C1 (section 5) |
| Compatibility helpers | `apps/api/src/common/compat/` (asset type, plan features, release metadata, contract last payment, external rights receipts, deprecated-field alias utility) and per-module `*-legacy-fields.ts` / `*-vocabulary.ts` | `ls apps/api/src/common/compat` |
| Alias mechanism wiring | 44 production call sites of `applyDeprecatedFieldAliases`, each with a fresh proof (C5) | `docs/naming/audit/compat-wiring-proof.json` (kinds: 32 `HELPER`, 12 without kind) |
| Legacy reads | canonical first on every audited reader: `LEGACY_FIRST_READS=0` | C3 |
| Prototype-key hardening | own-property guards for maps indexed by user text (`import-mapper.service.ts`, `integrations.controller.ts`, `lead-vocabulary.ts`, `release-legacy-fields.ts`, `license-vocabulary.ts`, `inventory-legacy-fields.ts`); spec `apps/api/src/modules/prototype-keys.legacy-lookups.spec.ts` | handoff section 3; file exists |
| Error and log text | stable error codes instead of raw provider text; English technical logs (commit `0f62de86` in the mission history) | `git log --oneline -1 0f62de86` |
| Still Portuguese by design | user-facing strings (`UX_TEXT`, 200 ledger rows), fiscal terms (`cpf`, `cnpj`, `tomador`, `prestador`, `serie`, `tipo_nota`, `cfop`, `natureza_operacao`: `PRODUCT_TERM_WITHOUT_SAFE_TRANSLATION`, 202 rows), external provider fields (`EXTERNAL_CONTRACT` 31 rows, e.g. ABRAMUS `duracao`, `periodo`) | section 26 |

## 11. API and contracts

| Aspect | State | Evidence |
|---|---|---|
| Canonical DTO inputs | snake_case canonical fields with the deprecated spelling kept as an alias marked `deprecated: true` in Swagger | `apps/api/src/modules/shares/dto/shares.dto.ts:18,25,49,63`; `invoices.dto.ts:49,91`; `create-work.dto.ts:97,117` |
| Shares canonical inputs | `holder_name`, `holder_document`, `work_id`, `phonogram_id`, `party_role`, `percentage` accepted; deprecated `role`, `holderName`, `holderDoc`, `workId`, `trackId` mapped, canonical wins, deprecated keys never persisted | `apps/api/src/modules/shares/shares.service.ts:93-109` (`toColumns`), `share-legacy-fields.ts`, specs `shares-canonical-input.spec.ts` (through the real `ValidationPipe`) and `share-contract.spec.ts:97` (`expect(row).not.toHaveProperty(legacy)`) |
| Deprecated alias rows in the ledger | 407 rows of kind `DEPRECATED_API_ALIAS`, all behaviorally proven (killed mutants of the runtime file) | `compat-boundary-classification.tsv` |
| Response shapes | canonical-only for shares (spec above); invoices responses still carry the legacy mirror names next to the canonical ones (`file_url` and `url_pdf` at `apps/api/src/modules/invoices/invoices.service.ts:55-56`, `tomador_legal_name` and `tomador_name` at `:57`, `service_amount` and `legacy_amount` at `:87`) until the owner approves the mirror drop | BLK-INVOICES-LEGACY-MIRRORS (OPEN), BLK-INVOICES-FISCAL-DISCRIMINATORS (OPEN) |
| Shared vocabularies | `packages/types/src/priorities.ts`, `providers.ts`, `accounting-vocabulary.ts`, `artist-team-categories.ts`, `role-slugs.ts`, spec `vocabularies.spec.ts` (run by the API `test` and `test:ci` scripts, commit `eb7620d5`) | `ls packages/types/src` |
| Priority scales | four distinct scales are never merged: `TRIAGE_PRIORITIES` (high, medium, low), `RELATIONSHIP_PRIORITIES` (low, medium, high, strategic), `WORK_PRIORITIES` (low, normal, high, urgent), support tickets use `SupportTicketPriority`; campaign tasks keep their own `TASK_PRIORITIES` on purpose | `packages/types/src/priorities.ts`; `campaign-operations.dto.ts:8-11` (comment states why) |
| DTOs on the shared scales | `clients.dto.ts` (`RELATIONSHIP_PRIORITIES`), `audiovisual.dto.ts` and `marketing-projects.dto.ts` (`WORK_PRIORITIES`), `support-requests.dto.ts`, `support-tickets.dto.ts` (`SupportTicketPriority`) import from `@music-os-360/types` | `git grep -n "PRIORITIES\|SupportTicketPriority" -- 'apps/api/src/**/*.dto.ts'` |
| Persisted Portuguese platform values | still written by live paths (release credit roles and others): owner decision | BLK-PERSISTED-PT-PLATFORM-VALUES (OPEN) |

## 12. Frontend

| Item | Value | Source |
|---|---|---|
| FRONTEND layer | 24,026 items audited, 22,507 normalized, 1,519 legitimate boundary, 0 NOT_NORMALIZED; 987 files changed | C1 (section 5) |
| Route surfaces | `frontendRoute` 203 baseline, 145 remaining (all with a ledger row; the reason text is in the ledger); `apiRoute` 4 baseline, 7 audited, 7 remaining with ledger rows | section 6 |
| Own-property helper | `apps/web/src/shared/lib/own-property.ts` (`hasOwnKey`) used in 10 files besides its definition (`user-status.ts`, `OAuthPopupPage.tsx`, `organization-industry.ts`, `event-type.ts`, `release-format.ts`, `genre-match.ts`, `category-labels.ts`, `skill-output-labels.pt-br.ts`, `tenant-labels.ts`, `legacy-redirects.tsx`) | `git grep -ln hasOwnKey -- apps/web/src` |
| Behavior tests for legacy values | `apps/web/src/modules/prototype-keys.web.test.ts`, `shared/lib/prototype-keys.labels.test.ts`, `app/providers/__tests__/tenant-labels.prototype-keys.test.ts`, rendering tests `*.legacy-compat.test.tsx` / `*.legacy-wiring.test.tsx` | `git ls-files` |
| PT-BR user interface | unchanged by design: user-visible text stays Portuguese and is held by `UX_TEXT` rows (200) and per-file rows; section 20 classifies every remaining Portuguese word of the scanned scope | section 20, 26 |
| Unwired code that calls the compatibility helpers | 10 survivor sites in 4 web files (`Schedule.tsx`, `Settings.tsx`, `contract-variables.ts`, `ArtistFormModal.tsx`): section 17 | C5 |

## 13. Tests, fixtures and mocks

| Item | Value | Source |
|---|---|---|
| TESTS_FIXTURES_MOCKS layer | 13,414 audited, 6,650 normalized, 6,764 legitimate boundary, 0 NOT_NORMALIZED; 992 files changed | C1 (section 5) |
| `testTitle` surface | 2,304 baseline items, 1 remaining | section 6 |
| BINDING_ONLY ledger rows | 2,520, every one with a path in a test, spec, e2e or script file (checked: 0 of 2,520 have a non-test path) | `python3` over `compat-boundary-classification.tsv` with the test-path regex of `isTestFile` plus `scripts/` |
| Fixture adjudication | 870 entries: UI_TEXT 802, COMMENT_OR_DOC 43, BOUNDARY_COVERED_BY_COMPOUND_ROW 16, BOUNDARY 5, RESOLVED 4; 0 unadjudicated | `docs/naming/audit/fixture-name-adjudication.json` |
| BINDING_ONLY fixture names with no production occurrence | 141 (asserted refused or gone, or pure input) | C4 |
| BINDING_ONLY fixture names in production files without a proven or exempt row | 0 | C4 |
| Naming tooling tests | 10 `*.test.mjs` files in `scripts/naming` plus `scripts/destructive-dossier.test.mjs`, all in `naming:check`; the gate-level mutation test passes 29 of 29 (C9) | `package.json:46` |

## 14. Documentation

| Item | Value | Source |
|---|---|---|
| DOCUMENTATION layer | 21,278 items audited, 10,378 normalized, 2,033 legitimate boundary, 8,695 historical record, 172 NOT_NORMALIZED; 1,238 files changed | C1 (section 5) |
| Portuguese prose lines (`doc` surface) | 18,219 baseline, 8,728 remaining: 33 with a ledger row (`UX_TEXT`) and 8,695 in frozen historical records | section 6 |
| Historical records | 129 documents; each validated for H1 label, H2 frozen sha256 and line count, H3 not consumed by executables, H4 not normative, H5 ledger coverage; `MISCLASSIFIED_HISTORICAL_RECORDS=0`, violations 0 | C6; `docs/naming/audit/historical-records-audit.md` and `.tsv`; frozen hashes in `docs/naming/historical-records.json` |
| Current documents touched in the final window | `docs/engineering/pack/CANONICAL_TECHNICAL_VOCABULARY.md` (5 lines changed in `5c92f97c`), the generated `docs/NAMING_NORMALIZATION_CANONICAL_MAP.md` and `docs/NAMING_NORMALIZATION_STATUS.md` (in sync with the ledger: C8) | `git show --stat 5c92f97c`, C8 |
| Current documents known to be stale | `docs/naming/audit/normalization-audit-report.md` still names baseline `02f1ee8a75be16a93f91caae1d8a78702ab2f4fc` (2026-09-26) while `package.json` `naming:audit` and this report use `56b55c46`; `docs/naming/audit/compat-boundary-audit.md` (3662 rows) and `normalization-audit-summary.md` (176) lag the live tools (finding F-02, section 25) | `grep -n BASELINE_SHA docs/naming/audit/normalization-audit-report.md` |
| `docCode` surface (Portuguese technical tokens inside code spans and fenced blocks of current documents) | gate added in the mission; 172 tokens still without disposition (section 3 counter 1): `docs/runbooks/staging-to-production.md` 141 (the legacy transaction-category slugs of the migration `20260930000018`, inside an SQL block), `.claude/skills/residue-search/SKILL.md` 7, `docs/engineering/pack/CANONICAL_TECHNICAL_VOCABULARY.md` 5, `docs/engineering/backfill-side-tables-retention.md` 3, 12 other files with 1 or 2 | C1 matrix |
| `docCode` marker rule | a line is exempt only when it contains an explicit legacy marker (`legacy`, `deprecated`, `alias`, `formerly`, `renamed`, `former name`, `->`, `→`); restricted from a broader list in commit `5c92f97c` | `scripts/naming/technical-naming-census.mjs:585` |
| `docCode` scope limit | scanned: `docs/engineering/`, `docs/runbooks/`, `docs/naming/*.md`, `apps/*/*.md`, `CLAUDE.md`, `.claude/**/*.md`; not scanned: other Markdown (for example `docs/*.md`, `README.md`) | census line 582 |

## 15. Tooling and configuration

| Item | Value | Source |
|---|---|---|
| Naming tooling | 30 files in `scripts/naming` (10 of them tests); 0 at the baseline | `git ls-tree -r --name-only 56b55c46 -- scripts/naming \| wc -l` = 0 |
| Package scripts | `naming:census`, `naming:baseline`, `naming:generate`, `naming:schema`, `naming:validate`, `naming:residue-census`, `naming:compat`, `naming:wiring`, `naming:compat:prove`, `naming:compat:report`, `naming:audit`, `naming:check` | `package.json:35-46` |
| `naming:check` composition | census `--check`, canonical map validation, generated docs `--check`, 11 test files, compat audit `--check`, wiring proof `--check`, historical records `--check`, destructive dossier `--check` | `package.json:46` |
| CI steps | "Naming check" at `.github/workflows/ci.yml:58-59`; "Environment contract" at `:60-61`; on the migrated database job: "Schema naming census" (`:293-294`), "Residue census" (`:295-296`), `verify:rls`, `verify:tenant-isolation`, `verify:cz042-cz043-migrations`, `verify:cz045-musicchat-migration`, `verify:musicchat-routing-keys` (`:346-349`) | `grep -n "naming\|verify:" .github/workflows/ci.yml` |
| Database verification scripts | `verify:schema-compat-boundaries` (`apps/api/package.json:37`; run by `scripts/naming/schema-boundary-proof.mjs --prove`, not a CI step), `verify:musicchat-routing-keys` (CI) | `apps/api/package.json` |
| Environment contract | `pnpm env:contract` = `scripts/env-contract-census.mjs --check` plus its tests and `scripts/env-check.test.mjs`; `scripts/env-contract.config.json` | `package.json:28-30` |
| Ratchets | `scripts/naming/technical-naming-baseline.json`: `debt` 287 entries, `wildcardCoverage` 117 files, `wordRowCoverage` 17 legal words; `scripts/naming/schema-naming-baseline.json`: 0 | `python3` over the files |
| Known tooling limits (not hidden) | the committed `docs/naming/audit/compat-boundary-audit.md` says 3662 rows while the live audit has 4347 (generated documents not regenerated after the last ledger change); the committed `normalization-audit-summary.md` is stale on `docCode` (section 5) | C3 versus the committed file |


## 16. Compatibility boundaries

Sources: C3 (`compat-boundary-audit.mjs --check`), C4 (`compat-boundary-classify.mjs --check`), `docs/naming/audit/compat-boundary-classification.tsv|json|md` (regenerated on the current ledger: 4347 rows, same total as C3 and C8), and `docs/naming/audit/compat-boundary-audit.md` (committed text is stale at 3662 rows; the live numbers below come from the commands).

| Class | Rows | Meaning (header of `scripts/naming/compat-boundary-classify.mjs`) |
|---|---:|---|
| BEHAVIORALLY_PROVEN | 1371 | a runtime file whose mutation of its own legacy name is killed by a test (1369 rows by the compat mutation proof; 2 rows by the database-schema boundary proof) |
| COMPILER_PROVEN | 2 | declaration-only rows proven by a compile-time reader (`ViaCEPResponse`, `fetchAddressByCEP` in `apps/web/src/shared/lib/masks.ts`); no runtime behavior exists |
| BINDING_ONLY | 2520 | the row is a test or verification fixture: the file exists and names the literal; binding is not behavioral proof |
| EXEMPT_WITH_JUSTIFICATION | 454 | no behavioral proof is required (legal term 200, user-facing text 187, pack tooling 30, migration history guard 21, naming tooling 7, historical document or data 6, living registry 3) |
| UNPROVEN | 0 | a runtime boundary that requires proof and has none |
| **Total** | **4347** | |

Class by boundary kind (python over the TSV):

| Kind | BEHAVIORALLY_PROVEN | COMPILER_PROVEN | BINDING_ONLY | EXEMPT_WITH_JUSTIFICATION | UNPROVEN | Total |
|---|---:|---:|---:|---:|---:|---:|
| DEPRECATED_API_ALIAS | 407 | 0 | 0 | 0 | 0 | 407 |
| EXTERNAL_PROVIDER_FIELD | 0 | 2 | 6 | 0 | 0 | 8 |
| HISTORICAL_DOCUMENT_OR_DATA | 0 | 0 | 0 | 6 | 0 | 6 |
| LEGACY_ALIAS_TEST_FIXTURE | 0 | 0 | 2204 | 0 | 0 | 2204 |
| LEGACY_NAME_READER | 364 | 0 | 0 | 0 | 0 | 364 |
| LEGAL_DOMAIN_TERM | 0 | 0 | 0 | 200 | 0 | 200 |
| LIVING_REGISTRY | 0 | 0 | 0 | 3 | 0 | 3 |
| MIGRATION_HISTORY_GUARD | 0 | 0 | 0 | 21 | 0 | 21 |
| NAMING_TOOLING | 0 | 0 | 0 | 7 | 0 | 7 |
| NEGATIVE_GUARD_TEST | 0 | 0 | 230 | 0 | 0 | 230 |
| PACK_TOOLING | 0 | 0 | 0 | 30 | 0 | 30 |
| PERSISTED_LEGACY_STRUCTURE | 39 | 0 | 80 | 0 | 0 | 119 |
| PERSISTED_VALUE_READER | 561 | 0 | 0 | 0 | 0 | 561 |
| USER_FACING_TEXT | 0 | 0 | 0 | 187 | 0 | 187 |
| **Total** | **1371** | **2** | **2520** | **454** | **0** | **4347** |

Why `BINDING_ONLY` is acceptable only as fixture proof input:

- Definition: the classifier assigns `BINDING_ONLY` only to rows that are tests or verification scripts. Measured: 0 of the 2,520 rows has a path outside a test, spec, e2e, fixtures or `scripts/` file (python over the TSV).
- A fixture is the input of the proof of a runtime boundary, not a boundary: the runtime file that reads the legacy name carries its own row (`BEHAVIORALLY_PROVEN`) and its own mutation proof. Measured link: fixture exercise states `RUNTIME_ROW_EXISTS` 1936, `COVERED_BY_FILE_ROW` 173, `ADJUDICATED_HARMLESS` 174, `NO_PRODUCTION_OCCURRENCE` 141 (`compat-boundary-classification.md`).
- The dangerous case, a fixture name that also occurs in a production file with no proven or exempt row, is 0 (C4). A fixture name with no production occurrence (141) is an input that asserts the name is refused or gone.
- Binding alone is never counted as behavioral proof: `COMPATIBILITY_WITHOUT_REQUIRED_PROOF` counts only rows of runtime boundaries (1371 required rows, all proven).

Observation (not a defect): of the 2,520 `BINDING_ONLY` rows, 86 are of kind `PERSISTED_LEGACY_STRUCTURE` (80) or `EXTERNAL_PROVIDER_FIELD` (6); they are test or script rows naming a persisted column or a provider field, and the runtime boundary they exercise is the database object or the provider contract itself.

## 17. Wiring sites and the exemption table

Wiring proof (`docs/naming/audit/compat-wiring-proof.json`, produced by `node scripts/naming/compat-wiring-proof.mjs --prove`, gated by C5): a production call site of a legacy-compatibility helper is mutated (operator `CALL_BYPASS`: the call is replaced by its argument) and the test suite of that directory must fail.

| Counter | Value | Source |
|---|---:|---|
| Production call sites | 510 | C5; 510 records in the proof file |
| Site kinds | 466 consumer calls of credited files; 44 calls of `applyDeprecatedFieldAliases` (32 `HELPER` records, 12 records without a kind) | C5 header; python over the JSON |
| KILLED | 500 | `python3` over `compat-wiring-proof.json` (`verdict`) |
| SURVIVED | 10 | same; each is listed below |
| BASELINE_RED / other | 0 | same |
| `WIRING_SITES_UNPROVEN` | 0 (every site has a fresh KILLED record or a valid exemption) | C5 |
| Exemptions recorded | 11 entries in `docs/naming/audit/compat-wiring-exemptions.json` | file |

Each exemption below was read together with the code at the site (callers and callees verified by `grep` in `apps/web/src/modules`). Result: the 10 survivors are all in `apps/web`, none in the API; 2 are equivalent mutants (the changed value is never observable: ArtistFormModal) and 8 are code that no production path reaches (Schedule 5, Settings 1, contract-variables 2; owner decision D-06, `docs/engineering/product-decision-packages.md` lines 145 to 165).

| SITE | REASON | CALLER | CALLEE | BEHAVIOR | WHY EXEMPT | EVIDENCE | STILL_REQUIRED | STATUS |
|---|---|---|---|---|---|---|---|---|
| `apps/web/src/modules/artist/components/ArtistFormModal.tsx:395` `emptyPreservedInput()` | Equivalent mutant | `ArtistFormModal` (component, line 356), `useState<ArtistPreservedInput>(...)` | `emptyPreservedInput` in `artist/forms/artist-form.definition.ts` | initial value of the preserved-input state | the open effect hydrates the state (`hydrateForm(null)` at line 449 for create, `hydrateForm(freshArtistQuery.data)` at 455 for edit; `setPreserved(...)` at 414) before any submit can read it; nothing submits while closed | wiring proof SURVIVED at line 395; exemption entry 1; code read | nothing observable to test; to remove the exemption the initial state would have to become unobservable by construction (lazy `null`) or a test would need to read state before hydration, which no UI path allows | ACTIVE, permanent (equivalent mutant) |
| `apps/web/src/modules/artist/components/ArtistFormModal.tsx:402` `emptyArtistFormValues()` | Equivalent mutant | `ArtistFormModal`, `useForm({ defaultValues: ... })` | `emptyArtistFormValues` in `artist/forms/artist-form.definition.ts` | initial `defaultValues` of react-hook-form | `hydrateForm` calls `reset(formValues)` before any field is shown; the same call text at line 463 (reset on close) is a separate site that is KILLED by its own test (the exemption matches by file and exact text, so it also names that site, which does not need it) | wiring proof SURVIVED at 402, KILLED at 463; exemption entry 11 | same as above | ACTIVE, permanent (equivalent mutant) |
| `apps/web/src/modules/events/pages/Schedule.tsx:209` `toAgendaRow({...})` | Unreachable code | `handleExcelExport` (line 188) | `toAgendaRow` in `events/lib/agenda-spreadsheet.ts:56` | builds one spreadsheet row per event for an XLSX export | `handleExcelExport` has no reference in the JSX; `git grep` finds only its definition (line 188); `excelInputRef` (line 155) is only reset, never attached to an input | wiring proof SURVIVED at 209; exemption entry 2; `product-decision-packages.md` D-06 | owner decision D-06: wire the spreadsheet import and export UI with tests (preview and approval rules), or delete the handlers; then delete the three Schedule exemptions | ACTIVE, waiting for D-06 |
| `.../Schedule.tsx:211` `getBackendEventTypeLabel(e.type)` | Unreachable code | `handleExcelExport`, inside the `toAgendaRow` argument | `getBackendEventTypeLabel` in `events/lib/event-type.ts` | label of the event type in the exported row | same unreferenced handler | wiring proof SURVIVED at 211; exemption entry 3 | same (D-06) | ACTIVE, waiting for D-06 |
| `.../Schedule.tsx:253` `readAgendaCell(row, column)` | Unreachable code | `handleExcelImport` (line 238), local `cell` helper | `readAgendaCell` in `events/lib/agenda-spreadsheet.ts` | reads a cell of an imported row by canonical column | `handleExcelImport` is unreferenced (definition only) | wiring proof SURVIVED at 253; exemption entry 4 | same (D-06) | ACTIVE, waiting for D-06 |
| `.../Schedule.tsx:270` `normalizeToBackendType(rawType, granularToBackendType)` | Unreachable code | `handleExcelImport`, payload building | `normalizeToBackendType` in `events/lib/event-type.ts` | maps the imported type text to the backend event type | same unreferenced handler (a different call of the same helper at line 144 is KILLED) | wiring proof SURVIVED at 270; exemption entry 5 | same (D-06) | ACTIVE, waiting for D-06 |
| `.../Schedule.tsx:325` `getBackendEventTypeLabel(event.type)` | Dead property | `schedulerEvents` `useMemo` (line 307) that maps events to calendar items | `getBackendEventTypeLabel` | the `type` property of each scheduler item | the only consumer, `calendarEvents` (line 332), reads id, title, dates, artist, status and all-day, never `type` | wiring proof SURVIVED at 325; exemption entry 6 | owner decision D-06 (remove the property or use it) | ACTIVE, waiting for D-06 |
| `apps/web/src/modules/settings/pages/Settings.tsx:292` `normalizeUserStatus(member.status)` | Unreachable branch | `filteredUsers` `useMemo` (line 284), `matchesStatus` | `normalizeUserStatus` in `settings/lib/user-status.ts` (uses `hasOwnKey`) | compares a member status with the status filter | `userStatusFilter` (line 282) is only ever set to `"all-status"` (`setUserStatusFilter("all-status")` at line 302; no other setter call), so the right-hand side is never evaluated; the other two calls of the helper (lines 2086, 2195) are KILLED | wiring proof SURVIVED at 292; exemption entry 7 | owner decision D-06: add the status filter UI with a test, or remove the filter state | ACTIVE, waiting for D-06 |
| `apps/web/src/modules/contracts/utils/contract-variables.ts:196` `canonicalVariableCategory(a.category)` | Unreachable in production | `resolveAllVariables` (line 182), sort comparator | `canonicalVariableCategory` in `contracts/lib/contract-variable-vocabulary.ts` | orders variables by canonical category | `resolveAllVariables` has no production reference (`git grep -n` over non-test web files finds it only at its definition, line 182); the module is imported in production only for `contractRoleLabel` (`ContractWizard.tsx`); unreferenced exports: `generateParticipantVariables`, `resolveAllVariables`, `SYSTEM_VARIABLES`, `CATEGORY_LABELS`, `PARTICIPANT_ROLE_OPTIONS` | wiring proof SURVIVED at 196; exemption entry 8 (reason text names the unreferenced exports, finding 9) | owner decision D-06: wire the contract variable resolution or remove those exports | ACTIVE, waiting for D-06 |
| `.../contract-variables.ts:197` `canonicalVariableCategory(b.category)` | Unreachable in production | `resolveAllVariables`, sort comparator | same | same | same | wiring proof SURVIVED at 197; exemption entry 9 | same (D-06) | ACTIVE, waiting for D-06 |
| `.../contract-variables.ts:65` `canonicalEntityType(entityType)` | Unreachable in production (exemption redundant for this site) | `generateParticipantVariables` (line 64), called only by `resolveAllVariables` | `canonicalEntityType` in the same vocabulary module | chooses individual or company fields | same unreferenced chain (`generateParticipantVariables` appears only at its definition, line 64, and in the call at line 184 inside `resolveAllVariables`). The wiring proof records this site as KILLED (a test exercises it), so the gate does not need this exemption; it remains valid because the (file, text) pair matches a site | wiring proof KILLED at line 65; exemption entry 10 | delete this exemption entry together with D-06, or earlier: it is not required by the gate | ACTIVE but unnecessary (candidate for removal) |

Count check: 11 exemption entries = 2 (ArtistFormModal) + 5 (Schedule) + 1 (Settings) + 3 (contract-variables); 10 SURVIVED sites = 2 + 5 + 1 + 2 (the eleventh entry matches a KILLED site). Gap noted: decision D-06 is documented as `BLK-UNWIRED-UI-SCAFFOLD` in `docs/engineering/product-decision-packages.md`, but that identifier has no entry in `docs/naming/canonical-naming-map.json` `blockers[]` (`grep -rn BLK-UNWIRED-UI-SCAFFOLD` finds only the decision package), so section 27 does not list it and the exemption reasons point to a document, not to a ledger blocker (finding F-03, section 25).

## 18. Mutation evidence

Compat mutation proof (`docs/naming/audit/compat-mutation-proof.json`, harness `scripts/naming/compat-mutation-proof.mjs`, operators version in the records). For each pair (runtime file, covering test) the harness replaces each legacy literal or alias by a non-matching one and expects the covering test to fail (`KILLED`).

| Measure | Value | Command or source |
|---|---:|---|
| Records in the proof file | 262 | python over `results[]` |
| Pairs the ledger cites today | 193 | C12 (`pairsFromLedger`) |
| Live pairs with a record | 193 of 193 | C12 |
| Live pairs whose file and test sha256 match the current files | 193 of 193 | C12 |
| Verdict of the 193 live pairs | PROVEN 192; COMPILER_CHECKED 1 | C12 |
| Mutations executed on the live pairs | 2,559, all KILLED, 0 SURVIVED | C12: LEGACY_LITERAL 2512, SQL_WORD 13, CANONICAL_FIRST 12, PREFIX_LITERAL 10, ALIAS_OVERRIDE 6, ENUM_MEMBER 6 |
| Orphan records (pairs no ledger row cites any more) | 69 (44 of them no longer match the file or test sha) | C12 |
| Verdicts over all 262 records | PROVEN 202, SURVIVED 38, NO_MUTATION_SITE 11, PARTIAL 5, CANONICAL_FIRST_UNENFORCED 4, COMPILER_CHECKED 2 | python over the file |

Reading: all 38 SURVIVED, 5 PARTIAL and 4 CANONICAL_FIRST_UNENFORCED records, and all 11 NO_MUTATION_SITE records, are among the 69 records that are not live pairs (the 69 are 38 SURVIVED, 11 NO_MUTATION_SITE, 5 PARTIAL, 4 CANONICAL_FIRST_UNENFORCED, 10 PROVEN and 1 COMPILER_CHECKED) (C12: every live pair is PROVEN or COMPILER_CHECKED). The audit looks a record up by the (file, test) pair of each ledger row (`pairEvidence`, `scripts/naming/compat-boundary-audit.mjs:150-153`) and treats it as fresh only when the file, the test, the runner configuration and the operator version match, so the 69 orphan records are not consulted by any row. Why they became orphans was not investigated (NOT MEASURED); pruning them would be a regeneration (a writer, not run here).

`SQL_WORD` operator: added in commit `a2639766` (`feat(naming): SQL_WORD mutation operator for legacy names inside SQL text`). It rewrites a legacy word inside a SQL string of a runtime file; 13 SQL_WORD mutations on live pairs, 13 KILLED. Its purpose is to prove legacy names used inside embedded SQL (for example the `COALESCE(NULLIF(...), "metadata"->'faixas')` read), which the literal operators could not mutate.

Database-schema boundary proof (`docs/naming/audit/schema-boundary-proof.json`, `scripts/naming/schema-boundary-proof.mjs`, check script `apps/api/scripts/verify-schema-compat-boundaries.ts`, generated 2026-10-06T00:29:20Z): baseline run exit 0 (6 of 6 checks); 2 mutants (`payment-method-legacy-value` on `invoices.payment_method`, `events-data-sync-trigger` on `events.data`), both killed (exit 1, 5 of 6 and 3 of 6 checks pass). These two rows are the 2 `BEHAVIORALLY_PROVEN` rows with mutation state `N/A` in the classification.

Wiring mutation proof: 510 sites, 500 KILLED, 10 SURVIVED (section 17).

## 19. Naming-gate mutation matrix per layer

Test: `scripts/naming/naming-gates-mutation.test.mjs` (C9: `node --test scripts/naming/naming-gates-mutation.test.mjs`, 29 of 29 pass, duration about 40 s). Method: a minimal repository (the real census scripts and lexicon, a one-column `entities.ts`, an empty baseline, an empty ledger) is mutated by one defect at a time; the real `technical-naming-census.mjs --check` must exit 1 and print the expected key; the clean fixture must exit 0. Extra tests: a ledger row covering exactly one file and name lets only that mutation pass (a second name in the same file still fails); the same defect in four other tracked paths (`apps/web/src`, `packages/utils/src`, `e2e`, `scripts`) still fails.

| # | Layer | Injected defect | Defect content | Expected failure | Result |
|---:|---|---|---|---|---|
| 1 | Backend | identifier | `export const nomeArtistico = 1;` in `apps/api/src/m.ts` | `exit 1` and stderr matches `identifier::apps/api/src/m.ts` | PASS (gate failed as expected) |
| 2 | Frontend | member read of a legacy field | `row.titulo ?? row.title` in `apps/web/src/m.ts` | `exit 1` and stderr matches `identifier::apps/web/src/m.ts::property-read::titulo` | PASS (gate failed as expected) |
| 3 | Backend | object key | `{ artista_id: 1 }` | `exit 1` and stderr matches `objectKey::apps/api/src/m.ts` | PASS (gate failed as expected) |
| 4 | Backend | string value | `'ativo'` | `exit 1` and stderr matches `value::apps/api/src/m.ts` | PASS (gate failed as expected) |
| 5 | Backend | ALL-CAPS Portuguese string value | `{ a: 'DIVERGENTE' }` | `exit 1` and stderr matches `value::...::caps-string::DIVERGENTE` | PASS (gate failed as expected) |
| 6 | Shared types | ALL-CAPS Portuguese enum initializer | `enum Provider { PRO_MUSICA = "PRO_MUSICA" }` in `packages/types/src/m.ts` | `exit 1` and stderr matches `value::packages/types/src/m.ts::caps-string::PRO_MUSICA` | PASS (gate failed as expected) |
| 7 | Frontend | capitalized Portuguese key | `{ "Comunicação": 'communication' }` in `apps/web/src/m.ts` | `exit 1` and stderr matches `objectKey::...::capitalized-key::Comunicação` | PASS (gate failed as expected) |
| 8 | Backend | capitalized Portuguese case clause | `case 'Pendente':` on a status field | `exit 1` and stderr matches `value::...::capitalized-string::Pendente` | PASS (gate failed as expected) |
| 9 | Backend | capitalized Portuguese lookup | `['Jurídico', 'Comercial'].includes(v)` | `exit 1` and stderr matches `value::...::capitalized-string::Jurídico` | PASS (gate failed as expected) |
| 10 | Database | Portuguese identifier in embedded SQL of a runtime file | `UPDATE transactions SET categoria = $1 WHERE tipo = 'receita'` | `exit 1` and stderr matches `sqlString::apps/api/src/m.ts::sql::categoria` | PASS (gate failed as expected) |
| 11 | Database | Portuguese literal in embedded SQL | `WHERE lower(type) IN ('despesa','revenue')` | `exit 1` and stderr matches `sqlString::...::sql::despesa` | PASS (gate failed as expected) |
| 12 | Backend | file name | `apps/api/src/contratos.service.ts` | `exit 1` and stderr matches `filename::apps/api/src/contratos.service.ts` | PASS (gate failed as expected) |
| 13 | Tooling | tooling message | `console.log('Registro criado com sucesso para o artista')` in `scripts/m.mjs` | `exit 1` and stderr matches `toolMessage::scripts/m.mjs` | PASS (gate failed as expected) |
| 14 | Database | SQL identifier outside migrations | `INSERT INTO artists (stage_name, nome_artistico)` in `apps/api/seed.sql` | `exit 1` and stderr matches `dataFile::apps/api/seed.sql::nome_artistico` | PASS (gate failed as expected) |
| 15 | API and contracts | JSON key | `{ "artista_id": 1 }` in `apps/api/data.json` | `exit 1` and stderr matches `dataFile::apps/api/data.json::artista_id` | PASS (gate failed as expected) |
| 16 | Database | database column (entity) | `@Column() nome_artistico` in `apps/api/src/database/entities.ts` | `exit 1` and stderr matches `dbColumn::artists.nome_artistico` | PASS (gate failed as expected) |
| 17 | Shared types | shared types package identifier | `interface Contrato { valorTotal: number }` in `packages/types/src/m.ts` | `exit 1` and stderr matches `identifier::packages/types/src/m.ts` | PASS (gate failed as expected) |
| 18 | API and contracts | API route | `@Controller('contratos')` | `exit 1` and stderr matches `apiRoute::apps/api/src/m.controller.ts` | PASS (gate failed as expected) |
| 19 | Configuration | environment variable | `process.env.CHAVE_SECRETA_API` | `exit 1` and stderr matches `envVar::apps/api/src/m.ts` | PASS (gate failed as expected) |
| 20 | Backend | event or queue name | `new Queue('envio-relatorio')` | `exit 1` and stderr matches `envio-relatorio` | PASS (gate failed as expected) |
| 21 | Configuration | YAML or config key | `nome_servico: api` in `infra/m.yaml` | `exit 1` and stderr matches `dataFile::infra/m.yaml::nome_servico` | PASS (gate failed as expected) |
| 22 | Tests | e2e helper identifier | `export function criarContrato()` in `e2e/m.ts` | `exit 1` and stderr matches `identifier::e2e/m.ts` | PASS (gate failed as expected) |
| 23 | Current docs | technical name in a backtick span | `` `valor_total` `` in `docs/engineering/guide.md` | `exit 1` and stderr matches `docCode::docs/engineering/guide.md` | PASS (gate failed as expected) |
| 24 | Current docs | technical name in a fenced block | `const payload = { data_inicio: 1 };` in a code fence | `exit 1` and stderr matches `docCode::docs/engineering/guide.md` | PASS (gate failed as expected) |
| 25 | Current docs | technical name next to a common English word (not a legacy marker) | `Use `valor_total` from the payload.` | `exit 1` and stderr matches `docCode::docs/engineering/guide.md` | PASS (gate failed as expected) |
| 26 | Current docs | Portuguese prose | a Portuguese paragraph in `docs/guia.md` | `exit 1` and stderr matches `doc::docs/guia.md` | PASS (gate failed as expected) |

Coverage statement from the test list: layers with an injected defect: database (4), backend (8), frontend (2), shared types (2), API and contracts (2), configuration (2), tooling (1), tests (1), current docs (4). Not covered by this test (covered elsewhere): the environment contract gate has its own tests (`scripts/env-contract-census.test.mjs`, `scripts/env-check.test.mjs`, run by `pnpm env:contract`); the schema census against a live database (CI step); the compat and wiring proofs (sections 17 and 18).


## 20. Residue scan and negative proof per legacy term

Method (C10, script kept outside the repository): for each of 31 legacy terms, `git grep -n -I -w -i -e <term>` over `apps/api/src apps/web/src packages scripts e2e .github supabase` at the baseline (`56b55c46`) and at the current tree. Current hits by scope root: `apps/api/src` 1,460, `apps/web/src` 300, `packages` 7, `scripts` 67, `e2e` 5, `.github` 0, `supabase` 0 (4 tracked files); total 1,839. Each current hit is classified in this order: (1) migration history (path contains `migrations/` or `drizzle/`: immutable published history, excluded from the production count); (2) test-only (spec, test, e2e, `__tests__`, fixtures); (3) ledger boundary: a ledger row exists for the file and the name (exact name, or a per-file `*` row), via the same `exceptionIndex` the census uses; (4) naming tooling data (`scripts/naming/pt-vocabulary.txt`, the two baseline files, the census header); (5) English comment that names the legacy term (history note); (6) UX text: a Portuguese display string (ledger row of class `UX_TEXT`, or a capitalized or in-sentence occurrence, a heuristic; the complete list of lines without a ledger row was printed and read, and no operational use was found); (7) blocker-tracked (see below); (8) unjustified. Hits that the automatic rules left unclassified (30 lines) were each read by hand and assigned: 15 UX text (`faixas` 3, `vencimento` 5, `compositores` 1, `setor` 5, `cidade` 1), 4 ABRAMUS wire fields in `apps/web/src/modules/integrations/hooks/useAbramus.ts` (`duracao` 2, `compositores` 2: the external provider rows, ledger class `PRODUCT_TERM_WITHOUT_SAFE_TRANSLATION` on the API side and the census-internal exemption table for the web file), 2 transaction-category slug keys `participacao-show-evento` (ledger rows exist under the full slug), and 9 occurrences of `url_pdf`.

`url_pdf` is not a Portuguese-lexicon name (`url`, `pdf`), so the census never flags it and no ledger row exists; it is the pre-rename name of `invoices.file_url`, kept as a persisted mirror column that the API still writes (`apps/api/src/modules/invoices/invoices.service.ts:55,56,89`) and the web still reads (`apps/web/src/modules/accounting/types/invoice-type.ts:6,7`). It is justified by the open blocker BLK-INVOICES-LEGACY-MIRRORS (removal needs destructive approval and a zero count of readers), not by a ledger row. The `canonical` class does not apply to these terms (each is legacy-only); canonical counterparts are in sections 4 and 7.

| Term | Baseline all | Baseline production | Now all | Migration history | Test-only | Ledger boundary | UX text | Comment (history note) | Naming tooling data | Blocker-tracked | Unjustified |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| `artista_id` | 522 | 313 | 117 | 105 | 12 | 0 | 0 | 0 | 0 | 0 | 0 |
| `tipo_obra` | 26 | 15 | 40 | 14 | 19 | 7 | 0 | 0 | 0 | 0 | 0 |
| `arquivo_audio` | 18 | 9 | 16 | 9 | 5 | 2 | 0 | 0 | 0 | 0 | 0 |
| `nome_artistico` | 252 | 147 | 70 | 19 | 42 | 9 | 0 | 0 | 0 | 0 | 0 |
| `tomador_nome` | 6 | 5 | 4 | 3 | 1 | 0 | 0 | 0 | 0 | 0 | 0 |
| `valor_total` | 45 | 37 | 20 | 9 | 11 | 0 | 0 | 0 | 0 | 0 | 0 |
| `data_vencimento` | 13 | 11 | 16 | 15 | 1 | 0 | 0 | 0 | 0 | 0 | 0 |
| `forma_pagamento` | 23 | 18 | 19 | 9 | 7 | 2 | 0 | 0 | 1 | 0 | 0 |
| `faixas` | 63 | 57 | 107 | 2 | 77 | 10 | 15 | 2 | 1 | 0 | 0 |
| `fonograma_id` | 30 | 21 | 10 | 9 | 1 | 0 | 0 | 0 | 0 | 0 | 0 |
| `obra_id` | 248 | 126 | 57 | 48 | 9 | 0 | 0 | 0 | 0 | 0 | 0 |
| `cliente_id` | 110 | 71 | 34 | 32 | 1 | 0 | 0 | 0 | 1 | 0 | 0 |
| `projeto_id` | 51 | 35 | 14 | 11 | 3 | 0 | 0 | 0 | 0 | 0 | 0 |
| `campanha_id` | 15 | 8 | 9 | 8 | 1 | 0 | 0 | 0 | 0 | 0 | 0 |
| `lancamento_id` | 49 | 38 | 15 | 14 | 0 | 0 | 0 | 0 | 1 | 0 | 0 |
| `nome_musica` | 47 | 29 | 8 | 8 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| `titular_nome` | 79 | 16 | 17 | 16 | 1 | 0 | 0 | 0 | 0 | 0 | 0 |
| `vencimento` | 51 | 47 | 53 | 18 | 10 | 7 | 16 | 1 | 1 | 0 | 0 |
| `tipo_cliente` | 22 | 11 | 20 | 17 | 2 | 0 | 0 | 1 | 0 | 0 | 0 |
| `tipo_servico` | 46 | 25 | 31 | 23 | 5 | 2 | 0 | 1 | 0 | 0 | 0 |
| `genero_musical` | 79 | 65 | 29 | 24 | 4 | 1 | 0 | 0 | 0 | 0 | 0 |
| `duracao` | 73 | 48 | 35 | 16 | 9 | 7 | 0 | 0 | 3 | 0 | 0 |
| `compositores` | 205 | 137 | 126 | 27 | 57 | 15 | 21 | 3 | 3 | 0 | 0 |
| `setor` | 113 | 105 | 79 | 15 | 25 | 4 | 30 | 4 | 1 | 0 | 0 |
| `url_pdf` | 17 | 14 | 56 | 12 | 28 | 2 | 0 | 5 | 0 | 9 | 0 |
| `tipo_nota` | 22 | 19 | 40 | 3 | 15 | 20 | 0 | 0 | 2 | 0 | 0 |
| `participacao` | 62 | 40 | 41 | 15 | 16 | 6 | 0 | 2 | 2 | 0 | 0 |
| `cidade` | 149 | 129 | 81 | 28 | 14 | 9 | 28 | 1 | 1 | 0 | 0 |
| `titulo` | 922 | 582 | 314 | 58 | 216 | 35 | 1 | 0 | 4 | 0 | 0 |
| `observacoes` | 388 | 264 | 197 | 156 | 29 | 10 | 0 | 1 | 1 | 0 | 0 |
| `descricao` | 372 | 244 | 164 | 106 | 40 | 7 | 1 | 9 | 1 | 0 | 0 |
| **Total (31 terms)** | **4,118** | **2,686** | **1,839** | **849** | **661** | **155** | **112** | **30** | **23** | **9** | **0** |

Result: production occurrences (non-test, non-migration) of the 31 terms went from 2686 at the baseline to 329 now; all 329 are classified, **0 unjustified**. Check (asserted by the script for every term): `Now all - Migration history - Test-only` equals `Ledger boundary + UX text + Comment + Naming tooling data + Blocker-tracked + Unjustified`.

Counts that went up, with the reason: `tipo_obra` 26 to 40, `data_vencimento` 13 to 16, `faixas` 63 to 107, `vencimento` 51 to 53, `url_pdf` 17 to 56, `tipo_nota` 22 to 40. The increases are in test-only, migration-history and ledger-covered lines (compat fixtures and migrations, section 16), except `url_pdf` (16 production lines now versus 14), which is the open mirror blocker above. The listed unit is lines mentioning the word, not distinct names, so a boundary that is documented and tested adds lines. Scope limit: `-w` matches whole words; a legacy name embedded in a longer identifier (for example `valor_total_nota`) is outside this scan and is covered by the census (identifier, objectKey, value and SQL surfaces, debt 0).

## 21. Cross-layer audit

The independent cross-layer audit (a read-only agent that compared database, API, frontend and documentation for the same concept) is referenced in the order and in commit `5c92f97c`; its own report is not a file of the repository, so the table below uses the commit message and the code as evidence.

| Item | Divergence found | Fix or disposition | Evidence |
|---|---|---|---|
| Team-contact category labels | canonical team-contact category slugs rendered the fallback label `Outro` in the artist 360 view (commit message of `5c92f97c`: was Outro) | labels now keyed by canonical slugs from `packages/types/src/artist-team-categories.ts`; legacy slugs mapped (`LEGACY_TEAM_CONTACT_CATEGORIES`); the same table exists in the API (`apps/api/src/modules/artists/artist-legacy-fields.ts`), each copy pinned by its own test, with no shared source (documented duplication; the UI label is the web-only part) | `apps/web/src/modules/artist/lib/team-contact-category.ts`, `team-contact-category.test.ts`; `apps/api/src/modules/artists/artist-team-contact-category.spec.ts`; `5c92f97c` |
| Share DTO canonical inputs | `toColumns` wrote the legacy `role`, `holderName`, `trackId`, `workId` aliases unconditionally over canonical fields (handoff section 9 finding 4); registry inputs lacked canonical snake_case DTO fields | canonical snake_case inputs added, deprecated aliases mapped, canonical wins; tests through the real `ValidationPipe`; the reports shares contract excludes the canonical registry inputs (guard) | `apps/api/src/modules/shares/dto/shares.dto.ts`, `shares.service.ts:93-109`, `shares-canonical-input.spec.ts`; `5c92f97c`, `bde5b74a` |
| Phantom invoice `total_amount` | the web read a top-level invoice `total_amount` that is not part of the invoice contract (phantom in the commit message) | reads removed (`accounting.types.ts` lost the field; item-level `total_amount` is a different, real field and stays) | `apps/web/src/modules/accounting/types/accounting.types.ts`, `InvoiceViewModal.tsx`, `useInvoiceForm.ts`, `InvoiceViewModal.legacy-wiring.test.tsx`; `5c92f97c` |
| Stale comments | the comment at `role-hierarchy.ts:15-19` was stale (handoff section 9 finding 3); other stale comments were corrected in the same commit | the comment in `apps/api/src/core/rbac/role-hierarchy.ts:14-24` now states that `org_members.role` can hold either form; vocabulary and NC-038 corrected | `git show 5c92f97c --stat`; file read |
| Release tracks JSON null | a stored JSON `null` in `metadata.tracks` hid the legacy `faixas` key | `COALESCE(NULLIF("metadata"->'tracks', 'null'::jsonb), "metadata"->'faixas')` | `apps/api/src/modules/reports/computed-fields/release-tracks.field.ts:45`, `release-tracks.field.legacy-key.spec.ts`; `5c92f97c` |
| Owner decision: shares participant role | four live names for the same idea (`type`, `party_role`, `role`, `share_type` is different) | recorded, not decided | BLK-SHARES-TYPE-SEMANTICS (OPEN); NC-039 |
| Owner decision: invoices | `type` versus `tipo_nota`, `prestador_id` not proven to be an artist FK, mirror columns | recorded, not decided | BLK-INVOICES-FISCAL-DISCRIMINATORS, BLK-INVOICES-LEGACY-MIRRORS (OPEN) |
| Owner decision: ISRC ownership | `works.isrc` versus `phonograms.isrc` | recorded, not decided | BLK-WORKS-ISRC-OWNERSHIP (OPEN) |
| Owner decision: MusicChat routing keys | `queueKey` and `sectorKey` are written and backfilled but nothing reads them | recorded: adopt a reader or remove | BLK-MUSICCHAT-ROUTING-KEYS-NO-READER (OPEN) |
| Owner decision: contract type spelling census | the artist 360 contract filter maps legacy spellings; the persisted census is external | recorded | BLK-CONTRACT-TYPE-SPELLING-CENSUS (OPEN, EXTERNAL) |

## 22. Domain distinctions preserved

Evidence that the distinctions of `docs/engineering/pack/CANONICAL_TECHNICAL_VOCABULARY.md` section 3 are preserved in the code (no merge of concepts happened during the rename):

| Distinction | Evidence in code | Check |
|---|---|---|
| Project is not ProjectTrack and not Release | three separate entities: `ProjectEntity` (`entities.ts:1399`), `ProjectTrackEntity` (1430), `ReleaseEntity` (1482); `ProjectStatus` and `ReleaseStatus` are separate enums (`packages/types/src/enums.ts`) | `git grep -n "class .*Entity" apps/api/src/database/entities.ts` |
| Work is not Phonogram, and neither is ReleaseTrack | `WorkEntity` (742) and `PhonogramEntity` (860) are separate tables; no `ReleaseTrackEntity`: release tracks stay in `releases.metadata.tracks` | same; `git grep ReleaseTrackEntity` returns nothing |
| Work and Phonogram are not released music | a Release is the distributable row; Work and Phonogram are registry rows (`release_works` at `entities.ts:1518` is the only link) | vocabulary section 3 items 3 and 5 |
| Project is not Distribution | no Distribution aggregate: only `releases.distributor` and status `distributed` | vocabulary section 3 item 4 (UNVERIFIED whether an aggregate is wanted: owner decision) |
| Release is not ReleaseTrack; Work is not ReleaseTrack | release track jsonb carries its own `isrc` and `composers` names, not a `work_id` | vocabulary section 3 items 6 and 7 |
| Contract kinds | one `contracts` table; `ContractEntity` has `artist_id`, `client_id`, `release_id` (lines 954 to 956) and no `work_id` or `phonogram_id` | `awk` over the entity (output above) |
| `invoices.due_date` is not `invoices.due_at` | `due_date` Stripe-owned (NC-025), `due_at` NFS-e (NC-024); guard spec `invoice-stripe-due-date.guard.spec.ts` | vocabulary section 4 |
| Four priority scales never merged | `packages/types/src/priorities.ts` (three scales) plus `SupportTicketPriority` plus the campaign `TASK_PRIORITIES` comment | section 11 |
| `audio_file` versus `audio_file_id` | two fields on `phonograms`; `arquivo_audio` is only a deprecated DTO alias of `audio_file` | NC-029 |
| `events.data` versus `starts_at` | entity maps only `starts_at`; physical column and trigger remain until approval | BLK-C3-E6; schema boundary proof |

PT-BR user interface: unchanged by design. A user-visible Portuguese string is a `UX_TEXT` ledger row or a per-file row; the PT-BR label maps are `packages/types/src/value-labels.pt-br.ts` and `status-labels.pt-br.ts`. A user-interface regression check beyond the rendering tests listed in section 12 was NOT MEASURED in this report.


## 23. Adversarial and security reviews

### 23.a First adversarial review (agent `adversarial-reviewer`, read-only, VERDICT FAIL at the received checkpoint)

State received = `docs/engineering/pack/TECHNICAL_NORMALIZATION_HANDOFF.md` section 9 at `6b6db7ae`. The reviewer is a model; its claims were treated as hypotheses. `Final proof` is a command run for this document or a file read; fixes are located with `git log --format='%h %s' 6b6db7a..HEAD -- <path>` (most product fixes are in `fc4fa411` and `5c92f97c`, because the work was committed in few large checkpoints).

| ID | State received | Reproduction | Evidence | Classification | Fix | Tests | Final proof | Status |
|---:|---|---|---|---|---|---|---|---|
| 1 | compat gate red: `compat-boundary-audit --check` exit 1, 11 rows STALE; wiring `WIRING_SITES_UNPROVEN=9` | run both `--check` commands on `6b6db7ae` | handoff section 5 | BLOCKING, symptom of stale proofs | proofs regenerated on the final code: `912bffd8` (compat), `3e5ab0f6`, `d1360e69`, `e39ba936` (wiring 510 sites, 0 unproven) | proof harness tests: `compat-wiring-proof.test.mjs`, `compat-boundary-audit.test.mjs` | C3 exit 0, C4 exit 0, C5 exit 0 (510 sites, 0 unproven); section 18: 193 of 193 live pairs fresh | CLOSED |
| 2 | user text indexing plain maps returned inherited members (`constructor`, `__proto__`); API sites fixed, web sites SUSPECTED | call a lookup with the key `constructor`: before the guard an inherited function came back | `apps/api/src/modules/prototype-keys.legacy-lookups.spec.ts` (11 of its tests failed with the guards removed, per handoff); web helper `apps/web/src/shared/lib/own-property.ts` | HIGH, confirmed | own-property guards in 6 API files (handoff section 3); `hasOwnKey` in 10 web files (section 12), including the named `user-status.ts`, `OAuthPopupPage.tsx`, `organization-industry.ts`, `event-type.ts` (the `ReleaseFormModal.tsx:119` site now lives in `releases/lib/release-format.ts`); `fc4fa411` | `prototype-keys.legacy-lookups.spec.ts`, web `prototype-keys.web.test.ts`, `prototype-keys.labels.test.ts`, `tenant-labels.prototype-keys.test.ts`, `team-contact-category.test.ts` | files exist; the web and API test suites are reported green (section 24); a systematic re-grep of every `MAP[x]` over user input was NOT MEASURED | CLOSED for the named sites; exhaustive re-grep not measured |
| 3 | Portuguese role slugs are persisted and authoritative; no blocker; stale comment at `role-hierarchy.ts:15-19` | read `apps/api/src/core/rbac/role-hierarchy.ts` and the ledger | `blockers[]` entry BLK-RBAC-LEGACY-ROLE-SLUGS (OPEN, DESTRUCTIVE_APPROVAL_REQUIRED); plan `docs/engineering/rbac-retirement-plan.md` | HIGH, owner-gated | blocker recorded with required action; comment rewritten (lines 14 to 24 now say `org_members.role` can hold either form); retirement itself is destructive and not executed | `role-hierarchy.spec.ts`, `workflow-role-matrix.spec.ts` (alias resolves to the same level) | C7 (map valid), section 27 row | CLOSED internally; OPEN as human blocker |
| 4 | `shares.service.ts` `toColumns` wrote legacy `role`/`holderName`/`trackId`/`workId` over canonical fields | send both canonical and deprecated keys; canonical must win | `shares.service.ts:93-109` | MEDIUM, confirmed | `applyDeprecatedFieldAliases(input, SHARE_DEPRECATED_FIELDS)`; canonical wins; deprecated keys never persisted; `5c92f97c` | `shares-canonical-input.spec.ts` (through the real `ValidationPipe`), `share-contract.spec.ts:97` | file read; wiring proof covers the call site (KILLED) | CLOSED |
| 5 | invoices: `tipo_nota` written into `type`, duplicate columns with no removal condition, half-migrated | read `invoices.service.ts` | `invoices.service.ts:116-118,163,180,196` and `:55-57,87` | MEDIUM | reads canonical-first; phantom `total_amount` reads removed (`5c92f97c`); discriminators and mirrors recorded as BLK-INVOICES-FISCAL-DISCRIMINATORS (R1/R3) and BLK-INVOICES-LEGACY-MIRRORS with explicit removal conditions | `invoice-contract.spec.ts`, `InvoiceViewModal.legacy-wiring.test.tsx` | blockers present (section 27) | CLOSED internally; OPEN as owner decision |
| 6 | 157 wildcard (`*`) ledger rows blind the census inside whole files | count rows with `currentName == "*"` | ledger now has 156 such rows and 40 rows with path `*` (python) | MEDIUM | not removed: ratcheted. Per-file `wildcardCoverage` (distinct names hidden by a whole-file row, 117 files) and a per-legal-word `wordRowCoverage` (17 words) in `scripts/naming/technical-naming-baseline.json`; the legal-term ratchet was added in `5c92f97c` | `technical-naming-census.test.mjs` (+24 lines in `5c92f97c`), gate mutation test (a ledger row covers exactly its file and name) | C2 exit 0 | CLOSED as a ratchet (rows remain, their coverage can no longer grow silently) |
| 7 | misclassified ledger rows (second Abramus period row is our own alias; thin reasons on 3 rows) | read the rows | ledger rows for `abramus.service.ts` (`duracao`, `periodo`: class `PRODUCT_TERM_WITHOUT_SAFE_TRANSLATION`, external provider field) | MEDIUM | `9a486f58` message: ledger corrections (Abramus own aliases, pro_labore, per-file `tipo_nota` rows, MusicChat labels) | `integrations-dto-wiring.spec.ts` (swagger deprecation of the period alias) | not re-adjudicated row by row here (NOT MEASURED); C3 and C4 exit 0 | CLOSED per commit; row-level re-adjudication not measured |
| 8 | MusicChat `queueKey`/`sectorKey` have no reader; migration comment claims the web derives them | grep readers of the keys | BLK-MUSICCHAT-ROUTING-KEYS-NO-READER (OPEN, GENUINE_BUSINESS_DECISION); migration `20261005100001_BackfillMusicChatRoutingKeys.ts` (comment line 23: a feature that filters by queue or sector must read `queueKey`/`sectorKey`) | MEDIUM | recorded as write-only scaffolding with an adopt-or-remove decision; CI step `verify:musicchat-routing-keys` (`.github/workflows/ci.yml:346-349`) | `musicchat-vocabulary.spec.ts` | comment now states a future reader is required; wording of the claim 'the web derives them' was not diffed (NOT MEASURED) | CLOSED internally; OPEN as owner decision |
| 9 | three `contract-variables.ts` exemptions state a false reason (no production importer) | read the exemption text and the importers | section 17 rows 8 to 10 | LOW-MEDIUM | reason text rewritten to name the unreferenced exports and the one production import (`contractRoleLabel`) | wiring proof (SURVIVED sites remain exempt, intentionally) | `docs/naming/audit/compat-wiring-exemptions.json` read | CLOSED |
| 10 | report hidden-field hint no longer matches retired internal-notes names; no test guards a reintroduction | read `HIDDEN_INTERNAL_HINT` | `apps/api/src/modules/reports/definitions/report-entity-definition.service.ts:21` | LOW | hint is documented as English-only (`internal_notes`, `internal_comments`, `internal_observations`); the Portuguese names are pinned as NOT matching by `report-entity-definition.service.spec.ts:168-185`; a reintroduced Portuguese column is caught by the `dbColumn` census, not by this hint | `report-entity-definition.service.spec.ts` | spec lines read | CLOSED (guard is the census, not the spec) |
| 11 | `packages/types/src/priorities.ts` unused by several DTOs | grep DTO imports | `clients.dto.ts`, `audiovisual.dto.ts`, `marketing-projects.dto.ts`, `support-requests.dto.ts`, `support-tickets.dto.ts` import shared scales; `campaign-operations.dto.ts` keeps its own scale with a written reason (`:8-11`) | LOW | DTOs moved to the shared scales (`fc4fa411`) | `packages/types/src/vocabularies.spec.ts`, now run by the API `test` script (`eb7620d5`) | `git grep` (section 11) | CLOSED |
| 12 | `fixture-name-adjudication.json` has one UNADJUDICATED row | count classes | 870 entries, classes UI_TEXT 802, COMMENT_OR_DOC 43, BOUNDARY_COVERED_BY_COMPOUND_ROW 16, BOUNDARY 5, RESOLVED 4 | LOW | adjudications added in `772b4b4f`, `912bffd8` | `compat-boundary-classify.mjs --check` | C4: `FIXTURE_NAMES_WITH_UNCOVERED_PRODUCTION_OCCURRENCE=0` | CLOSED |

### 23.b Second blind adversarial review of the final tree

Verdict reported by the orchestrator: **VERDICT PASS** with MEDIUM-1 to MEDIUM-4 and LOW-5 to LOW-6. The review report is not a file of the repository and no matching `evidence review` record existed in `.claude/ops/evidence/` when this document was written (newest `security-reviewer` record there is `evid-f18da642` of 2026-10-03, a different range; review evidence is recorded only after the agent ends). The verdict is therefore `PENDING FINAL EVIDENCE` as a gate input; the actions below are verified against the tree.

| ID | Finding as relayed in the order | Action | Verified in the tree |
|---|---|---|---|
| MEDIUM-1 | relayed as resolved by a blocker (the blocker id was not given) | blocker recorded | NOT VERIFIED which blocker: candidates added in `5c92f97c` are BLK-SHARES-TYPE-SEMANTICS, BLK-WORKS-ISRC-OWNERSHIP, BLK-CONTRACT-TYPE-SPELLING-CENSUS, BLK-MUSICCHAT-ROUTING-KEYS-NO-READER, BLK-INVOICES-FISCAL-DISCRIMINATORS (all OPEN in `blockers[]`) |
| MEDIUM-2 | Portuguese platform values still written by live paths | BLK-PERSISTED-PT-PLATFORM-VALUES | present in `blockers[]`, OPEN, DESTRUCTIVE_APPROVAL_REQUIRED |
| MEDIUM-3 | thin reasons on pack-tooling ledger rows | reason text added | 30 ledger rows with a `.claude` path have a non-empty reason (for example `SEVERITY_RANK ranks the Portuguese severity ALTO alongside its English twin ...`); all 4347 rows have a non-empty `reason`, `owner` and `removalCondition` (python) |
| MEDIUM-4 | `docCode` legacy marker too broad (any common word exempted a line) | marker restricted to explicit legacy tokens | `scripts/naming/technical-naming-census.mjs:585` now `/legacy\|deprecated\|\balias(?:es)?\b\|formerly\|renamed\|former name\|->\|→/i`; the old pattern included `old`, `before`, `was`, `from`, `compat`, `persisted`, `migration` (diff of `5c92f97c`); gate mutation test 26 (`valor_total` next to an English word fails the gate) |
| LOW-5 | invoice legacy mirror columns without a blocker | BLK-INVOICES-LEGACY-MIRRORS | present, OPEN, with removal conditions per column |
| LOW-6 | release tracks stored JSON null hides the legacy key | `NULLIF` fallback and a note | `release-tracks.field.ts:45`; `release-tracks.field.legacy-key.spec.ts` (changed in `5c92f97c`) |

### 23.c Independent cross-layer audit

See section 21 (findings, fixes, owner decisions). Its counter is `CROSS_LAYER_DIVERGENCES` = `PENDING FINAL REVIEW`.

### 23.d Security review

Verdict reported by the orchestrator: security review VERDICT PASS, no CRITICAL, HIGH or MEDIUM finding. As for 23.b, the review evidence record was not present when this document was written. `node .claude/runtime/gate-engine.mjs security` = `PENDING FINAL EVIDENCE`. External scanners (OSV-Scanner, CodeQL) are not installed and the policy disallows network, so they are `NOT MEASURED` (handoff section 11).

## 24. Tests, builds and gates

Two kinds of rows. `Run here` means I executed the command for this document and saw the exit code. `Reported` means the number was given to me by the orchestrator for the final tree and I did not re-run it; its evidence record is `PENDING FINAL EVIDENCE` (record with `node .claude/runtime/ops.mjs evidence run --cmd ... --criterion <id>`).

| Check | Result | Kind |
|---|---|---|
| `node scripts/naming/technical-naming-census.mjs --check` | exit 0, 4796 files, debt `{doc: 8695, docCode: 172}` | Run here (C2) |
| `node scripts/naming/validate-canonical-map.mjs` | exit 0 | Run here (C7) |
| `node scripts/naming/render-naming-docs.mjs --check` | exit 0 | Run here (C8) |
| `node scripts/naming/compat-boundary-audit.mjs --check` | exit 0 | Run here (C3) |
| `node scripts/naming/compat-boundary-classify.mjs --check` | exit 0 | Run here (C4) |
| `node scripts/naming/compat-wiring-proof.mjs --check` | exit 0, 510 sites, 0 unproven | Run here (C5) |
| `node scripts/naming/historical-records-audit.mjs --check` | exit 0 | Run here (C6) |
| `node --test scripts/naming/naming-gates-mutation.test.mjs` | 29 of 29 pass | Run here (C9) |
| `pnpm naming:check` (whole chain) | exit 0 | Reported (its components C2 to C8 were run here separately; the other 9 test files and `destructive-dossier --check` were not) |
| API suite (`cd apps/api && npx jest --silent`) | 554 suites; 9149 tests passed, 17 skipped | Reported |
| Web suite (`cd apps/web && npx vitest run`) | 385 files; 3163 tests passed | Reported |
| Typecheck `packages/types`, `apps/api` (`tsc -p tsconfig.build.json`), `apps/web` (`tsc -p tsconfig.app.json`) | 0 errors each | Reported |
| Lint | 0 errors | Reported |
| Builds | ok | Reported |
| Database gates on a disposable PostgreSQL 16 (`DB_SSL=false`) | `db:migrate`, `db:check`, `schema-naming-census --check` (5221 catalog objects, 0 Portuguese names, 39 excepted), `residue-census`, `verify:rls`, `verify:tenant-isolation`, `verify:schema-compat-boundaries`, `schema-boundary-proof --prove`, `verify:musicchat-routing-keys` | Reported (not re-run here) |
| `node .claude/runtime/gate-engine.mjs security` | `PENDING FINAL EVIDENCE` | Pending |
| `node .claude/runtime/completion-gate.mjs` | `PENDING FINAL EVIDENCE` | Pending |

Skipped tests (17 in the API suite, as reported). The order states the composition: 12 pre-existing skips plus 5 opt-in real-database blocks. Located here: `describe.skip` blocks that run only when a PostgreSQL URL is set, in `apps/api/src/database/add-english-role-slug-aliases.pg-integration.spec.ts:20`, `apps/api/src/database/migrate-application.preflight-transaction-types.spec.ts:108`, `apps/api/src/database/migration-drafts/rename-legacy-hr-permissions.draft.spec.ts:133`, `apps/api/src/modules/reports/computed-fields/release-tracks.field.legacy-key.spec.ts:85`, and (outside `src`) `apps/api/test/e2e/realtime/realtime-broadcast-authorization.e2e-spec.ts:30`: 5 blocks, matching the 5 opt-in blocks. The 12 pre-existing skips were NOT LOCATED: `git grep -nE "(it|test|describe)\.skip\(|xit\(|xdescribe\(" -- apps/api/src` returns no hit, so they are conditional skips or come from a mechanism I did not identify. They are not hidden: the real-database behavior of these blocks is covered by the CI database job (`.github/workflows/ci.yml` steps listed in section 15).

## 25. Gaps found, fixed and remaining

| ID | Gap | Found by | State | Action |
|---|---|---|---|---|
| F-01 | Canonical map row NC-037 names `dados_internos_crm` as the canonical application name of the leads CRM jsonb, while the code uses `crm_internal_data` (`apps/api/src/database/entities.ts:1272,1277`) and a test asserts `dados_internos_crm` is refused (`apps/api/src/modules/leads/lead-contract.spec.ts:98`). The generated `docs/NAMING_NORMALIZATION_CANONICAL_MAP.md` inherits it. | this report (`grep` of both names) | OPEN | correct NC-037 `application` in `docs/naming/canonical-naming-map.json`, then `node scripts/naming/render-naming-docs.mjs`; the vocabulary document already says `crm_internal_data` |
| F-02 | Generated or hand-kept audit documents lag the tools: `normalization-audit-report.md` still names baseline `02f1ee8a75be16a93f91caae1d8a78702ab2f4fc`; `compat-boundary-audit.md` says 3662 rows (live 4347); `normalization-audit-summary.md\|json` and the matrix say 176 NOT_NORMALIZED (live 172) | this report (C1, C3) | OPEN | regenerate with `pnpm naming:audit` and `pnpm naming:compat:report`; rewrite the baseline paragraph of `normalization-audit-report.md` |
| F-03 | Decision D-06 (`BLK-UNWIRED-UI-SCAFFOLD`) exists only in `docs/engineering/product-decision-packages.md`; no `blockers[]` entry, so the 11 wiring exemptions are justified by a document, not by a ledger blocker | this report | OPEN | add the blocker entry (owner decision) or decide D-06 |
| F-04 | 172 `docCode` tokens without ledger row or historical banner (section 3 counter 1) | C1, C2 | OPEN | per token: rewrite with the canonical name, or add a documented ledger row (for example the legacy transaction slugs inside the `20260930000018` SQL block of the staging runbook are persisted legacy values that the migration reads, which a documented ledger row could state) |
| F-05 | Wiring exemption for `contract-variables.ts:65` matches a site that the proof records as KILLED; it is not needed by the gate | this report (section 17) | OPEN, low | delete the entry |
| F-06 | `compat-mutation-proof.json` holds 69 records of pairs no ledger row cites (38 SURVIVED, 11 NO_MUTATION_SITE, 5 PARTIAL, 4 CANONICAL_FIRST_UNENFORCED, 10 PROVEN, 1 COMPILER_CHECKED) | C12 | OPEN, cosmetic | prune on the next proof regeneration |
| F-07 | The census detects Portuguese words only; legacy mirror names that are not Portuguese (`url_pdf`, `legacy_amount`, `legacy_*` columns) are visible only through blockers, wiring proofs and the schema census, not through a per-name census surface | this report (section 20) | OPEN, low (candidate `RELEVANT_NAMING_GATE_COVERAGE_GAP`) | decide whether a deny-list of legacy mirror names belongs in the gate; the blockers carry removal conditions meanwhile |
| F-08 | `docCode` scans only `docs/engineering/`, `docs/runbooks/`, `docs/naming/*.md`, `apps/*/*.md`, `CLAUDE.md`, `.claude/**/*.md` | this report (census line 582) | OPEN, low | extend `isCurrentDocForCode` or declare other Markdown historical or non-current |
| F-09 | Two copies of the legacy team-contact category table (API `artist-legacy-fields.ts`, web `team-contact-category.ts`), each pinned by its own test, with no parity test between them | this report | OPEN, low | add a parity test or a shared source in `packages/types` |
| F-10 | Orchestration (`.claude/ops`) has no `evidence review` record for the second adversarial review or the security review of the final tree at the time of writing | this report (section 23) | PENDING FINAL EVIDENCE | record after the agents end |
| - | The 12 findings of the first adversarial review | review | FIXED or recorded as human blocker (section 23.a) | - |
| - | Second review MEDIUM-1 to MEDIUM-4, LOW-5, LOW-6 | review | FIXED or recorded (section 23.b) | - |
| - | Cross-layer: team-contact labels, share DTO canonical inputs, phantom invoice `total_amount`, stale comments, release tracks JSON null | independent audit | FIXED (section 21) | - |
| - | Naming gate blind spots: ALL-CAPS values, capitalized data positions, runtime SQL strings, member reads, Markdown code spans and fences | gate analysis | FIXED: detectors and per-detector gate mutations (`9a486f58`; `docCode`: `f5710d80`) | - |

## 26. Allowed residues and why they are not unjustified operational debt

Source: `docs/naming/canonical-naming-map.json` `exceptions[]` (4347 rows, all `status: ACTIVE`; C8 confirms the generated documents are in sync). Counts by `exceptionClass` and `surface` (python over the file):

| exceptionClass | Rows | Lifetime | apiRoute | dataFile | doc | frontendRoute | identifier | objectKey | schema | sqlString | testTitle | toolMessage | unspecified | value |
|---|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| TEMPORARY_MIGRATION_COMPATIBILITY | 3772 | temporary (removal condition) | 4 | 0 | 0 | 8 | 221 | 1346 | 1 | 5 | 1 | 1 | 159 | 2026 |
| LEGACY_DATABASE_COMPATIBILITY | 140 | temporary (removal condition) | 0 | 0 | 0 | 0 | 3 | 10 | 1 | 32 | 0 | 0 | 8 | 86 |
| PRODUCT_TERM_WITHOUT_SAFE_TRANSLATION | 202 | permanent (legal or fiscal term) | 0 | 0 | 0 | 0 | 12 | 30 | 1 | 0 | 0 | 0 | 56 | 103 |
| UX_TEXT | 200 | permanent (PT-BR text) | 0 | 3 | 5 | 0 | 1 | 16 | 0 | 0 | 0 | 3 | 4 | 168 |
| EXTERNAL_CONTRACT | 31 | permanent (external wire format) | 0 | 1 | 0 | 0 | 2 | 6 | 0 | 0 | 0 | 0 | 1 | 21 |
| PROVIDER_DEFINED | 2 | permanent (provider-defined) | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 2 | 0 |
| **Total** | **4347** | | 4 | 4 | 5 | 8 | 239 | 1408 | 3 | 37 | 1 | 4 | 230 | 2404 |

Why none of it is unjustified operational debt (each point measured):

1. Every row has a non-empty `reason`, `owner`, `removalCondition`, `consumer` and `targetState` (python: 0 rows missing any of them).
2. Temporary rows (3,772 + 140 = 3,912) are compatibility for a window, each with a removal condition; every `TEMPORARY_MIGRATION_COMPATIBILITY` row has a `coveringTest` (0 without; ratchet `scripts/naming/covering-test-baseline.json` is 0 and `validate-canonical-map.mjs` fails if it grows).
3. Runtime boundaries are proven by behavior, not by the ledger alone: 1,371 rows BEHAVIORALLY_PROVEN and 2 COMPILER_PROVEN, with 0 required rows unproven (section 16); the 2,559 mutations of the live pairs are all killed (section 18); 510 wiring sites are proven or exempt with a reason (section 17).
4. Permanent rows are domain or contract facts: 202 fiscal/legal terms (`cpf`, `cnpj`, `tomador`, ...), 200 user-visible PT-BR texts, 31 external wire formats, 2 provider-defined. Exempt classification of the 454 non-behavioral rows is in section 16.
5. Persisted structure that cannot be removed without approval is tied to an OPEN blocker with an owner (section 27); no destructive action was executed.
6. The census gate (C2) shows zero debt on every operational surface, so no Portuguese technical name exists outside a ledger row; the only debt is documentation (`doc` 8,695 lines in frozen records and `docCode` 172, section 3).
7. Residue scan (section 20): 0 unjustified production occurrences of 31 legacy terms.

Residues that are explicitly not covered by these arguments: the 172 `docCode` tokens (F-04), the F-01 map divergence, and the human blockers of section 27.

## 27. Human blockers still open and Git state

Source: `docs/naming/canonical-naming-map.json` `blockers[]` with `status = OPEN` (23 of 37; 14 are RESOLVED). By disposition: DESTRUCTIVE_APPROVAL_REQUIRED 12, GENUINE_BUSINESS_DECISION 9, EXTERNAL 2, RESOLVABLE_FROM_CANONICAL_SOURCES 0. No approval was requested or granted here; approvals `appr-c80c4e2f`, `appr-6570cc2f` and the others in the handoff stay with their owners.

| ID | Disposition | Owner | Decision or approval needed |
|---|---|---|---|
| BLK-C3-E6 | DESTRUCTIVE_APPROVAL_REQUIRED | explicit owner authorization required | explicit owner authorization to drop `events.data` and its sync trigger after the web/API release that reads only `starts_at` is live everywhere |
| BLK-HR-LEGACY-MIRRORS | DESTRUCTIVE_APPROVAL_REQUIRED | hr owner | approval to drop the `legacy_*` HR mirror columns after a per-environment comparison with the canonical columns |
| BLK-HR-PII | DESTRUCTIVE_APPROVAL_REQUIRED | hr owner | owner decision: persist `birth_date`, `address`, `rg` with field-level encryption, or remove the inputs; then approval of the drop |
| BLK-SHARES-ARTIST-MIRROR | DESTRUCTIVE_APPROVAL_REQUIRED | shares owner (Phase 0 naming) | authorization to drop `shares.legacy_artist_project_id` once it is proven equal to `artist_id` everywhere |
| BLK-CRM-PII-PLAINTEXT | DESTRUCTIVE_APPROVAL_REQUIRED | crm / tenancy owner (Phase 0 naming) | security-reviewed plan and authorization to encrypt or scrub plaintext PII in `clients.metadata` and `artists.metadata` |
| BLK-WORKS-LEGACY-DUPLICATES | DESTRUCTIVE_APPROVAL_REQUIRED | catalog owner (Phase 0 naming) | authorization to drop the `works.legacy_*` columns after the web release and a disagreement check |
| BLK-PHONOGRAMS-LEGACY-DUPLICATES | DESTRUCTIVE_APPROVAL_REQUIRED | catalog owner (Phase 0 naming) | authorization to reconcile and drop the `phonograms.legacy_*` columns |
| BLK-RELEASES-STATUS-CHECK | GENUINE_BUSINESS_DECISION | releases team | product decision: add `rejected` and `taken_down` to `ReleaseStatus`, or move those rows to `cancelled`; then a CHECK |
| BLK-TRANSACTIONS-LEGACY-DUPLICATES | DESTRUCTIVE_APPROVAL_REQUIRED | accounting owner (Phase 0 naming) | authorization to drop the `transactions.legacy_*` columns once they hold no data absent from the canonical ones |
| BLK-CLIENTS-LEGACY-DUPLICATES | DESTRUCTIVE_APPROVAL_REQUIRED | crm / tenancy owner (Phase 0 naming) | authorization to drop `clients.legacy_contact_status` |
| BLK-CI-JOB-NAME-FASE | EXTERNAL | platform tooling owner | repository admin confirmation that no classic branch protection requires the old CI job name (external) |
| BLK-TRANSACTIONS-V2-CUTOVER | GENUINE_BUSINESS_DECISION | accounting owner (Phase 0 naming) | product decision: keep `transactions` as the ledger or cut over to `financial_transactions` |
| BLK-SHARES-REGISTRY-CREATION | GENUINE_BUSINESS_DECISION | rights owner (Phase 0 naming) | product decision: build the registry-share creation flow or schedule its removal |
| BLK-LEADS-INTERNAL-NOTES | GENUINE_BUSINESS_DECISION | crm owner (Phase 0 naming) | product decision: remove the dead write path, build a real notes field, or keep a read-only legacy mapping |
| BLK-EXTERNAL-SOURCE-SCAFFOLD | GENUINE_BUSINESS_DECISION | catalog owner (Phase 0 naming) | product decision: keep the `external_source*` columns for a planned integration or approve dropping them |
| BLK-RBAC-LEGACY-ROLE-SLUGS | DESTRUCTIVE_APPROVAL_REQUIRED | explicit owner authorization required | authorization for the S4b rename and S5 retirement of the Portuguese role slugs after the gates of `rbac-retirement-plan.md` section 3; decision on four ambiguous slugs |
| BLK-MUSICCHAT-ROUTING-KEYS-NO-READER | GENUINE_BUSINESS_DECISION | explicit owner decision required | owner chooses: adopt `queueKey`/`sectorKey` with a first reader and a drift rule, or remove them |
| BLK-PERSISTED-PT-PLATFORM-VALUES | DESTRUCTIVE_APPROVAL_REQUIRED | explicit owner decision required | owner approval of canonical English ids per vocabulary, then additive migrations with backfill and dual read |
| BLK-SHARES-TYPE-SEMANTICS | GENUINE_BUSINESS_DECISION | explicit owner decision required | owner decision: registry token and CHECK, exclusivity enforcement, canonical participant-role name, fate of `master-owner` |
| BLK-INVOICES-FISCAL-DISCRIMINATORS | GENUINE_BUSINESS_DECISION | explicit owner decision required | owner decision on R1 and R3 and approval of an `operation_type` column with backfill and dual write |
| BLK-INVOICES-LEGACY-MIRRORS | DESTRUCTIVE_APPROVAL_REQUIRED | explicit owner decision required | approval to drop `url_pdf`, `legacy_amount` and the other invoice mirrors together with their readers |
| BLK-WORKS-ISRC-OWNERSHIP | GENUINE_BUSINESS_DECISION | explicit owner decision required | owner decision: keep `works.isrc` as a Work-level reference or migrate to `phonograms.isrc` |
| BLK-CONTRACT-TYPE-SPELLING-CENSUS | EXTERNAL | explicit owner decision required | per-environment census of persisted `contracts.type` values (external) |

Also external and not blockers of the ledger: the destructive dossier packages (all `READY: NO`), PII backfill and scrub, and tools that are not installed (`graphify`, `osv-scanner`, `codeql`; policy disallows network).

Git state (placeholders are filled by the orchestrator):

| Item | Value |
|---|---|
| Branch | `dev` (only branch; no other branch created) |
| HEAD at measurement time | `f5710d80af7f3fe8cac73860f44633b2a1ad1d75`; `git rev-list --left-right --count HEAD...origin/dev` = `0 0` |
| Tracked product files modified by this report author | 1: `docs/engineering/pack/TECHNICAL_LANGUAGE_BEFORE_AFTER_REPORT.md` (no commit, no push) |
| Pre-existing dirty files preserved | `.claude/ops/logs/journal.ndjson`, `.claude/ops/records/orchestration/orch-4281815e.json` (orchestration records, untouched) |
| Final product SHA | `FINAL_PRODUCT_SHA_PLACEHOLDER` |
| Final repository HEAD | `FINAL_HEAD_PLACEHOLDER` |
| `HEAD == origin/dev` and clean tree at the end | `PENDING FINAL EVIDENCE` |
| `gate-engine security` | `PENDING FINAL EVIDENCE` |
| Completion gate | `PENDING FINAL EVIDENCE` |


