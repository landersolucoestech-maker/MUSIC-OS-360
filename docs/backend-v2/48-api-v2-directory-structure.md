> Historical record. Kept as recorded; not the current contract.

# 48 — Estrutura de Diretórios da `apps/api-v2`

Definição read-only da estrutura física de diretórios, derivada exclusivamente da arquitetura em 8 camadas já aprovada em [`47-api-v2-layered-architecture.md`](./47-api-v2-layered-architecture.md), aplicada aos 35 domínios de [`38-domain-inventory.md`](./38-domain-inventory.md) na ordem de [`41-domain-implementation-order.md`](./41-domain-implementation-order.md). Nenhum diretório ou arquivo foi criado. `apps/api-v2` não foi criado. `apps/web` e `apps/api` (legacy) não foram alterados.

## Decisões fixas (não reabertas)

```text
Framework: NestJS (platform-express)
Arquitetura: 8 camadas já definidas (doc47)
Database access: Drizzle ORM
Domain: não depende de NestJS ou Drizzle
Controllers: não acessam banco diretamente
Drizzle: restrito à persistência/database
Cross-domain: não pode importar internals arbitrariamente
```

## Duas ambiguidades de nome resolvidas antes da árvore

O modelo de 8 camadas do doc47 usa os nomes "Auth/Tenant/Authorization" e "Integrations" como camadas técnicas transversais. O doc38 usa os nomes "auth" e "integrations" como **domínios de negócio** (o domínio `auth` tem endpoints reais de login/sessão/onboarding — A.1; o domínio `integrations` tem os endpoints de conexões de marketing/streaming — A.8). São conceitos diferentes com o mesmo nome — resolvido explicitamente para não haver colisão física de pasta:

```text
modules/auth/            → domínio de NEGÓCIO: login/sessão/onboarding (regra de negócio do próprio domínio auth)
src/auth/                → camada TÉCNICA transversal: Guards que validam o JWT do Supabase e produzem o RequestContext
                            (consumida por TODOS os módulos, não é regra de negócio de nenhum domínio específico)

modules/integrations/    → domínio de NEGÓCIO: registro/estado das conexões de marketing/streaming por tenant
src/integrations/        → camada TÉCNICA transversal: adapters de SDK externo (Stripe, ACRCloud, Spotify, R2,
                            Resend, provedores de IA, etc.) que implementam os Integration Ports declarados
                            pelos domínios que precisam deles — usada por VÁRIOS domínios, não só por modules/integrations/
```

Nenhuma outra das 8 camadas do doc47 colide de nome com um dos 35 domínios do doc38.

---

## Árvore de alto nível

