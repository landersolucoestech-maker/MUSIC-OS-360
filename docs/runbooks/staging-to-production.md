# Runbook — Staging validation and production release · MUSIC OS 360

> dev is the only branch. Nothing reaches production without a green staging run dispatched from `dev`, with every gate green.
> Production is never a test environment. Development, staging and production secrets are independent.

## Branch policy

- `dev` is the only branch: development, continuous integration and the ref every workflow runs on.
- `staging` is an environment (GitHub Environment `staging`), not a branch.
- Production is released by an owner-authorized manual action; there is no `main` branch and no promotion between branches.
- Enforced by `scripts/git-guard/`, `.github/workflows/branch-policy.yml` and `scripts/verify-branch-topology.mjs`.

## Precondition: staging operational

Dispatch `staging.yml` only when the environment is isolated:

- [ ] Isolated staging Supabase (`jjnnjnxjkqipgqebijen`)
- [ ] Isolated staging Redis
- [ ] Staging R2 storage with a separate bucket/prefix
- [ ] GitHub Environment `staging` configured, including `STAGING_STOP_WEBHOOK_URL` (stops every API instance) and `STAGING_DEPLOY_WEBHOOK_URL` (receives `{"ref":"<commit>"}`, deploys that commit and starts it with `BUILD_SHA=<commit>`); the Environment requires reviewers and allows only the `dev` branch
- [ ] Staging secrets hold no production values
- [ ] Staging API answers the health check
- [ ] Staging web points only at the staging API

## Release order

1. Confirm CI and Security Scan are green on `dev`.
2. Dispatch the `staging.yml` workflow manually on ref `dev`; add no functional change between the green CI and the dispatch.
3. Every run first reads the schema state against the build (`db-ops check:state`, read-only):
   - database at this build's schema: RLS, isolation, deploy (the new build must answer `/api/v1/health/ready`) and smoke;
   - database holding migrations this build does not ship: the run fails — this build is older than the schema and is never deployed over it;
   - pending migrations: the run fails in a controlled way and does not touch the database.
4. When pending migrations are reviewed, dispatch `staging.yml` again on ref `dev` with `apply_migrations=true`. The workflow stops the running build, proves no instance serves, migrates, deploys the matching build and proves it is up (`docs/engineering/database.md`, "Deploy order").
5. Validate on staging:
   - authentication;
   - tenant A × tenant B isolation;
   - critical journeys;
   - integrations;
   - observability;
   - rollback (`rollback_to_migration`, see below).
6. After the owner approves the staging evidence, the owner authorizes the production release of that same `dev` commit.
7. Apply production migrations only in an authorized window, with a recent backup and a rollback plan, following the same order by hand: stop every API instance first, migrate, `db:check`, start the new build (there is no production deploy workflow in this repository).
8. Deploy production and run the post-deploy smoke.

## Pre-production checklist

- [ ] CI green on the released commit
- [ ] Security Scan green
- [ ] `staging.yml` green for the same commit
- [ ] Production backup younger than 24 hours
- [ ] No destructive migration without an explicit plan
- [ ] `db:check` clean after the authorized application
- [ ] RLS and multi-tenant isolation verified
- [ ] Staging smoke done
- [ ] Alerts and observability active
- [ ] Eng. Lead and Owner approval

## Rollback

- **Application only (no migration in between):** redeploy the previous immutable build.
- **Database:** from the newer build, with every API instance stopped, `db-ops rollback:to <last migration of the older build>` (staging: `staging.yml` with `rollback_to_migration`, which never deploys), then deploy the older build — see `docs/engineering/database.md`, "Reverse transition", and `docs/RUNBOOK_ROLLBACK.md` §3. A migration whose `down()` refuses or fails requires the pre-deploy backup restore.
- **Rollback criterion:** error rate above 1% for 5 minutes, health check persistently unavailable, or a SEV1/SEV2 incident.

## Minimum evidence

- Link to the green CI on `dev`.
- Link to the green `staging.yml` run dispatched on `dev`.
- Result of `db:check`, RLS and isolation.
- Evidence of the staging smoke.
- Pre-production backup.
- The `dev` commit SHA released to production.

## Automatic blockers

- A production release of a commit without a green `staging.yml` run.
- Red `staging.yml`.
- Pending migrations without `apply_migrations=true`.
- A database ahead of the build being deployed.
- A schema change without `STAGING_STOP_WEBHOOK_URL` or without proof that the running build stopped.
- Missing or stale backup.
- Critical/high vulnerability without an approved exception.
- RLS, isolation or smoke failure.
- The marketing approval migration (`20260930000003`) does the same for the `metadata->>'approval'` key of `marketing_content_posts` (no column: a jsonb key), restricting it to `pending`, `approved`, `rejected`, `revision_requested`. Run the approval distribution query from "Vocabulary pre-flight queries" first; any residue aborts the migration. An API build older than this release writes Portuguese approvals and fails the new CHECK, so it is stopped in the same swap as above.

