> Historical record. Kept as recorded; not the current contract.

# 45 — Decisão da Camada de Acesso ao PostgreSQL da `apps/api-v2`

Decisão read-only baseada nas restrições reais registradas em [`42-api-v2-technical-constraints.md`](./42-api-v2-technical-constraints.md), [`43-api-v2-http-framework-decision.md`](./43-api-v2-http-framework-decision.md) e [`44-api-v2-http-framework-final-resolution.md`](./44-api-v2-http-framework-final-resolution.md). Framework (NestJS/platform-express) e validação padrão (class-validator/class-transformer) permanecem fixos, não reabertos. Nenhum banco/schema/migration/repository foi criado. Nenhum código foi escrito. `apps/api-v2` não foi criado. Nenhuma dependência foi instalada. Nenhum `package.json` foi alterado. `apps/web` e `apps/api` (legacy) não foram alterados.

## Contexto já aprovado (não reaberto)

```text
Framework: NestJS (platform-express)
Validação padrão: class-validator + class-transformer
Banco: PostgreSQL
Multi-tenancy: obrigatório desde o início
```

## Evidência estrutural decisiva encontrada durante a investigação

O mecanismo de isolamento multi-tenant já em produção na `apps/api` legacy não é apenas RLS no banco — é um padrão específico de **sessão transacional com variáveis Postgres locais à transação**, encontrado em `apps/api/src/database/database-context.service.ts`:

```text
- runInTenantContext() abre uma transação dedicada (QueryRunner.startTransaction())
- executa 3x SELECT set_config('app.current_tenant_id'|'app.current_org_id'|'app.current_role', $1, true)
  — o terceiro argumento `true` = SET LOCAL (escopo de transação, nunca vaza entre requisições
  numa conexão pooled)
- todas as queries do "work" subsequente PRECISAM rodar dentro dessa mesma transação/conexão
  para que o RLS do Postgres enxergue o contexto de tenant
- comentário do próprio arquivo: este é um primitivo OPT-IN, "intentionally NOT done globally...
  to avoid an uncontrolled refactor of 130+ repository call sites" — ou seja, o legacy reconhece
  que sua própria camada de acesso (TypeORM, Active-Record-like via Repository) tornou caro aplicar
  esse padrão de forma sistemática desde o início.
```

Esta é a restrição mais importante para a decisão: qualquer tecnologia escolhida precisa dar **controle explícito e direto sobre transação + SQL cru (raw)**, porque o mecanismo de RLS deste projeto depende de rodar `set_config(...)` na mesma transação/conexão de cada query subsequente — não é algo que uma abstração de alto nível esconda com segurança; precisa ser visível e fácil de garantir em todo endpoint desde o primeiro dia (diferente do legacy, que retrofitou isso como opt-in).

Também encontrada evidência de que **Drizzle já foi parcialmente usado neste repositório e descontinuado** — mas escopado estritamente à ferramenta de migration, não ao query builder: `apps/api/drizzle/_DEPRECATED.md` confirma que `drizzle-kit generate` foi usado "durante uma fase anterior do projeto antes do sistema de migration ser padronizado em TypeORM"; a instrução é não usar essas snapshots como base de novo schema e não rodar `drizzle-kit push/migrate`. Nada nesse arquivo relata problema técnico com o Drizzle ORM como camada de query — a descontinuação foi de **consolidação em um único executor de migration**, uma decisão de migration tool, explicitamente fora do escopo deste prompt. Esta análise não deixa essa decisão histórica, escopada a migrations, influenciar a avaliação da camada de query — registrada apenas por transparência (regra de nunca omitir evidência encontrada).

---

## Opções avaliadas

