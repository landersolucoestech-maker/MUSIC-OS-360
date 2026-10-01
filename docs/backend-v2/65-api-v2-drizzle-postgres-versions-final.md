> Historical record. Kept as recorded; not the current contract.

# 65 — Versões Exatas de Drizzle e Driver PostgreSQL da `apps/api-v2`

Definição read-only das versões exatas e do driver PostgreSQL da camada de persistência já decidida (Drizzle ORM, doc45/58, não reaberta), com verificação em fontes oficiais/primárias atuais. Deployment (long-running container, doc61) e a escolha Drizzle-vs-TypeORM (doc58) não reabertos. Nenhuma dependência foi instalada, nenhum `package.json`/`pnpm-lock.yaml` foi alterado, nenhum schema/migration foi criado. `apps/api-v2` não foi criado. `apps/web`, `apps/api` (legacy), banco e Supabase não foram alterados.

## Decisões já fechadas (contexto, não reabertas)

```text
Node.js 24 | TypeScript 6.0.3 | NestJS 11.1.28 | Express 5.2.1 | Zod 4.4.3
Database: PostgreSQL 17 hospedado no Supabase | Database access: Drizzle ORM | TypeORM na API v2: NÃO
SQL manual controlado: SIM | Deployment: long-running container
```

---

## 1 — Drizzle ORM

```text
Fonte: registry.npmjs.org/drizzle-orm (consultado nesta etapa)

DRIZZLE_ORM_VERSION:
0.45.2

Compatibilidade:
- Node.js 24: SIM — Drizzle é uma biblioteca TypeScript/JS pura sobre o driver escolhido (seção 2),
  sem piso de Node.js próprio mais restritivo que o do próprio driver.
- TypeScript 6.0.3: SIM — Drizzle não depende de decorators/reflect-metadata (mesma vantagem já
  registrada no doc58 em relação ao TypeORM) e seu sistema de inferência de tipos opera sobre recursos
  estáveis da linguagem TypeScript, sem exigência de uma versão mínima acima da já selecionada.
- PostgreSQL 17: SIM — Drizzle não implementa protocolo de rede próprio; a compatibilidade com a
  versão do servidor Postgres depende do driver subjacente (seção 2), que é wire-protocol-compatible
  de forma retroativa.
- NestJS 11: SIM — integração via provider customizado (doc47/48, não reaberto), sem exigência de
  versão de NestJS específica além de ser NestJS em si.
```

---

## 2 — Driver PostgreSQL

```text
Fontes: registry.npmjs.org/pg, registry.npmjs.org/postgres (consultadas nesta etapa)

OPÇÃO A — pg (node-postgres)
- Versão latest: 8.22.0 | engines: Node.js >= 16.0.0 (bem abaixo do piso de Node 24 já fixado, doc60)
- Connection pooling: classe Pool nativa e embutida no próprio pacote (import { Pool } from 'pg') —
  madura, documentada, comportamento bem conhecido.
- Transactions: suporte direto via client.query('BEGIN'/'COMMIT'/'ROLLBACK') — é EXATAMENTE o mecanismo
  que já fundamenta o padrão RLS/SET LOCAL já provado neste projeto (doc45: o QueryRunner do TypeORM
  usa pg por baixo para implementar esse padrão em produção) — não é uma escolha teórica, é o driver
  cujo comportamento de transação já foi empiricamente validado para este caso de uso específico
  (RLS por sessão transacional), independentemente de qual ORM está por cima.
- Prepared statements: suportados nativamente, sem ressalva.
- PostgreSQL 17: compatível (protocolo wire retrocompatível).
- Shutdown: pool.end() documentado e bem estabelecido para drenar conexões de forma limpa —
  encaixe direto com o graceful shutdown já exigido pelo modelo long-running (doc61).
- Observabilidade: eventos do Pool (connect/acquire/remove/error) expõem hooks claros para
  instrumentação (doc52, não reaberto).
- Estabilidade: driver Postgres para Node.js mais antigo e com o maior histórico de produção entre as
  opções avaliadas.
- Integração com Drizzle: drizzle-orm/node-postgres é um dos adaptadores Postgres mais maduros e
  centrais da própria documentação do Drizzle.
- TypeScript: sem tipos embutidos — depende de pacote de tipos separado (seção 10).
- Execução em container: encaixe direto — Pool criado uma vez no boot do processo long-running
  (doc61, DATABASE_CONNECTION_MODEL já fixado), sem nenhuma característica do driver pensada para
  lifecycle efêmero.
- Supabase PostgreSQL: totalmente compatível — é o driver já usado hoje neste projeto para acessar o
  mesmo banco gerenciado pelo Supabase (doc42/54/57), incluindo o padrão RLS já validado.

OPÇÃO B — postgres.js
- Versão latest: 3.4.9 | engines: Node.js >= 12
- Connection pooling: pooling embutido também, com filosofia de API diferente (tagged template
  literals para SQL, alinhado ao estilo do próprio helper `sql` do Drizzle).
- Transactions: suportado nativamente via sql.begin(), API própria distinta de BEGIN/COMMIT manual.
- Prepared statements: suportados, mas com particularidades documentadas de interação com poolers
  externos (relevante especialmente em modo pooler transaction-mode — menos relevante aqui já que o
  modelo escolhido é long-running com pool próprio de aplicação, doc61).
- PostgreSQL 17: compatível.
- Shutdown/observabilidade/TypeScript: comparáveis a A, com tipos TypeScript já embutidos no próprio
  pacote (vantagem pontual sobre A neste item específico).
- Integração com Drizzle: drizzle-orm/postgres-js também é um adaptador oficial e maduro.
- Estabilidade: histórico de produção real, porém mais recente e com volume de adoção/tempo de mercado
  menor que pg — sem nenhum problema documentado grave, mas sem o mesmo lastro específico deste
  projeto (nunca usado neste repositório em nenhuma capacidade, nem mesmo indiretamente).
```