## Rollout window for the canonical-vocabulary migrations

The canonical English vocabulary migrations (`20260930000012` to `20260930000025`) run **before** the new API build boots: the API refuses to start while migrations are pending, so a "deploy the API first" order is not possible. For a short window the previous API build serves traffic against migrated data:

- Backfills are exact-match and additive; the new API reads both the legacy and the canonical spelling everywhere, and writes canonical values only.
- The previous build does not know the canonical slugs: its lookups by renamed operational-list slugs (`20260930000016`) miss the renamed platform rows until it is replaced, and any write of an old Portuguese value into a column that now has a CHECK is rejected. Stop the previous API instances and workers in the same swap that runs the migrations (the staging workflow does this: `STAGING_STOP_WEBHOOK_URL`).
- Run the "Vocabulary pre-flight queries" below in every environment first; residue values abort a guarded migration and block the whole pending batch.
- Several migrations rewrite most rows of a table in one transaction (`transactions`, `clients`): run them in a low-traffic window, with a recent backup, and exercise the reverse `down()` order on a disposable PostgreSQL before production (`20260930000022` first, then `16`, `18`, `19`, `25`, `24`, `21`, `17`, `23`).
- The backfill side tables keep before/after jsonb (including third-party personal data) and are not removed by tenant deletion. Run the per-tenant erasure SQL of `docs/engineering/backfill-side-tables-retention.md` on every tenant deletion or erasure request, and purge the tables with the gated draft `migration-drafts/20260930000050_PurgeBackfillSideTables.ts` only after the rollback window ends and the pre-flight residue is 0 in every environment (the draft is not registered; take a backup first, the purge is irreversible).

## Vocabulary pre-flight queries

Read-only `SELECT`s to run on the target database (as the migration role, so RLS does not hide other tenants) before releasing the vocabulary migrations. Every value outside the expected set aborts the matching migration (nothing is coerced); resolve those rows first. The migrations print at most 20 offending values, each truncated to 40 characters.

```sql
-- invoices.payment_method (20260930000010). Allowed after backfill: cash, credit_card, debit_card,
-- check, pix, ted, boleto, transferencia. Legacy dinheiro/cartao_credito/cartao_debito/cheque are
-- rewritten; case, tab and NBSP variants are normalized; any other text (e.g. accented) aborts.
SELECT payment_method, count(*) FROM invoices GROUP BY 1 ORDER BY 2 DESC;

-- transactions.type (20260930000011 validates chk_transactions_type). Allowed: revenue, expense, investment, tax, transfer.
SELECT type, count(*) FROM transactions GROUP BY 1 ORDER BY 2 DESC;

-- financial_rules.type and calculation_method (20260930000011). Allowed type: tax, commission,
-- external_rights_fee, discount, fee, other. Allowed calculation_method: percentage, fixed, tiered.
SELECT type, calculation_method, count(*) FROM financial_rules GROUP BY 1, 2 ORDER BY 3 DESC;

-- marketing_content_posts.metadata->>'approval' (20260930000003). Allowed: pending, approved,
-- rejected, revision_requested (NULL = key absent).
SELECT metadata->>'approval' AS approval, count(*) FROM marketing_content_posts GROUP BY 1 ORDER BY 2 DESC;

-- RBAC slug collision (role alias migration 20260930000001): tenant custom roles, and the members
-- holding them, already using a slug that becomes a built-in role. Must return zero rows, otherwise the holder is widened
-- to that built-in level. Resolve (rename the custom role or change the members) before releasing.
SELECT 'custom_role' AS source, tenant_id, slug, count(*) AS n
FROM roles
WHERE tenant_id IS NOT NULL AND deleted_at IS NULL
  AND slug IN ('legal', 'sales', 'producer', 'collaborator', 'hr_manager')
GROUP BY tenant_id, slug
UNION ALL
SELECT 'member_of_custom_role' AS source, m.tenant_id, r.slug, count(*) AS n
FROM org_members m
JOIN roles r ON r.id = m.role_id
WHERE r.tenant_id IS NOT NULL AND r.deleted_at IS NULL
  AND r.slug IN ('legal', 'sales', 'producer', 'collaborator', 'hr_manager')
GROUP BY m.tenant_id, r.slug;
```

### Residue census of the contract vocabulary backfills (read-only)

Removal condition of the matching read aliases: every query returns 0 in every environment (run as the migration role).