```text
OPTION:
TypeORM

ALREADY_PRESENT_IN_REPO:
SIM — dependency direta de apps/api/package.json ("typeorm": "^0.3.31", "@nestjs/typeorm": "^10.0.2"); é a camada de acesso da apps/api legacy hoje, incluindo o próprio mecanismo de session-context descrito acima.

COMPATIBLE_WITH_NESTJS:
SIM — é a integração oficialmente mantida pelo time do NestJS (@nestjs/typeorm), com o maior nível de integração "out of the box" entre as 4 opções.

POSTGRES_SUPPORT:
SIM (driver "pg" por baixo).

TRANSACTION_SUPPORT:
Forte — QueryRunner.startTransaction()/commitTransaction()/rollbackTransaction() dá controle explícito, já comprovado em produção pelo padrão SET LOCAL do database-context.service.ts.

COMPOSITE_CONSTRAINT_SUPPORT:
Suportado via decorators (@Unique(['col1','col2']) em nível de Entity) ou via SQL cru nas migrations — o legacy já usa ambos os caminhos (constraints compostas confirmadas em várias migrations, ex.: 20260610000002_CreateRolesAndRolePermissions.ts "UNIQUE (role_id, permission_id)").

COMPOSITE_INDEX_SUPPORT:
Suportado via @Index(['col1','col2']) em nível de Entity, ou SQL cru.

RAW_SQL_SUPPORT:
Forte — queryRunner.query()/manager.query() com parâmetros posicionais, já é o mecanismo usado para o SET LOCAL do RLS.

RLS_COMPATIBILITY:
Comprovada — é o padrão exato já em produção neste projeto para RLS via sessão transacional (database-context.service.ts). Porém o próprio código admite que aplicá-lo de forma consistente por cima do padrão Repository/Active-Record do TypeORM foi caro o suficiente para ficar OPT-IN em 130+ call sites, em vez de ser a via padrão desde o início.

MULTI_TENANT_QUERY_CONTROL:
Média — depende inteiramente de cada service usar corretamente `runInTenantContext()`/o EntityManager contextualizado; nada no padrão Repository do TypeORM torna isso obrigatório ou visível no tipo — omitir o wrapper é um erro silencioso de isolamento.

TYPE_SAFETY:
Média — entities tipadas via decorators, mas queries com QueryBuilder e `.query()` raw retornam `any` sem tipagem adicional manual.

TESTABILITY:
Forte — @nestjs/testing + TypeORM já comprovado em dezenas de spec.ts reais no legacy (incl. testes que replicam a ValidationPipe global e rodam contra dados reais).

SERVERLESS_COMPATIBILITY:
Comprovada neste repositório especificamente — é a camada de acesso já usada pelo mesmo código que roda hoje tanto em Docker/long-running quanto na function serverless da Vercel (doc42/doc43).

MIGRATION_COUPLING:
Média-alta — TypeORM inclui seu próprio sistema de migrations (já é, de fato, o "sole migration executor" do legacy, conforme comentário em database.module.ts); escolher TypeORM como camada de query cria uma tendência natural (não uma obrigação técnica) a também usar seu migration tool, ainda que uma decisão de migration tool separada permaneça tecnicamente possível.

NEW_DEPENDENCIES_REQUIRED:
- typeorm, @nestjs/typeorm, pg (nenhuma delas desconhecida do monorepo — já usadas pela apps/api legacy, mas ainda assim novas entradas próprias no package.json da apps/api-v2, que não existe ainda)

RISKS:
- O padrão Repository/Active-Record típico do TypeORM tende a esconder qual conexão/transação uma query usa — exatamente o tipo de abstração que, segundo o comentário do próprio legacy, tornou caro garantir SET LOCAL de forma sistemática (daí o padrão ter ficado opt-in em vez de universal).
- Reflect-metadata + decorators adicionam overhead de boot, jรก mitigado mas não eliminado no ambiente serverless (mesmo risco já registrado no doc43 para o framework).
```