---

## 3 — Decisão do driver

```text
SELECTED_DRIVER:
PG

SELECTED_DRIVER_PACKAGE:
pg

SELECTED_DRIVER_VERSION:
8.22.0
```

Justificativa: entre os critérios pedidos, o único com evidência concreta e específica deste projeto
(não apenas comparação genérica de mercado) é a compatibilidade já comprovada de `pg` com o padrão de
transação SET LOCAL para RLS (doc45) — o mesmo driver, no mesmo tipo de uso (transação explícita +
`SET LOCAL` + query subsequente na mesma conexão), já roda em produção neste projeto por baixo do
TypeORM legacy. Isso não é "escolher pg porque o legacy usa TypeORM" (regra já respeitada — TypeORM em
si não é reaproveitado, doc58) — é reconhecer que o comportamento do PRÓPRIO DRIVER de rede/transação
já foi empiricamente validado para exatamente o padrão que a apps/api-v2 precisa reproduzir (doc45/47/
51/61). postgres.js é uma alternativa oficialmente suportada e tecnicamente viável, sem nenhuma
desvantagem que a desqualifique — mas não supera a vantagem concreta e específica de `pg` neste
critério, e nenhum requisito desta etapa (long-running container, não serverless) favorece
estruturalmente B sobre A. Não foi escolhido "por ser o driver mais popular" nem "por integração com
Supabase" (regra explícita do prompt) — foi escolhido pelo comportamento de transação já validado
neste projeto especificamente.

---

## 4 — Pooling

```text
APPLICATION_POOL:
SIM

POOL_IMPLEMENTATION:
pg.Pool (classe de pool nativa do próprio pacote "pg", import { Pool } from 'pg')

POOL_OWNED_BY_APPLICATION:
SIM — o processo long-running (container, doc61) cria e possui o Pool uma vez no boot, reutilizado
  por toda a vida do processo, fechado de forma limpa no graceful shutdown (pool.end()) — mesmo modelo
  conceitual já fixado no doc61 (DATABASE_CONNECTION_MODEL), agora confirmado com o mecanismo concreto
  do driver selecionado.

Nenhum valor de tamanho de pool é configurado nesta etapa (proibido implicitamente — "não configurar
valores de pool ainda", instrução explícita do prompt).
```

---

## 5 — Supabase Connection Modes

```text
RUNTIME_CONNECTION_MODE:
Pool de aplicação (pg.Pool) — opcionalmente atrás do pooler gerenciado do Supabase (Supavisor) em modo
  SESSION, não modo "transaction" — mesma decisão conceitual já fixada no doc61 (seção Database
  Connections), aqui apenas confirmada como compatível com o driver `pg` selecionado (Pool de pg
  conecta-se normalmente a um endpoint em modo session sem nenhuma particularidade adicional).

MIGRATION_CONNECTION_MODE:
DIRECT

(reafirmado verbatim, não reaberto — conexão direta/sem pooler, exclusiva da ferramenta de migration,
doc46, nunca usada pelo processo da aplicação em runtime)

Nenhuma connection string real foi incluída nesta etapa.
```

---

## 6 — Drizzle Kit