```sql
-- contracts.type default `outro` (20260930000034). Retires the `outro` alias.
SELECT count(*) AS outro_rows FROM contracts WHERE type = 'outro';

-- contract.signed provisional transactions (20260930000035): handler-created rows still on the ad-hoc category.
SELECT category, count(*) FROM transactions
WHERE category IN ('contratos', 'contracts') AND metadata ->> 'source' = 'contract.signed'
GROUP BY 1;

-- platform-owned contract category slugs (20260930000036), contracts and templates. Retires the ten legacy aliases.
SELECT 'contracts' AS source, type AS slug, count(*) FROM contracts
WHERE type IN ('gravacao', 'cessao_direitos', 'producao', 'exclusividade', 'publicitario', 'semantico', 'distribuicao', 'licenciamento', 'gestao', 'outros')
GROUP BY 2
UNION ALL
SELECT 'contract_templates', service_type, count(*) FROM contract_templates
WHERE service_type IN ('gravacao', 'cessao_direitos', 'producao', 'exclusividade', 'publicitario', 'semantico', 'distribuicao', 'licenciamento', 'gestao', 'outros')
GROUP BY 2;
```

A value that is neither canonical nor in these lists (a tenant-authored slug such as `parceria`, or the pre-canonical `exclusivo`,
`nao_exclusivo`, `representacao`, `servicos`) is not residue of these migrations; see blocker `BLK-CONTRACT-CATEGORY-REGISTRY` in
`docs/NAMING_NORMALIZATION_CANONICAL_MAP.md`.

## Residue census of the persisted-vocabulary backfills (20260930000017 to 20260930000033)

Read-only `SELECT`s, one subsection per backfill migration, each derived from that migration's own predicate (the `candidatePredicate` of its spec, or its exact-match statement). Run them as the migration role, so RLS does not hide other tenants, in every environment. They count rows the migration would still rewrite: that is the removal condition of the matching legacy read paths. Counts only, no values are selected beyond the legacy keys listed. The contract-vocabulary backfills `20260930000034` to `20260930000036` are in the section above. `20260930000030` is a draft and is not registered.

### Residue census 20260930000017

Migration `BackfillExternalRightsReceiptsToCanonical`. Predicate: exact, case-sensitive match of the legacy phrase in two free-varchar columns, soft-deleted rows included (no `deleted_at` filter, as in the migration). Removal condition of the legacy readers (`common/compat/external-rights-receipts.ts`, the API list filter on `transactions.category`, the contracts DTO input mapping, the web normalizers): both counts are 0 in every environment.

```sql
-- 20260930000017 external rights receipts
SELECT 'contract_service_types.financial_model' AS source, count(*) FROM contract_service_types
WHERE financial_model = 'recebimentos externos de direitos'
UNION ALL
SELECT 'transactions.category', count(*) FROM transactions
WHERE category = 'recebimentos externos de direitos';
```

### Residue census 20260930000018

Migration `BackfillTransactionTaxonomyToEnglish`. Predicate: exact match of `transactions.category` and `transactions.subcategory` against the keys of `LEGACY_TRANSACTION_CATEGORY_SLUGS` (`apps/api/src/modules/transactions/transaction-category-slugs.ts`, the list below is generated from that map). Removal condition of the legacy side (API and web slug maps, IN-expansion of the list and export filters): the first query returns no rows for one release window. The deliberately unmapped slugs are not residue of this migration (owner decision, blocker `BLK-TRANSACTION-CATEGORY-TAXONOMY`); the second query only lists them. The CHECK on `transactions.category` stays blocked until every writer is validated and the slug-shaped values outside the known sets, which the migration prints in its own log, are 0.