```text
OPTION:
Prisma

ALREADY_PRESENT_IN_REPO:
NÃO — nenhuma ocorrência de "prisma" encontrada em nenhum package.json de apps/* ou packages/* deste repositório.

COMPATIBLE_WITH_NESTJS:
SIM — padrão de integração bem documentado (PrismaService injetável via DI), amplamente usado na comunidade Nest.

POSTGRES_SUPPORT:
SIM.

TRANSACTION_SUPPORT:
Forte — `$transaction(async (tx) => {...})` (transação interativa) permite executar SQL cru e queries tipadas na mesma transação.

COMPOSITE_CONSTRAINT_SUPPORT:
Suportado — `@@unique([col1, col2])` no schema.prisma.

COMPOSITE_INDEX_SUPPORT:
Suportado — `@@index([col1, col2])` no schema.prisma.

RAW_SQL_SUPPORT:
Suportado via `$queryRaw`/`$executeRaw` (template tag parametrizado, seguro contra injection) — inclusive dentro de `$transaction`, permitindo replicar o padrão SET LOCAL do legacy.

RLS_COMPATIBILITY:
Viável tecnicamente (mesmo padrão SET LOCAL dentro de `$transaction` + `$executeRaw`), mas SEM nenhum precedente comprovado neste repositório — precisaria ser desenhado do zero, ao contrário do TypeORM.

MULTI_TENANT_QUERY_CONTROL:
Média — mesma limitação estrutural do TypeORM: nada no Prisma Client obriga uma query a passar pelo wrapper de contexto de tenant; é convenção de time, não garantia de tipo.

TYPE_SAFETY:
Forte — tipos gerados automaticamente a partir do schema.prisma via `prisma generate`, incluindo tipos de resultado de queries relacionais complexas.

TESTABILITY:
Forte — amplamente documentado, testável com um Postgres real ou com mocking do PrismaClient; sem precedente local, mas sem fricção técnica conhecida.

SERVERLESS_COMPATIBILITY:
Ressalva real e documentada pelo próprio ecossistema Prisma: o "query engine" nativo (binário) historicamente aumenta o tamanho do bundle e o cold start em funções serverless; a Vercel function já em produção neste repositório (apps/api/api/index.ts, doc42) tem `maxDuration: 30` configurado — não há evidência de que esse valor seria insuficiente, mas o overhead de cold start do engine binário é um risco concreto e conhecido, não hipotético, para esse alvo de deployment específico.

MIGRATION_COUPLING:
Alta — o fluxo idiomático do Prisma (`schema.prisma` → `prisma migrate dev/deploy`) trata o schema Prisma como fonte da verdade; é possível desacoplar via `prisma db pull` (introspecção de um banco cujo schema é gerido por outra ferramenta) + `prisma generate`, mas isso é um fluxo alternativo que teria que ser adotado deliberadamente, não o caminho padrão da ferramenta.

NEW_DEPENDENCIES_REQUIRED:
- prisma (CLI/dev), @prisma/client — nenhuma delas presente hoje em nenhum package.json do repositório.

RISKS:
- Nenhum precedente local — todo o padrão de RLS via SET LOCAL precisaria ser reconstruído e validado do zero especificamente para Prisma.
- Acoplamento de migration mais alto entre as 4 opções, criando fricção específica com a instrução deste prompt de não decidir a migration strategy ainda (embora o desacoplamento via introspecção seja tecnicamente possível).
- Overhead de cold-start do query engine binário é um risco concreto e bem documentado no ecossistema para o alvo de deployment serverless real deste projeto.
```

