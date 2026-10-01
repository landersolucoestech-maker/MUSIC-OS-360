> Historical record. Kept as recorded; not the current contract.

# 72 — Stack Final Consolidada da API v2 e Prontidão para Scaffold

Consolidação read-only de todas as 21 decisões técnicas já aprovadas (docs 47-71) para a futura `apps/api-v2`, com verificação de lacunas estruturais restantes antes do scaffold físico. Nenhuma decisão anterior foi reaberta ou alterada. Nenhum código/schema/migration/Dockerfile/tsconfig/dependência foi criado ou instalado. `apps/api-v2` não foi criado. `apps/web`, `apps/api` (legacy), banco, Supabase e Git não foram alterados.

---

## 1. Stack final obrigatória (consolidada, não reaberta)

```text
Runtime:
Node.js 24 (doc60)

Language:
TypeScript 6.0.3 — strict: true, noImplicitAny: true, strictNullChecks: true, noImplicitReturns: true,
noFallthroughCasesInSwitch: true, noUncheckedIndexedAccess: true, exactOptionalPropertyTypes: false,
useUnknownInCatchVariables: true, noImplicitOverride: true, forceConsistentCasingInFileNames: true,
experimentalDecorators: true, emitDecoratorMetadata: true, module: CommonJS, moduleResolution: node10,
target: ES2023 (doc63)

Framework:
NestJS 11.1.28 (doc59)

HTTP:
@nestjs/platform-express 11.1.28
Express 5.2.1 (doc59)

Validation:
Zod 4.4.3 (padrão único, sem class-validator/class-transformer — doc64)

Database:
PostgreSQL 17 / Supabase (doc58)

Database access:
Drizzle ORM 0.45.2
pg 8.22.0
@types/pg 8.21.0 (doc65)

Migrations:
Drizzle Kit 0.31.10
+
SQL manual controlado (RLS/extensions/functions/triggers, doc46/65)

Auth:
Supabase Auth (provedor de identidade preservado)
jose 6.2.8 (sem jsonwebtoken/jwks-rsa — doc66)

Tenant/Authorization:
RequestContext (authUserId/userId/tenantId/role/permissions/correlationId) + AuthGuard/TenantGuard/
PermissionGuard (doc49)

Transactions:
Transaction Manager Port + Transaction Context opaco, propagado por Repository Ports (doc51)

Async processing:
pg-boss 12.27.0 (fila PostgreSQL-backed, sem Redis)
@nestjs/schedule 6.1.3 (agendamento leve não-durável, complementar) (doc67)

Logging:
Pino 10.3.1
nestjs-pino 4.6.1 (doc68)

Metrics:
prom-client 15.1.3 (Prometheus/OpenMetrics) (doc68)

Tracing:
OpenTelemetry — ENABLED_FROM_INITIAL_V2
@opentelemetry/api 1.9.1
@opentelemetry/sdk-node 0.221.0
@opentelemetry/instrumentation-http 0.221.0
@opentelemetry/instrumentation-express 0.69.0
@opentelemetry/instrumentation-pg 0.73.0
@opentelemetry/exporter-trace-otlp-http 0.221.0 (doc68)

Health:
@nestjs/terminus 11.1.1 (doc68)

Error tracking:
@sentry/nestjs 10.69.0 (escopo: captura de exceção apenas, não tracing — doc68)

Security:
helmet 8.3.0
@nestjs/throttler 6.5.0 (storage híbrido: in-memory + Postgres-backed para endpoints sensíveis)
compression 1.8.1 (doc70)

Testing:
Jest 30.4.2
ts-jest 29.4.12
Supertest 7.2.2
@testcontainers/postgresql 12.1.0 (doc69)

Deployment:
LONG_RUNNING_CONTAINER (não serverless, não dual — doc61)

Environment model:
development | staging | production | test
NODE_ENV como fonte canônica (doc71)
```

Nenhuma dessas decisões foi alterada nesta etapa.

---

## 2. Decisões arquiteturais consolidadas

```text
Frontend permanece congelado como especificação funcional (doc62 — FRONTEND_AS_FUNCTIONAL_SPEC: SIM).
250 endpoints HTTP devem manter contrato (doc37, não reaberto).
22 eventos realtime devem manter contrato quando aplicável (doc37/33).
Multi-tenancy obrigatório desde a primeira migration (doc45/46/58).
Tenant vindo do cliente não é confiado — X-Tenant-ID é indício, nunca prova (doc49).
Domain não depende de NestJS/Drizzle/Zod (doc47/58/64).
Controllers não acessam banco diretamente (doc47).
Use cases controlam transações (doc51 — TRANSACTION_OWNER_LAYER: Application/Use Case).
TypeORM não entra na apps/api-v2 (doc58/65 — TYPEORM_IN_API_V2: NÃO).
Raw SQL somente controlado e parametrizado (doc51/65/70 — RAW_SQL_ARBITRARY_CRUD_ALLOWED: NÃO).
Supabase Auth permanece (doc49/66).
Supabase Realtime permanece quando já aprovado — superfície de autorização separada do RequestContext
  HTTP, não redesenhada (doc49).
Transactional outbox suportado (doc51/67 — TRANSACTIONAL_OUTBOX_SUPPORTED: SIM, via pg-boss na mesma
  transação Drizzle da escrita de negócio).
Queue não é source of truth (doc67 — QUEUE_IS_SOURCE_OF_TRUTH: NÃO).
Cross-domain behavior deve ser preservado (doc62 — Public Application Service/Domain Event/Port
  genérico/Shared Kernel, conforme o caso já mapeado nos docs 39-41).
Financial traceability obrigatória (doc62 — P&L rastreável até transaction→artist/project→operação
  original).
Cutover somente com contratos verdes (doc69 — ALL_FRONTEND_CONTRACT_TESTS_GREEN: SIM obrigatório).
```