```sql
-- 20260930000018 transaction taxonomy
WITH legacy AS (SELECT unnest(ARRAY[
    'servicos', 'produtos', 'administrativo', 'viagens', 'suporte-financeiro', 'remuneracao', 'servicos-pf',
    'reembolso', 'salario', 'pro-labore', 'pagamento-diaria', 'hora-extra', 'comissao', 'bonus-premiacao',
    'prestador-autonomo', 'consultoria', 'reembolso-transporte', 'reembolso-alimentacao', 'reembolso-hospedagem',
    'reembolso-materiais', 'design-grafico', 'producao-audiovisual', 'licenciamento-obras', 'direitos-autorais',
    'fotografia-audiovisual', 'sampling-clearance', 'assessoria-juridica', 'contabil-fiscal',
    'ti-desenvolvimento-saas', 'marketing-trafego-pr', 'anuncios', 'brindes-promocionais', 'passagens', 'hospedagem',
    'alimentacao', 'transporte', 'locacao-equipamentos', 'equipamentos', 'cenografia-pirotecnia', 'aluguel', 'agua',
    'luz', 'telefonia', 'correios-logistica', 'taxas-bancarias', 'impostos', 'juros', 'multas', 'tarifas-plataformas',
    'caches', 'show-evento', 'publicidade', 'receitas-musicais', 'receitas-contratuais', 'participacao-show-evento',
    'venda-show-fechado', 'direitos-conexos', 'external-rights-streaming', 'recebimentos-externos-streaming',
    'licenciamento-obra', 'licenciamento-fonograma', 'sincronizacao', 'venda-beats', 'producao-musical',
    'marketing-divulgacao', 'criacao-site', 'gestao-redes-sociais', 'trafego-pago', 'gravacao-estudio', 'mixagem',
    'masterizacao', 'sessao-producao', 'ensaio', 'locacao-estudio', 'venda-merchandising', 'venda-produtos-fisicos',
    'venda-produtos-digitais', 'venda-nfts', 'beats-avulsos', 'pack-beats', 'sample-packs', 'presets-plugins',
    'fee-administrativo', 'reembolso-recebido', 'multa-contratual', 'bonus-incentivo', 'patrocinio', 'apoio-cultural',
    'cache-show', 'external-rights-receipts', 'licenciamento', 'adiantamento', 'outros', 'infraestrutura',
    'tecnologia', 'formacao', 'microfone', 'fone-ouvido', 'mesa-som', 'monitor-referencia', 'interface-audio',
    'instrumento-musical', 'iluminacao', 'computador', 'acessorios', 'reforma-escritorio', 'reforma-estudio',
    'mobiliario', 'tratamento-acustico', 'ar-condicionado', 'eletrica', 'seguranca', 'software-daw', 'plugins-vst',
    'licenca-software', 'servicos-cloud', 'armazenamento', 'crm-erp', 'automacao', 'ia', 'redes-sociais',
    'assessoria-imprensa', 'material-promocional', 'evento-lancamento', 'pesquisa-mercado', 'fotografia', 'videoclipe',
    'curso-producao', 'curso-mixagem', 'curso-gestao', 'curso-marketing', 'mentoria', 'certificacao',
    'evento-networking', 'simples-nacional', 'entre-contas', 'aplicacao', 'resgate'
  ]) AS slug)
SELECT 'category' AS col, t.category AS legacy_slug, count(*) FROM transactions t JOIN legacy l ON t.category = l.slug GROUP BY 2
UNION ALL
SELECT 'subcategory', t.subcategory, count(*) FROM transactions t JOIN legacy l ON t.subcategory = l.slug GROUP BY 2
ORDER BY 1, 3 DESC;

-- Informational, not part of the zero condition: legacy slugs left as stored on purpose.
SELECT 'category' AS col, category AS unmapped_slug, count(*) FROM transactions
WHERE category IN ('receitas-internas', 'repasse-contrato') GROUP BY 2
UNION ALL
SELECT 'subcategory', subcategory, count(*) FROM transactions
WHERE subcategory IN ('receitas-internas', 'repasse-contrato') GROUP BY 2;
```

### Residue census 20260930000019

Migration `BackfillReleaseMetadataKeysToEnglish`. Predicate (`candidatePredicate`): `releases.metadata` holds at least one legacy top-level key. Removal condition of the legacy readers (`common/compat/release-metadata.ts` and its web twin): both queries return 0 for one release window. The second query covers legacy keys inside `tracks[]`, which the migration reaches only on rows that also hold a legacy top-level key.

```sql
-- 20260930000019 release metadata keys
SELECT count(*) AS release_rows_with_legacy_top_level_keys FROM releases
WHERE metadata ?| ARRAY['variosArtistas', 'generoSecundario', 'copyrightDataLancamento', 'copyrightDataGravacao', 'artistasAdicionaisAlbum', 'faixas']::text[];

SELECT count(*) AS release_rows_with_legacy_track_keys FROM releases
WHERE EXISTS (
  SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(metadata -> 'tracks') = 'array' THEN metadata -> 'tracks' ELSE '[]'::jsonb END) AS t(e)
  WHERE jsonb_typeof(t.e) = 'object'
    AND t.e ?| ARRAY['artista', 'isVersionAlternativa', 'tipoVersao', 'artistasAdicionais', 'produtores', 'compositores', 'musicos', 'idioma', 'letra']::text[]
);
```

### Residue census 20260930000021

Migration `BackfillInvoicePaymentMethodBankTransfer`. Predicate: exact `payment_method = 'transferencia'`. Removal condition of the legacy map (`apps/api/src/modules/invoices/invoice-legacy-fields.ts`) and of `transferencia` in `chk_invoices_payment_method`: the count is 0 in every environment.

```sql
-- 20260930000021 invoice payment method bank_transfer
SELECT payment_method, count(*) FROM invoices
WHERE payment_method = 'transferencia' GROUP BY 1;
```