```text
OPTION:
Drizzle ORM

ALREADY_PRESENT_IN_REPO:
PARCIAL — não como dependency ativa de nenhum app hoje, mas o repositório já contém um artefato histórico real: apps/api/drizzle/ (schema/snapshots gerados por drizzle-kit numa fase anterior do projeto, hoje arquivados e explicitamente marcados como não-executáveis — ver _DEPRECATED.md, seção acima). Isso é evidência de familiaridade prévia da equipe com a ferramenta, não de uso ativo atual.

COMPATIBLE_WITH_NESTJS:
SIM — não tem integração oficial do time Nest, mas se integra via um provider/module customizado simples (padrão equivalente ao DATA_SOURCE token já usado pelo TypeORM no legacy, doc: database.tokens); é apenas uma instância de client injetada via DI, sem fricção estrutural com o padrão de Modules do Nest.

POSTGRES_SUPPORT:
SIM (via driver node-postgres "pg" ou postgres.js, ambos suportados nativamente pelo Drizzle).

TRANSACTION_SUPPORT:
Forte — `db.transaction(async (tx) => {...})` mapeia diretamente para uma transação real do driver subjacente (pg/postgres.js), com o mesmo nível de controle explícito que o QueryRunner do TypeORM.

COMPOSITE_CONSTRAINT_SUPPORT:
Suportado — `pgTable(..., (table) => ({ uq: unique().on(table.col1, table.col2) }))` no schema TypeScript.

COMPOSITE_INDEX_SUPPORT:
Suportado — `index().on(table.col1, table.col2)` no schema TypeScript.

RAW_SQL_SUPPORT:
Forte — o helper `sql` (template tag parametrizado) é tratado como cidadão de primeira classe do próprio design da biblioteca, não uma via de escape secundária; executar `SELECT set_config(...)` dentro de `db.transaction()` é direto e idiomático.

RLS_COMPATIBILITY:
Viável e de baixo atrito — o mesmo padrão SET LOCAL do legacy é portável quase 1:1: abrir `db.transaction()`, rodar `sql\`select set_config(...)\`` como primeira instrução, e todas as queries seguintes dentro do mesmo callback já usam a conexão/transação certa por construção (o parâmetro `tx` do callback É a conexão contextualizada — não existe um "manager global" alternativo para escapar do contexto por engano, ao contrário do padrão Repository do TypeORM).

MULTI_TENANT_QUERY_CONTROL:
Forte — como toda query dentro de `db.transaction()` precisa necessariamente usar o parâmetro `tx` recebido no callback (não há um objeto `db` global "por engano" acessível dentro do mesmo escopo que ignore o contexto), a estrutura da API reduz — não apenas por convenção, mas por forma de uso — o risco que o próprio legacy identificou como motivo de manter seu padrão de RLS como opt-in.

TYPE_SAFETY:
Forte — tipos inferidos diretamente do schema TypeScript (`pgTable(...)`), sem etapa de geração de código separada (diferente do `prisma generate`) — o schema TS já É o tipo.

TESTABILITY:
Forte — client aponta para qualquer Postgres real (inclusive o Postgres local já provisionado via docker-compose.yml deste repositório); consultas são funções simples, testáveis com Jest sem infraestrutura adicional.

SERVERLESS_COMPATIBILITY:
Forte — biblioteca fina, sem binário de engine nativo e sem reflect-metadata; menor overhead de boot entre as 3 opções de ORM avaliadas, favorável ao cold start da function Vercel já em produção (doc42).

MIGRATION_COUPLING:
Baixa — drizzle-kit (a ferramenta de migration do ecossistema Drizzle) é um pacote opcional e separado do query builder; é tecnicamente possível usar o Drizzle Client inteiramente sem drizzle-kit, com o schema/DDL gerido por qualquer outra ferramenta — a mais desacoplada das 3 opções de ORM frente à instrução deste prompt de não decidir a migration strategy ainda. (Nota de transparência: é exatamente o drizzle-kit, não o Drizzle Client, que este repositório já tentou e descontinuou — ver seção de evidência acima; a decisão de migration tool permanece inteiramente em aberto para um prompt futuro.)

NEW_DEPENDENCIES_REQUIRED:
- drizzle-orm, pg (driver — mesmo driver já usado pela apps/api legacy)

