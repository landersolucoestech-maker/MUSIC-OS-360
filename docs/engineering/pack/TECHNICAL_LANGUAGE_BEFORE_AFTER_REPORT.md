# Technical language normalization: before and after (comparative report)

Scope: technical names (identifiers, persisted names and values, API fields, routes, tooling messages, data files, documentation language). Every number in this document comes from a command or an artifact cited next to it, or is marked `Reported` when the orchestrator measured it and this report author did not re-run it. A value that could not be derived is written `NOT MEASURED` with the reason; a value that needs a PostgreSQL-backed proof that cannot run now is written `DEFERRED`. Legacy Portuguese names appear only in tables and explanations next to their canonical name, and on lines that say they are legacy. This document describes the final product tree, commit `685aa1c1`.

## 1. Identification

| Item | Value | How obtained |
|---|---|---|
| Baseline | `56b55c46f35d92cabdd8a98bebf7fdfe3a9c1cac` | `git log -1 --format='%H %cI %s' 56b55c46` gives `2026-09-05T13:44:54-03:00` , subject `fix(tenancy): verify cross-tenant FK ownership before create (contracts, licensing, takedowns, shares)` (date 2026-09-05) |
| Received checkpoint | `6b6db7ae39141ce2fb5520f0e951da52971d1cc0` | `git log -1 6b6db7a` (subject `chore(naming): checkpoint technical normalization for account handoff`) |
| Commits baseline to checkpoint | 694 | `git rev-list --count 56b55c46..6b6db7a` |
| Commits checkpoint to the final product commit | 20 | `git rev-list --count 6b6db7a..685aa1c1` |
| Commits baseline to the final product commit | 714 | `git rev-list --count 56b55c46..685aa1c1` (equals `git rev-list --count 56b55c46..HEAD` at the time of measurement) |
| Final product SHA | `685aa1c1e51492db9a599d602500234690721695` | `git log -1 --format=%H 685aa1c1`; branch `dev`; last commit that changed product code |
| Final repository HEAD | the commit that contains this document (`git log -1 --format=%H -- docs/engineering/pack/TECHNICAL_LANGUAGE_BEFORE_AFTER_REPORT.md`); a document cannot contain the hash of its own commit | see the handoff document, section git state |

Commits after the received checkpoint (`git log --format='%H %s' 6b6db7a..685aa1c1`, newest first):

| # | SHA | Subject |
|---:|---|---|
| 1 | `685aa1c1e51492db9a599d602500234690721695` | fix(naming): close technical normalization gates except the deferred database-schema proof |
| 2 | `0598eef34d9568ef05bb64ac54843186d4d5cbb3` | fix: cross-tenant FK ownership on share update/create; invoices canonical fiscal_document_type (tipo_nota deprecated alias); MusicChat routing-key scaffolding removed; shared team-contact category map; read-only contract spelling variants; CI runs the real-PostgreSQL specs |
| 3 | `dd8fc3ccf1aa49e4e9325db13b4e00659f0fa051` | docs: comparative report (27 sections), closure record replacing the interim handoff; ledger blockers (D-06), NC-037 key name, exemption trimmed |
| 4 | `f5710d80af7f3fe8cac73860f44633b2a1ad1d75` | chore(naming): docCode keyed per token; audit baseline set to the real historical baseline 56b55c46 |
| 5 | `d64a6a5dda34a6b0dd1f4f5ce6fa55eb6ecd8d7e` | fix(naming): schema row for invoices.tipo_nota (the per-file rows no longer cover the catalog column); schema/DB gates re-run green |
| 6 | `e39ba93678e33282bd473ac92e158dd8f99c6272` | chore(naming): proofs refreshed on the final code (wiring 510 sites 0 unproven, compat 0, classify 0) |
| 7 | `bde5b74ab019f7a20d9cd668216abd5dfdcffc45` | fix(reports): shares contract excludes the canonical registry inputs (guard); compat mutation proof refreshed |
| 8 | `5c92f97c` expanded: `5c92f97cbb3b3cafb3d7c852802e3f82bd121610` | fix: canonical share DTO inputs, team-contact category labels, phantom invoice total_amount, NULLIF tracks fallback; ledger blockers, docCode and legal-term ratchets |
| 9 | `41470fc594b8cfd84247ea60ef3f927e3216eae6` | chore(ops): journal and orchestration records of the review round |
| 10 | `eb7620d5b51bfd33e3ca88888a7c4a7b6d8052e7` | test: run the shared vocabularies spec from the API test and test:ci scripts (it had no runner) |
| 11 | `3e5ab0f6a9e7f0ab1db88af19268434eb00c9871` | chore(naming): wiring proof complete (509 sites, 0 unproven); classification regenerated; naming:check green |
| 12 | `40ed08155f2e5d48b328458bf1790113ea1962bc` | test(web): rendering tests that kill the remaining wiring mutants (contact categories, HR employees); fixture ledger rows |
| 13 | `912bffd835f63c157b8b475bae4e1812f304c267` | chore(naming): compat mutation proof complete (0 rows without behavioral proof), classify at 0, fixture adjudications |
| 14 | `a26397664cf99521a263643abb3e17b2e8626e99` | feat(naming): SQL_WORD mutation operator for legacy names inside SQL text; rh proof exemptions |
| 15 | `772b4b4f01aade8eabc6174b3074471c5e010bad` | test: behavioral tests for legacy values (API/web), CI wiring of verify:musicchat-routing-keys, ledger covering tests and per-name fixture rows |
| 16 | `d1360e693fad825175fc0fd92b43090385879c29` | chore(naming): wiring proof complete (495 sites, 0 unproven) |
| 17 | `da2cf1dfbab666c6a888fdbac7ea14cfc7f73d93` | test(web): behavioral tests for the release phonogram title lookup and genre review summary; helpers moved to lib (no behavior change) |
| 18 | `915a70544e2bc384b7f9925bffbd4bc6c3a34a0c` | chore(naming): wiring proof slices for reports, clients, invoices and migrations re-proved (remaining slices running) |
| 19 | `9a486f589b96b91dbd26b147f227641c19a168af` | chore(naming): close naming gate coverage gaps (ALL-CAPS values, capitalized data positions, runtime SQL strings) |
| 20 | `fc4fa41137e4bd883115d9cee486ab777b1780d0` | chore(naming): intermediate checkpoint of the technical normalization resume (gates not green yet) |

Note on row 8: the full SHA of that commit is the value after the word expanded; row 15 names a CI step (`verify:musicchat-routing-keys`) that commit `0598eef3` (row 2) removed together with the scaffolding it verified (section 21).

## 2. Method and evidence sources

Detectors: the same lexicon (`scripts/naming/pt-lexicon.mjs`, `scripts/naming/pt-vocabulary.txt`), the same scanners (`scripts/naming/technical-naming-census.mjs`) and the same surfaces are run over the baseline tree (`git archive` of `56b55c46`, empty exception index) and over the current tree (real ledger). The only variable is the repository. Reference: header of `scripts/naming/normalization-audit.mjs`.

Commands run for this document (all read-only; outputs outside the repository went to a scratch directory). `Reported` means the orchestrator measured the value at the final tree and this report author did not re-run it:

| Id | Command | Result |
|---|---|---|
| C1 | `node scripts/naming/normalization-audit.mjs --baseline 56b55c46f35d92cabdd8a98bebf7fdfe3a9c1cac --out <scratch>` | per-layer table and per-surface table (sections 5 and 6); matrix of 32,857 rows, run on the final tree after this document was rewritten (the matrix includes this document's own rows) |
| C2 | `node scripts/naming/technical-naming-census.mjs --check` | exit 0, debt {"doc":8695} on the tree committed with this document (on the product tree `685aa1c1` alone it exited 1 with debt {"doc":8695,"value":8}, finding F-14); see section 24 |
| C3 | `node scripts/naming/compat-boundary-audit.mjs --check` | exit 0: 4,546 rows, 944 groups; counters in section 3 |
| C4 | `node scripts/naming/compat-boundary-classify.mjs --check` | exit 1: 4,546 rows, 3 UNPROVEN rows, all `database-schema` and DEFERRED (counters in sections 3 and 16) |
| C5 | `node scripts/naming/compat-wiring-proof.mjs --check` | exit 0: 516 production call sites, `WIRING_SITES_UNPROVEN=0` |
| C6 | `node scripts/naming/historical-records-audit.mjs --check` | exit 0; 129 records, `MISCLASSIFIED_HISTORICAL_RECORDS=0`, violations 0 |
| C7 | `node scripts/naming/validate-canonical-map.mjs` | exit 0; 70 column assertions against 132 tables |
| C8 | `node scripts/naming/render-naming-docs.mjs --check` | exit 0; 97 concepts, 0 renames, 4,546 exceptions |
| C9 | `node --test scripts/naming/naming-gates-mutation.test.mjs` | 29 tests, 29 pass, 0 fail (1 clean fixture + 26 injected defects + 2 ledger/path tests); `Reported` for the final tree |
| C10 | `git grep -n -I -w -i -e <term> -- apps/api/src apps/web/src packages scripts e2e .github supabase` for 31 legacy terms, counted by path class with a small python script kept in the scratch directory | section 20 |
| C11 | `python3` over `docs/naming/canonical-naming-map.json`, `docs/naming/audit/*.json` and the committed classification TSV | sections 4, 16 to 18, 26, 27 |
| C12 | per-pair freshness of `compat-mutation-proof.json` against the ledger (script imports `pairsFromLedger` from `scripts/naming/compat-mutation-proof.mjs`) | last run at commit `f5710d80`; NOT re-run for the final tree, the per-pair count is `NOT MEASURED`. C3 exit 0 shows that every credited pair has a fresh record, because the check rejects stale records (section 18) |

Freshness rule: the measurements were taken at the final product commit `685aa1c1` (`git log -1 --format=%H` = `685aa1c1e51492db9a599d602500234690721695`, branch `dev`) with this working tree state (`git status --short`): the orchestration records `.claude/ops/logs/journal.ndjson`, `.claude/ops/records/orchestration/orch-4281815e.json` and `.claude/ops/telemetry/events.ndjson` modified, `docs/engineering/pack/TECHNICAL_NORMALIZATION_HANDOFF.md` modified, this document modified, and `docs/engineering/pack/TECHNICAL_NORMALIZATION_DEFERRED_DATABASE_PROOF.md` untracked. No product file was dirty. The committed proof files are bound to the sha256 of each source file and test; the `--check` modes reject stale records. The tables of sections 5 and 6 come from C1 run after this document was rewritten and therefore include its rows. Numbers that I could not re-measure (test-suite totals, the last full API run, security gate, live-database census) are marked `Reported` or `NOT MEASURED`. Any later product change makes the numbers of this document stale until C1 to C9 are re-run.

## 3. Verdict and the ten closing counters

> Update after the post-commit validation of round 4: where a counter below was measured at `685aa1c1` and `docs/engineering/pack/TECHNICAL_NORMALIZATION_FINAL_VALIDATION.md` states a different value (items 69,314; 4,547 boundary rows; adjudication entries 875; open blockers 28 of 42; verdict `CONDITIONALLY COMPLETE — DATABASE PROOF DEFERRED`), the final validation record is authoritative.

Verdict: **`TECHNICAL NORMALIZATION: INCOMPLETE — DATABASE SCHEMA PROOF DEFERRED`**. Reason: the three `database-schema` boundaries (`transferencia` on `invoices.payment_method`, `events.data`, `tipo_nota` on invoices) need a PostgreSQL-backed proof (`node scripts/naming/schema-boundary-proof.mjs --prove`) and no PostgreSQL is available now: BLOCKED_EXTERNAL / DEFERRED. The recorded schema proof is stale by design (the check script `apps/api/scripts/verify-schema-compat-boundaries.ts` gained a `tipo_nota` check and `schema-boundary-proof.mjs` gained the mutant `invoices-fiscal-kind-column` after the proof was generated). Everything else is independently proven. Resume command for the deferred proof: `DATABASE_URL=postgresql://musicos360@127.0.0.1:5432/music_os_check DB_SSL=false node scripts/naming/schema-boundary-proof.mjs --prove` (the password is supplied by the operator through `PGPASSWORD`; a migrated database is required), then `node scripts/naming/compat-boundary-classify.mjs --report && node scripts/naming/compat-boundary-classify.mjs --check`. Details: `docs/engineering/pack/TECHNICAL_NORMALIZATION_DEFERRED_DATABASE_PROOF.md`.

| # | Counter | Value | Command that produced it | Status |
|---:|---|---|---|---|
| 1 | NOT_NORMALIZED | **0** | C1 on the tree committed with this document: 69,304 items, NORMALIZED 47,762, LEGITIMATE_COMPATIBILITY_BOUNDARY 12,847, HISTORICAL_RECORD 8,695, NOT_NORMALIZED 0 (the orchestrator's earlier run, before the final tree: 69,294 items, same NOT_NORMALIZED 0, `Reported`). Per layer (items / normalized / legitimate / historical / not normalized): DATABASE 858 / 824 / 34 / 0 / 0; BACKEND_API 8,811 / 6,696 / 2,115 / 0 / 0; FRONTEND 24,009 / 22,507 / 1,502 / 0 / 0; SHARED_PACKAGES 481 / 434 / 47 / 0 / 0; TESTS_FIXTURES_MOCKS 13,460 / 6,650 / 6,810 / 0 / 0; TOOLING_SCRIPTS_CI 337 / 273 / 64 / 0 / 0; DOCUMENTATION 21,348 / 10,378 / 2,275 / 8,695 / 0. The earlier 171 `docCode` tokens are covered by 199 per-token ledger rows of class `UX_TEXT` with surface `docCode` (path = the document, current name = the token), so the census debt of documentation is only `doc` = 8,695 baselined prose lines and `docCode` = 0. Intermediate state (finding F-14): on the committed product tree `685aa1c1` the census reported 8 occurrences of `tipo_nota` and `tipo_notas` in two spec files that the commit started tracking; ledger rows for them are in the tree committed with this document | Closed on the tree committed with this document |
| 2 | UNJUSTIFIED_OPERATIONAL_RESIDUES | `node scripts/naming/technical-naming-census.mjs --check` exit 0, debt {"doc":8695}: zero debt on every operational surface. The per-term classification of section 20 keeps its caveat | C2; C1 surfaces; section 20 gives per-term totals split by path class and states what was not re-classified | Census part measured; per-term part `NOT MEASURED` at the final commit |
| 3 | UNCOVERED_COMPATIBILITY | `COMPATIBILITY_BOUNDARIES_WITHOUT_BEHAVIORAL_PROOF` = 0, `OBSOLETE_BOUNDARIES` = 0, `MISCLASSIFIED_OPERATIONAL_USAGE` = 0, `LEGACY_FIRST_READS` = 0 (the two invoice event reads now read the canonical `fiscal_document_type` first) | C3 exit 0: 4,546 rows, 944 groups; proof basis 1,376 rows by mutation, 3 by the compiler only, 2,528 binding-only | Closed for runtime boundaries; database-schema rows are counted in counter 7 |
| 4 | CROSS_LAYER_DIVERGENCES | Round-3 independent adversarial review (read-only agent): M1 MEDIUM (a MusicChat settings save could return 400 for settings that still carried stored `queueKey` or `sectorKey`): FIXED in `685aa1c1`, the two keys are accepted as deprecated input and dropped by `canonicalMenuOption`, tests in `musicchat-vocabulary.spec.ts`; L1 LOW (ledger text of CZ-045 referred to the removed migration): FIXED; L2 LOW (migration `20261005100001` was published at the checkpoint and removed later: environments that applied it keep a migrations row and the side table `musicchat_routing_keys_backfill_20261005`): recorded as a compensation note, no code action. Its VERDICT line said FAIL because of M1. M1 is now fixed; no re-review was run after the fix | No script measures this counter. Findings in sections 21 and 23.f | Known and open: 0 from the code findings; F-11 (blocker text, section 25) remains a text divergence |
| 5 | RELEVANT_NAMING_GATE_COVERAGE_GAPS | 0 known | `node --test` over the 11 naming gate test files of `pnpm naming:check`: 210 tests, 209 pass, 0 fail, 1 skipped; `naming-gates-mutation` 29 of 29 (`Reported` for the final tree). Known scope limit: `docCode` only scans `docs/engineering/`, `docs/runbooks/`, `docs/naming/*.md`, `apps/*/*.md`, `CLAUDE.md`, `.claude/**/*.md` (`isCurrentDocForCode`, census line 582); other current Markdown is not scanned for code tokens | Measured for the tested defects |
| 6 | SOLVABLE_NAMING_BLOCKERS | 0 by the ledger; **contested for 2**: the independent reviewer judged BLK-PERSISTED-PT-PLATFORM-VALUES and BLK-UNWIRED-UI-SCAFFOLD internally solvable, the orchestrator classified them as decisions (sections 23 and 25). If the reviewer view prevails the value is 2 | C11: `blockers[]` with `status=OPEN` and `disposition=RESOLVABLE_FROM_CANONICAL_SOURCES` = 0 (OPEN total 23: 12 DESTRUCTIVE_APPROVAL_REQUIRED, 9 GENUINE_BUSINESS_DECISION, 2 EXTERNAL; RESOLVED 14; total 37) | Measured 0 on the ledger; disagreement open |
| 7 | COMPATIBILITY_BOUNDARIES_WITHOUT_REQUIRED_PROOF | **3** (`REQUIRED_BEHAVIORAL_ROWS=1379`): DEFERRED | C4 `--report` classes: BEHAVIORALLY_PROVEN 1,376, COMPILER_PROVEN 3, BINDING_ONLY 2,525, EXEMPT_WITH_JUSTIFICATION 639, UNPROVEN 3 (the committed product tree `685aa1c1` had 4,542 rows, BINDING_ONLY 2,522 and EXEMPT 638; the 4 added rows are the ledger rows of F-14 and one `docCode` token row). The three rows are exactly the `database-schema` rows `transferencia`, `events.data` and `tipo_nota`, UNPROVEN only because the recorded schema proof is stale (see verdict) and cannot be regenerated without PostgreSQL | DEFERRED, BLOCKED_EXTERNAL (F-12) |
| 8 | WIRING_SITES_UNPROVEN | 0 of 516 production call sites (45 calls of `applyDeprecatedFieldAliases`, 471 consumer calls) | C5 exit 0; `docs/naming/audit/compat-wiring-proof.json` holds 515 records: 505 KILLED, 10 SURVIVED (the 10 documented exemptions of section 17) | Closed |
| 9 | CURRENT_DOCUMENTATION_DIVERGENCES | The committed generated audit documents were regenerated (`compat-boundary-audit.md` reports 4,546 rows and 944 groups; `normalization-audit-summary.md` equals C1 except the two spec files); the stale ledger sentence of finding L1 was fixed; the final review listed no other documentation divergence. Still stale: the narrative paragraph of `docs/naming/audit/normalization-audit-report.md` names baseline `02f1ee8a75be16a93f91caae1d8a78702ab2f4fc` instead of `56b55c46` (F-02, partly open) | No script classifies a documentation statement as divergent from code (state: not measurable by a script). `docs/naming/audit/historical-records-audit.md` (C6) proves the 129 historical records are frozen, labelled, unconsumed and not normative | Not measurable by a script |
| 10 | FIXTURE_MOCK_DIVERGENCES | 0 unadjudicated fixture names (unchanged) | `docs/naming/audit/fixture-name-adjudication.json`: 870 entries (UI_TEXT 802, COMMENT_OR_DOC 43, BOUNDARY_COVERED_BY_COMPOUND_ROW 16, BOUNDARY 5, RESOLVED 4), none unadjudicated; C4 `FIXTURE_NAMES_WITH_UNCOVERED_PRODUCTION_OCCURRENCE=0` and `FIXTURE_NAMES_WITHOUT_PRODUCTION_OCCURRENCE=142` | Measured for names; shape divergence not measurable by a script |

Gate state at the final tree: `node .claude/runtime/gate-engine.mjs security` = `BLOCKED` (the evidence criteria must be re-recorded as fresh PASS bound to the final workspace fingerprint, and two criteria, `schema-naming-census` and `db:check`, need PostgreSQL: BLOCKED_EXTERNAL). Completion gate = NOT RUN (it cannot pass while those criteria are open).

## 4. Concept matrix before and after

Source: `docs/naming/canonical-naming-map.json` `concepts[]` (97 concepts in total; this table lists 41 of them: every NC concept that names a field family, chosen because each one has a legacy alias and a canonical name; the 48 `CZ-*` rows describe modules and carry no alias columns in the map). Disposition counts over all 97 (command: `python3` over `concepts[].disposition`): DONE 85, BLOCKED_PRODUCT_DECISION 6, NEEDS_PRODUCT_DECISION 3, RESOLVED 2, MIGRATION_REQUIRED 1. Rows whose map columns are empty were completed from the concept title. NC-039 to NC-042 (decisions without alias columns: NEEDS_PRODUCT_DECISION for NC-039 to NC-041, RESOLVED for NC-042) and the external-source concepts NC-044, NC-045, NC-047, NC-048 (same shape as NC-043 and NC-046) are in the map and are not repeated here. The invoice fiscal document kind (`fiscal_document_type`, persisted column `tipo_nota`) is documented by ledger rows and by blocker BLK-INVOICES-FISCAL-DISCRIMINATORS, not by an NC concept row.

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
| NC-010 | Start/end dates | `data_inicio`, `data_fim` (legacy names; the map also lists `startsAt`, `expiresAt` as aliases of the contracts family) | `start_date`/`end_date` (contracts, HR leave, audiovisual, goals); `starts_at` (events, campaigns, marketing projects); app `startDate`/`endDate`; `startsAt`; API same names on the wire | `Data de início / término` | DONE |
| NC-011 | Attachments/documents field | `documentos` | `documents` (artists, contracts, shares, employees); app `documents`; API `documents` | Documentos | DONE |
| NC-012 | Notes/observations | `observacoes` | `notes` (12+ tables); app `notes`; API `notes` | `Observações` | DONE |
| NC-013 | Description | `descricao` | `description` (8+ tables); app `description`; API `description` | `Descrição` | DONE |
| NC-014 | Duration (text form) | `duracao` | `duration_text` (works, phonograms); app `durationText`; API `duration_text` | `Duração` | DONE |
| NC-015 | Genre/music genre | `genero`, `genero_musical` (legacy names) | `music_genre` (artists, phonograms, projects, project_tracks, releases, works); app `musicGenre`; API `music_genre` | `Gênero Musical` | DONE |
| NC-016 | Name | `nome` | `name` (employees, inventory_items, financial_rules, work_participants, project_tracks, project_track_participants); app `name`; API `name` | Nome | DONE |
| NC-017 | Name: clients / leads | - | `name` (clients, leads); app `name`; API `name` | Nome | DONE |
| NC-018 | Category | `categoria` | `category` (inventory_items, financial_rules); app `category`; API `category` | Categoria | DONE |
| NC-019 | Category: transactions | - | `category`, `subcategory` (transactions); app `category`, `subcategory`; API `category`, `subcategory` | Categoria | DONE |
| NC-020 | Active flag | `ativo` | `active` (contract_templates, financial_rules); app `active`; API `active` | Ativo | DONE |
| NC-021 | Sort order | `ordem` | `sort_order` (work_participants, project_tracks, project_track_participants, contract_service_types, knowledge_categories); app `sortOrder`; API `sortOrder` | Ordem | DONE |
| NC-022 | Leads client/service type | `tipo_cliente`, `tipo_servico`, `tipoCliente`, `tipoServico` (legacy names) | `client_type`/`service_type` (leads only); app `clientType`/`serviceType`; API `clientType`/`serviceType` | `Tipo de cliente / Tipo de serviço` | DONE |
| NC-023 | Share party role / percentage / holder identity | `papel`, `percentual`, `titular_nome`, `titular_doc`, `direcao`, `nome_musica`, `detentor`, `destinatario` (legacy names) | `party_role`, `percentage`, `holder_name`, `holder_document`, `direction`, `music_title`, `holder`, `recipient`; app matching camelCase; API matching snake_case | `Papel, Percentual, Titular, Documento, Direção, Título, Participante, Destinatário` | DONE |
| NC-024 | Invoice due date (internal fiscal note) | `vencimento`, `data_vencimento` (legacy names) | `due_at` (invoices); app n/a; API `due_at` (legacy `vencimento` is a deprecated input alias) | Vencimento | DONE |
| NC-025 | Invoice due date (Stripe SaaS billing) | - | `due_date` (invoices, `type='stripe_subscription'` rows only); app n/a; API n/a (webhook-populated) | - | DONE |
| NC-026 | Invoice payer tax ID (CPF or CNPJ) | - | `tomador_cnpj` (invoices); app `tomador_cnpj`; API `tomador_cnpj` | CNPJ / CPF | DONE |
| NC-027 | Works registry-field pairs | `idioma`, `outros_titulos`, `criada_por_ia`, `instrumental`, `duracao`, `letra_completa` (legacy names) | `language`, `alternative_titles`, `ai_used`/`ai_tools`/`ai_prompts`, `duration_seconds`, `lyrics` | - | DONE |
| NC-028 | Phonograms registry-field pairs | `gravacao_original`, `data_lancamento`, `duracao_min`/`duracao_seg`, `pais_origem` (legacy names) | `recording_date`, `release_date`, `duration_seconds`, `country_of_recording` | - | DONE |
| NC-029 | Phonograms audio file metadata (jsonb: name/size/url) versus the file FK | `arquivo_audio` (legacy name) | `audio_file` (jsonb display metadata) distinct from `audio_file_id` (uuid FK); app `audioFile`; API `audio_file` (`arquivo_audio` deprecated input alias) | - | DONE |
| NC-030 | Phonograms `instrumental` (was varchar yes/no text) to `is_instrumental` | `instrumental` (legacy varchar) | `is_instrumental` | - | DONE |
| NC-031 | Works legacy `tipo_obra` versus `type` | `tipo_obra` (legacy name) | `work_origin` (and `type`); app `workOrigin`; API `work_origin` (`tipo_obra` deprecated input alias) | - | DONE |
| NC-032 | Phonograms legacy text columns for composers, performers and producers | `compositores`/`interpretes`/`produtores` (legacy text columns) | participants child tables (`work_participants`, `project_track_participants`); the three text columns removed | - | DONE |
| NC-033 | Works singular versus plural composer field | `compositor` (legacy singular) | plural jsonb participants; the singular field retired | - | DONE |
| NC-034 | Phonograms participation DTO shape | `participacao` (legacy name) | `participation` (jsonb) | - | DONE |
| NC-035 | Clients city and state | `cidade`/`estado` (legacy names) | `city`, `state` (clients); app `city`/`state`; API `city`/`state` | - | DONE |
| NC-036 | Leads city, state and country | `cidade`/`estado`/`pais` (legacy names) | `city`, `state`, `country` (leads); app `city`/`state`/`country`; API `city`/`state`/`country` | - | DONE |
| NC-037 | Leads dual-storage (seven physical columns versus a jsonb copy) | `origem_lead`, `responsavel`, `prioridade`, `temperatura`, `probabilidade_fechamento`, `proximo_follow_up` (legacy columns) | physical columns dropped; CRM data in the `crm_internal_data` jsonb column (the ledger concept uses that name; finding F-01 closed); app jsonb key vocabulary in `lead-vocabulary.ts`; API per map | - | DONE |
| NC-038 | `shares.type` versus `party_role` | `type` (shares, legacy name) | `party_role`; app `party_role`; API `party_role` | - | RESOLVED |
| NC-043 | `works.external_source` | `works.origem_externa` (legacy name) | works.external_source; app external_source; API external_source | `Origem externa` | BLOCKED_PRODUCT_DECISION |
| NC-046 | `phonograms.external_source` | `phonograms.origem_externa` (legacy name) | phonograms.external_source; app external_source; API external_source | `Origem externa` | BLOCKED_PRODUCT_DECISION |
| NC-049 | Lead interaction timestamp | `lead_interactions.data` (legacy column) | `lead_interactions.occurred_at`; app `occurred_at` (entity), `occurredAt` (web); API `occurred_at` | `Data da interação` | DONE |

## 5. Quantitative table by layer, baseline versus final

Source: C1 (`node scripts/naming/normalization-audit.mjs --baseline 56b55c46f35d92cabdd8a98bebf7fdfe3a9c1cac --out <scratch>`), run on the final tree after this document was rewritten (its rows are included). Baseline scanned 2743 files, final tree 4800 files; 4705 files changed between them. Unit: one census item (identifier, object key, string value, route, file name, data-file name, tool message; a Markdown document counts its Portuguese prose lines) with its occurrence count. `audited = normalized + remaining` on every row; `audited` of an item is `max(baseline, final)`; `normalized = max(0, baseline - final)`; `remaining = final`.

| Layer | Items audited | Files changed | Normalized | Remaining: legitimate boundary | Remaining: historical record | NOT_NORMALIZED |
|---|---:|---:|---:|---:|---:|---:|
| DATABASE | 858 | 289 | 824 | 34 | 0 | 0 |
| BACKEND_API | 8,811 | 712 | 6,696 | 2,115 | 0 | 0 |
| FRONTEND | 24,009 | 987 | 22,507 | 1,502 | 0 | 0 |
| SHARED_PACKAGES | 481 | 168 | 434 | 47 | 0 | 0 |
| TESTS_FIXTURES_MOCKS | 13,460 | 998 | 6,650 | 6,810 | 0 | 0 |
| TOOLING_SCRIPTS_CI | 337 | 313 | 273 | 64 | 0 | 0 |
| DOCUMENTATION | 21,348 | 1,238 | 10,378 | 2,275 | 8,695 | 0 |
| **TOTAL** | **69,304** | **4,705** | **47,762** | **12,847** | **8,695** | **0** |

Relation to the committed summary (`docs/naming/audit/normalization-audit-summary.md`): the committed file of commit `685aa1c1` shows 4798 files, 4703 changed files, 69,294 items and NOT_NORMALIZED 0. Two things differ in the re-run on the tree committed with this document (4800 files, 4705 changed files, 69,304 items): the two spec files that the final product commit started tracking, whose three fixture names have ledger rows added in this tree (F-14, ledger 4,542 to 4,546 rows), and the rows of this document itself (DOCUMENTATION 21,348 items). The orchestrator's scratch run of the same command (`Reported`) showed BACKEND_API with 6,694 normalized and 2,117 legitimate; this run and the committed summary show 6,696 and 2,115 for that layer, and this document uses the values it measured.

Reading: the layer with the largest residue is TESTS_FIXTURES_MOCKS (6,810 remaining as `LEGITIMATE_COMPATIBILITY_BOUNDARY`): legacy names kept on purpose as fixture inputs of the compatibility proofs (section 16). No layer has `NOT_NORMALIZED` items: the former `docCode` tokens of DOCUMENTATION and the three fixture names of the two spec files (F-14) are covered by ledger rows.

## 6. Quantitative table by surface

Same source as section 5 (the matrix `normalization-audit-matrix.tsv` re-generated by C1, grouped by the `surface` column; command: `python3` over the TSV). `Baseline` is the sum of baseline occurrence counts of the census items; `Audited` is the sum of `max(baseline, final)`.

| Surface | Items | Baseline | Audited | Normalized | Remaining | Legitimate boundary | Historical record | NOT_NORMALIZED |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| apiRoute | 7 | 4 | 7 | 0 | 7 | 7 | 0 | 0 |
| comment | 989 | 5,707 | 5,707 | 5,707 | 0 | 0 | 0 | 0 |
| dataFile | 2,631 | 2,611 | 2,631 | 574 | 2,057 | 2,057 | 0 | 0 |
| dbColumn | 411 | 399 | 411 | 377 | 34 | 34 | 0 | 0 |
| directory | 5 | 5 | 5 | 5 | 0 | 0 | 0 | 0 |
| doc | 273 | 18,219 | 19,068 | 10,340 | 8,728 | 33 | 8,695 | 0 |
| docCode | 212 | 7 | 212 | 7 | 205 | 205 | 0 | 0 |
| eventQueueJob | 35 | 37 | 37 | 37 | 0 | 0 | 0 | 0 |
| filename | 245 | 245 | 245 | 245 | 0 | 0 | 0 | 0 |
| frontendRoute | 276 | 203 | 348 | 203 | 145 | 145 | 0 | 0 |
| identifier | 8,641 | 12,316 | 12,840 | 11,942 | 898 | 898 | 0 | 0 |
| objectKey | 6,718 | 6,838 | 10,222 | 6,408 | 3,814 | 3,814 | 0 | 0 |
| sqlString | 212 | 238 | 328 | 232 | 96 | 96 | 0 | 0 |
| testTitle | 2,295 | 2,304 | 2,305 | 2,304 | 1 | 1 | 0 | 0 |
| toolMessage | 523 | 520 | 523 | 493 | 30 | 30 | 0 | 0 |
| value | 9,386 | 9,405 | 14,415 | 8,888 | 5,527 | 5,527 | 0 | 0 |
| **TOTAL** | **32,859** | **59,058** | **69,304** | **47,762** | **21,542** | **12,847** | **8,695** | **0** |

Observation on `docCode`: the surface has 7 baseline items and 212 final items (205 remaining, all with a ledger row, 0 NOT_NORMALIZED). The ledger holds 199 per-token rows of class `UX_TEXT` with surface `docCode` (python over `exceptions[]` of `docs/naming/canonical-naming-map.json`; path = the document, current name = the token). The data do not show why the baseline count is so low (documents added during the mission versus lines that carry a legacy marker in the baseline and are skipped by the scanner); that was not investigated. NOT_NORMALIZED is 0 on every surface. The `comment` surface (5,707 baseline, 0 final) and `testTitle` (2,304 baseline, 1 final) are fully normalized.

## 7. Vertical propagation: database, domain, backend, API, frontend, tests, docs, tooling

Each family below is traced through every layer. `BEFORE` is read with `git show 56b55c46:<path>` (or `git grep -n ... 56b55c46`), `AFTER` with `git grep -n` on the current tree. A cell `none` means the command returned no hit for that layer. Line numbers were re-read on the current tree.

### 7.1 Family A: foreign keys to catalog and CRM aggregates (legacy `artista_id` becomes `artist_id`; map concepts NC-001 to NC-007)

| Layer | BEFORE | AFTER |
|---|---|---|
| Database | `56b55c46:apps/api/src/database/entities.ts:713` legacy column `artista_id: string \| null` | `apps/api/src/database/entities.ts:588` `artist_id: string`; migration `apps/api/src/database/migrations/20260905000003_RenameArtistaIdToArtistId.ts` (not present at the baseline) |
| Domain (`packages/types`) | no FK field; legacy status enum member `EX_ARTISTA = "ex_artista"` (`56b55c46:packages/types/src/enums.ts:72`) | `FORMER_ARTIST = "former_artist"` (`packages/types/src/enums.ts:84`) |
| Backend | `56b55c46:apps/api/src/modules/artist-goals/artist-goals.controller.ts:26` legacy query parameter `@Query('artista_id')` | `apps/api/src/modules/artist-goals/artist-goals.controller.ts:26` `@Query('artist_id') artist_id`; service filter at `artist-goals.service.ts:25` |
| API | legacy query parameter `artista_id` (same line as backend) | canonical `artist_id`; deprecated aliases are accepted through `applyDeprecatedFieldAliases` where a DTO still lists them (45 call sites in the current wiring check, C5) |
| Frontend | `56b55c46:apps/web/src/modules/accounting/components/transacao-form/hooks/useFinancialRules.ts:15` legacy interface with `artista_id` and `titulo` | `apps/web/src/modules/accounting/components/transaction-form/hooks/useFinancialRules.ts:15` `interface Event { ... artist_id ... title ... }` (file and folder renamed) |
| Tests | `56b55c46:apps/api/src/core/automation/project-planning.automation.spec.ts:68` legacy fixture `artista_id: null` | `apps/api/src/core/automation/project-planning.automation.spec.ts:70` `artist_id: null` |
| Docs | `56b55c46:docs/ESPECIFICACAO_TECNICA_ESTADO_ATUAL_SISTEMA.md:42` legacy mapping `artistId -> artista_id` | `docs/engineering/pack/CANONICAL_TECHNICAL_VOCABULARY.md:26` Artist row: canonical `artist_id`, legacy alias listed next to it |
| Tooling | `56b55c46:scripts/phase2-crud-validation.mjs:236` legacy SQL selecting `artista_id` and `titulo` | script no longer matches `artist_id` or the legacy name; the legacy name is registered in `docs/naming/canonical-naming-map.json:554` (NC-001 `legacyAliases`) and gated by the census |

Counts for the family at the baseline and now (section 20): the legacy name `artista_id` appeared 522 times (313 in non-test files) and appears 118 times now (105 in migration history, 12 in tests, 1 in another file).

### 7.2 Family B: works classification (legacy `tipo_obra` becomes `work_origin`; NC-031)

| Layer | BEFORE | AFTER |
|---|---|---|
| Database | `56b55c46:apps/api/src/database/entities.ts:748` legacy column `tipo_obra: string \| null` | `apps/api/src/database/entities.ts:795` `work_origin`; migration `20260921000001_FixWorksTypeTipoObraCollision.ts` |
| Domain | the legacy column coexisted with the generic `type` classifier (collision recorded as NC-031) | `work_origin` is the origin of the work; `type` stays the generic classifier (`docs/engineering/pack/CANONICAL_TECHNICAL_VOCABULARY.md:52`) |
| Backend | `56b55c46:apps/api/src/modules/works/dto/query-work.dto.ts:19` legacy query field `tipo_obra?: string` | `apps/api/src/modules/works/work-legacy-fields.ts:26` alias `tipo_obra: 'work_origin'` (deprecated input); legacy values `autoral`, `referencia` mapped at `:56` to `original`, `reference` |
| API | `56b55c46:apps/api/src/modules/works/dto/create-work.dto.ts:89` legacy field `tipo_obra?: string` | `apps/api/src/modules/works/dto/create-work.dto.ts:97` canonical `work_origin` and `:117` the legacy alias marked `DEPRECATED('work_origin')` |
| Frontend | `56b55c46:apps/web/src/modules/catalog/components/ObraFormModal.tsx:186` reads the legacy field `obra.tipo_obra` | `apps/web/src/modules/catalog/components/WorkFormModal.tsx:198` `work?.work_origin`; `WorkOriginBadge.tsx:4` PT-BR badge of `works.work_origin` |
| Tests | no deprecation test | `apps/api/src/modules/works/dto/create-work.dto.legacy-compat.spec.ts:49` (legacy alias row, `'tipo_obra', 'work_origin', ...`); `apps/api/src/modules/works/work-contract.spec.ts:57` rejects unknown `work_origin` values |
| Docs | vocabulary did not exist | `docs/engineering/pack/CANONICAL_TECHNICAL_VOCABULARY.md:15` Work row and `:52` |
| Tooling | no census | ledger rows for `create-work.dto.ts` and the spec, compat mutation proof for `work-legacy-fields.ts` (section 18) |

### 7.3 Family C: invoice due date (legacy `data_vencimento`/`vencimento` become `due_at`; NC-024, NC-025)

| Layer | BEFORE | AFTER |
|---|---|---|
| Database | `56b55c46:apps/api/src/database/entities.ts:1058` legacy `data_vencimento` (timestamp) and `:1072` legacy `vencimento` (date), two columns for one concept | `apps/api/src/database/entities.ts:1125` `due_at`; migration `20260920000005_ConsolidateInvoiceDueDateColumns.ts` |
| Domain | none | `invoices.due_date` stays Stripe-owned and is never merged with `due_at` (vocabulary document line 46; NC-025) |
| Backend | none | `apps/api/src/modules/invoices/invoice-legacy-fields.ts:18` alias `vencimento: 'due_at'` |
| API | `56b55c46:apps/api/src/modules/invoices/dto/invoices.dto.ts:42` legacy field `vencimento?: string` | `apps/api/src/modules/invoices/dto/invoices.dto.ts:49` `due_at` and `:92` the legacy alias (`description: 'Use "due_at".'`) |
| Frontend | `56b55c46:apps/web/src/modules/accounting/types/accounting.types.ts:77` legacy `data_vencimento?` | `apps/web/src/modules/accounting/types/accounting.types.ts:119` `due_at?` |
| Tests | none | `apps/api/src/modules/invoices/invoice-contract.spec.ts:25` legacy input alias, `:61` canonical `due_at`; `invoice-stripe-due-date.guard.spec.ts` pins the Stripe field |
| Docs | none | `docs/engineering/pack/CANONICAL_TECHNICAL_VOCABULARY.md:24` and `:46` |
| Tooling | none | the legacy name `data_vencimento` appears 17 times in the scanned scope now: 15 in migration history, 1 in a test, 1 in another file (section 20) |

### 7.4 Further families (same layers, one line each)

| Family | BEFORE (baseline) | AFTER (current) | Layers with proof |
|---|---|---|---|
| Share party fields (NC-023) | `56b55c46:apps/api/src/database/entities.ts:1470` legacy `titular_nome` and `:1496` legacy `nome_musica`; `56b55c46:apps/api/src/modules/shares/shares.service.ts:91` writes the legacy `out['titular_nome']` | `apps/api/src/database/entities.ts:1534` `holder_name`, `:1560` `music_title`; `apps/api/src/modules/shares/dto/shares.dto.ts:18,49` canonical inputs and `:25` deprecated alias; migration `20260913000001_RenameSharePartyFieldsToEnglish.ts` | database, backend, API, tests (`shares-canonical-input.spec.ts`, `share-contract.spec.ts:99`) |
| Share parent references (tenant isolation) | `SharesService.update` persisted `work_id`, `phonogram_id`, `artist_id`, `release_id` without a same-tenant check (comment of the new spec) | `apps/api/src/modules/shares/shares.service.ts:177` `assertOwnedForeignKeys`, called on create (`:197`) and update (`:214`), uses `assertSameTenantFk` for the four references | backend, tests (`shares-fk-ownership.security.spec.ts`, 138 lines, 13 `it(` blocks, abuse cases with a foreign-tenant id) |
| Invoice fiscal document kind | the persisted column `tipo_nota` was the API, DTO, web and reports name | canonical API/DTO/web/reports name `fiscal_document_type` (`invoices.dto.ts:38`, `:110`); legacy `tipo_nota` is a deprecated input alias (`invoices.dto.ts:88`, `:116`) and a response mirror (`invoices.service.ts:59-61`); the persisted column keeps the legacy name (`invoices.service.ts:89-91`, owner decision R1) | database (column unchanged), backend, API, web, reports, tests (`fiscal-document-type.contract.spec.ts`) |
| Release tracks (CZ-016) | `56b55c46:apps/api/src/modules/reports/computed-fields/registry.ts:45` legacy computed field `'releases.faixas'` implemented in `releases-faixas.field.ts` | file `release-tracks.field.ts`; canonical `metadata.tracks`, legacy `faixas` read through `COALESCE(NULLIF("metadata"->'tracks', 'null'::jsonb), "metadata"->'faixas')` at `release-tracks.field.ts:45` and removed on write at `:114` | backend, tests (`release-tracks.field.legacy-key.spec.ts`) |
| Lead interaction timestamp (NC-049) | legacy column `lead_interactions.data` (a date column named with the Portuguese word) | `occurred_at`, migration `20261003000001` (described in `docs/naming/audit/normalization-audit-report.md`) | database, entity, web reader |
| Artist team-contact categories | web showed the fallback label `Outro` for legacy slugs | one shared map `LEGACY_TEAM_CONTACT_CATEGORIES` in `packages/types/src/artist-team-categories.ts`, used by the API (`artist-legacy-fields.ts:140`) and the web (`apps/web/src/modules/artist/lib/team-contact-category.ts`); tests `team-contact-category.test.ts`, `artist-team-contact-category.spec.ts` | shared types, backend, frontend, tests |
| Contract category read variants | the list filter expanded only the platform-owned legacy spellings | `READ_ONLY_LEGACY_CONTRACT_CATEGORY_SLUGS` (`{ exclusivo: 'exclusivity' }`) in `apps/api/src/modules/contracts/contract-category-slugs.ts:61`, used by `contractCategorySlugVariants`; read compatibility only, never written | backend, tests (`contract-category-slugs.spec.ts:86`) |

## 8. Database

| Item | Value | Source |
|---|---|---|
| Database layer, census items | 858 audited, 824 normalized, 34 legitimate boundary, 0 NOT_NORMALIZED | C1 (section 5) |
| Entity columns (`dbColumn` surface) | baseline 399, final remaining 34 (all with a ledger row), 377 normalized | C1 (section 6) |
| Migration files in `apps/api/src/database/migrations` | 174 at the baseline, 339 now (166 added, 117 modified, 1 deleted; includes `*.spec.ts` files); commit `0598eef3` removed the MusicChat routing-key migration `20261005100001_BackfillMusicChatRoutingKeys.ts` and its spec | `git ls-tree -r --name-only <rev> -- apps/api/src/database/migrations \| wc -l`; `git diff --name-status 56b55c46 HEAD -- apps/api/src/database/migrations` |
| Naming migrations (examples) | `20260905000003` to `20260905000008` (FK, `titulo`, `tipo`, `data_inicio/fim` renames), `20260910000010` to `20260910000026` (status backfill and restrict migrations to English values), `20260913000001` (share fields), `20260918000001` to `20260918000011` (`ordem`, `ativo`, `duracao`, `categoria`, `nome` renames) | `git diff --name-only --diff-filter=A 56b55c46 HEAD -- apps/api/src/database/migrations` |
| Canonical map versus entities | 70 column assertions against 132 tables, valid | C7 |
| Schema naming baseline | `total: 0, debt: 0` | `scripts/naming/schema-naming-baseline.json` |
| Live catalog census | `NOT MEASURED` at the final commit: no PostgreSQL is available now (BLOCKED_EXTERNAL / DEFERRED). Last reported value (commit `f5710d80`, reported by the orchestrator, not re-run by this report author): 5221 catalog objects, 0 Portuguese names, 39 excepted rows, PostgreSQL 16 local. One migration was removed since, so the count may differ | CI step: `.github/workflows/ci.yml:293-294` ("Schema naming census"), residue census at `:295-296`; resume instructions in `docs/engineering/pack/TECHNICAL_NORMALIZATION_DEFERRED_DATABASE_PROOF.md` |
| Schema boundary proof | The committed record `docs/naming/audit/schema-boundary-proof.json` was generated 2026-10-06T00:29:20Z on a real migrated PostgreSQL (2 of 2 mutants killed: `payment-method-legacy-value` on `invoices.payment_method` and `events-data-sync-trigger` on `events.data`; baseline 6 of 6 checks) before the check script changed. It is stale by design and DEFERRED: the check script gained a `tipo_nota` check and `schema-boundary-proof.mjs` gained the mutant `invoices-fiscal-kind-column`, so C4 reports the three `database-schema` rows (`transferencia`, `events.data`, `tipo_nota`) as UNPROVEN. 3 of 3 is NOT claimed. Resume command in section 3 and in `docs/engineering/pack/TECHNICAL_NORMALIZATION_DEFERRED_DATABASE_PROOF.md` | `docs/naming/audit/schema-boundary-proof.json`; C4; section 18 |
| Persisted legacy structure still in the schema | ledger rows of kind `PERSISTED_LEGACY_STRUCTURE`: 126 in the classification at the final tree (41 behaviorally proven, 83 binding-only, 2 UNPROVEN `database-schema` rows); removal needs destructive approval: 12 OPEN blockers with `DESTRUCTIVE_APPROVAL_REQUIRED` (section 27) | `compat-boundary-classification.tsv`; `canonical-naming-map.json` `blockers[]` |

The drop of every `legacy_*` mirror column, PII scrub and `events.data` removal are destructive and are not executed (blockers in section 27). Extra jsonb keys written by the removed MusicChat migration may remain in environments where it ran; they are harmless and unread. Nothing in this document is evidence of a production data change.

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
- A Work contract, a Phonogram contract and a Distribution contract are not modeled separately: `contracts` has one table with a free `type` slug; a contract kind per aggregate is an owner decision (vocabulary section 3 item 8, section 6). Three web-only contract category spellings (`non_exclusive`, `representation`, `services`) and `parceria` have no canonical slug (BLK-CONTRACT-TYPE-SPELLING-CENSUS).
- Whether a Release links to Phonograms is UNVERIFIED (`release_works` exists, no `release_phonograms`).
- `events.data` versus `starts_at` (CZ-029): the entity maps only `starts_at`; the physical column and its sync trigger remain until the destructive drop (BLK-C3-E6).
- PT-BR display terms for ProjectTrack and ReleaseTrack are UNVERIFIED (the map has no `displayPtBr` for CZ-015, CZ-016, CZ-031).

## 10. Backend

| Item | Value | Source |
|---|---|---|
| BACKEND_API layer | 8,811 items audited, 6,696 normalized, 2,115 legitimate boundary, 0 NOT_NORMALIZED; 712 files changed | C1 (section 5) |
| Compatibility helpers | `apps/api/src/common/compat/` (asset type, plan features, release metadata, contract last payment, external rights receipts, deprecated-field alias utility) and per-module `*-legacy-fields.ts` / `*-vocabulary.ts` | `ls apps/api/src/common/compat` |
| Alias mechanism wiring | 45 production call sites of `applyDeprecatedFieldAliases` in the wiring check; all proven or exempt (`WIRING_SITES_UNPROVEN=0`) | C5; `docs/naming/audit/compat-wiring-proof.json` |
| Legacy reads | canonical first on every audited reader (`LEGACY_FIRST_READS=0`; the two invoice event reads at `invoices.service.ts:193` and `:309` now read the canonical `fiscal_document_type` first) | C3 |
| Tenant FK ownership | `SharesService` create and update verify that `work_id`, `phonogram_id`, `artist_id` and `release_id` belong to the caller's tenant before writing (`assertOwnedForeignKeys`) | `apps/api/src/modules/shares/shares.service.ts:177-190`; spec `shares-fk-ownership.security.spec.ts` |
| Prototype-key hardening | own-property guards for maps indexed by user text (`import-mapper.service.ts`, `integrations.controller.ts`, `lead-vocabulary.ts`, `release-legacy-fields.ts`, `license-vocabulary.ts`, `inventory-legacy-fields.ts`); spec `apps/api/src/modules/prototype-keys.legacy-lookups.spec.ts` | handoff section 3; file exists |
| Error and log text | stable error codes instead of raw provider text; English technical logs (commit `0f62de86` in the mission history) | `git log --oneline -1 0f62de86` |
| Still Portuguese by design | user-facing strings (`UX_TEXT`, 202 ledger rows outside the `docCode` surface, plus 199 per-token `docCode` rows), fiscal terms (`cpf`, `cnpj`, `tomador`, `prestador`, `serie`, `tipo_nota`, `cfop`, `natureza_operacao`: `PRODUCT_TERM_WITHOUT_SAFE_TRANSLATION`, 185 rows), external provider fields (`EXTERNAL_CONTRACT` 31 rows, e.g. ABRAMUS `duracao`, `periodo`) | section 26 |

## 11. API and contracts

| Aspect | State | Evidence |
|---|---|---|
| Canonical DTO inputs | snake_case canonical fields with the deprecated spelling kept as an alias marked `deprecated: true` in Swagger | `apps/api/src/modules/shares/dto/shares.dto.ts:18,25,49,63`; `invoices.dto.ts:49,92`; `create-work.dto.ts:97,117` |
| Shares canonical inputs | `holder_name`, `holder_document`, `work_id`, `phonogram_id`, `party_role`, `percentage` accepted; deprecated `role`, `holderName`, `holderDoc`, `workId`, `trackId` mapped, canonical wins, deprecated keys never persisted | `apps/api/src/modules/shares/shares.service.ts:93-110` (`toColumns`), `share-legacy-fields.ts`, specs `shares-canonical-input.spec.ts` (through the real `ValidationPipe`) and `share-contract.spec.ts:99` (`expect(row).not.toHaveProperty(legacy)`) |
| Shares cross-tenant references | create and update fail closed when a referenced work, phonogram, artist or release is not owned by the tenant | `shares.service.ts:177-190,197,214`; `shares-fk-ownership.security.spec.ts` |
| Invoice fiscal document kind | canonical `fiscal_document_type` (values `nfse`, `nfe`, `nfce`) on create, update and list filter; `tipo_nota` accepted as a deprecated alias (canonical wins, never persisted as a key) and emitted as a deprecated response mirror; the physical column keeps its legacy name until owner decision R1 | `invoices.dto.ts:38,88,110,116`; `invoices.service.ts:59-61,89-91,124-131`; `fiscal-document-type.contract.spec.ts` |
| Deprecated alias rows in the ledger | 411 rows of kind `DEPRECATED_API_ALIAS` in the classification at the final tree: 410 behaviorally proven, 1 compiler-proven (the invoice alias rows were reclassified, see section 26) | `compat-boundary-classification.tsv` |
| Response shapes | canonical-only for shares (spec above); invoices responses still carry the legacy mirror names next to the canonical ones (`file_url` and `url_pdf` at `apps/api/src/modules/invoices/invoices.service.ts:56-57`, `tomador_legal_name` and `tomador_name` at `:58`, `tipo_nota` mirror at `:59-61`, `service_amount` and `legacy_amount` at `:95`) until the owner approves the mirror drop | BLK-INVOICES-LEGACY-MIRRORS (OPEN), BLK-INVOICES-FISCAL-DISCRIMINATORS (OPEN) |
| Shared vocabularies | `packages/types/src/priorities.ts`, `providers.ts`, `accounting-vocabulary.ts`, `artist-team-categories.ts` (now also the single `LEGACY_TEAM_CONTACT_CATEGORIES` map), `role-slugs.ts`, spec `vocabularies.spec.ts` (run by the API `test` and `test:ci` scripts, commit `eb7620d5`) | `ls packages/types/src` |
| Priority scales | four distinct scales are never merged: `TRIAGE_PRIORITIES` (high, medium, low), `RELATIONSHIP_PRIORITIES` (low, medium, high, strategic), `WORK_PRIORITIES` (low, normal, high, urgent), support tickets use `SupportTicketPriority`; campaign tasks keep their own `TASK_PRIORITIES` on purpose | `packages/types/src/priorities.ts`; `campaign-operations.dto.ts:8-11` (comment states why) |
| DTOs on the shared scales | `clients.dto.ts` (`RELATIONSHIP_PRIORITIES`), `audiovisual.dto.ts` and `marketing-projects.dto.ts` (`WORK_PRIORITIES`), `support-requests.dto.ts`, `support-tickets.dto.ts` (`SupportTicketPriority`) import from `@music-os-360/types` | `git grep -n "PRIORITIES\|SupportTicketPriority" -- 'apps/api/src/**/*.dto.ts'` |
| Persisted Portuguese platform values | still written by live paths (release credit roles, genre slugs, org-structure department names and others): owner decision | BLK-PERSISTED-PT-PLATFORM-VALUES (OPEN; contested, section 25) |

## 12. Frontend

| Item | Value | Source |
|---|---|---|
| FRONTEND layer | 24,009 items audited, 22,507 normalized, 1,502 legitimate boundary, 0 NOT_NORMALIZED; 987 files changed | C1 (section 5) |
| Route surfaces | `frontendRoute` 203 baseline, 145 remaining (all with a ledger row; the reason text is in the ledger); `apiRoute` 4 baseline, 7 audited, 7 remaining with ledger rows | section 6 |
| Own-property helper | `apps/web/src/shared/lib/own-property.ts` (`hasOwnKey`) used in 10 files besides its definition (`user-status.ts`, `OAuthPopupPage.tsx`, `organization-industry.ts`, `event-type.ts`, `release-format.ts`, `genre-match.ts`, `category-labels.ts`, `skill-output-labels.pt-br.ts`, `tenant-labels.ts`, `legacy-redirects.tsx`) | `git grep -ln hasOwnKey -- apps/web/src` returns 11 files |
| Behavior tests for legacy values | `apps/web/src/modules/prototype-keys.web.test.ts`, `shared/lib/prototype-keys.labels.test.ts`, `app/providers/__tests__/tenant-labels.prototype-keys.test.ts`, rendering tests `*.legacy-compat.test.tsx` / `*.legacy-wiring.test.tsx`, and three new invoice file-url tests added to the index (`InvoiceViewModal.file-url.test.tsx`, `useInvoiceForm.file-url-notes.test.ts`, `Invoices.file-url.test.tsx`) | `git ls-files`; `git status --short` |
| Contact categories | the web uses the shared `LEGACY_TEAM_CONTACT_CATEGORIES` map from `packages/types` (the web copy was removed) | `apps/web/src/modules/artist/lib/team-contact-category.ts` |
| PT-BR user interface | unchanged by design: user-visible text stays Portuguese and is held by `UX_TEXT` rows (202) and per-file rows; section 20 gives the per-term totals | section 20, 26 |
| Unwired code that calls the compatibility helpers | 10 survivor sites in 4 web files in the committed proof at HEAD (`Schedule.tsx`, `Settings.tsx`, `contract-variables.ts`, `ArtistFormModal.tsx`): section 17; recorded as blocker BLK-UNWIRED-UI-SCAFFOLD | C5 |

## 13. Tests, fixtures and mocks

| Item | Value | Source |
|---|---|---|
| TESTS_FIXTURES_MOCKS layer | 13,460 audited, 6,650 normalized, 6,810 legitimate boundary, 0 NOT_NORMALIZED; 998 files changed | C1 (section 5) |
| `testTitle` surface | 2,304 baseline items, 1 remaining | section 6 |
| BINDING_ONLY ledger rows | 2,525 (C4); python over the TSV: 0 of the 2,525 have a path outside a test, spec, e2e, fixtures or `scripts/` file | C4; `python3` over `compat-boundary-classification.tsv` with a path pattern equivalent to `isTestFile` |
| Fixture adjudication | 870 entries: UI_TEXT 802, COMMENT_OR_DOC 43, BOUNDARY_COVERED_BY_COMPOUND_ROW 16, BOUNDARY 5, RESOLVED 4; 0 unadjudicated | `docs/naming/audit/fixture-name-adjudication.json` |
| BINDING_ONLY fixture names with no production occurrence | 142 (asserted refused or gone, or pure input) | C4 |
| BINDING_ONLY fixture names in production files without a proven or exempt row | 0 | C4 |
| Naming tooling tests | 10 `*.test.mjs` files in `scripts/naming` plus `scripts/destructive-dossier.test.mjs` (11 files, all in `naming:check`): 210 tests, 209 pass, 0 fail, 1 skipped (`Reported`); the gate-level mutation test passes 29 of 29 (C9) | `package.json:46` |

## 14. Documentation

| Item | Value | Source |
|---|---|---|
| DOCUMENTATION layer | 21,348 items audited, 10,378 normalized, 2,275 legitimate boundary, 8,695 historical record, 0 NOT_NORMALIZED; 1,238 files changed | C1 (section 5) |
| Portuguese prose lines (`doc` surface) | 18,219 baseline, 8,728 remaining: 33 with a ledger row (`UX_TEXT`) and 8,695 in frozen historical records | section 6 |
| Historical records | 129 documents; each validated for H1 label, H2 frozen sha256 and line count, H3 not consumed by executables, H4 not normative, H5 ledger coverage; `MISCLASSIFIED_HISTORICAL_RECORDS=0`, violations 0 | C6; `docs/naming/audit/historical-records-audit.md` and `.tsv`; frozen hashes in `docs/naming/historical-records.json` |
| Current documents touched in the final window | `docs/engineering/pack/CANONICAL_TECHNICAL_VOCABULARY.md`, the generated `docs/NAMING_NORMALIZATION_CANONICAL_MAP.md` and `docs/NAMING_NORMALIZATION_STATUS.md` (in sync with the ledger: C8, 4,546 exceptions) | `git show --stat 685aa1c1`, C8 |
| Current documents known to be stale | the generated audit documents were regenerated in the final commit (`compat-boundary-audit.md`: 4,546 rows, 944 groups; `normalization-audit-summary.md`: 69,294 items; `compat-boundary-classification.md`: `REQUIRED_BEHAVIORAL_ROWS` 1379). One stale item remains: the narrative paragraph of `docs/naming/audit/normalization-audit-report.md` names baseline `02f1ee8a75be16a93f91caae1d8a78702ab2f4fc` (2026-09-26) while `package.json` `naming:audit` and this report use `56b55c46` (finding F-02, section 25) | `grep -n BASELINE_SHA docs/naming/audit/normalization-audit-report.md`; head of each file |
| `docCode` surface (Portuguese technical tokens inside code spans and fenced blocks of current documents) | gate added in the mission; 0 tokens without disposition: the former 171 are covered by 199 per-token ledger rows of class `UX_TEXT` with surface `docCode` (section 3 counter 1) | C1 matrix; python over `exceptions[]` |
| `docCode` marker rule | a line is exempt only when it contains an explicit legacy marker (`legacy`, `deprecated`, `alias`, `formerly`, `renamed`, `former name`, `->`, `→`); restricted from a broader list in commit `5c92f97c` | `scripts/naming/technical-naming-census.mjs:585` |
| `docCode` scope limit | scanned: `docs/engineering/`, `docs/runbooks/`, `docs/naming/*.md`, `apps/*/*.md`, `CLAUDE.md`, `.claude/**/*.md`; not scanned: other Markdown (for example `docs/*.md`, `README.md`) | census line 582 |

## 15. Tooling and configuration

| Item | Value | Source |
|---|---|---|
| Naming tooling | 30 files in `scripts/naming` (10 of them tests); 0 at the baseline | `git ls-files 'scripts/naming/*' \| wc -l` = 30; `git ls-tree -r --name-only 56b55c46 -- scripts/naming \| wc -l` = 0 |
| Package scripts | `naming:census`, `naming:baseline`, `naming:generate`, `naming:schema`, `naming:validate`, `naming:residue-census`, `naming:compat`, `naming:wiring`, `naming:compat:prove`, `naming:compat:report`, `naming:audit`, `naming:check` | `package.json:35-46` |
| `naming:check` composition | census `--check`, canonical map validation, generated docs `--check`, 11 test files, compat audit `--check`, wiring proof `--check`, historical records `--check`, destructive dossier `--check` | `package.json:46` |
| CI steps | "Naming check" at `.github/workflows/ci.yml:58-59`; "Environment contract" at `:60-61`; on the migrated database job: "Schema naming census" (`:293-294`), "Residue census" (`:295-296`), `verify:rls`, `verify:tenant-isolation`, `verify:cz042-cz043-migrations` (`:338-341`), `verify:cz045-musicchat-migration` (`:342-345`), and a new step "Real-PostgreSQL specs of legacy names embedded in SQL text" (`:346-` with `PG_INTEGRATION_URL` set from the job's ephemeral database) that runs three specs: `release-tracks.field.legacy-key.spec.ts`, `migrate-application.preflight-transaction-types.spec.ts`, `rename-legacy-hr-permissions.draft.spec.ts` | `grep -n "naming\|verify:\|PG_INTEGRATION_URL" .github/workflows/ci.yml` |
| Removed from CI and scripts | the `verify:musicchat-routing-keys` step, its package script `verify:musicchat-routing-keys` and `apps/api/scripts/verify-musicchat-routing-keys.ts` (commit `0598eef3`, with the scaffolding they verified) | `git show --stat 0598eef3` |
| Database verification scripts | `verify:schema-compat-boundaries` (`apps/api/package.json:37`; run by `scripts/naming/schema-boundary-proof.mjs --prove`, not a CI step) | `apps/api/package.json` |
| Environment contract | `pnpm env:contract` = `scripts/env-contract-census.mjs --check` plus its tests and `scripts/env-check.test.mjs`; `scripts/env-contract.config.json` | `package.json:28-30` |
| Ratchets | `scripts/naming/technical-naming-baseline.json`: `debt` 115 entries, `wildcardCoverage` 117 files, `wordRowCoverage` 17 legal words; `scripts/naming/schema-naming-baseline.json`: 0 | `python3` over the files |
| Known tooling limits (not hidden) | the narrative baseline paragraph of `normalization-audit-report.md` lags the tool (section 14, F-02); the census does not yet cover the 3 test items of F-14 | C1 versus the committed file; C2 |

## 16. Compatibility boundaries

Sources: C3 (`compat-boundary-audit.mjs --check`), C4 (`compat-boundary-classify.mjs --check`) and the committed `docs/naming/audit/compat-boundary-classification.tsv|json|md` (committed at 4,546 rows, equal to the live ledger). Counts below come from C4 and from `python3` over the TSV.

Classification (C4, 4,546 rows):

| Class | Rows | Meaning (header of `scripts/naming/compat-boundary-classify.mjs`) |
|---|---:|---|
| BEHAVIORALLY_PROVEN | 1376 | a runtime file whose mutation of its own legacy name is killed by a test, or a database-schema boundary proven on a real database |
| COMPILER_PROVEN | 3 | declaration-only rows proven by a compile-time reader; no runtime behavior exists |
| BINDING_ONLY | 2525 | the row is a test or verification fixture: the file exists and names the literal; binding is not behavioral proof |
| EXEMPT_WITH_JUSTIFICATION | 639 | no behavioral proof is required (legal term, user-facing text, pack tooling, migration history guard, naming tooling, historical document or data, living registry) |
| UNPROVEN | 3 | a runtime boundary that requires proof and has none: the `database-schema` rows `transferencia`, `events.data` and `tipo_nota` (stale schema proof, DEFERRED, section 3 counter 7) |
| **Total** | **4546** | `REQUIRED_BEHAVIORAL_ROWS=1379`, `COMPATIBILITY_WITHOUT_REQUIRED_PROOF=3` |

Class by boundary kind, classification at the final tree (4,546 rows; python over the TSV):

| Kind | BEHAVIORALLY_PROVEN | COMPILER_PROVEN | BINDING_ONLY | EXEMPT_WITH_JUSTIFICATION | UNPROVEN | Total |
|---|---:|---:|---:|---:|---:|---:|
| DEPRECATED_API_ALIAS | 410 | 1 | 0 | 0 | 0 | 411 |
| EXTERNAL_PROVIDER_FIELD | 0 | 2 | 6 | 0 | 0 | 8 |
| HISTORICAL_DOCUMENT_OR_DATA | 0 | 0 | 0 | 163 | 0 | 163 |
| LEGACY_ALIAS_TEST_FIXTURE | 0 | 0 | 2205 | 0 | 0 | 2205 |
| LEGACY_NAME_READER | 360 | 0 | 0 | 0 | 0 | 360 |
| LEGAL_DOMAIN_TERM | 0 | 0 | 0 | 185 | 0 | 185 |
| LIVING_REGISTRY | 0 | 0 | 0 | 31 | 0 | 31 |
| MIGRATION_HISTORY_GUARD | 0 | 0 | 0 | 21 | 0 | 21 |
| NAMING_TOOLING | 0 | 0 | 0 | 8 | 0 | 8 |
| NEGATIVE_GUARD_TEST | 0 | 0 | 231 | 0 | 0 | 231 |
| PACK_TOOLING | 0 | 0 | 0 | 44 | 0 | 44 |
| PERSISTED_LEGACY_STRUCTURE | 41 | 0 | 83 | 0 | 2 | 126 |
| PERSISTED_VALUE_READER | 565 | 0 | 0 | 0 | 1 | 566 |
| USER_FACING_TEXT | 0 | 0 | 0 | 187 | 0 | 187 |
| **Total** | **1376** | **3** | **2525** | **639** | **3** | **4546** |

Why `BINDING_ONLY` is acceptable only as fixture proof input:

- Definition: the classifier assigns `BINDING_ONLY` only to rows that are tests or verification scripts. Measured at the final tree: 0 of the 2,525 rows have a path outside a test, spec, e2e, fixtures or `scripts/` file (python over the TSV).
- A fixture is the input of the proof of a runtime boundary, not a boundary: the runtime file that reads the legacy name carries its own row (`BEHAVIORALLY_PROVEN`) and its own mutation proof.
- The dangerous case, a fixture name that also occurs in a production file with no proven or exempt row, is 0 now (C4 `FIXTURE_NAMES_WITH_UNCOVERED_PRODUCTION_OCCURRENCE=0`). A fixture name with no production occurrence (142) is an input that asserts the name is refused or gone.
- Binding alone is never counted as behavioral proof: `COMPATIBILITY_WITHOUT_REQUIRED_PROOF` counts only rows of runtime boundaries.

## 17. Wiring sites and the exemption table

Wiring proof (`docs/naming/audit/compat-wiring-proof.json`, produced by `node scripts/naming/compat-wiring-proof.mjs --prove`, gated by C5): a production call site of a legacy-compatibility helper is mutated (operator `CALL_BYPASS`: the call is replaced by its argument) and the test suite of that directory must fail.

| Counter | Final tree | Source |
|---|---:|---|
| Production call sites / records | 515 records in the proof; the live check counts 516 sites (45 `applyDeprecatedFieldAliases` calls + 471 consumer calls) | C5; python over the JSON |
| Site kinds | 470 `CONSUMER`, 33 `HELPER`, 12 without a kind | python over the JSON |
| KILLED | 505 | same |
| SURVIVED | 10 (the 10 documented exemptions below) | same |
| `WIRING_SITES_UNPROVEN` (C5 live) | 0 | C5 |
| Exemptions recorded | 10 entries in `docs/naming/audit/compat-wiring-exemptions.json` | file |

The unneeded exemption for `contract-variables.ts:65` (finding F-05 of the earlier report) was removed: the exemption file has 10 entries, and the proof records that site as KILLED. The five invoice sites that survived in an intermediate proof (`useInvoiceForm.ts`, `InvoiceViewModal.tsx`, `Invoices.tsx`) are KILLED in the final proof: the survivors are exactly the 10 exemptions.

Each exemption below was read together with the code at the site (callers and callees verified by `grep` in `apps/web/src/modules`). Result: the 10 survivors of the committed proof are all in `apps/web`, none in the API; 2 are equivalent mutants (the changed value is never observable: ArtistFormModal) and 8 are code that no production path reaches (Schedule 5, Settings 1, contract-variables 2). Owner decision D-06 is recorded as ledger blocker BLK-UNWIRED-UI-SCAFFOLD (`docs/naming/canonical-naming-map.json` `blockers[]`, status OPEN, GENUINE_BUSINESS_DECISION) and in `docs/engineering/product-decision-packages.md` (D-06, line 145 onward).

| SITE | REASON | CALLER | CALLEE | BEHAVIOR | WHY EXEMPT | EVIDENCE | STILL_REQUIRED | STATUS |
|---|---|---|---|---|---|---|---|---|
| `apps/web/src/modules/artist/components/ArtistFormModal.tsx:395` `emptyPreservedInput()` | Equivalent mutant | `ArtistFormModal` (component), `useState<ArtistPreservedInput>(...)` | `emptyPreservedInput` in `artist/forms/artist-form.definition.ts` | initial value of the preserved-input state | the open effect hydrates the state (`hydrateForm(null)` for create, `hydrateForm(freshArtistQuery.data)` for edit) before any submit can read it; nothing submits while closed | wiring proof SURVIVED at line 395; exemption entry 1; code read at the earlier measurement | nothing observable to test; to remove the exemption the initial state would have to become unobservable by construction or a test would need to read state before hydration, which no UI path allows | ACTIVE, permanent (equivalent mutant) |
| `apps/web/src/modules/artist/components/ArtistFormModal.tsx:402` `emptyArtistFormValues()` | Equivalent mutant | `ArtistFormModal`, `useForm({ defaultValues: ... })` | `emptyArtistFormValues` in `artist/forms/artist-form.definition.ts` | initial `defaultValues` of react-hook-form | `hydrateForm` calls `reset(formValues)` before any field is shown; the same call text at line 463 (reset on close) is a separate site that is KILLED by its own test (the exemption matches by file and exact text, so it also names that site) | wiring proof SURVIVED at 402, KILLED at 463; exemption entry 10 | same as above | ACTIVE, permanent (equivalent mutant) |
| `apps/web/src/modules/events/pages/Schedule.tsx:209` `toAgendaRow({...})` | Unreachable code | `handleExcelExport` | `toAgendaRow` in `events/lib/agenda-spreadsheet.ts` | builds one spreadsheet row per event for an XLSX export | `handleExcelExport` has no reference in the JSX; `git grep` finds only its definition; `excelInputRef` is only reset, never attached to an input | wiring proof SURVIVED at 209; exemption entry 2; D-06 | owner decision D-06: wire the spreadsheet import and export UI with tests (preview and approval rules), or delete the handlers; then delete the Schedule exemptions | ACTIVE, waiting for D-06 |
| `.../Schedule.tsx:211` `getBackendEventTypeLabel(e.type)` | Unreachable code | `handleExcelExport`, inside the `toAgendaRow` argument | `getBackendEventTypeLabel` in `events/lib/event-type.ts` | label of the event type in the exported row | same unreferenced handler | wiring proof SURVIVED at 211; exemption entry 3 | same (D-06) | ACTIVE, waiting for D-06 |
| `.../Schedule.tsx:253` `readAgendaCell(row, column)` | Unreachable code | `handleExcelImport`, local `cell` helper | `readAgendaCell` in `events/lib/agenda-spreadsheet.ts` | reads a cell of an imported row by canonical column | `handleExcelImport` is unreferenced (definition only) | wiring proof SURVIVED at 253; exemption entry 4 | same (D-06) | ACTIVE, waiting for D-06 |
| `.../Schedule.tsx:270` `normalizeToBackendType(rawType, granularToBackendType)` | Unreachable code | `handleExcelImport`, payload building | `normalizeToBackendType` in `events/lib/event-type.ts` | maps the imported type text to the backend event type | same unreferenced handler (a different call of the same helper elsewhere in the file is KILLED) | wiring proof SURVIVED at 270; exemption entry 5 | same (D-06) | ACTIVE, waiting for D-06 |
| `.../Schedule.tsx:325` `getBackendEventTypeLabel(event.type)` | Dead property | `schedulerEvents` `useMemo` that maps events to calendar items | `getBackendEventTypeLabel` | the `type` property of each scheduler item | the only consumer, `calendarEvents`, reads id, title, dates, artist, status and all-day, never `type` | wiring proof SURVIVED at 325; exemption entry 6 | owner decision D-06 (remove the property or use it) | ACTIVE, waiting for D-06 |
| `apps/web/src/modules/settings/pages/Settings.tsx:292` `normalizeUserStatus(member.status)` | Unreachable branch | `filteredUsers` `useMemo`, `matchesStatus` | `normalizeUserStatus` in `settings/lib/user-status.ts` (uses `hasOwnKey`) | compares a member status with the status filter | `userStatusFilter` is only ever set to `"all-status"`, so the right-hand side is never evaluated; the other two calls of the helper are KILLED | wiring proof SURVIVED at 292; exemption entry 7 | owner decision D-06: add the status filter UI with a test, or remove the filter state | ACTIVE, waiting for D-06 |
| `apps/web/src/modules/contracts/utils/contract-variables.ts:196` `canonicalVariableCategory(a.category)` | Unreachable in production | `resolveAllVariables`, sort comparator | `canonicalVariableCategory` in `contracts/lib/contract-variable-vocabulary.ts` | orders variables by canonical category | `resolveAllVariables` has no production reference; the module is imported in production only for `contractRoleLabel` (`ContractWizard.tsx`); unreferenced exports: `generateParticipantVariables`, `resolveAllVariables`, `SYSTEM_VARIABLES`, `CATEGORY_LABELS`, `PARTICIPANT_ROLE_OPTIONS` | wiring proof SURVIVED at 196; exemption entry 8 | owner decision D-06: wire the contract variable resolution or remove those exports | ACTIVE, waiting for D-06 |
| `.../contract-variables.ts:197` `canonicalVariableCategory(b.category)` | Unreachable in production | `resolveAllVariables`, sort comparator | same | same | same | wiring proof SURVIVED at 197; exemption entry 9 | same (D-06) | ACTIVE, waiting for D-06 |

Count check: 10 exemption entries = 2 (ArtistFormModal) + 5 (Schedule) + 1 (Settings) + 2 (contract-variables); 10 SURVIVED sites of the final proof = 2 + 5 + 1 + 2. Reasons were read against the code at the earlier measurement (commit `f5710d80`); the sites were not modified by the later commits (`git diff --stat f5710d80 HEAD -- <those four files>` prints nothing, re-run for the final tree).

## 18. Mutation evidence

Compat mutation proof (`docs/naming/audit/compat-mutation-proof.json`, harness `scripts/naming/compat-mutation-proof.mjs`, operators version in the records). For each pair (runtime file, covering test) the harness replaces each legacy literal or alias by a non-matching one and expects the covering test to fail (`KILLED`). The proof file was regenerated for the final code and is committed.

| Measure | Value | Command or source |
|---|---:|---|
| Records in the proof file | 275 | python over `docs/naming/audit/compat-mutation-proof.json` |
| Verdicts per pair | PROVEN 209, SURVIVED 40, NO_MUTATION_SITE 11, PARTIAL 7, CANONICAL_FIRST_UNENFORCED 4, COMPILER_CHECKED 3, BASELINE_RED 1 | same |
| Credit | per ledger row by the classifier: PARTIAL, SURVIVED and the other non-PROVEN verdicts are per-pair verdicts of pairs that no ledger row credits | `scripts/naming/compat-boundary-classify.mjs` |
| Rows by mutation (C3) | 1,376 rows by mutation | C3 |
| Proof basis seen by C3 | 1,376 rows by mutation, 3 by the compiler only, 2,528 rows by binding only | C3 |
| Live pairs with a fresh record (C12) | `NOT MEASURED` for the final tree (C3 exit 0 implies the credited pairs are fresh). At commit `f5710d80`: 193 of 193 live pairs fresh, verdicts PROVEN 192 and COMPILER_CHECKED 1, 2,559 mutations all KILLED (LEGACY_LITERAL 2512, SQL_WORD 13, CANONICAL_FIRST 12, PREFIX_LITERAL 10, ALIAS_OVERRIDE 6, ENUM_MEMBER 6), 69 orphan records | C12 run at `f5710d80`; not re-run |

Reading: the audit looks a record up by the (file, test) pair of each ledger row (`pairEvidence`, `scripts/naming/compat-boundary-audit.mjs:150-153`) and treats it as fresh only when the file, the test, the runner configuration and the operator version match. The 40 SURVIVED, 7 PARTIAL, 4 CANONICAL_FIRST_UNENFORCED, 11 NO_MUTATION_SITE and 1 BASELINE_RED verdicts are per-pair verdicts of pairs that the classifier does not credit; C3 exit 0 with 0 rows without behavioral proof is the credited result. Whether each non-credited record is an orphan of the ledger is `NOT MEASURED` for the final tree (69 were orphans at `f5710d80`). Pruning orphans would be a regeneration (finding F-06).

`SQL_WORD` operator: added in commit `a2639766` (`feat(naming): SQL_WORD mutation operator for legacy names inside SQL text`). It rewrites a legacy word inside a SQL string of a runtime file; 13 SQL_WORD mutations on live pairs at `f5710d80`, 13 KILLED. Its purpose is to prove legacy names used inside embedded SQL (for example the `COALESCE(NULLIF(...), "metadata"->'faixas')` read), which the literal operators could not mutate.

Database-schema boundary proof (`docs/naming/audit/schema-boundary-proof.json`, `scripts/naming/schema-boundary-proof.mjs`, check script `apps/api/scripts/verify-schema-compat-boundaries.ts`): the committed record was generated 2026-10-06T00:29:20Z on a real migrated PostgreSQL before the check script changed: baseline run exit 0 (6 of 6 checks); 2 mutants (`payment-method-legacy-value` on `invoices.payment_method`, `events-data-sync-trigger` on `events.data`), both killed (exit 1, 5 of 6 and 3 of 6 checks pass); 2 of 2, not 3 of 3. It is stale by design and DEFERRED: the check script gained a `tipo_nota` check and the harness gained the mutant `invoices-fiscal-kind-column`, so C4 reports the three `database-schema` rows (`transferencia`, `events.data`, `tipo_nota`) as UNPROVEN. A fresh proof needs a migrated PostgreSQL (resume command in section 3 and in `docs/engineering/pack/TECHNICAL_NORMALIZATION_DEFERRED_DATABASE_PROOF.md`).

Wiring mutation proof: section 17.

## 19. Naming-gate mutation matrix per layer

Test: `scripts/naming/naming-gates-mutation.test.mjs` (C9: `node --test scripts/naming/naming-gates-mutation.test.mjs`, 29 of 29 pass at the final tree (`Reported` by the orchestrator; duration about 64 s at the earlier measurement, commit `0598eef3`)). Method: a minimal repository (the real census scripts and lexicon, a one-column `entities.ts`, an empty baseline, an empty ledger) is mutated by one defect at a time; the real `technical-naming-census.mjs --check` must exit 1 and print the expected key; the clean fixture must exit 0. Extra tests: a ledger row covering exactly one file and name lets only that mutation pass (a second name in the same file still fails); the same defect in four other tracked paths (`apps/web/src`, `packages/utils/src`, `e2e`, `scripts`) still fails.

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

Method (C10, script kept outside the repository): for each of 31 legacy terms, `git grep -n -I -w -i -e <term>` over `apps/api/src apps/web/src packages scripts e2e .github supabase` at the baseline (`56b55c46`, values carried over from the earlier measurement, immutable) and at the current working tree (the table values below were measured at commit `0598eef3` and were not re-run for the final commit `685aa1c1`). Current hits are split by path class only: migration history (path contains `migrations/` or `drizzle/`: immutable published history), test-only (spec, test, e2e, `__tests__`, fixtures; same patterns as `isTestFile` of `scripts/naming/compat-boundary-audit.mjs`), and every other path. The earlier measurement (commit `f5710d80`) further classified each other-path hit as ledger boundary, UX text, history comment, naming tooling data, blocker-tracked or unjustified and found 329 non-test, non-migration hits with 0 unjustified; that per-hit classification was NOT re-run for this update (the classifier was not preserved), so `unjustified = 0` is `NOT MEASURED` at the commits `0598eef3` and `685aa1c1`. The census gate (C2, section 6) is the standing control: it shows zero debt on every operational surface except the 8 `value` occurrences of finding F-14 (section 3 counter 1).

`url_pdf` is not a Portuguese-lexicon name, so the census never flags it and no ledger row exists; it is the pre-rename name of `invoices.file_url`, kept as a persisted mirror column that the API still writes (`apps/api/src/modules/invoices/invoices.service.ts:56-57,97`) and the web still reads (`apps/web/src/modules/accounting/types/invoice-type.ts`). It is justified by the open blocker BLK-INVOICES-LEGACY-MIRRORS (removal needs destructive approval and a zero count of readers), not by a ledger row.

| Term (legacy) | Baseline all | Baseline non-test | Now all | Migration history | Test-only | Other paths |
|---|---:|---:|---:|---:|---:|---:|
| `artista_id` | 522 | 313 | 118 | 105 | 12 | 1 |
| `tipo_obra` | 26 | 15 | 41 | 14 | 19 | 8 |
| `arquivo_audio` | 18 | 9 | 17 | 9 | 5 | 3 |
| `nome_artistico` | 252 | 147 | 71 | 19 | 42 | 10 |
| `tomador_nome` | 6 | 5 | 5 | 3 | 1 | 1 |
| `valor_total` | 45 | 37 | 21 | 9 | 11 | 1 |
| `data_vencimento` | 13 | 11 | 17 | 15 | 1 | 1 |
| `forma_pagamento` | 23 | 18 | 20 | 9 | 7 | 4 |
| `faixas` | 63 | 57 | 107 | 2 | 77 | 28 |
| `fonograma_id` | 30 | 21 | 11 | 9 | 1 | 1 |
| `obra_id` | 248 | 126 | 58 | 48 | 9 | 1 |
| `cliente_id` | 110 | 71 | 35 | 32 | 1 | 2 |
| `projeto_id` | 51 | 35 | 15 | 11 | 3 | 1 |
| `campanha_id` | 15 | 8 | 10 | 8 | 1 | 1 |
| `lancamento_id` | 49 | 38 | 16 | 14 | 0 | 2 |
| `nome_musica` | 47 | 29 | 9 | 8 | 0 | 1 |
| `titular_nome` | 79 | 16 | 18 | 16 | 1 | 1 |
| `vencimento` | 51 | 47 | 53 | 18 | 10 | 25 |
| `tipo_cliente` | 22 | 11 | 21 | 17 | 2 | 2 |
| `tipo_servico` | 46 | 25 | 32 | 23 | 5 | 4 |
| `genero_musical` | 79 | 65 | 30 | 24 | 4 | 2 |
| `duracao` | 73 | 48 | 35 | 16 | 9 | 10 |
| `compositores` | 205 | 137 | 126 | 27 | 57 | 42 |
| `setor` | 113 | 105 | 79 | 15 | 25 | 39 |
| `url_pdf` | 17 | 14 | 68 | 12 | 40 | 16 |
| `tipo_nota` | 22 | 19 | 79 | 3 | 51 | 25 |
| `participacao` | 62 | 40 | 41 | 15 | 16 | 10 |
| `cidade` | 149 | 129 | 81 | 28 | 14 | 39 |
| `titulo` | 922 | 582 | 314 | 58 | 216 | 40 |
| `observacoes` | 388 | 264 | 197 | 156 | 29 | 12 |
| `descricao` | 372 | 244 | 164 | 106 | 40 | 18 |
| **Total (31 terms)** | **4,118** | **2,686** | **1,909** | **849** | **709** | **351** |

Result: non-test, non-migration occurrences of the 31 terms went from 2,686 at the baseline to 351 now (earlier measurement: 329). Check (asserted by the script): `Now all = Migration history + Test-only + Other paths` on every row. The increases over the baseline (`tipo_obra`, `data_vencimento`, `faixas`, `vencimento`, `url_pdf`, `tipo_nota`) are in test-only, migration-history and boundary lines (compat fixtures, migrations and the documented invoice mirror and alias); the invoice terms grew since `f5710d80` because commit `0598eef3` added the `fiscal_document_type` contract spec, web tests and the deprecated alias in the DTO, service and reports contract (`tipo_nota` 40 to 79, `url_pdf` 56 to 68). The listed unit is lines mentioning the word, not distinct names, so a boundary that is documented and tested adds lines. Scope limit: `-w` matches whole words; a legacy name embedded in a longer identifier is outside this scan and is covered by the census (identifier, objectKey, value and SQL surfaces).

## 21. Cross-layer audit

The independent cross-layer audit (a read-only agent that compared database, API, frontend and documentation for the same concept) is referenced in the order and in commit `5c92f97c`; its own report is not a file of the repository, so the table below uses the commit messages and the code as evidence.

| Item | Divergence found | Fix or disposition | Evidence |
|---|---|---|---|
| Team-contact category labels | canonical team-contact category slugs rendered the fallback label `Outro` in the artist 360 view (commit message of `5c92f97c`) | labels keyed by canonical slugs from `packages/types/src/artist-team-categories.ts`; the legacy slug map was first duplicated in API and web and is now ONE map, `LEGACY_TEAM_CONTACT_CATEGORIES`, exported by `@music-os-360/types` and used by both (commit `0598eef3`, finding L5 of the second review); the UI label stays web-only | `apps/web/src/modules/artist/lib/team-contact-category.ts`, `team-contact-category.test.ts`; `apps/api/src/modules/artists/artist-legacy-fields.ts:140`, `artist-team-contact-category.spec.ts`; `5c92f97c`, `0598eef3` |
| Share DTO canonical inputs | `toColumns` wrote the legacy `role`, `holderName`, `trackId`, `workId` aliases unconditionally over canonical fields (handoff section 9 finding 4); registry inputs lacked canonical snake_case DTO fields | canonical snake_case inputs added, deprecated aliases mapped, canonical wins; tests through the real `ValidationPipe`; the reports shares contract excludes the canonical registry inputs (guard) | `apps/api/src/modules/shares/dto/shares.dto.ts`, `shares.service.ts:93-110`, `shares-canonical-input.spec.ts`; `5c92f97c`, `bde5b74a` |
| Share parent references | update persisted `work_id`, `phonogram_id`, `artist_id`, `release_id` with no same-tenant check, so one tenant could link a share to another tenant's rows (finding M1 of the second review) | `assertOwnedForeignKeys` on create and update through `assertSameTenantFk`, fail closed | `shares.service.ts:177-190,197,214`; `shares-fk-ownership.security.spec.ts`; `0598eef3` |
| Phantom invoice `total_amount` | the web read a top-level invoice `total_amount` that is not part of the invoice contract | reads removed (`accounting.types.ts` lost the field; item-level `total_amount` is a different, real field and stays) | `apps/web/src/modules/accounting/types/accounting.types.ts`, `InvoiceViewModal.tsx`, `useInvoiceForm.ts`, `InvoiceViewModal.legacy-wiring.test.tsx`; `5c92f97c` |
| Invoice fiscal document kind | the persisted column name `tipo_nota` was the API, DTO, web and reports name (finding M4 of the second review) | canonical `fiscal_document_type` on the API, DTO, web and reports; `tipo_nota` is a deprecated alias and response mirror; ledger rows reclassified (persisted column rows LEGACY_DATABASE_COMPATIBILITY, alias rows TEMPORARY_MIGRATION_COMPATIBILITY); column rename remains owner decision R1 | `invoices.dto.ts:38,88,110,116`; `invoices.service.ts`; `fiscal-document-type.contract.spec.ts`; `0598eef3`; ledger rows in `canonical-naming-map.json` |
| Stale comments | the comment at `role-hierarchy.ts:15-19` was stale (handoff section 9 finding 3); other stale comments were corrected in the same commit | the comment in `apps/api/src/core/rbac/role-hierarchy.ts:14-24` now states that `org_members.role` can hold either form; vocabulary and NC-038 corrected | `git show 5c92f97c --stat`; file read |
| Release tracks JSON null | a stored JSON `null` in `metadata.tracks` hid the legacy `faixas` key | `COALESCE(NULLIF("metadata"->'tracks', 'null'::jsonb), "metadata"->'faixas')` | `apps/api/src/modules/reports/computed-fields/release-tracks.field.ts:45`, `release-tracks.field.legacy-key.spec.ts`; `5c92f97c` |
| MusicChat routing keys | `queueKey` and `sectorKey` were written and backfilled but nothing read them (finding M2 of the second review) | the scaffolding was REMOVED, not adopted: DTO fields, vocabulary maps, metadata writes, migration `20261005100001`, its spec, the verify script, the package script and the CI step are deleted; blocker BLK-MUSICCHAT-ROUTING-KEYS-NO-READER is removed from the ledger; extra jsonb keys may remain in environments where the migration ran (harmless, unread) | `git show --stat 0598eef3`; `git grep -n "queueKey"` finds none in `apps` or `packages` |
| Contract category spelling variants | the artist 360 filter mapped legacy spellings in the browser only; the server filter did not expand them | `READ_ONLY_LEGACY_CONTRACT_CATEGORY_SLUGS` (`exclusivo` to `exclusivity`) added to the server variants, read only; three web-only slugs (`non_exclusive`, `representation`, `services`) and `parceria` have no canonical slug: owner decision, blocker BLK-CONTRACT-TYPE-SPELLING-CENSUS | `contract-category-slugs.ts:61-85`; `contract-category-slugs.spec.ts:86`; `0598eef3` |
| Owner decision: shares participant role | four live names for the same idea (`type`, `party_role`, `role`, `share_type` is different) | recorded, not decided | BLK-SHARES-TYPE-SEMANTICS (OPEN); NC-039 |
| Owner decision: invoices | `type` versus the legacy `tipo_nota`, `prestador_id` not proven to be an artist FK, mirror columns | recorded, not decided | BLK-INVOICES-FISCAL-DISCRIMINATORS, BLK-INVOICES-LEGACY-MIRRORS (OPEN) |
| Owner decision: ISRC ownership | `works.isrc` versus `phonograms.isrc` | recorded, not decided | BLK-WORKS-ISRC-OWNERSHIP (OPEN) |
| MusicChat settings save (round 3, M1) | removing the routing-key scaffolding left stored settings that still carried `queueKey` or `sectorKey`, and a settings save with such keys could return 400 | the two keys are accepted as deprecated input and dropped by `canonicalMenuOption`; environments that applied migration `20261005100001` keep a migrations row and the side table `musicchat_routing_keys_backfill_20261005` (compensation note, round-3 finding L2, no code action) | `musicchat-vocabulary.spec.ts`; `685aa1c1` |

## 22. Domain distinctions preserved

Evidence that the distinctions of `docs/engineering/pack/CANONICAL_TECHNICAL_VOCABULARY.md` section 3 are preserved in the code (no merge of concepts happened during the rename):

| Distinction | Evidence in code | Check |
|---|---|---|
| Project is not ProjectTrack and not Release | three separate entities: `ProjectEntity` (`entities.ts:1399`), `ProjectTrackEntity` (1430), `ReleaseEntity` (1482); `ProjectStatus` and `ReleaseStatus` are separate enums (`packages/types/src/enums.ts`) | `git grep -n "class .*Entity" apps/api/src/database/entities.ts` |
| Work is not Phonogram, and neither is ReleaseTrack | `WorkEntity` (742) and `PhonogramEntity` (860) are separate tables; no `ReleaseTrackEntity`: release tracks stay in `releases.metadata.tracks` | same; `git grep ReleaseTrackEntity` returns nothing |
| Work and Phonogram are not released music | a Release is the distributable row; Work and Phonogram are registry rows (`release_works` at `entities.ts:1518` is the only link) | vocabulary section 3 items 3 and 5 |
| Project is not Distribution | no Distribution aggregate: only `releases.distributor` and status `distributed` | vocabulary section 3 item 4 (UNVERIFIED whether an aggregate is wanted: owner decision) |
| Release is not ReleaseTrack; Work is not ReleaseTrack | release track jsonb carries its own `isrc` and `composers` names, not a `work_id` | vocabulary section 3 items 6 and 7 |
| Contract kinds | one `contracts` table; `ContractEntity` has `artist_id`, `client_id`, `release_id` (lines 954 to 956) and no `work_id` or `phonogram_id` | `sed -n 950,960p apps/api/src/database/entities.ts` |
| `invoices.due_date` is not `invoices.due_at` | `due_date` Stripe-owned (NC-025), `due_at` fiscal-note-owned (NC-024); guard spec `invoice-stripe-due-date.guard.spec.ts` | vocabulary section 4 |
| Four priority scales never merged | `packages/types/src/priorities.ts` (three scales) plus `SupportTicketPriority` plus the campaign `TASK_PRIORITIES` comment | section 11 |
| `audio_file` versus `audio_file_id` | two fields on `phonograms`; the legacy `arquivo_audio` is only a deprecated DTO alias of `audio_file` | NC-029 |
| `events.data` versus `starts_at` | entity maps only `starts_at`; physical column and trigger remain until approval | BLK-C3-E6; schema boundary proof |

PT-BR user interface: unchanged by design. A user-visible Portuguese string is a `UX_TEXT` ledger row or a per-file row; the PT-BR label maps are `packages/types/src/value-labels.pt-br.ts` and `status-labels.pt-br.ts`. A user-interface regression check beyond the rendering tests listed in section 12 was NOT MEASURED in this report.

## 23. Adversarial and security reviews

### 23.a First adversarial review (agent `adversarial-reviewer`, read-only, VERDICT FAIL at the received checkpoint)

State received = `docs/engineering/pack/TECHNICAL_NORMALIZATION_HANDOFF.md` section 9 at `6b6db7ae`. The reviewer is a model; its claims were treated as hypotheses. `Final proof` is a command run for this document or a file read; fixes are located with `git log --format='%h %s' 6b6db7a..HEAD -- <path>`.

| ID | State received | Reproduction | Evidence | Classification | Fix | Tests | Final proof | Status |
|---:|---|---|---|---|---|---|---|---|
| 1 | compat gate red: `compat-boundary-audit --check` exit 1, 11 rows STALE; wiring `WIRING_SITES_UNPROVEN=9` | run both `--check` commands on `6b6db7ae` | handoff section 5 | BLOCKING, symptom of stale proofs | proofs regenerated on the code of that time: `912bffd8` (compat), `3e5ab0f6`, `d1360e69`, `e39ba936` (wiring 510 sites, 0 unproven). The later commit `0598eef3` changed invoice and artist code, so the same checks were red until the proofs were regenerated at `685aa1c1` | proof harness tests: `compat-wiring-proof.test.mjs`, `compat-boundary-audit.test.mjs` | at `f5710d80`: C3, C4, C5 exit 0 (510 sites, 0 unproven); at `685aa1c1`: C3 and C5 exit 0 (516 sites, 0 unproven), C4 exit 1 only for the 3 DEFERRED `database-schema` rows | CLOSED for runtime boundaries at `685aa1c1`; the `database-schema` rows DEFERRED (F-12) |
| 2 | user text indexing plain maps returned inherited members (`constructor`, `__proto__`); API sites fixed, web sites SUSPECTED | call a lookup with the key `constructor`: before the guard an inherited function came back | `apps/api/src/modules/prototype-keys.legacy-lookups.spec.ts`; web helper `apps/web/src/shared/lib/own-property.ts` | HIGH, confirmed | own-property guards in 6 API files (handoff section 3); `hasOwnKey` in 10 web files (section 12), including the named `user-status.ts`, `OAuthPopupPage.tsx`, `organization-industry.ts`, `event-type.ts`; `fc4fa411` | `prototype-keys.legacy-lookups.spec.ts`, web `prototype-keys.web.test.ts`, `prototype-keys.labels.test.ts`, `tenant-labels.prototype-keys.test.ts`, `team-contact-category.test.ts` | files exist; the web and API test suites were reported green (section 24); a systematic re-grep of every `MAP[x]` over user input was NOT MEASURED | CLOSED for the named sites; exhaustive re-grep not measured |
| 3 | Portuguese role slugs are persisted and authoritative; no blocker; stale comment at `role-hierarchy.ts:15-19` | read `apps/api/src/core/rbac/role-hierarchy.ts` and the ledger | `blockers[]` entry BLK-RBAC-LEGACY-ROLE-SLUGS (OPEN, DESTRUCTIVE_APPROVAL_REQUIRED); plan `docs/engineering/rbac-retirement-plan.md` | HIGH, owner-gated | blocker recorded with required action; comment rewritten (lines 14 to 24); retirement itself is destructive and not executed | `role-hierarchy.spec.ts`, `workflow-role-matrix.spec.ts` (alias resolves to the same level) | C7 (map valid), section 27 row | CLOSED internally; OPEN as human blocker |
| 4 | `shares.service.ts` `toColumns` wrote legacy `role`/`holderName`/`trackId`/`workId` over canonical fields | send both canonical and deprecated keys; canonical must win | `shares.service.ts:93-110` | MEDIUM, confirmed | `applyDeprecatedFieldAliases(input, SHARE_DEPRECATED_FIELDS)`; canonical wins; deprecated keys never persisted; `5c92f97c` | `shares-canonical-input.spec.ts` (through the real `ValidationPipe`), `share-contract.spec.ts:99` | file read | CLOSED |
| 5 | invoices: `tipo_nota` written into `type`, duplicate columns with no removal condition, half-migrated | read `invoices.service.ts` | `invoices.service.ts` | MEDIUM | reads canonical-first; phantom `total_amount` reads removed (`5c92f97c`); the fiscal kind now has the canonical API name `fiscal_document_type` (`0598eef3`); discriminators and mirrors recorded as BLK-INVOICES-FISCAL-DISCRIMINATORS (R1/R3) and BLK-INVOICES-LEGACY-MIRRORS with explicit removal conditions | `invoice-contract.spec.ts`, `fiscal-document-type.contract.spec.ts`, `InvoiceViewModal.legacy-wiring.test.tsx` | blockers present (section 27) | CLOSED internally; OPEN as owner decision |
| 6 | 157 wildcard (`*`) ledger rows blind the census inside whole files | count rows with `currentName == "*"` | ledger now has 156 such rows and 40 rows with path `*` (python) | MEDIUM | not removed: ratcheted. Per-file `wildcardCoverage` (distinct names hidden by a whole-file row, 117 files) and a per-legal-word `wordRowCoverage` (17 words) in `scripts/naming/technical-naming-baseline.json`; the legal-term ratchet was added in `5c92f97c` | `technical-naming-census.test.mjs`, gate mutation test (a ledger row covers exactly its file and name) | C9 29 of 29 | CLOSED as a ratchet (rows remain, their coverage can no longer grow silently) |
| 7 | misclassified ledger rows (second Abramus period row is our own alias; thin reasons on 3 rows) | read the rows | ledger rows for `abramus.service.ts` (`duracao`, `periodo`: class `PRODUCT_TERM_WITHOUT_SAFE_TRANSLATION`, external provider field) | MEDIUM | `9a486f58` message: ledger corrections (Abramus own aliases, pro_labore, per-file `tipo_nota` rows, MusicChat labels) | `integrations-dto-wiring.spec.ts` (swagger deprecation of the period alias) | not re-adjudicated row by row here (NOT MEASURED) | CLOSED per commit; row-level re-adjudication not measured |
| 8 | MusicChat `queueKey`/`sectorKey` have no reader; migration comment claims the web derives them | grep readers of the keys | the former BLK-MUSICCHAT-ROUTING-KEYS-NO-READER | MEDIUM | superseded: the scaffolding was removed in `0598eef3` (section 21); no reader decision remains | `musicchat-vocabulary.spec.ts` (trimmed to the display vocabulary) | `git grep -n "queueKey" -- apps packages` empty | CLOSED by removal |
| 9 | three `contract-variables.ts` exemptions state a false reason (no production importer) | read the exemption text and the importers | section 17 | LOW-MEDIUM | reason text rewritten to name the unreferenced exports and the one production import (`contractRoleLabel`); the unneeded entry for line 65 was later removed | wiring proof (SURVIVED sites remain exempt, intentionally) | `docs/naming/audit/compat-wiring-exemptions.json` read (10 entries) | CLOSED |
| 10 | report hidden-field hint no longer matches retired internal-notes names; no test guards a reintroduction | read `HIDDEN_INTERNAL_HINT` | `apps/api/src/modules/reports/definitions/report-entity-definition.service.ts:21` | LOW | hint is documented as English-only (`internal_notes`, `internal_comments`, `internal_observations`); the Portuguese names are pinned as NOT matching by `report-entity-definition.service.spec.ts`; a reintroduced Portuguese column is caught by the `dbColumn` census, not by this hint | `report-entity-definition.service.spec.ts` | file read | CLOSED (guard is the census, not the spec) |
| 11 | `packages/types/src/priorities.ts` unused by several DTOs | grep DTO imports | `clients.dto.ts`, `audiovisual.dto.ts`, `marketing-projects.dto.ts`, `support-requests.dto.ts`, `support-tickets.dto.ts` import shared scales; `campaign-operations.dto.ts` keeps its own scale with a written reason | LOW | DTOs moved to the shared scales (`fc4fa411`) | `packages/types/src/vocabularies.spec.ts`, run by the API `test` script (`eb7620d5`) | `git grep` (section 11) | CLOSED |
| 12 | `fixture-name-adjudication.json` has one UNADJUDICATED row | count classes | 870 entries, classes UI_TEXT 802, COMMENT_OR_DOC 43, BOUNDARY_COVERED_BY_COMPOUND_ROW 16, BOUNDARY 5, RESOLVED 4 | LOW | adjudications added in `772b4b4f`, `912bffd8` | `compat-boundary-classify.mjs --check` | C4: `FIXTURE_NAMES_WITH_UNCOVERED_PRODUCTION_OCCURRENCE=0` | CLOSED |

### 23.b Second blind adversarial review (VERDICT FAIL on internally solvable items)

The second review was blind to the first. Its verdict was FAIL because it found items that could be solved internally. The orchestrator relayed the finding identifiers below; the review report itself is not a file of the repository, and the findings M3, L2 and L3 were NOT RELAYED to this report author (value `NOT MEASURED`). The reviews ran as independent agents in this session; `ops.mjs evidence review` records are written at the end by the orchestrator (F-10). The fixes are in commit `0598eef3`.

| ID | Finding as relayed | Action | Verified in the tree |
|---|---|---|---|
| M1 | cross-tenant FK ownership missing on `SharesService` create and update | `assertSameTenantFk` for `work_id`, `phonogram_id`, `artist_id`, `release_id` | `shares.service.ts:177-190,197,214`; `shares-fk-ownership.security.spec.ts` (138 lines, 13 `it(` blocks) |
| M2 | MusicChat `queueKey`/`sectorKey` scaffolding with no reader | removed (not adopted): DTO fields, vocabulary maps, metadata writes, migration `20261005100001`, its spec, verify script, package script and CI step; blocker BLK-MUSICCHAT-ROUTING-KEYS-NO-READER removed; extra jsonb keys may remain where the migration ran (harmless) | `git show --stat 0598eef3`; `git grep -n "queueKey" -- apps packages` empty; the blocker id is absent from `blockers[]` |
| M4 | invoices: the persisted column name was the API name for the fiscal document kind | canonical API/DTO/web/reports name `fiscal_document_type`, legacy `tipo_nota` kept as deprecated alias and response mirror; ledger rows reclassified (persisted column rows LEGACY_DATABASE_COMPATIBILITY, alias rows TEMPORARY_MIGRATION_COMPATIBILITY); column rename remains owner decision R1 | `invoices.dto.ts`, `invoices.service.ts`, `fiscal-document-type.contract.spec.ts`; ledger rows (python over `canonical-naming-map.json`) |
| M5 | generated audit documents stale | regenerate the audit documents | Closed in the final commit for `compat-boundary-audit.md` (4,546 rows), `normalization-audit-summary.md` and `compat-boundary-classification.md`; the narrative baseline paragraph of `normalization-audit-report.md` is still stale (finding F-02, section 25); the `NAMING_NORMALIZATION_*` generated documents are in sync (C8) |
| L1 | the three real-PostgreSQL specs are skipped everywhere in CI | CI step "Real-PostgreSQL specs of legacy names embedded in SQL text" sets `PG_INTEGRATION_URL` and runs the three specs | `.github/workflows/ci.yml:346-` |
| L4 | a dangling documentation reference | fixed | NOT MEASURED which reference (not relayed in detail) |
| L5 | the legacy team-contact category table existed twice (API and web) | one shared `LEGACY_TEAM_CONTACT_CATEGORIES` map in `packages/types/src/artist-team-categories.ts` used by both | `git grep -n LEGACY_TEAM_CONTACT_CATEGORIES -- apps packages` (API `artist-legacy-fields.ts:13,140`, web `team-contact-category.ts:8,18`) |
| L5b (contract category) | web-only contract category spellings had no server-side read compatibility | `READ_ONLY_LEGACY_CONTRACT_CATEGORY_SLUGS` (`exclusivo` to `exclusivity`) in the read-only variants; `non_exclusive`, `representation`, `services` and `parceria` have no canonical slug (owner decision, recorded blocker BLK-CONTRACT-TYPE-SPELLING-CENSUS) | `contract-category-slugs.ts:61`; `contract-category-slugs.spec.ts:86` |

Disagreement between the reviewer and the orchestrator (not arbitrated in this document): the independent reviewer judged BLK-PERSISTED-PT-PLATFORM-VALUES and BLK-UNWIRED-UI-SCAFFOLD internally solvable. The orchestrator classified both as decisions, for the reasons in the ledger text:

- BLK-PERSISTED-PT-PLATFORM-VALUES (DESTRUCTIVE_APPROVAL_REQUIRED): release credit roles, persisted genre slugs and organization-structure department names are persisted display-like values that change with the Catalog and HR reconstruction topics; moving them to English ids needs a backfill of persisted rows, dual-read for deployed builds and the catalog vocabulary design, so it needs owner approval. The ledger records that the code side is prepared (every literal is isolated in one constants file with a behavioral test and a killed mutation proof).
- BLK-UNWIRED-UI-SCAFFOLD (GENUINE_BUSINESS_DECISION): whether the unreachable spreadsheet handlers, the status filter branch and the contract variable resolver are planned features (wire), dead code (delete) or inert scaffolding with an owner and deadline (decision D-06); the ledger states that code and tests cannot settle it.

Because the review framework requires evidence-backed arbitration when reviewers disagree on a finding of this kind, the counter SOLVABLE_NAMING_BLOCKERS is reported as 0 on the ledger and contested for 2 (section 3 counter 6). No arbiter record is cited here.

### 23.c Earlier relayed review round (kept for traceability, superseded by 23.b)

The previous version of this document carried a relayed review with identifiers MEDIUM-1 to MEDIUM-4, LOW-5 and LOW-6 and a PASS verdict that was never recorded as evidence. Its actions remain true in the tree: BLK-PERSISTED-PT-PLATFORM-VALUES exists in `blockers[]` (OPEN); 30 ledger rows with a `.claude` path have a non-empty reason and all 4,546 rows have a non-empty `reason`, `owner` and `removalCondition` (python); the `docCode` marker is restricted to explicit legacy tokens (`scripts/naming/technical-naming-census.mjs:585`, `/legacy|deprecated|\balias(?:es)?\b|formerly|renamed|former name|->|→/i`; gate mutation test 25 proves an English word next to a technical name no longer exempts the line); BLK-INVOICES-LEGACY-MIRRORS exists with removal conditions per column; `release-tracks.field.ts:45` has the NULLIF fallback with `release-tracks.field.legacy-key.spec.ts`. Which blocker closed MEDIUM-1 was never identified (NOT VERIFIED).

### 23.d Independent cross-layer audit

See section 21 (findings, fixes, owner decisions) and section 23.f. Its counter is `CROSS_LAYER_DIVERGENCES`, stated in section 3 counter 4.

### 23.e Security review

Round-3 security review (independent agent, read-only, on the final tree): VERDICT PASS, CRITICAL 0, HIGH 0, MEDIUM 0. Scanners through `.claude/runtime/security-verification-engine.mjs`: secret-scan and npm-audit `canonicalFindings: []`; OSV-Scanner skipped (network disallowed); CodeQL not authorized. Observation (not a finding): `work_id` and `phonogram_id` in `CreateShareDto` use `IsString` and not `IsUUID` (pre-existing). `node .claude/runtime/gate-engine.mjs security` = `BLOCKED`: the evidence criteria must be re-recorded as fresh PASS bound to the final workspace fingerprint, and two criteria, `schema-naming-census` and `db:check`, need PostgreSQL (BLOCKED_EXTERNAL). The completion gate was NOT RUN: it cannot pass while those criteria are open.

### 23.f Round-3 independent adversarial review

Read-only agent on the tree after `0598eef3`. Findings: M1 MEDIUM (a MusicChat settings save could return 400 for settings that still carried stored `queueKey` or `sectorKey`): FIXED in `685aa1c1` (the two keys are accepted as deprecated input and dropped by `canonicalMenuOption`; tests in `musicchat-vocabulary.spec.ts`). L1 LOW (the ledger text of CZ-045 referred to the removed migration): FIXED. L2 LOW (migration `20261005100001` was published at the checkpoint and removed later; environments that applied it keep a migrations row and the side table `musicchat_routing_keys_backfill_20261005`): recorded as a compensation note, no code action. Its VERDICT line said FAIL because of M1. M1 was fixed after that verdict and no re-review was run after the fix, so the fix is verified by the tests named above and not by a second review.

## 24. Tests, builds and gates

Two kinds of rows. `Run here` means I executed the command for this document and saw the exit code. `Reported` means the orchestrator measured it on the final tree and I did not re-run it. Final full API rerun on the committed tree: see the handoff document.

| Check | Result | Kind |
|---|---|---|
| `node scripts/naming/technical-naming-census.mjs --check` | exit 0, debt {"doc":8695} (see the paragraph after the table for the intermediate state) | Run here (C2) |
| `node scripts/naming/validate-canonical-map.mjs` | exit 0; 70 column assertions against 132 tables | Run here (C7) |
| `node scripts/naming/render-naming-docs.mjs --check` | exit 0; 97 concepts, 4,546 exceptions | Run here (C8) |
| `node scripts/naming/compat-boundary-audit.mjs --check` | exit 0: 4,546 rows, 944 groups, all four counters 0 (section 3) | Run here (C3) |
| `node scripts/naming/compat-boundary-classify.mjs --check` | exit 1: 3 UNPROVEN `database-schema` rows (`transferencia`, `events.data`, `tipo_nota`), DEFERRED | Run here (C4) |
| `node scripts/naming/compat-wiring-proof.mjs --check` | exit 0: 516 sites, `WIRING_SITES_UNPROVEN=0` | Run here (C5) |
| `node scripts/naming/historical-records-audit.mjs --check` | exit 0: 129 records, 0 violations | Run here (C6) |
| `node --test scripts/naming/naming-gates-mutation.test.mjs` | 29 of 29 pass, 0 fail | Reported (C9) |
| `pnpm naming:check` (whole chain) | exit 0, reported by the orchestrator; not re-run here. `node --test` over its 11 naming test files: 210 tests, 209 pass, 0 fail, 1 skipped | Reported, not re-run here |
| API suite (jest, full run) | 557 suites passed + 1 skipped; 9,174 tests passed, 17 skipped. The run preceded the last small edit of `invoices.service.ts`; after it, the targeted run of conversations, invoices, reports, shares and the migration spec gave 60 suites, 973 passed, 1 skipped | Reported |
| Web suite (vitest) | 388 files; 3,190 tests passed | Reported |
| Typecheck | `pnpm --filter @music-os-360/api typecheck` exit 0; `pnpm --filter @music-os-360/web typecheck` exit 0; `packages/types` vocabularies `tsx --test`: 7 pass, 0 fail | Reported |
| Lint | `pnpm lint` exit 0 (0 errors, 2,002 warnings) | Reported |
| Builds | `pnpm build` exit 0 | Reported |
| `node scripts/destructive-dossier.mjs --check` | 12 package blocks, 0 problems | Reported |
| Database gates on a PostgreSQL (`db:migrate`, `db:check`, `schema-naming-census --check`, `residue-census`, `verify:rls`, `verify:tenant-isolation`, `verify:schema-compat-boundaries`, `schema-boundary-proof --prove`) | NOT RUN for the final tree: no PostgreSQL is available (BLOCKED_EXTERNAL / DEFERRED, F-12). Last reported at `f5710d80` on a disposable PostgreSQL 16 (`DB_SSL=false`): 5221 catalog objects, 0 Portuguese names, 39 excepted; `verify:musicchat-routing-keys` was removed afterwards | Not run |
| `node .claude/runtime/gate-engine.mjs security` | `BLOCKED` (evidence criteria to be re-recorded as fresh PASS; `schema-naming-census` and `db:check` need PostgreSQL: BLOCKED_EXTERNAL) | Run by the orchestrator |
| `node .claude/runtime/completion-gate.mjs` | NOT RUN (cannot pass while those criteria are open) | Not run |

Census result after this document was rewritten: `node scripts/naming/technical-naming-census.mjs --check` exit 0, debt {"doc":8695}. On the product tree `685aa1c1` before the ledger rows of F-14 the same command exited 1 with debt {"doc":8695,"value":8} (names in `apps/api/src/modules/invoices/invoice-entity-fiscal-document-type.spec.ts` and `apps/api/src/modules/reports/form-contracts/invoices-fiscal-document-type.spec.ts`).

Skipped tests (17 in the API suite at the final full run, `Reported`). Composition stated at `f5710d80`: 12 pre-existing skips plus 5 opt-in real-database blocks. Located here: blocks that run only when a PostgreSQL URL is set, in `apps/api/src/database/add-english-role-slug-aliases.pg-integration.spec.ts:17` (also needs `RUN_PG_INTEGRATION=1`), `apps/api/src/database/migrate-application.preflight-transaction-types.spec.ts:107`, `apps/api/src/database/migration-drafts/rename-legacy-hr-permissions.draft.spec.ts:132`, `apps/api/src/modules/reports/computed-fields/release-tracks.field.legacy-key.spec.ts:84`, and (outside `src`) `apps/api/test/e2e/realtime/realtime-broadcast-authorization.e2e-spec.ts`. Since commit `0598eef3` the CI database job runs three of them (`release-tracks.field.legacy-key`, `migrate-application.preflight-transaction-types`, `rename-legacy-hr-permissions.draft`) with `PG_INTEGRATION_URL` set (section 15, finding L1 of the second review), so they are no longer skipped in CI. The 12 pre-existing skips were NOT LOCATED: `git grep -nE "(it|test|describe)\.skip\(|xit\(|xdescribe\(" -- apps/api/src` returns no hit, so they are conditional skips or come from a mechanism I did not identify.

## 25. Gaps found, fixed and remaining

| ID | Gap | Found by | State | Action |
|---|---|---|---|---|
| F-01 | Canonical map row NC-037 named a legacy key as the canonical application name of the leads CRM jsonb, while the code uses `crm_internal_data` | the earlier version of this report | CLOSED | the ledger concept now uses `crm_internal_data`; the generated map document is in sync (C8) |
| F-02 | Generated audit documents lagged the tools | this report (C1, C3, C4) | PARTLY CLOSED: `compat-boundary-audit.md` (4,546 rows), `normalization-audit-summary.md` and `compat-boundary-classification.md` were regenerated in the final commit. OPEN, low: the narrative baseline paragraph of `docs/naming/audit/normalization-audit-report.md` still names baseline `02f1ee8a75be16a93f91caae1d8a78702ab2f4fc` | rewrite that paragraph with baseline `56b55c46` (hand-written text, not produced by `pnpm naming:audit`) |
| F-03 | Decision D-06 had no `blockers[]` entry | the earlier version of this report | CLOSED | BLK-UNWIRED-UI-SCAFFOLD is in `blockers[]` (OPEN, GENUINE_BUSINESS_DECISION); its disposition is contested (section 23.b) |
| F-04 | 171 `docCode` tokens without ledger row or historical banner | C1, C2 | CLOSED | the tokens are covered by 199 per-token ledger rows of class `UX_TEXT` with surface `docCode`; census `docCode` debt is 0 |
| F-05 | Wiring exemption for `contract-variables.ts:65` matched a site that the proof records as KILLED | the earlier version of this report | CLOSED | the entry was removed; the exemption file has 10 entries |
| F-06 | `compat-mutation-proof.json` holds records of pairs no ledger row cites (69 at `f5710d80`) | C12 | OPEN, hygiene, harmless (no row consults them) | prune on the next proof regeneration |
| F-07 | The census detects Portuguese words only; legacy mirror names that are not Portuguese (`url_pdf`, `legacy_amount`, `legacy_*` columns) are visible only through blockers, wiring proofs and the schema census, not through a per-name census surface | this report (section 20) | OPEN, low (candidate `RELEVANT_NAMING_GATE_COVERAGE_GAP`) | decide whether a deny-list of legacy mirror names belongs in the gate; the blockers carry removal conditions meanwhile |
| F-08 | `docCode` scans only `docs/engineering/`, `docs/runbooks/`, `docs/naming/*.md`, `apps/*/*.md`, `CLAUDE.md`, `.claude/**/*.md` | this report (census line 582) | OPEN, low | extend `isCurrentDocForCode` or declare other Markdown historical or non-current |
| F-09 | Two copies of the legacy team-contact category table (API and web) | the earlier version of this report | CLOSED | one shared `LEGACY_TEAM_CONTACT_CATEGORIES` map in `packages/types` (commit `0598eef3`) |
| F-10 | `evidence review` records for the reviews of the final tree | this report (section 23) | OPEN until written | reviews ran as independent agents in this session; `ops.mjs evidence review` records are written at the end by the orchestrator |
| F-11 | The ledger text of BLK-CONTRACT-TYPE-SPELLING-CENSUS still says the server list filter does not expand the legacy spellings, while `READ_ONLY_LEGACY_CONTRACT_CATEGORY_SLUGS` now expands `exclusivo` on the server (`contract-category-slugs.ts:61-85`) | this report (python over `blockers[]` versus the code) | OPEN, low (text divergence only; the blocker itself stays) | update the blocker text in `docs/naming/canonical-naming-map.json`, then `node scripts/naming/render-naming-docs.mjs` |
| F-12 | Database-schema proof DEFERRED: the three `database-schema` boundaries (`transferencia` on `invoices.payment_method`, `events.data`, `tipo_nota`) need `schema-boundary-proof.mjs --prove` on a migrated PostgreSQL; none is available (BLOCKED_EXTERNAL) | C4 | OPEN, DEFERRED | resume: `DATABASE_URL=postgresql://musicos360@127.0.0.1:5432/music_os_check DB_SSL=false node scripts/naming/schema-boundary-proof.mjs --prove` (`PGPASSWORD` supplied by the operator; migrated database required), then `node scripts/naming/compat-boundary-classify.mjs --report && node scripts/naming/compat-boundary-classify.mjs --check`; details in `docs/engineering/pack/TECHNICAL_NORMALIZATION_DEFERRED_DATABASE_PROOF.md` |
| F-13 | Disagreement on two blockers: the independent reviewer judged BLK-PERSISTED-PT-PLATFORM-VALUES and BLK-UNWIRED-UI-SCAFFOLD internally solvable; the orchestrator classified them as decisions (reasons in section 23.b and in the ledger text) | second blind review | OPEN, not arbitrated here | arbiter or owner decision; until then counter 6 is `0 on the ledger, contested for 2` |
| F-14 | On the product tree `685aa1c1` the census reported 8 occurrences of 3 names in two spec files that the commit started tracking (surface `value`, layer TESTS_FIXTURES_MOCKS): C2 exited 1 and C1 showed NOT_NORMALIZED 8 | this report (C1, C2 re-run) | CLOSED on the tree committed with this document: ledger rows for the three names are present (4,542 to 4,546 rows) and C2 exits 0 | keep the ledger change in the same commit as this document |
| F-15 | The committed census baseline `scripts/naming/technical-naming-baseline.json` is regenerated: 115 `debt` entries (it had 327, including entries for an earlier version of this document) | C2 | CLOSED | regenerated in the final commit |
| - | The 12 findings of the first adversarial review | review | FIXED or recorded as human blocker (section 23.a); item 1 closed for runtime boundaries at `685aa1c1`, the `database-schema` rows DEFERRED (F-12) | - |
| - | Second review M1, M2, M4, M5 (partial), L1, L4, L5 | second blind review | FIXED in `0598eef3` except M5 (F-02, narrative paragraph only); M3, L2, L3 NOT RELAYED (section 23.b) | - |
| - | Round-3 review M1, L1, L2 | round-3 adversarial review (section 23.f) | M1 and L1 FIXED in `685aa1c1`; L2 recorded as a compensation note; no re-review after the fix | - |
| - | Cross-layer: team-contact labels, share DTO canonical inputs, phantom invoice `total_amount`, stale comments, release tracks JSON null | independent audit | FIXED (section 21) | - |
| - | Naming gate blind spots: ALL-CAPS values, capitalized data positions, runtime SQL strings, member reads, Markdown code spans and fences | gate analysis | FIXED: detectors and per-detector gate mutations (`9a486f58`; `docCode`: `f5710d80`) | - |

## 26. Allowed residues and why they are not unjustified operational debt

Source: `docs/naming/canonical-naming-map.json` `exceptions[]` (4,546 rows, all `status: ACTIVE`; C8 confirms the generated documents are in sync). Counts by `exceptionClass` and `surface` (python over the file):

| exceptionClass | Rows | Lifetime | apiRoute | dataFile | doc | frontendRoute | identifier | objectKey | schema | sqlString | testTitle | toolMessage | unspecified | value |
|---|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| TEMPORARY_MIGRATION_COMPATIBILITY | 3779 | temporary (removal condition) | 4 | 0 | 0 | 0 | 8 | 221 | 1352 | 1 | 5 | 1 | 0 | 172 | 2015 |
| LEGACY_DATABASE_COMPATIBILITY | 148 | temporary (removal condition) | 0 | 0 | 0 | 0 | 0 | 3 | 10 | 2 | 32 | 0 | 0 | 15 | 86 |
| PRODUCT_TERM_WITHOUT_SAFE_TRANSLATION | 185 | permanent (legal or fiscal term) | 0 | 0 | 0 | 0 | 0 | 12 | 30 | 0 | 0 | 0 | 0 | 40 | 103 |
| UX_TEXT | 401 | permanent (PT-BR text) | 0 | 3 | 5 | 199 | 0 | 1 | 16 | 0 | 0 | 0 | 3 | 6 | 168 |
| EXTERNAL_CONTRACT | 31 | permanent (external wire format) | 0 | 1 | 0 | 0 | 0 | 2 | 6 | 0 | 0 | 0 | 0 | 1 | 21 |
| PROVIDER_DEFINED | 2 | permanent (provider-defined) | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 2 | 0 |
| **Total** | **4546** | | 4 | 4 | 5 | 199 | 8 | 239 | 1414 | 3 | 37 | 1 | 3 | 236 | 2393 |

Change since the earlier measurement (4,340 rows at `0598eef3`): the 199 per-token `docCode` rows of class `UX_TEXT` were added (UX_TEXT 202 to 401), TEMPORARY_MIGRATION_COMPATIBILITY went from 3,774 to 3,779 rows and LEGACY_DATABASE_COMPATIBILITY from 146 to 148 rows (python over `exceptions[]`).

Why none of it is unjustified operational debt (each point measured):

1. Every row has a non-empty `reason`, `owner`, `removalCondition`, `consumer` and `targetState` (python: 0 rows missing any of them, over the 4,546 rows).
2. Temporary rows (3,779 + 148 = 3,927) are compatibility for a window, each with a removal condition; every `TEMPORARY_MIGRATION_COMPATIBILITY` row has a `coveringTest` (0 without; ratchet `scripts/naming/covering-test-baseline.json` and `validate-canonical-map.mjs`, which passes: C7).
3. Runtime boundaries are proven by behavior, not by the ledger alone: at the final tree 1,376 rows are BEHAVIORALLY_PROVEN and 3 COMPILER_PROVEN, with 0 runtime rows without behavioral proof (C3) and 3 `database-schema` rows UNPROVEN and DEFERRED (C4, F-12); 515 wiring records: 505 KILLED and 10 SURVIVED, the 10 documented exemptions (section 17).
4. Permanent rows are domain or contract facts: 185 fiscal/legal terms (`cpf`, `cnpj`, `tomador`, ...), 401 user-visible PT-BR text rows (202 outside the `docCode` surface and 199 per-token `docCode` rows), 31 external wire formats, 2 provider-defined. The exempt classification (639 rows) is in section 16.
5. Persisted structure that cannot be removed without approval is tied to an OPEN blocker with an owner (section 27); no destructive action was executed.
6. The census gate (C1 surfaces, section 6) shows zero debt on every operational surface; the documentation debt is `doc` 8,695 lines in frozen records and `docCode` 0 (section 3).
7. Residue scan (section 20): per-term totals by path class (measured at `0598eef3`); the per-hit justification of the 351 non-test, non-migration hits is `NOT MEASURED` at the final commit (it was 0 unjustified of 329 at `f5710d80`).

Residues that are explicitly not covered by these arguments: the DEFERRED `database-schema` proof (F-12), and the human blockers of section 27.

## 27. Human blockers still open and Git state

Source: `docs/naming/canonical-naming-map.json` `blockers[]` with `status = OPEN` (23 of 37; 14 are RESOLVED). By disposition: DESTRUCTIVE_APPROVAL_REQUIRED 12, GENUINE_BUSINESS_DECISION 9, EXTERNAL 2, RESOLVABLE_FROM_CANONICAL_SOURCES 0. The set changed since the earlier report: BLK-MUSICCHAT-ROUTING-KEYS-NO-READER was removed (scaffolding deleted) and BLK-UNWIRED-UI-SCAFFOLD was added. No approval was requested or granted here; approvals `appr-c80c4e2f`, `appr-6570cc2f` and the others in the handoff stay with their owners.

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
| BLK-RBAC-LEGACY-ROLE-SLUGS | DESTRUCTIVE_APPROVAL_REQUIRED | explicit owner authorization required | the legacy Portuguese role slugs (the five global `roles.slug` rows and `org_members.role`) are still persisted; S4a (dual read, canonical write with kill switch) shipped; authorization needed for the S4b rename and S5 retirement after the gates of `rbac-retirement-plan.md` section 3 (S4a live for a full token lifetime, disposable-PostgreSQL round trip, a PITR point, a cache-flush runbook); owner decision on four ambiguous slugs (`admin_master`, `ar_gestao`, `financeiro_contabil`, `tenant_owner`); the migration draft is registered only with the `RBAC_S4B_CONFIRM` token, never set by an agent |
| BLK-PERSISTED-PT-PLATFORM-VALUES | DESTRUCTIVE_APPROVAL_REQUIRED | explicit owner decision required | persisted display-like values written verbatim by live paths: release credit roles, genre slugs derived from PT labels, org-structure department names, contact classification slugs, default operational-list slugs and planning-automation departments. They change with the Catalog and HR reconstruction topics, so moving them to English ids needs a backfill of persisted rows, dual-read for deployed builds and the catalog vocabulary design. Decision needed: owner approves canonical English ids per vocabulary, then per vocabulary an additive migration with backfill, dual-read in API and web, labels as display maps, removal of the PT literals. Ledger says every literal is isolated in one constants file with a behavioral test and a killed mutation proof. CONTESTED: the independent reviewer judged it internally solvable (sections 23.b, 25) |
| BLK-SHARES-TYPE-SEMANTICS | GENUINE_BUSINESS_DECISION | explicit owner decision required | shares participant role has four live names and a NULL `share_type` that means a registry split on the API but a financial/internal share on the web; exclusivity is enforced only in the web form; `master-owner` is an unused DTO role value. Decision needed: registry token plus CHECK plus backfill (L5), the exclusivity enforcement, which participant-role name is canonical and the fate of `master-owner`. Code side: canonical DTO inputs with deprecated aliases and characterization tests, no semantics changed |
| BLK-INVOICES-FISCAL-DISCRIMINATORS | GENUINE_BUSINESS_DECISION | explicit owner decision required | `type` (row kind) versus the legacy `tipo_nota` (nfse, nfe, nfce) versus a possible `origin` column (R1); `prestador_id` not proven to be an artist FK (R3); `tomador_name` versus `tomador_legal_name`; operation type carried by a marker inside notes; `tomador_cnpj` holds CPF or CNPJ. Decision needed: R1/R3 and approval of an `operation_type` column with backfill and dual write. Code side: `fiscal_document_type` is now the canonical API name and `tipo_nota` a deprecated alias and response mirror; only the physical column rename remains under R1 |
| BLK-INVOICES-LEGACY-MIRRORS | DESTRUCTIVE_APPROVAL_REQUIRED | explicit owner decision required | legacy mirror columns kept next to canonical ones: `url_pdf` (mirror of `file_url`), `legacy_amount` (mirror of `service_amount`) and the read fallback `tomador_legal_name ?? tomador_name`; the response still emits `url_pdf`. Decision needed: approval to drop them in one authorized migration together with their readers, after the census conditions in the ledger text hold (migration `20261005200001` applied everywhere and no row with `file_url IS NULL AND url_pdf IS NOT NULL`; `20260930000022` applied and no row with `service_amount IS NULL AND legacy_amount IS NOT NULL`) |
| BLK-WORKS-ISRC-OWNERSHIP | GENUINE_BUSINESS_DECISION | explicit owner decision required | `works.isrc` (unique index per tenant) is read by external-data-exchange, catalog metadata validation and web lookups while the canonical vocabulary says a Work carries ISWC and a Phonogram carries ISRC. Decision needed: keep it as a documented Work-level reference, or migrate to `phonograms.isrc` with backfill and drop |
| BLK-CONTRACT-TYPE-SPELLING-CENSUS | EXTERNAL | explicit owner decision required | per-environment census of persisted `contracts.type` values (`SELECT type, count(*) FROM contracts GROUP BY 1`; no real environment available here); if legacy spellings exist, extend the legacy map or backfill. The three web-only slugs (`non_exclusive`, `representation`, `services`) and `parceria` have no canonical slug (owner decision); `exclusivo` is now a read-only server variant (F-11: the ledger text predates that fix) |
| BLK-UNWIRED-UI-SCAFFOLD | GENUINE_BUSINESS_DECISION | explicit owner decision required | frontend code that calls the compatibility helpers but is unreachable in production: Schedule spreadsheet export and import handlers, the Settings user-status filter branch, the contract variable resolver (decision package D-06). Decision needed per item: (A) delete the dead handlers, filter and resolver with their tests, (B) wire them as real features with owner and date (import must follow the preview/approval rules, XLSX only), or (C) keep inert with owner and deadline; the 10 wiring exemptions are removed when decided. CONTESTED: the independent reviewer judged it internally solvable (sections 23.b, 25) |

Also external and not blockers of the ledger: the destructive dossier packages (all `READY: NO`), PII backfill and scrub, and tools that are not installed (`graphify`, `osv-scanner`, `codeql`; policy disallows network).

Orchestration state (plan `orch-4281815e`): ACTIVE. Counts at the end of this checkpoint: COMPLETED 20, BLOCKED_EXTERNAL 1, PENDING 10. `classify` is BLOCKED_EXTERNAL with the full external-dependency record (a reachable PostgreSQL for the schema boundary proof; unblock condition: section 4 of `docs/engineering/pack/TECHNICAL_NORMALIZATION_DEFERRED_DATABASE_PROOF.md`). `n6-gate-mutation`, `w1-types-api`, `w2-musicchat` and `w5-invoices-api` were closed with `done` and recorded evidence ids (command evidence of the final tree: gate mutation tests, census, API and web suites, typecheck). The downstream phases stay PENDING behind `classify`; nothing was marked failed, and no task was completed without evidence. `destructive-approval` stays a human approval and is never self-granted. No PR, tag or extra branch was created; every commit is on `dev`.

Git state:

| Item | Value |
|---|---|
| Branch | `dev` (only branch; no other branch created) |
| HEAD and `origin/dev` at the end | see handoff document, section git state |
| Tracked files modified by this report author | 1: `docs/engineering/pack/TECHNICAL_LANGUAGE_BEFORE_AFTER_REPORT.md` (no commit, no push) |
| Pre-existing dirty files preserved | `.claude/ops/logs/journal.ndjson`, `.claude/ops/records/orchestration/orch-4281815e.json`, `.claude/ops/telemetry/events.ndjson`, `docs/engineering/pack/TECHNICAL_NORMALIZATION_HANDOFF.md` and the untracked `docs/engineering/pack/TECHNICAL_NORMALIZATION_DEFERRED_DATABASE_PROOF.md` (untouched) |
| Final product SHA | `685aa1c1e51492db9a599d602500234690721695` |
| Final repository HEAD | the commit that contains this document (`git log -1 --format=%H -- docs/engineering/pack/TECHNICAL_LANGUAGE_BEFORE_AFTER_REPORT.md`); a document cannot contain the hash of its own commit |
| `HEAD == origin/dev` and clean tree at the end | see handoff document, section git state |
| `gate-engine security` | `BLOCKED` (section 23.e) |
| Completion gate | NOT RUN (section 23.e) |