### Residue census 20260930000022

Migration `BackfillCanonicalFromLegacyMirrors`. Predicates: `invoices.service_amount IS NULL AND legacy_amount IS NOT NULL`, and `takedowns.infringing_url IS NULL AND url IS NOT NULL` (the `takedowns.url` mirror was removed by `20260719000016`; run the second query only where `information_schema.columns` still lists it). Removal condition of the mirror columns: both counts are 0. The divergence counts are informational (the migration never overwrites a non-NULL canonical value).

```sql
-- 20260930000022 canonical columns from legacy mirrors
SELECT count(*) AS invoices_service_amount_unfilled FROM invoices
WHERE service_amount IS NULL AND legacy_amount IS NOT NULL;

SELECT count(*) AS invoices_divergent_untouched FROM invoices
WHERE service_amount IS NOT NULL AND legacy_amount IS NOT NULL AND service_amount <> legacy_amount;

-- only where takedowns.url still exists
SELECT count(*) AS takedowns_infringing_url_unfilled FROM takedowns
WHERE infringing_url IS NULL AND url IS NOT NULL;
```

### Residue census 20260930000023

Migration `BackfillContractLastPaymentKeysToEnglish`. Predicate: `contracts.metadata` holds one of the three legacy keys. Removal condition of `common/compat/contract-last-payment.ts`: the count is 0 for one release window.

```sql
-- 20260930000023 contract last payment keys
SELECT count(*) AS contract_rows_with_legacy_last_payment_keys FROM contracts
WHERE metadata ?| ARRAY['ultimo_pagamento_em', 'ultimo_pagamento_valor', 'ultimo_pagamento_por']::text[];
```

### Residue census 20260930000024

Migration `BackfillPlanFeatureKeysToEnglish`. Predicate: `features` is a jsonb object holding the legacy key `moduleRh`, in `tenants` and in `billing_plans` (global table, no tenant). Removal condition of `common/compat/plan-features.ts` and of the web feature-flag fallback: both counts are 0 for one release window.

```sql
-- 20260930000024 plan feature keys
SELECT 'tenants' AS source, count(*) FROM tenants
WHERE jsonb_typeof(features) = 'object' AND features ? 'moduleRh'
UNION ALL
SELECT 'billing_plans', count(*) FROM billing_plans
WHERE jsonb_typeof(features) = 'object' AND features ? 'moduleRh';
```

### Residue census 20260930000025

Migration `BackfillAssetTypesToEnglish`. Predicate: `assets.asset_type` or the mirrored `metadata.classification.assetType` holds one of the three legacy values. Removal condition of `common/compat/asset-type.ts`: the count is 0 for one release window.

```sql
-- 20260930000025 asset types
SELECT count(*) AS asset_rows_with_legacy_type FROM assets
WHERE asset_type IN ('guia', 'videoclipe', 'contrato')
   OR (metadata #>> '{classification,assetType}') IN ('guia', 'videoclipe', 'contrato');
```

### Residue census 20260930000026

Migration `BackfillMarketingVocabularyToEnglish`. Predicate: one `SELECT` per table, copied from the migration's `PREDICATES` (value lists generated from its frozen maps; the campaign `promotedEntityType` also matches the upper-case spellings). Removal condition of the legacy maps in `apps/api/src/modules/marketing/marketing-vocabulary.ts` and the web readers: every row returns 0 in every environment.