RISKS:
- Ecossistema mais novo que TypeORM/Prisma; menor volume de exemplos/integrações de terceiros prontas para NestJS especificamente (mitigado pela integração ser estruturalmente simples).
- Existe um artefato arquivado no próprio repositório (apps/api/drizzle/) associado à marca "Drizzle" e a uma decisão explícita de descontinuação — risco de confusão/percepção para quem só ler o nome da pasta sem ler o _DEPRECATED.md, mesmo a descontinuação sendo estritamente sobre a ferramenta de migration, não sobre o query builder.
```

```text
OPTION:
node-postgres (pg) — driver cru, sem query builder/ORM

ALREADY_PRESENT_IN_REPO:
SIM — "pg": "^8.20.0" já é dependency direta de apps/api/package.json (usado por baixo do TypeORM, e também disponível para uso direto).

COMPATIBLE_WITH_NESTJS:
SIM — qualquer client pode ser exposto como provider injetável via DI, sem fricção.

POSTGRES_SUPPORT:
SIM — é o driver oficial do node-postgres, a base sobre a qual TypeORM/Drizzle/Prisma constroem seu suporte a Postgres.

TRANSACTION_SUPPORT:
Forte — client.query('BEGIN')/'COMMIT'/'ROLLBACK' com controle total; é literalmente o mecanismo que o QueryRunner do TypeORM usa por baixo para implementar o padrão SET LOCAL já em produção.

COMPOSITE_CONSTRAINT_SUPPORT:
Suportado apenas como SQL cru — nenhuma representação em TypeScript; constraints existem só no banco, sem espelho tipado no código.

COMPOSITE_INDEX_SUPPORT:
Idem — apenas SQL cru, sem representação tipada.

RAW_SQL_SUPPORT:
Máximo possível — é a própria definição da ferramenta.

RLS_COMPATIBILITY:
Máxima em termos de capacidade técnica (é a camada mais próxima do banco), mas TODA a responsabilidade de garantir que cada query rode na conexão/transação certa recai inteiramente sobre disciplina manual do time, sem nenhuma estrutura de linguagem/tipo que ajude — o maior risco entre as 4 opções para exatamente o problema que o comentário do legacy já identificou como caro de garantir de forma consistente.

MULTI_TENANT_QUERY_CONTROL:
Fraca — nenhuma ajuda estrutural; o mesmo risco identificado para o Express puro no doc43 (ausência de mecanismo declarativo) se repete aqui para queries: nada impede uma query de "esquecer" de usar o client transacional certo.

TYPE_SAFETY:
Fraca — `client.query()` retorna `any`/genérico sem tipagem de schema; exigiria escrever manualmente uma interface de retorno para cada uma das 250 queries.

TESTABILITY:
Forte — simples de testar contra um Postgres real, sem camada de abstração no caminho.

SERVERLESS_COMPATIBILITY:
Forte — menor footprint possível entre todas as opções (é a própria base sobre a qual as outras são construídas).

MIGRATION_COUPLING:
Nenhuma — não tem nenhum sistema de migration próprio, portanto nenhum acoplamento.

NEW_DEPENDENCIES_REQUIRED:
- pg (já usada indiretamente pelo TypeORM no legacy; nova entrada direta própria da apps/api-v2)

RISKS:
- Para 250 endpoints/35 domínios, escrever e manter SQL cru manualmente sem nenhuma ferramenta de tipagem/composição eleva significativamente o risco de inconsistência entre domínios (exatamente o mesmo tipo de risco já registrado no doc43 para Express puro, mas agora aplicado à camada de dados em vez de HTTP) — cada query precisaria reimplementar manualmente tipagem de retorno, o que 35 domínios diferentes tendem a fazer de formas diferentes sem uma convenção imposta pela ferramenta.
- Nenhuma abstração de composição de queries (joins, filtros dinâmicos) — sujeito a concatenação manual de SQL, risco real de erro humano em escala.
```

---

## Decisão

```text
SELECTED_DATABASE_ACCESS_LAYER:
Drizzle ORM

