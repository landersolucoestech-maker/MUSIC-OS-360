# Naming Normalization — Canonical Map

One row per concept. Schema: `.claude/contracts/canonical-map-entry.schema.json`. Populated by the `canonical-naming` skill — do not hand-edit without going through it. Owner: `mission-orchestrator` (arbitrates conflicts via a `conflict-record` + `decision-record`); every other agent proposes additions, none invents a canonical name independently (`.claude/rules/naming-canonical.md`).

Source of decisions: `/NAMING_NORMALIZATION_DISCOVERY_LOG.md` (repo-root, untracked) is the discovery/decision narrative this table transcribes — it documents *why* each canonical name was chosen, batch-by-batch, plus data-reconciliation blockers for concepts not yet listed here. Keep both: the root file is process history, this file is the queryable registry the naming-canonical rule requires.

| Concept | Database | Application | API | Event/Queue | Display (PT-BR) | Legacy aliases | Status |
|---|---|---|---|---|---|---|---|
| Artist reference (FK) | `artist_id` (15 tables) | `artistId` | `artistId` | — | Artista | `artista_id` | done |
| Work reference (FK) | `work_id` (6 tables) | `workId` | `workId` | — | Obra | `obra_id` | done |
| Client reference (FK) | `client_id` | `clientId` | `clientId` | — | Cliente | `cliente_id` | done |
| Project reference (FK) | `project_id` | `projectId` | `projectId` | — | Projeto | `projeto_id` | done |
| Campaign reference (FK) | `campaign_id` | `campaignId` | `campaignId` | — | Campanha | `campanha_id` | done |
| Release reference (FK) | `release_id` | `releaseId` | `releaseId` | — | Lançamento | `lancamento_id` | done |
| Title | `title` (10 tables) | `title` | `title` | — | Título | `titulo` | done |
| Type/category classifier | `type` (18 tables) | `type` | `type` | — | Tipo | `tipo` | done |
| Contract/event/goal start & end dates | `start_date`/`end_date` (6 tables) | `startDate`/`endDate` | `startDate`/`endDate` | — | Data de início / Data de término | `data_inicio`, `data_fim`, `startsAt`, `expiresAt` | done |
| Attachments/documents field | `documents` (artists, contracts, shares, employees) | `documents` | `documents` | — | Documentos | `documentos` | migrating |

**Not yet in this table (documented as open in the root discovery file, no canonical decision recorded here yet):** `notes`/`observacoes`, `description`/`descricao`, `duration`/`duracao`, `genre`/`genero`, `name`/`nome`, `category`/`categoria`, `amount`/`valor`, `city`/`state`/`country`, `active`/`ativo`, `sort_order`/`ordem`, the Holder family (`titular_nome`/`detentor`/`rights_holder_id` — blocked on data reconciliation), the 13 same-table PT/EN collision cases (§9 of the root file — blocked on data/product decisions), and the Brazilian fiscal-term cluster (§10 — blocked on compliance sign-off). Do not treat their absence here as "not a concept" — see the root file for why each is still open.
