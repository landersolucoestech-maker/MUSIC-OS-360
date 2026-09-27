# 73 — Decisão Final: Namespace PostgreSQL da `apps/api-v2`

Definição read-only do namespace/schema PostgreSQL onde as tabelas de negócio da futura `apps/api-v2` residirão, resolvendo o bloqueio explícito registrado no PROMPT 83 (nenhum documento anterior definia `public` vs. schema privado). Framework, Drizzle ORM, driver `pg`, estratégia de migrations (Drizzle Kit + SQL manual controlado) e o mecanismo de RLS via `set_config('app.current_tenant_id', ..., true)` (docs 45/47/49/51) permanecem fixos, não reabertos aqui — apenas o NAMESPACE de destino das tabelas é decidido. Nenhum schema PostgreSQL, migration ou tabela foi criado. Nenhuma dependência foi instalada. Nenhum Drizzle schema foi alterado. `apps/api-v2` não teve código alterado. Supabase remoto não foi alterado. `apps/web` e `apps/api` (legacy) não foram alterados. Git não foi modificado.

## Decisões fixas (não reabertas)

```text
Database: PostgreSQL 17 / Supabase (doc58)
Database access: Drizzle ORM 0.45.2, driver pg 8.22.0 (doc65)
Migrations: Drizzle Kit + SQL manual controlado (doc46/65)
RLS: sessão transacional via set_config('app.current_tenant_id'/'app.current_org_id'/'app.current_role', ..., true) (doc45/47/49/51)
Multi-tenancy obrigatória desde a primeira migration (doc45/46/58)
```

---

## Decisão

```text
DATABASE_NAMESPACE:
app

Todas as tabelas de negócio da apps/api-v2 (users, tenants, tenant_memberships, e os domínios futuros
dos 35 módulos, doc38/41) residem exclusivamente no schema `app` — nunca em `public`.

Exemplos futuros (nomenclatura, não criados nesta etapa):
app.users
app.tenants
app.tenant_memberships

API_V2_BUSINESS_TABLES_IN_PUBLIC:
NÃO
```

---

## Motivo

```text
- Evitar exposição acidental via Supabase Data API (PostgREST expõe por padrão o schema `public`
  configurado no projeto Supabase; um schema dedicado não entra nessa superfície sem exposição
  explícita e deliberada — ver seção DATA API abaixo).
- Separar claramente a apps/api-v2 do banco legacy: o legacy (apps/api, TypeORM) já usa `public`
  extensivamente (baseline canônico "157 public tables", docs/STAGE_4_CANONICAL_BASELINE_157_80.md,
  legacy, não reaberto) — um schema `app` dedicado elimina qualquer risco de colisão de nome de
  tabela/índice/constraint entre os dois backends durante a coexistência até o cutover.
- Manter ownership arquitetural explícito: qualquer objeto em `app.*` é inequivocamente da apps/api-v2;
  qualquer objeto em `public.*` é inequivocamente do legacy — sem ambiguidade de qual sistema é dono de
  qual tabela durante a transição.
- Facilitar grants e políticas: permissões de schema (USAGE/CREATE em `app`) podem ser concedidas de
  forma isolada, sem depender de filtrar objetos dentro do `public` compartilhado.
- Permitir RLS como defense in depth (doc49) independentemente do isolamento de schema — os dois
  mecanismos são complementares, não substitutos um do outro (ver seção RLS abaixo).
- Evitar colisão com objetos legacy em `public` durante toda a janela de coexistência dos dois backends.
```

---

## Supabase — schemas gerenciados (não alterados)

```text
Os schemas gerenciados pelo Supabase permanecem exatamente como estão, sem nenhuma alteração:

auth        — Supabase Auth (GoTrue) continua sendo a fonte de identidade (doc49, não reaberto);
              apps/api-v2 apenas VALIDA o JWT emitido por este schema, nunca o modifica.
storage     — Supabase Storage, não tocado.
realtime    — Supabase Realtime, não tocado (doc49: superfície de autorização separada, não redesenhada).
extensions  — extensões Postgres instaladas pelo Supabase, não tocado.
vault       — Supabase Vault, não tocado.

Nenhum desses schemas é redefinido, migrado ou referenciado como destino de tabela de negócio da
apps/api-v2 — o schema `app` é adicional e paralelo a eles, nunca um substituto.
```

---

## Drizzle — estratégia de namespace (conceitual, não implementada)

```text
DRIZZLE_NAMESPACE_STRATEGY_DEFINED:
SIM

Mecanismo: pgSchema("app") do drizzle-orm/pg-core — já a forma canônica e estável da versão aprovada
(drizzle-orm 0.45.2, doc65) para declarar tabelas fora do schema `public` implícito. Cada arquivo de
schema futuro (src/database/schema/<domain>.schema.ts, doc48) declarará suas tabelas via
`appSchema.table(...)` (onde `appSchema = pgSchema("app")`, definido uma única vez e reexportado — não
uma instância nova por arquivo), nunca via `pgTable(...)` solto (que implicitamente resolveria para
`public`).

Isso NÃO é implementado nesta etapa (proibido pelo prompt) — apenas o mecanismo é registrado como a via
já aprovada para quando o schema Drizzle for de fato escrito (retomada do PROMPT 83).
```