```text
apps/api-v2/
├── drizzle.config.ts                     # config do Drizzle Kit (doc46) — convenção do próprio tool, na raiz do app
├── src/
│   ├── main.ts                           # bootstrap Docker/long-running (equivalente ao main.ts do legacy)
│   ├── app.module.ts                     # módulo raiz — importa todos os módulos de domínio + camadas técnicas
│   │
│   ├── modules/                          # 1 pasta por domínio de NEGÓCIO — 35 pastas, uma por domínio do doc38
│   │   ├── auth/
│   │   ├── external-lookups/
│   │   ├── artists/
│   │   ├── works/
│   │   ├── phonograms/
│   │   ├── shares/
│   │   ├── contracts/
│   │   ├── releases/
│   │   ├── events/
│   │   ├── inventory/
│   │   ├── hr/
│   │   ├── licensing/
│   │   ├── projects/
│   │   ├── accounting/
│   │   ├── billing/
│   │   ├── admin-billing/
│   │   ├── support/
│   │   ├── audit/
│   │   ├── leads/
│   │   ├── clients/
│   │   ├── company-settings/
│   │   ├── users/
│   │   ├── rbac/
│   │   ├── integrations/
│   │   ├── ai/
│   │   ├── conversations/
│   │   ├── marketing/
│   │   ├── audiovisual/
│   │   ├── reports/
│   │   ├── notifications/
│   │   ├── dashboard/
│   │   ├── oauth-bridge/
│   │   ├── uploads/
│   │   ├── workspace-panel/
│   │   └── core-entities-gateway/
│   │                                      # (cada pasta segue o TEMPLATE DE DOMÍNIO abaixo)
│   │
│   ├── auth/                             # camada técnica transversal (doc47: Auth/Tenant/Authorization, parte Auth)
│   │   └── guards/                       # validação de JWT Supabase → produção do RequestContext
│   ├── tenant/                           # camada técnica transversal (parte Tenant)
│   │   └── resolvers/                    # resolução de org/tenant a partir da identidade já validada
│   ├── authorization/                    # camada técnica transversal (parte Authorization)
│   │   └── guards/                       # gate de permissão coarse ({module}:read/write/delete/export, doc16)
│   │
│   ├── database/                         # Persistence técnica GLOBAL (não é um domínio) — ver seção DATABASE
│   │   ├── schema/
│   │   ├── migrations/
│   │   ├── transaction/
│   │   └── client/
│   │
│   ├── integrations/                     # Integrations técnica GLOBAL (adapters de SDK externo) — ver ambiguidade acima
│   │   ├── stripe/
│   │   ├── acrcloud/
│   │   ├── spotify/
│   │   ├── r2/
│   │   ├── resend/
│   │   └── ai-providers/
│   │
│   ├── observability/                    # logging/tracing/métricas transversais
│   ├── config/                           # carregamento/validação de env (Zod, doc42)
│   └── shared/                           # ver seção SHARED — conteúdo estritamente restrito
│
└── test/
    ├── e2e/                              # HTTP roundtrip completo, app real + banco de teste
    ├── contract/                         # verificação do contrato canônico (doc37) endpoint a endpoint
    └── integration/                      # testes cross-layer que exigem infraestrutura real (Postgres),
                                           # quando não fizer sentido co-localizar dentro do próprio módulo
```

`test/` no nível raiz do app cobre apenas os testes que precisam de infraestrutura compartilhada (app HTTP real, banco real) — testes unitários ficam co-localizados dentro de cada módulo (ver seção TESTES).

---

## Template de domínio

Aplicado identicamente às 35 pastas de `modules/<domain>/` — nenhum domínio tem uma estrutura interna diferente dos demais, independentemente de ter ou não endpoints HTTP diretos (os 11 domínios do doc38 servidos só via `core-entities-gateway` seguem o mesmo template, apenas com `presentation/` mínima ou ausente — ver nota ao final desta seção):

```text
modules/<domain>/
├── <domain>.module.ts              # wiring NestJS: importa Application/Domain/Infrastructure, declara providers/controllers
│
├── presentation/                   # camada HTTP/Controllers (doc47)
│   ├── <domain>.controller.ts      # mapeia DTO HTTP → Command/Query da Application; nunca contém regra de negócio
│   └── dto/
│       ├── requests/                # DTOs de entrada HTTP (class-validator, doc44)
│       └── responses/               # DTOs de saída HTTP
│
├── application/                    # camada Application/Use Cases (doc47)
│   ├── <domain>.service.ts         # ÚNICO ponto público consumível por OUTROS domínios (Public Application Service,
│   │                                # regra de cross-domain do doc47) — superfície estreita e deliberada
│   ├── use-cases/
│   │   └── <verbo>-<domain>.use-case.ts   # 1 caso de uso de negócio por arquivo, uso INTERNO ao módulo
│   └── ports/
│       └── <capacidade>.port.ts    # Integration Port declarado pela Application quando a capacidade
│                                     # não é vocabulário intrínseco de domínio (ver doc47)
│
├── domain/                         # camada Domain (doc47) — TypeScript puro, zero dependência de framework
│   ├── entities/
│   ├── value-objects/
│   ├── events/                     # definição dos Domain Events publicados por este domínio
│   └── repositories/
│       └── <entity>.repository.port.ts   # Repository Port — interface abstrata, SEM nenhum tipo Drizzle
│
├── infrastructure/                 # camada Persistence/Integrations DESTE domínio (doc47)
│   ├── persistence/
│   │   ├── <entity>.repository.ts  # Persistence Adapter Drizzle — implementa o Repository Port do domain/
│   │   └── <entity>.mapper.ts      # tradução linha Drizzle ↔ entidade de Domain
│   └── integrations/               # SOMENTE quando este domínio precisa de uma implementação de Integration Port
│                                     # que é vocabulário intrínseco dele (raro — ver doc47); o adapter real do SDK
│                                     # externo em si mora em src/integrations/ (camada técnica global)
│
└── (testes co-localizados — ver seção TESTES, não uma pasta separada dentro do template)
```