```sql
-- 20260930000026 marketing vocabulary
SELECT 'marketing_projects' AS source, count(*) FROM marketing_projects
WHERE (metadata ->> 'uiType') IN ('lancamento_musical', 'videoclipe', 'campanha_institucional', 'campanha_promocional', 'evento', 'conteudo_corporativo', 'bastidores', 'reuniao', 'divulgacao_produto', 'divulgacao_servico', 'divulgacao_saas', 'comunicacao_interna', 'comunicacao_externa', 'portal_noticias', 'projeto_especial')
   OR (metadata ->> 'uiStatus') IN ('planejamento', 'em_andamento', 'pausado', 'concluido', 'cancelado')
   OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(CASE WHEN jsonb_typeof(metadata -> 'channels') = 'array' THEN metadata -> 'channels' ELSE '[]'::jsonb END) AS c(v) WHERE c.v IN ('portal_noticias', 'campanha', 'material_publicitario', 'evento_interno', 'evento_externo', 'reuniao', 'bastidores'))
UNION ALL
SELECT 'marketing_tasks' AS source, count(*) FROM marketing_tasks
WHERE (kind) IN ('publicacao', 'campanha', 'planejamento', 'aprovacao', 'revisao', 'analise', 'reuniao', 'bastidor', 'conteudo_institucional', 'conteudo_comercial', 'conteudo_artistico', 'trafego_pago', 'capa', 'arte_redes_sociais', 'identidade_visual', 'material_promocional', 'videoclipe', 'video_redes_sociais', 'bastidores', 'entrevista', 'captacao_evento', 'prospeccao', 'negociacao', 'relacionamento', 'planejamento_lancamento', 'material_institucional', 'apresentacao_comercial', 'video_institucional', 'bastidores_empresa', 'cobertura_evento_corporativo', 'entrevista_corporativa', 'campanha_institucional', 'posicionamento_marca', 'comunicados', 'relacionamento_parceiros', 'parcerias', 'planejamento_carreira', 'gestao_agenda', 'planejamento_estrategico', 'assessoria_imprensa', 'branding_pessoal', 'posicionamento', 'estrategias_crescimento', 'sessao_fotos', 'conteudo_redes_sociais', 'contratacoes', 'arte_divulgacao', 'conteudo_lancamento', 'distribuicao', 'campanha_lancamento', 'divulgacao', 'influenciadores', 'aprovacao_conteudo')
   OR (metadata ->> 'uiType') IN ('publicacao', 'campanha', 'planejamento', 'aprovacao', 'revisao', 'analise', 'reuniao', 'bastidor', 'conteudo_institucional', 'conteudo_comercial', 'conteudo_artistico', 'trafego_pago', 'capa', 'arte_redes_sociais', 'identidade_visual', 'material_promocional', 'videoclipe', 'video_redes_sociais', 'bastidores', 'entrevista', 'captacao_evento', 'prospeccao', 'negociacao', 'relacionamento', 'planejamento_lancamento', 'material_institucional', 'apresentacao_comercial', 'video_institucional', 'bastidores_empresa', 'cobertura_evento_corporativo', 'entrevista_corporativa', 'campanha_institucional', 'posicionamento_marca', 'comunicados', 'relacionamento_parceiros', 'parcerias', 'planejamento_carreira', 'gestao_agenda', 'planejamento_estrategico', 'assessoria_imprensa', 'branding_pessoal', 'posicionamento', 'estrategias_crescimento', 'sessao_fotos', 'conteudo_redes_sociais', 'contratacoes', 'arte_divulgacao', 'conteudo_lancamento', 'distribuicao', 'campanha_lancamento', 'divulgacao', 'influenciadores', 'aprovacao_conteudo')
   OR (metadata ->> 'targetType') IN ('projeto_musical', 'artista', 'empresa')
UNION ALL
SELECT 'campaigns' AS source, count(*) FROM campaigns
WHERE type = 'marketing_builder' AND ((metadata #>> '{marketingBuilder,payload,promotedEntityType}') IN ('PROJETO_MUSICAL', 'projeto_musical', 'ARTISTA', 'artista', 'EMPRESA', 'empresa')
   OR (metadata #>> '{marketingBuilder,payload,type}') IN ('institucional', 'comercial', 'artistica', 'promocional', 'lancamento_musical', 'produto', 'servico', 'evento', 'conteudo', 'trafego_pago', 'organica')
   OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(CASE WHEN jsonb_typeof(metadata #> '{marketingBuilder,payload,platforms}') = 'array' THEN metadata #> '{marketingBuilder,payload,platforms}' ELSE '[]'::jsonb END) AS c(v) WHERE c.v IN ('portal_noticias', 'campanha', 'material_publicitario', 'evento_interno', 'evento_externo', 'reuniao', 'bastidores')))
UNION ALL
SELECT 'briefings' AS source, count(*) FROM briefings
WHERE (metadata ->> 'type') IN ('campanha', 'conteudo', 'institucional', 'comercial', 'artistico', 'evento', 'produto', 'servico', 'portal_noticias', 'bastidores')
   OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(CASE WHEN jsonb_typeof(metadata -> 'channels') = 'array' THEN metadata -> 'channels' ELSE '[]'::jsonb END) AS c(v) WHERE c.v IN ('portal_noticias', 'campanha', 'material_publicitario', 'evento_interno', 'evento_externo', 'reuniao', 'bastidores'))
UNION ALL
SELECT 'marketing_content_posts' AS source, count(*) FROM marketing_content_posts
WHERE EXISTS (SELECT 1 FROM jsonb_array_elements_text(CASE WHEN jsonb_typeof(metadata -> 'channels') = 'array' THEN metadata -> 'channels' ELSE '[]'::jsonb END) AS c(v) WHERE c.v IN ('portal_noticias', 'campanha', 'material_publicitario', 'evento_interno', 'evento_externo', 'reuniao', 'bastidores'))
UNION ALL
SELECT 'activity_logs' AS source, count(*) FROM activity_logs
WHERE entity_type = 'marketing_ai' AND ((metadata ->> 'kind') IN ('analise_fonograma', 'analise_letra', 'planejamento_campanha', 'sugestao_conteudo', 'legenda', 'roteiro', 'analise_artista', 'analise_marca', 'analise_empresa', 'pitch_playlist', 'pitch_imprensa', 'posicionamento', 'calendario_editorial', 'conteudo_bastidores', 'conteudo_corporativo')
   OR (metadata ->> 'targetType') IN ('projeto_musical', 'artista', 'empresa')
   OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(CASE WHEN jsonb_typeof(metadata -> 'channels') = 'array' THEN metadata -> 'channels' ELSE '[]'::jsonb END) AS c(v) WHERE c.v IN ('portal_noticias', 'campanha', 'material_publicitario', 'evento_interno', 'evento_externo', 'reuniao', 'bastidores')));
```