---

## 3. Environment files (convenção final, doc71 não reaberto)

```text
.env.development.example
.env.staging.example
.env.production.example
.env.test.example

.env.{environment}.local (nunca versionado)

.env.example permanece como catálogo geral seguro (papel redefinido: referência completa de todas as
variáveis possíveis, distinto dos 4 templates acionáveis por ambiente).
```

---

## 4. Verificação de lacunas estruturais

Cada uma das 21 áreas pedidas foi conferida contra os docs 47-71:

```text
runtime: RESOLVIDO (Node 24, doc60)
framework: RESOLVIDO (NestJS 11.1.28, doc59)
TypeScript: RESOLVIDO (6.0.3 + política de strictness completa, doc63)
validation: RESOLVIDO (Zod 4.4.3, doc64)
database: RESOLVIDO (PostgreSQL 17/Supabase, doc58)
migrations: RESOLVIDO (Drizzle Kit + SQL manual, doc46/65)
auth: RESOLVIDO (Supabase Auth + jose, doc66)
tenant context: RESOLVIDO (RequestContext + fluxo completo, doc49)
authorization architecture: RESOLVIDO (3 Guards + separação authentication/tenant/permission coarse/
  business fina, doc49; 8 camadas, doc47)
transactions: RESOLVIDO (Transaction Manager Port/Context, critérios de atomicidade, retry, side
  effects, doc51)
async processing: RESOLVIDO (pg-boss + @nestjs/schedule, política de falha/idempotência, doc67)
observability: RESOLVIDO (Pino/prom-client/OTel/Terminus/Sentry, com responsabilidade de cada um
  delimitada, doc68)
health: RESOLVIDO (Terminus, liveness/readiness com critério de dependência, doc68/52)
security HTTP: RESOLVIDO (helmet/CORS/request limits/webhook raw body/trust proxy/HTTPS/CSRF/
  compression, doc70)
rate limiting: RESOLVIDO (@nestjs/throttler, storage híbrido, identidade de throttling nunca do
  cliente, doc70)
testing: RESOLVIDO (Jest/ts-jest/supertest/testcontainers, 4 tipos de teste, cobertura por
  criticidade, gates 100% bloqueantes, doc69)
deployment: RESOLVIDO (long-running container, doc61)
configuration: RESOLVIDO (8 categorias tipadas, validação fail-fast no boot, fronteira Domain↔env,
  doc53)
environment naming: RESOLVIDO (4 ambientes + convenção de arquivo, doc71)
directory structure: RESOLVIDO (8 camadas + template de domínio para as 35 pastas, doc48)
error model: RESOLVIDO (envelope plano, 11 categorias, HTTP status mapping, doc50)
```

Nenhuma das 21 áreas obrigatórias pedidas por este prompt ficou sem decisão registrada em algum dos
docs 47-71.

---

## 5. Itens remanescentes identificados (nenhum bloqueante)

Registrados por transparência — nenhum deles impede a criação do scaffold mínimo, todos são
decisões de infraestrutura/provedor já deliberadamente deferidas em etapas anteriores, ou detalhe de
implementação que só faz sentido definir durante a construção de cada domínio (mesma orientação
explícita da seção 5 do prompt):

