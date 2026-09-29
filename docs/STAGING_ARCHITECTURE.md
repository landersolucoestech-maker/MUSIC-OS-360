# MUSIC OS 360 — Arquitetura de Staging

> Staging é um **ambiente** (GitHub Environment `staging`), nunca uma branch.
> A topologia deste projeto é somente `dev` e `main`. Todo código novo entra
> em `dev`; a promoção para staging é a execução manual e deliberada de
> `staging.yml` (Actions tab → Run workflow, ref `dev`), nunca um merge.

## Decisão arquitetural: Supabase STAGING

Duas opções, ambas com custo recorrente real neste plano (Pro):

| Opção | Custo | Isolamento |
|---|---|---|
| Branch persistente no projeto MUSIC OS 360 (mesmo modelo já usado pela branch DEV) | ~$0.01344/hora ≈ $9.68/mês | Schema/dados sempre próprios (branch nova nunca copia dados reais); mesmo projeto físico |
| Projeto Supabase separado | $10/mês fixo | Isolamento total, incluindo infraestrutura de projeto |

**Decidido e criado na Parte 65** (2026-08-01): branch persistente no projeto MUSIC OS 360 (custo ~$9.68/mês, aprovado explicitamente). Ref real: `jjnnjnxjkqipgqebijen` — `SUPABASE_STAGING_REF` em `env.schema.ts`/`assert-supabase-env.mjs`/`env-check.mjs` foi atualizado para este valor, substituindo o placeholder `khnaxcgjnvhhtgkozsif` que nunca correspondeu a um recurso real.

## Migrations que tocam schemas do próprio Supabase (`realtime`, `auth`, `storage`)

Descoberto na Parte 67 ao tentar aplicar `20260801000001_RealtimeBroadcastAuthorization`
em DEV real: **`execute_sql` e `apply_migration` do MCP falham com
`must be owner of table messages`** para qualquer DDL em `realtime.messages`
(e, por extensão, qualquer tabela nos schemas `realtime`/`auth`/`storage`,
que pertencem à própria plataforma Supabase, não ao role usado pela Management
API). Toda migration anterior deste projeto só tocou o schema `public`
(dono = role da própria migration/`musicos_migrator`), por isso esse limite
nunca tinha aparecido.

**Única forma de aplicar essas migrations em DEV/STAGING/MAIN**: SQL Editor
do Dashboard do Supabase (conexão como owner real), ou uma conexão direta
via `DATABASE_URL` com o role `postgres` real do projeto — nenhuma das duas
está disponível a um agente sem essas credenciais. Ver PARTE 67 para o SQL
exato pendente em DEV.

## Fonte única de migrations (staging incluído)

Staging usa exatamente o mesmo `migrations/index.ts` que DEV/MAIN — não existe
(e não deve existir) uma terceira lista de migrations. `scripts/verify-migration-source-of-truth.mjs`
roda no job `migrations-staging` do `staging.yml` como em qualquer outro ambiente.

## Guard de project ref

`src/core/config/verify-supabase-dev-ref.util.ts` expõe `validateSupabaseRef`
(genérico) e dois wrappers — `validateSupabaseDevRef` e
`validateSupabaseStagingRef` — cada um recusando explicitamente MAIN, refs
denylisted, e qualquer ref que não seja exatamente o esperado. `staging.yml`
roda `scripts/verify-supabase-staging-ref.ts` antes de qualquer query.

## Seed sintético

`apps/api/src/database/seeds/index.ts` é o runner único (`npm run db:seed`).
Cadeia atual: `01_default_tenant` → `02_admin_user` → `03_operational_seed`
(agora corretamente encadeado — antes desta parte, `03_operational_seed`
existia no disco mas nunca era chamado pelo runner, e usava um `org_id`
default diferente do de `01_default_tenant`, o que teria criado uma
organização órfã duplicada se alguém o tivesse invocado manualmente) →
`04_rbac_seed` → `05_org_structure_seed`.