RATIONALE:
A restrição mais concreta encontrada nesta investigação não veio de nenhum dos 4 frameworks em abstrato, mas do próprio mecanismo de RLS já em produção no legacy (database-context.service.ts): isolamento multi-tenant depende de rodar `set_config('app.current_tenant_id', ..., true)` na MESMA transação/conexão de toda query subsequente, e o próprio código do legacy documenta que isso foi caro de garantir de forma sistemática por cima do padrão Repository/Active-Record do TypeORM — motivo pelo qual ficou opt-in em 130+ call sites em vez de universal desde o início. Como este prompt exige multi-tenancy obrigatório DESDE O INÍCIO (não como retrofit), o critério decisivo passa a ser: qual camada torna estruturalmente mais difícil uma query "escapar" do contexto de tenant por engano?

Drizzle vence neste critério específico: dentro de `db.transaction(async (tx) => {...})`, o parâmetro `tx` recebido no callback é a única via de acesso ao banco disponível naquele escopo — não existe, como no TypeORM, um manager/repository global paralelo que um desenvolvedor apressado possa usar por engano e pular o contexto de tenant. Isso não é apenas "mais uma opção com transação" — é a mesma capacidade que Prisma e pg puro também têm em teoria (`$transaction`/`BEGIN`), mas com o menor atrito prático: raw SQL (`sql` tag) é cidadão de primeira classe (ao contrário de pg puro, que teria toda a tipagem construída manualmente para as 250 queries), e não há overhead de engine binário nem reflect-metadata (ao contrário do Prisma e do TypeORM, respectivamente) — o que também favorece o cold start da function Vercel serverless já comprovada em produção neste repositório (doc42/43).

Sobre migration coupling: o Drizzle Client é desacoplado do drizzle-kit (a peça que este repositório já tentou e descontinuou, por motivo de consolidação de executor único, não por defeito técnico do query builder) — isso preserva integralmente a decisão de migration tool para um prompt futuro, como exigido, sem nenhuma tendência estrutural a forçar essa escolha (diferente de TypeORM, cujo próprio pacote já inclui e é hoje o executor de migration do legacy, e de Prisma, cujo fluxo idiomático acopla schema e migration por padrão).

Esta escolha não foi feita "porque o legacy usa" (não usa — TypeORM é o legacy) nem "apesar de não estar no legacy" de forma arbitrária — foi feita porque, entre as 4 opções tecnicamente viáveis, é a que melhor atende ao critério mais concreto e específico deste projeto (RLS via sessão transacional, obrigatório desde o início) com o menor atrito colateral (tipagem, cold start, acoplamento de migration).
```

---

## Resumo

```text
OPTIONS_EVALUATED:
4

SELECTED_DATABASE_ACCESS_LAYER:
Drizzle ORM

ALREADY_PRESENT_IN_REPO:
NÃO

COMPATIBLE_WITH_NESTJS:
SIM

RLS_COMPATIBLE:
SIM

COMPOSITE_CONSTRAINTS_SUPPORTED:
SIM

TRANSACTIONS_SUPPORTED:
SIM

NEW_DEPENDENCIES_REQUIRED:
2

UNRESOLVED_DATABASE_ACCESS_DECISIONS:
0
```

## Cobertura

4 opções tecnicamente viáveis avaliadas com os 12 critérios pedidos cada, incluindo o achado de que este repositório já teve contato prévio e descontinuado com uma ferramenta do ecossistema Drizzle (drizzle-kit, escopado a migrations) — registrado por transparência e explicitamente não usado para influenciar esta decisão, que é escopada apenas à camada de acesso/query. Nenhum ORM/migration tool foi "escolhido" além da camada de acesso em si; a decisão de migration strategy permanece inteiramente em aberto. Nenhum banco, schema, tabela, migration ou repository foi criado. `apps/api-v2` não foi criado, nenhuma dependência foi instalada, nenhum `package.json` foi alterado. `apps/web` e `apps/api` (legacy) não foram alterados. Nenhum documento anterior foi modificado.