```text
ID: GAP-001
AREA: Observability (tracing backend)
DECISION_REQUIRED_BEFORE_SCAFFOLD: NÃO
DESCRIPTION: o backend/coletor concreto de destino do OpenTelemetry (ex.: um backend compatível com
  OTLP) não foi escolhido — apenas o SDK/instrumentação/exportador (doc68).
WHY_NOT_BLOCKING: é uma decisão de provedor/hosting, mesma categoria já deliberadamente deferida no
  doc61 ("não escolher provedor de container/hosting") — o endpoint de exportação é um valor de
  configuração (env var), não uma decisão de código estrutural; o SDK funciona e pode ser apontado a
  qualquer backend compatível quando essa escolha for feita.

ID: GAP-002
AREA: Deployment (hosting provider)
DECISION_REQUIRED_BEFORE_SCAFFOLD: NÃO
DESCRIPTION: nenhum provedor concreto de hosting/container (Railway/Render/Fly.io/outro) foi escolhido
  para o modelo long-running já decidido (doc61).
WHY_NOT_BLOCKING: já era uma exclusão de escopo explícita e repetida em múltiplos docs (61/68/70) — o
  código da aplicação não depende de qual provedor a hospeda; necessário antes do primeiro DEPLOY, não
  antes do scaffold/implementação inicial.

ID: GAP-003
AREA: Rate limiting (storage compartilhado)
DECISION_REQUIRED_BEFORE_SCAFFOLD: NÃO
DESCRIPTION: o esquema concreto (tabela/colunas) da implementação própria de ThrottlerStorage
  Postgres-backed para endpoints sensíveis (doc70) não foi desenhado — só a abordagem foi decidida.
WHY_NOT_BLOCKING: mesma categoria de "schema de cada domínio", explicitamente listada pelo prompt como
  não-bloqueante — implementação de detalhe, não decisão estrutural.

ID: GAP-004
AREA: Deployment (empacotamento)
DECISION_REQUIRED_BEFORE_SCAFFOLD: NÃO
DESCRIPTION: nenhum Dockerfile foi criado para a apps/api-v2 (proibido em múltiplas etapas anteriores,
  incluindo esta).
WHY_NOT_BLOCKING: o modelo de deployment (long-running container) já está decidido (doc61); o
  Dockerfile em si é um artefato de empacotamento que pode ser criado a qualquer momento depois do
  scaffold inicial existir, sem bloquear o início do desenvolvimento do código da aplicação.

ID: GAP-005
AREA: CI/CD (pipeline específico da apps/api-v2)
DECISION_REQUIRED_BEFORE_SCAFFOLD: NÃO
DESCRIPTION: nenhum workflow do GitHub Actions foi criado para rodar os quality gates já definidos no
  doc69 contra a apps/api-v2.
WHY_NOT_BLOCKING: os GATES em si (install/lint/typecheck/unit/integration/contract/e2e/build/migration
  validation) já estão definidos conceitualmente (doc69) — a automação de CI é infraestrutura de
  processo, adicionável em paralelo ao início da implementação, não um pré-requisito para escrever o
  primeiro código.
```

```text
STRUCTURAL_GAPS_FOUND:
5

BLOCKING_GAPS:
0
```

---

## 6. Gate para começar a implementação

```text
READY_FOR_API_V2_SCAFFOLD:
SIM

Todas as 21 áreas estruturais obrigatórias pedidas por este prompt têm decisão já registrada e
aprovada em algum dos 25 documentos consolidados (docs 47-71). Os 5 itens remanescentes identificados
são, sem exceção, decisões de provedor/infraestrutura já deliberadamente deferidas em etapas anteriores
ou detalhe de implementação que a própria série de prompts já orientou a não tratar como bloqueador.
Nenhuma decisão estrutural realmente pendente foi encontrada.
```

---

## 7. Próxima fase

```text
NEXT_PHASE:
API_V2_SCAFFOLD

A próxima fase será a criação física da apps/api-v2 — scaffold mínimo (estrutura de diretórios já
definida no doc48, package.json, tsconfig conforme doc63, main.ts/app.module.ts mínimos) — SEM
implementar nenhum dos 35 domínios de negócio ainda (ordem já definida no doc41, a ser seguida quando a
implementação de domínio começar). Esta etapa (doc72) NÃO executa essa criação — apenas confirma
prontidão e aponta a fase seguinte.
```

---

## Resumo

```text
FINAL_STACK_CONSOLIDATED: SIM
ARCHITECTURE_DECISIONS_CONSOLIDATED: SIM
ENVIRONMENT_MODEL_CONSOLIDATED: SIM
STRUCTURAL_GAPS_FOUND: 5
BLOCKING_GAPS: 0
READY_FOR_API_V2_SCAFFOLD: SIM
```

## Cobertura

Stack final consolidada em 20 categorias técnicas, decisões arquiteturais consolidadas em 16 princípios
não reabertos, convenção de environment files reafirmada. As 21 áreas estruturais pedidas pelo prompt
foram verificadas individualmente contra os 25 documentos-fonte (docs 47-71), todas com decisão já
registrada. 5 itens remanescentes identificados por transparência, todos explicitamente não-bloqueantes
(decisão de provedor/infraestrutura já deferida em etapas anteriores, ou detalhe de implementação da
mesma categoria que o próprio prompt já orienta a não tratar como bloqueador). Nenhuma decisão
estrutural realmente necessária antes do scaffold ficou sem resposta. Nenhuma decisão anterior foi
reaberta ou alterada. Nenhum código/schema/migration/Dockerfile/tsconfig/dependência foi criado ou
instalado. `apps/api-v2` não foi criado. `apps/web`, `apps/api` (legacy), banco, Supabase e Git não
foram alterados.