Dados cobertos hoje: organization, tenant, billing_subscription, org_member
(owner), artist, contact, campaign, campaign_task, form, contract,
transaction, contact_timeline — todos com IDs determinísticos
(`10000000-0000-0000-0000-0000000000XX`) e o email padrão
`admin@musicos360.dev` (convenção já estabelecida em `02_admin_user.ts` e
`dev-auth.controller.ts` — mantida por consistência, não é um domínio real).

**Gap registrado, não preenchido nesta parte**: works, phonograms, releases,
invoices, leads, projects, conversations, e usuários adicionais por role
(manager/viewer além do owner) — a lista completa do Bloco 6 da Parte 63.
Expandir `03_operational_seed.ts` sem um banco de staging real para testar
contra arriscaria introduzir bugs silenciosos (nomes de coluna incorretos,
FKs quebradas) — ver o bug real de `leads.tipoServico` corrigido na Parte 61,
que só foi descoberto rodando contra um banco de verdade.

Guard anti-MAIN adicionado ao runner (`index.ts`): recusa rodar se
`DATABASE_URL` resolver para `SUPABASE_MAIN_REF`, independente de
`NODE_ENV`/`--force`.

`provision-staging-rbac-users.ts` (pré-existente) já cobre a criação de um
usuário Supabase Auth real por role (`owner`, `admin`, `manager`, `editor`,
`viewer`, `accounting`, `artist`) com emails `rbac-<role>@homolog.local` —
domínio reservado, guard fail-closed contra qualquer ref que não seja
`SUPABASE_STAGING_REF`, e exige `PROVISION_CONFIRM=YES` explícito.

## Matriz de variáveis (Bloco 2)

Fonte: `apps/api/src/core/config/env.schema.ts`, `.env.production`,
`.env.staging`, `apps/web/.env.staging`, `staging.yml`.