**Nota sobre os 11 domínios sem endpoint HTTP direto (doc38):** domínios como `works`, `phonograms`, `shares`, `contracts`, `releases`, `events`, `inventory`, `hr`, `licensing`, `projects` e parte de `artists` são hoje expostos só através do wrapper genérico (`core-entities-gateway`). Mesmo assim mantêm domain/application/infrastructure completos — a regra de negócio e a persistência pertencem ao domínio, não ao gateway genérico. `presentation/` nesses casos fica vazia ou ausente (nenhum controller próprio); o único controller físico que atende esses domínios é o de `modules/core-entities-gateway/presentation/`, cujos use cases internamente chamam o `<domain>.service.ts` (Public Application Service) de cada domínio-alvo — nunca acessam `domain/`/`infrastructure/` de outro módulo diretamente, preservando a regra de cross-domain do doc47.

---

## DATABASE

```text
src/database/schema/<domain>.schema.ts
  → Definições Drizzle (pgTable/relations) — UM arquivo por domínio, mas fisicamente CENTRALIZADO aqui, não dentro
  de modules/<domain>/. Exceção deliberada e justificada à regra de "sem pasta horizontal": schema.ts é forma de
  dado (DDL espelhado em TypeScript), não regra de negócio nem query — e o Drizzle Kit (doc46) espera uma fonte
  única de schema para gerar o diff de migration corretamente; fragmentar schema.ts por módulo tornaria o comando
  `drizzle-kit generate` mais frágil sem nenhum ganho real de isolamento (o schema não decide nada, só descreve
  colunas/tipos/constraints). A REPOSITORY IMPLEMENTATION (a query com significado de negócio) continua dentro do
  domínio (modules/<domain>/infrastructure/persistence/), importando apenas a tabela que precisa deste arquivo central.

src/database/client/
  → Instância única do client Drizzle (conexão/pool), exposta como provider NestJS injetável — equivalente
  técnico ao DATA_SOURCE token do legacy TypeORM (doc42), agora para Drizzle.

src/database/transaction/
  → O primitivo de contexto transacional/RLS (equivalente Drizzle do `runInTenantContext()` do legacy, doc45/47) —
  abre `db.transaction()`, executa `SELECT set_config('app.current_tenant_id', ..., true)` etc., e expõe o `tx`
  contextualizado para os Persistence Adapters de QUALQUER domínio consumirem de forma uniforme.

src/database/migrations/
  → Arquivos .sql versionados (gerados via `drizzle-kit generate` e `drizzle-kit generate --custom`, doc46),
  nomeados conforme a convenção NNNN_slug_descritivo já fixada.

Repository IMPLEMENTATIONS (a query específica de um domínio):
  → NÃO ficam em src/database/ — ficam em modules/<domain>/infrastructure/persistence/, conforme o template de
  domínio acima, para preservar isolamento por domínio e a exigência explícita do prompt de "repository ports
  dentro do domínio" (o port e a implementação ficam no mesmo domínio; só a definição crua de tabela é centralizada).
```