```text
Fonte: registry.npmjs.org/drizzle-kit (consultado nesta etapa)

DRIZZLE_KIT_VERSION:
0.31.10

Compatibilidade com drizzle-orm 0.45.2: mesma linha de desenvolvimento do ecossistema Drizzle,
publicada para uso conjunto (drizzle-kit é a ferramenta de CLI/migration companion do drizzle-orm,
mantida pelo mesmo projeto) — sem incompatibilidade identificada nesta consulta.
```

---

## 7 — Migrations (reafirmado, não reaberto)

```text
DRIZZLE_KIT_FOR_SCHEMA_MIGRATIONS:
SIM

MANUAL_SQL_FOR_RLS_AND_POSTGRES_SPECIFIC_FEATURES:
SIM

(estratégia híbrida já aprovada no doc46 — Drizzle Kit + SQL manual controlado — não reavaliada aqui,
apenas confirmada compatível com as versões exatas agora fechadas)
```

---

## 8 — SQL direto — esclarecimento de nomenclatura

```text
O driver selecionado (pg) sendo tecnicamente capaz de executar SQL cru NÃO significa uma segunda
camada de persistência concorrendo com Drizzle — a regra é:

DRIZZLE: acesso normal aos dados (toda query de domínio, via query builder/schema do Drizzle).

RAW SQL: somente quando necessário para recursos PostgreSQL que não devam ser abstraídos — o caso já
  identificado e aprovado é o primitivo de sessão RLS (SET LOCAL app.current_tenant_id/org_id/role,
  doc45/47/51), executado via o helper `sql` do próprio Drizzle (não pg cru fora do Drizzle) dentro do
  mesmo Transaction Context já definido no doc51 — nunca como uma via paralela e não controlada de
  acesso a dado.

RAW_SQL_ALLOWED:
SIM

RAW_SQL_ARBITRARY_CRUD_ALLOWED:
NÃO
```

---

## 9 — TypeORM

```text
TYPEORM_PACKAGE_IN_API_V2:
NÃO

NEST_TYPEORM_PACKAGE_IN_API_V2:
NÃO

(confirmado definitivamente — doc58 já decidiu isso, doc45/58 não reabertos; nenhum dos 2 pacotes
("typeorm", "@nestjs/typeorm") faz parte da stack da apps/api-v2 em nenhuma capacidade)
```

---

## 10 — Types

```text
O driver selecionado (pg) não embute tipos TypeScript próprios — requer pacote de tipos separado:

@types/pg — versão latest confirmada nesta etapa: 8.21.0 (registry.npmjs.org)

(postgres.js, a alternativa não selecionada, embute tipos próprios e não precisaria deste pacote
separado — ponto já registrado na comparação da seção 2, não decisivo o suficiente para reverter a
escolha do driver)
```

---

## 11 — Decisão final da camada

```text
API V2 — POSTGRESQL STACK

PostgreSQL:
17

ORM/query layer:
drizzle-orm 0.45.2

PostgreSQL driver:
pg 8.22.0 (+ @types/pg 8.21.0)

Migration tooling:
drizzle-kit 0.31.10

Manual SQL:
permitido de forma controlada (primitivo de sessão RLS via helper `sql` do Drizzle, dentro do
Transaction Context já aprovado — nunca CRUD arbitrário fora do Drizzle)

TypeORM:
não utilizado
```

---

## Resumo

```text
UNRESOLVED_DATABASE_PACKAGE_DECISIONS:
0
```

## Cobertura

Versões exatas de drizzle-orm (0.45.2), drizzle-kit (0.31.10), driver PostgreSQL selecionado (pg
8.22.0, com @types/pg 8.21.0) e a alternativa postgres.js (3.4.9) comparadas nos 11 critérios pedidos,
com decisão justificada por evidência concreta e específica deste projeto (comportamento de transação
`SET LOCAL` já validado com `pg` em produção, doc45), não por popularidade genérica nem por integração
com Supabase (regra explícita do prompt). Pooling, modos de conexão runtime/migration (reafirmando
DIRECT para migration, não reaberto), estratégia de migration (Drizzle Kit + SQL manual, não reaberta),
nomenclatura SQL direto vs. CRUD arbitrário, e confirmação definitiva de que TypeORM/@nestjs/typeorm não
fazem parte da apps/api-v2 — todos definidos. Nenhuma dependência foi instalada, nenhum `package.json`/
`pnpm-lock.yaml` foi alterado, nenhum schema/migration foi criado. `apps/api-v2` não foi criado.
`apps/web`, `apps/api` (legacy), banco e Supabase não foram alterados. A escolha Drizzle e o deployment
não foram reavaliados. Nenhum documento anterior foi modificado.