| Variável | Obrigatória em staging | Origem | Já disponível | Ação |
|---|---|---|---|---|
| `DATABASE_URL` (staging) | Sim | Supabase STAGING | Não | Depende da criação do recurso Supabase STAGING |
| `APP_DATABASE_URL` | Sim (RLS runtime) | Supabase STAGING | Não | Idem |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` | Sim | Supabase STAGING | Não | Idem |
| `DATABASE_SESSION_CONTEXT_ENABLED` | Sim (`true`) | Config estática | Sim | Já no `staging.yml` |
| `RBAC_PERSISTED_AUTHORITY` | Sim (`SHADOW` inicialmente) | Config estática | — | Adicionar como variable no Environment |
| `ENCRYPTION_KEY` | Sim | Gerado (não reaproveitar DEV) | Não | Gerar novo valor próprio de staging |
| `REDIS_URL` / `REDIS_QUEUE_URL` | Sim | Redis STAGING | Não | **BLOCKED_EXTERNAL** — sem provedor Redis acessível |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` (test) | Sim | Stripe TEST mode | Não | **BLOCKED_EXTERNAL** — Stripe MCP não autorizado |
| `STRIPE_CONNECT_CLIENT_ID` | Opcional | Stripe TEST mode | Não | Idem |
| `R2_ACCOUNT_ID` / `R2_ACCESS_KEY` / `R2_SECRET_KEY` / `R2_BUCKET_NAME` / `R2_PUBLIC_URL` | Sim | Cloudflare R2 | Não | **BLOCKED_EXTERNAL** — Cloudflare MCP não autorizado |
| `RESEND_API_KEY` / `RESEND_FROM_EMAIL` | Sim (produção-like) | Resend | Não | **BLOCKED_EXTERNAL** — sem credencial |
| `SENTRY_DSN` | Sim (produção-like) | Sentry | Não | **BLOCKED_EXTERNAL** — Sentry MCP não autorizado |
| `POSTHOG_API_KEY` / `POSTHOG_HOST` | Opcional | PostHog | **Sim** (MCP autorizado, projeto único "Default project") | Confirmar se staging deve usar o mesmo projeto ou uma property de ambiente |
| `SPOTIFY_CLIENT_ID/SECRET/REDIRECT_URI/OAUTH_STATE_SECRET` | Opcional | Spotify Developer Dashboard | Não | **BLOCKED_EXTERNAL** |
| `YOUTUBE_API_KEY` | Opcional | Google Cloud Console | Não | **BLOCKED_EXTERNAL** |
| `SOUNDCLOUD_CLIENT_ID/SECRET` | Opcional | SoundCloud | Não | **BLOCKED_EXTERNAL** |
| `META_APP_ID/SECRET/REDIRECT_URI` | Opcional | Meta for Developers | Não | **BLOCKED_EXTERNAL** |
| `TIKTOK_CLIENT_KEY/SECRET/REDIRECT_URI` | Opcional | TikTok for Developers | Não | **BLOCKED_EXTERNAL** |
| `DOCUSIGN_INTEGRATION_KEY/CLIENT_SECRET` | Opcional | DocuSign | Não | **BLOCKED_EXTERNAL** (Docusign MCP existe mas não autorizado) |
| `GOOGLE_ADS_CLIENT_ID/SECRET/REDIRECT_URI` | Opcional | Google Ads | Não | **BLOCKED_EXTERNAL** |
| `ACRCLOUD_HOST/ACCESS_KEY/ACCESS_SECRET` | Opcional | ACRCloud | Não | **BLOCKED_EXTERNAL** |
| `AUTENTIQUE_WEBHOOK_SECRET` | Sim (se Autentique ativo) | Autentique | Não | **BLOCKED_EXTERNAL** |
| `CORS_ORIGINS` / `APP_URL` | Sim | Depende do domínio de staging | Não | Depende de Bloco 9 (Cloudflare DNS) — **BLOCKED_EXTERNAL** |
| `USE_MOCK` / `MOCK_MODE` / `AUTH_DISABLED` | Sim (`false` todos) | Config estática | Sim | Adicionar como variables |
| Deezer, Apple Music | — | — | — | Não existem no schema hoje — nenhuma integração real codificada ainda; nada a bloquear ou configurar |

## Bloqueios externos (BLOCKED_EXTERNAL)

Nenhum destes é acionável sem autorização humana prévia (via configurações de
conector do claude.ai) ou credenciais fornecidas diretamente:

- **Cloudflare** (DNS + R2) — MCP não autorizado.
- **Stripe** (test mode, produtos, webhook) — MCP não autorizado.
- **Resend/SMTP** — sem credencial e sem MCP.
- **Sentry** — MCP não autorizado.
- **Todas as integrações OAuth de terceiros** (Spotify, YouTube/Google, Meta,
  TikTok, SoundCloud, DocuSign, Google Ads, ACRCloud, Autentique) — exigem
  criação/configuração de app nas respectivas plataformas, fora do alcance
  de qualquer ferramenta disponível aqui.
- **Deploy platform** (API + Web) — no `vercel.json`/`railway.toml`/
  `render.yaml`/`Procfile` exists in the repository; the only reachable Vercel
  project (`lander-launchpad`) is unrelated. `staging.yml` is platform-agnostic:
  it calls a generic `STAGING_STOP_WEBHOOK_URL` (must stop every API instance,
  workers included, and keep it stopped) before any schema change and a generic
  `STAGING_DEPLOY_WEBHOOK_URL` (receives `{"ref":"<commit>"}`, deploys that commit and starts it with `BUILD_SHA=<commit>`, which `/api/v1/health/live` reports) —
  see `docs/engineering/database.md`, "Deploy order". The service itself still
  has to exist on a provider with reachable credentials.

## Estado do GitHub Environment `staging`

Já existia antes desta parte (criado em 2026-07-03). Nesta parte: variáveis
não sensíveis adicionadas (ver commit `fix(ci): provision and verify the
staging environment`).