---

## DTOs — onde cada tipo vive, sem misturar HTTP com Domain

```text
HTTP request DTOs:
modules/<domain>/presentation/dto/requests/*.dto.ts (class-validator, doc44)

HTTP response DTOs:
modules/<domain>/presentation/dto/responses/*.dto.ts (class-validator/class-transformer, doc44)

Application commands/queries:
modules/<domain>/application/ — tipos TypeScript puros (não class-validator, não decorators HTTP), construídos
pelo Controller a partir do DTO HTTP validado e passados ao use-case; é a fronteira que impede o Use Case de
"conhecer HTTP" (regra obrigatória do doc47)

Domain objects (entidades/value objects):
modules/<domain>/domain/entities/ e modules/<domain>/domain/value-objects/ — nunca decorados com class-validator
nem com decorators Drizzle; TypeScript puro, conforme doc47
```

Nenhum tipo é reaproveitado entre estas 3 camadas por conveniência — DTO HTTP, Command/Query de Application e entidade de Domain são sempre tipos distintos, mesmo quando os campos coincidem, para que uma mudança de contrato HTTP nunca vaze silenciosamente para a regra de negócio.

---

## TESTES

```text
Unit tests (Domain, Application, Mappers):
Co-localizados junto do arquivo testado dentro do próprio módulo — <arquivo>.spec.ts no mesmo diretório
(mesma convenção já usada no legacy, ex.: create-artist.dto.spec.ts ao lado de create-artist.dto.ts, doc42)

Integration tests (Persistence Adapter contra Postgres real, Use Case + Repository real):
modules/<domain>/infrastructure/persistence/<entity>.repository.integration-spec.ts (co-localizado), OU
test/integration/<domain>/ no nível raiz quando o teste precisa orquestrar mais de um domínio ou infraestrutura
compartilhada que não faz sentido dentro de um único módulo

Contract tests (verificação do contrato canônico doc37, endpoint a endpoint):
test/contract/ — 1 arquivo por domínio (test/contract/<domain>.contract-spec.ts), validando que a apps/api-v2
reproduz exatamente o shape de request/response já aprovado, sem exigir HTTP real (chamando o Controller/use-case
diretamente ou via um app de teste leve)

E2E tests (HTTP roundtrip completo, app real + banco de teste):
test/e2e/ — mesmo padrão do jest.e2e.config.ts já usado no legacy (doc42), mas escopado à apps/api-v2
```

---

## SHARED

```text
PODE CONTER (exclusivamente, herdado sem alteração da regra já fixada no doc47):
- Tipos de identidade/tenant/permissão (RequestContext, TenantId, PermissionKey, RoleKey)
- Primitivos técnicos sem significado de negócio (Result/Either genérico, classes base de erro,
  interface genérica de Domain Event bus, helpers de paginação)
- Contratos puramente estruturais reutilizados por múltiplos domínios (ex.: PaginatedResult<T>)

PROIBIDO EXPLICITAMENTE:
- Qualquer entidade, value object ou regra de negócio de 1+ domínios específicos
- Virar depósito genérico — nenhum arquivo entra em shared/ sem justificar por que é técnico/identitário,
  não de negócio; na dúvida, o código pertence a um domínio (modules/<domain>/) e é exposto via
  <domain>.service.ts, nunca movido para shared/ por conveniência
```

---

## Nomenclatura