### Residue census 20260930000027

Migration `BackfillArtistDistributorIdOtherToEnglish`. Predicate: a distributor entry with `id = 'outros'` in `general_distributors`, or inside `distributors` of an item of `relationships`, `linked_contacts` or `team_contacts`. Removal condition of the legacy id reader: the count is 0 in every environment.

```sql
-- 20260930000027 artist distributor id other
SELECT count(*) AS artist_rows_with_legacy_distributor_id FROM artists
WHERE EXISTS (SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(general_distributors) = 'array' THEN general_distributors ELSE '[]'::jsonb END) AS g(e) WHERE g.e ->> 'id' = 'outros')
   OR EXISTS (SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(relationships) = 'array' THEN relationships ELSE '[]'::jsonb END) AS i(item),
              jsonb_array_elements(CASE WHEN jsonb_typeof(i.item -> 'distributors') = 'array' THEN i.item -> 'distributors' ELSE '[]'::jsonb END) AS d(e) WHERE d.e ->> 'id' = 'outros')
   OR EXISTS (SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(linked_contacts) = 'array' THEN linked_contacts ELSE '[]'::jsonb END) AS i(item),
              jsonb_array_elements(CASE WHEN jsonb_typeof(i.item -> 'distributors') = 'array' THEN i.item -> 'distributors' ELSE '[]'::jsonb END) AS d(e) WHERE d.e ->> 'id' = 'outros')
   OR EXISTS (SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(team_contacts) = 'array' THEN team_contacts ELSE '[]'::jsonb END) AS i(item),
              jsonb_array_elements(CASE WHEN jsonb_typeof(i.item -> 'distributors') = 'array' THEN i.item -> 'distributors' ELSE '[]'::jsonb END) AS d(e) WHERE d.e ->> 'id' = 'outros');
```

### Residue census 20260930000028

Migration `BackfillCampaignBuilderStateToEnglish`. Predicate: `campaigns` of type `marketing_builder` whose `metadata.marketingBuilder.payload` text mentions a legacy token. The migration's own predicate is deliberately over-inclusive (a bare token match); this census narrows it to a token that is a whole JSON string value, plain or escaped inside the `notes` string, so that free text does not keep the count above 0. Removal condition of the legacy maps (API `canonicalMarketingCampaignPayload`, web `parseCampaignBuilderNotes`): the count is 0 in every environment.

```sql
-- 20260930000028 campaign builder state
SELECT count(*) AS builder_state_rows FROM campaigns
WHERE type = 'marketing_builder'
  AND (metadata #>> '{marketingBuilder,payload}') ~ '\\?"(pre_lancamento|lancamento|sustentacao|catalogo|imagem|carrossel|texto|menor_custo|limite_custo|custo_alvo|todos|feminino|masculino|nao_binario|nao_informado)\\?"';
```

### Residue census 20260930000029

Migration `BackfillMarketingTaskSectorToEnglish`. Predicate: `metadata.sector` or `metadata.automationFlowId` equals a legacy sector label or flow id, exact match. Removal condition of the legacy maps (API DTO transform, web `canonicalMarketingSector` and `canonicalAutomationFlowId`): the count is 0 in every environment. A sector typed by a tenant is user content and is not residue.

```sql
-- 20260930000029 marketing task sector and flow id
SELECT count(*) AS sector_or_flow_rows FROM marketing_tasks
WHERE (metadata ->> 'sector') IN ('Design', 'Audiovisual', 'Marketing', 'Comunicação', 'Comercial', 'Administração Musical', 'Distribuição Digital', 'CRM')
   OR (metadata ->> 'automationFlowId') IN ('flow-lancamento', 'flow-conteudo-corporativo', 'flow-bastidores', 'flow-evento', 'flow-produto-saas');
```

### Residue census 20260930000031