---

## Migration (conceitual, não executada)

```text
A primeira migration v2 (quando retomada) deverá criar o schema explicitamente ANTES de qualquer objeto
dependente:

CREATE SCHEMA IF NOT EXISTS app;

seguido das tabelas app.users / app.tenants / app.tenant_memberships e seus constraints/índices/policies.
Esta instrução é registrada aqui como requisito para a migration futura — nenhuma migration foi criada,
gerada ou executada nesta etapa.
```

---

## RLS

```text
RLS_REQUIRED_ON_TENANT_SCOPED_TABLES:
SIM

Residir em um schema privado (`app`, não `public`) NÃO dispensa RLS nas tabelas tenant-scoped — os dois
mecanismos protegem contra ameaças diferentes: o schema privado reduz superfície de EXPOSIÇÃO (ex.: via
Data API/PostgREST, ver seção abaixo); RLS protege contra QUERY incorreta/vazamento cross-tenant dentro
do próprio caminho de acesso da aplicação (doc49: "camada ADICIONAL de isolamento — defesa em
profundidade contra um bug de aplicação"). Nenhum dos dois substitui:

- auth (validação JWT via JWKS, doc49) — continua sendo o primeiro portão, sem alteração.
- tenant membership validation (TenantGuard resolvendo tenantId a partir do JWT + membership ativa,
  doc49) — continua sendo o controle PRIMÁRIO e OBRIGATÓRIO, não substituível por RLS.
- authorization da aplicação (PermissionGuard/Use Case, doc47/49) — continua decidindo autorização fina,
  independentemente de schema ou RLS.

O mecanismo concreto de RLS (SET LOCAL app.current_tenant_id/app.current_org_id/app.current_role via
set_config, doc45/47/49/51) não muda por causa do schema — os mesmos session vars funcionam
identicamente dentro de policies declaradas sobre tabelas de `app.*`.
```

---

## Data API (Supabase/PostgREST)

```text
SUPABASE_DATA_API_DIRECT_ACCESS_REQUIRED_FOR_APP_SCHEMA:
NÃO

O frontend (apps/web) NÃO deve acessar diretamente tabelas internas de `app.*` via REST/Data API do
Supabase (PostgREST) — todo acesso funcional a dado de negócio da apps/api-v2 ocorre exclusivamente
através dos endpoints HTTP da própria apps/api-v2 (contrato canônico, doc37, não reaberto). Um schema
dedicado e não exposto ao Data API é justamente o mecanismo que torna essa regra estruturalmente mais
difícil de violar por engano (nenhuma tabela de negócio da v2 aparece na superfície REST autoexposta do
Supabase a menos que alguém decida deliberadamente expor o schema `app` na configuração do projeto —
decisão que este documento explicitamente NÃO autoriza).
```

---

## Legacy (`public`, não alterado)

```text
Nenhum objeto atualmente em `public` (apps/api legacy, baseline "157 public tables") é movido, renomeado,
migrado ou alterado por esta decisão. O legacy permanece intacto e operando normalmente em `public` até o
cutover — este documento define apenas o destino das tabelas NOVAS da apps/api-v2, nunca uma migração do
que já existe.

LEGACY_PUBLIC_SCHEMA_CHANGED:
NÃO
```

---

## Validação (respostas objetivas exigidas pelo prompt)

```text
Tabelas de negócio da apps/api-v2 ficam em public?
NÃO

Schema app é privado/dedicado?
SIM

RLS continua exigida mesmo em schema privado?
SIM

Frontend pode acessar app.* via Data API diretamente?
NÃO

Schemas gerenciados pelo Supabase (auth/storage/realtime/extensions/vault) foram alterados?
NÃO

Objetos legacy em public foram movidos ou alterados?
NÃO
```

---

## Resumo

```text
UNRESOLVED_NAMESPACE_DECISIONS:
0
```

## Cobertura

Namespace PostgreSQL da apps/api-v2 definido explicitamente (`app`, privado, dedicado), resolvendo o
bloqueio registrado no PROMPT 83. Motivo registrado com 6 objetivos concretos (exposição acidental,
separação do legacy, ownership, grants, RLS como defesa adicional, colisão de nomes). Schemas gerenciados
pelo Supabase (auth/storage/realtime/extensions/vault) confirmados não alterados. Estratégia Drizzle
(`pgSchema("app")`) registrada conceitualmente, não implementada. Requisito de `CREATE SCHEMA IF NOT
EXISTS app;` como primeira instrução da migration futura, registrado, não executado. RLS reafirmada como
obrigatória em tabelas tenant-scoped independentemente do schema, sem substituir auth/tenant
membership/authorization da aplicação. Acesso direto ao Data API para `app.*` explicitamente não
autorizado. Legacy (`public`) confirmado intacto. Nenhum schema PostgreSQL, migration, tabela ou Drizzle
schema foi criado/alterado nesta etapa. Supabase remoto não foi alterado. `apps/web` e `apps/api`
(legacy) não foram alterados. Git não foi modificado. Nenhum documento anterior foi modificado.