```text
*.controller.ts        → presentation/ — 1 por domínio (ou mais, só se o volume de endpoints do domínio
                          justificar concretamente split por sub-recurso; não é o padrão default)
*.module.ts             → raiz de modules/<domain>/ — wiring NestJS do módulo; também app.module.ts na raiz de src/
*.service.ts             → application/ — RESERVADO ao Public Application Service (1 por domínio, <domain>.service.ts)
                          — é a ÚNICA superfície que outro domínio pode importar (regra de cross-domain do doc47)
*.use-case.ts            → application/use-cases/ — 1 caso de uso de negócio por arquivo, uso interno ao módulo,
                          nunca importado por outro domínio diretamente
*.repository.ts           → infrastructure/persistence/ — Persistence Adapter Drizzle, implementa o port
*.repository.port.ts      → domain/repositories/ — interface abstrata, sem tipo Drizzle
*.dto.ts                  → presentation/dto/ — exclusivamente HTTP (class-validator); nunca usado para
                          Application command/query nem para Domain object (ver seção DTOs)
*.schema.ts                → EXCLUSIVAMENTE src/database/schema/ — definição Drizzle (pgTable/relations);
                          nunca usado para nomear um Zod schema de validação de request (para não colidir
                          com o padrão já fixado no doc44 — o escape hatch Zod, se necessário, usa outro sufixo,
                          ex.: *.zod.ts, para não haver ambiguidade com schema de banco)
*.mapper.ts                 → infrastructure/persistence/ (linha Drizzle ↔ entidade Domain) — mesmo sufixo também
                          aceitável em presentation/ quando um domínio precisar de um mapeamento DTO↔Command
                          explícito e não trivial (responsabilidade diferente, mesmo sufixo, camada diferente)
*.spec.ts                  → unit test, co-localizado, qualquer camada
*.integration-spec.ts       → integration test (banco real), co-localizado ou em test/integration/
*.contract-spec.ts           → contract test, em test/contract/
*.e2e-spec.ts                 → e2e test, em test/e2e/
```

---

## Validação (respostas objetivas exigidas pelo prompt)

```text
Cada domínio possui pasta própria?
SIM

Controllers ficam dentro do domínio?
SIM

Use cases ficam dentro do domínio?
SIM

Repository ports ficam separados de implementations?
SIM (port em domain/repositories/, implementation em infrastructure/persistence/)

Drizzle fica fora do domain layer?
SIM (Drizzle só aparece em infrastructure/persistence/ e em src/database/)

DTO HTTP fica fora do domain layer?
SIM (DTO HTTP fica em presentation/dto/; domain/ usa apenas entidades/value objects)

Cross-domain internals ficam protegidos?
SIM (apenas <domain>.service.ts é superfície pública; use-cases/domain/infrastructure nunca são importados
por outro módulo)
```

---

## Resumo

```text
DOMAIN_TEMPLATE_DEFINED:
SIM

ROOT_STRUCTURE_DEFINED:
SIM

DATABASE_STRUCTURE_DEFINED:
SIM

TEST_STRUCTURE_DEFINED:
SIM

SHARED_RULES_DEFINED:
SIM

NAMING_CONVENTIONS_DEFINED:
SIM

CROSS_DOMAIN_INTERNALS_PROTECTED:
SIM

UNRESOLVED_DIRECTORY_DECISIONS:
0
```

## Cobertura

Árvore de alto nível definida para `apps/api-v2/`, incluindo `src/` e `test/` e os 9 diretórios técnicos exigidos (modules, auth, tenant, authorization, database, integrations, observability, config, shared). Template de domínio definido e aplicado uniformemente às 35 pastas de `modules/`. Duas ambiguidades de nome entre camada técnica e domínio de negócio (`auth`, `integrations`) foram identificadas e resolvidas explicitamente. Localização de DTOs HTTP, commands/queries de Application e objetos de Domain definida sem sobreposição. Estrutura de testes definida por tipo (unit/integration/contract/e2e). Regras de `shared/` herdadas do doc47 sem alteração. Convenção de nomenclatura definida para os 10 sufixos pedidos. Nenhum diretório ou arquivo foi criado. `apps/api-v2` não foi criado. `apps/web` e `apps/api` (legacy) não foram alterados. Nenhum documento anterior foi modificado.