Migration `ClassifyMarketingAndContactOperationalListsToEnglish`. Predicate: a row is a platform default only by an exact `(kind, slug, name)` match with `origin` NULL or `platform` (tenant-authored rows are never touched). A row still listed here either predates the migration or was skipped because its target `(tenant, kind, slug / stable_key)` is held by another live row; the migration prints the skipped count, and those rows need a manual decision (they are never merged). Removal condition of the legacy kind and slugs in the API and web readers and of `legacy_slug`: no rows returned in every environment.

```sql
-- 20260930000031 operational lists (marketing and contact)
WITH platform_default(kind, slug, name) AS (VALUES
  ('marketing_context', 'projeto_musical', 'Projeto Musical'),
  ('marketing_context', 'artista', 'Artista'),
  ('marketing_context', 'empresa', 'Empresa'),
  ('marketing_sector', 'Design', 'Design'),
  ('marketing_sector', 'Audiovisual', 'Audiovisual'),
  ('marketing_sector', 'Marketing', 'Marketing'),
  ('marketing_sector', 'Comunicação', 'Comunicação'),
  ('marketing_task_type', 'campanha', 'Campanha'),
  ('briefing_service_type', 'campanha', 'Campanha'),
  ('briefing_service_type', 'conteudo', 'Conteúdo'),
  ('contact_pf_classification', 'ARTIST_AGENT', 'Agente Artístico'),
  ('contact_pf_classification', 'PRESS_OFFICE', 'Assessoria de Imprensa'),
  ('contact_pf_classification', 'VIDEOMAKER', 'Videomaker'),
  ('contact_pf_classification', 'OTHER', 'Outro'),
  ('contact_pj_classification', 'MARKETING_AGENCY', 'Agência de Marketing'),
  ('contact_pj_classification', 'VENUE', 'Casa de Show'),
  ('contact_pj_classification', 'SUPPLIER', 'Fornecedor'),
  ('contact_pj_classification', 'OTHER', 'Outro')
)
SELECT o.kind, o.slug, count(*) FROM operational_list_items o
JOIN platform_default d ON o.kind = d.kind AND o.slug = d.slug AND o.name = d.name
WHERE o.origin IS NULL OR o.origin = 'platform'
GROUP BY 1, 2 ORDER BY 1, 2;
```

### Residue census 20260930000032

Migration `BackfillProjectTrackInstrumentalAndLanguageToEnglish`. Predicate: `project_tracks.instrumental` or `language` equals a key of the frozen maps (lists generated from them). Free text typed in an import is user content and is not residue. Removal condition of the legacy maps (API canonical on read, web readers, report import cells): no rows returned in every environment.

```sql
-- 20260930000032 project track instrumental flag and language
SELECT 'instrumental' AS col, instrumental AS legacy_value, count(*) FROM project_tracks
WHERE instrumental IN ('sim', 'nao', 'não')
GROUP BY 2
UNION ALL
SELECT 'language', language, count(*) FROM project_tracks
WHERE language IN (
  'alemao', 'amarico', 'arabe', 'bengali', 'chines-mandarim', 'coreano', 'dinamarques', 'espanhol', 'finlandes',
  'frances', 'grego', 'hebraico', 'hindi', 'holandes', 'indonesio', 'ingles', 'ioruba', 'italiano', 'japones', 'latim',
  'malaio', 'noruegues', 'persa', 'polones', 'portugues', 'punjabi', 'russo', 'suaili', 'sueco', 'tailandes', 'tamil',
  'telugu', 'turco', 'ucraniano', 'urdu', 'vietnamita', 'zulu', 'cantones', 'filipino', 'multilingue',
  'instrumental-sem-letra', 'outro'
)
GROUP BY 2
ORDER BY 1, 3 DESC;
```

### Residue census 20260930000033

Migration `RenameVideomakerJobFunctionSlugToVideographer`. Predicate: the seeded live row (`slug = 'videomaker'` and `name = 'Videomaker'`). The migration skips a tenant that already has a live `videographer` row; the second query lists those, which need a manual decision. Removal condition: the first count is 0, and the second is 0 or each such tenant has been resolved.

```sql
-- 20260930000033 videomaker job function slug
SELECT count(*) AS seeded_rows_still_legacy FROM job_functions
WHERE slug = 'videomaker' AND name = 'Videomaker' AND deleted_at IS NULL;

SELECT count(*) AS skipped_target_taken FROM job_functions t
WHERE t.slug = 'videomaker' AND t.name = 'Videomaker' AND t.deleted_at IS NULL
  AND EXISTS (SELECT 1 FROM job_functions o WHERE o.tenant_id = t.tenant_id AND o.slug = 'videographer' AND o.deleted_at IS NULL);
```
