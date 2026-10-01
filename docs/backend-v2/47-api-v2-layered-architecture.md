> Historical record. Kept as recorded; not the current contract.

# 47 — Camadas e Direção de Dependências da `apps/api-v2`

Definição read-only da arquitetura lógica (camadas + direção de dependência permitida) da futura `apps/api-v2`, sobre as decisões já fixadas em [`43`](./43-api-v2-http-framework-decision.md)/[`44`](./44-api-v2-http-framework-final-resolution.md) (NestJS/platform-express, validação class-validator+class-transformer), [`45`](./45-api-v2-database-access-decision.md) (Drizzle ORM) e [`46`](./46-database-v2-migration-strategy.md) (Drizzle Kit + SQL manual controlado), aplicada aos 35 domínios e à ordem de dependências já registrados em [`38`](./38-domain-inventory.md) e [`41`](./41-domain-implementation-order.md). Nenhuma estrutura de diretórios, código, schema ou entidade foi criada. `apps/api-v2` não foi criado. `apps/web` e `apps/api` (legacy) não foram alterados.

## Decisões fixas (não reabertas)

```text
Framework: NestJS (platform-express)
Validação padrão: class-validator + class-transformer
Database access: Drizzle ORM
Migrations: Drizzle Kit + SQL manual controlado
```

## Avaliação de subdivisão (antes de definir as camadas)

O modelo base obrigatório (8 grupos) foi mantido sem adicionar nenhuma camada vertical nova. Duas decisões de subdivisão concretas foram necessárias, ambas exigidas diretamente pelas restrições já aprovadas, não por preferência estética:

1. **Repository Port vs. Persistence Adapter** (dentro do grupo "Repositories/Persistence"): o doc45 exige que o Domain permaneça livre de Drizzle, mas alguém precisa declarar o contrato que a Persistence implementa — a única forma de satisfazer as duas coisas ao mesmo tempo é o Domain declarar a *interface* (Repository Port, sem nenhum tipo Drizzle) e a Persistence declarar a *implementação* (Persistence Adapter, com Drizzle) — exatamente o modelo conceitual dado no prompt ("Persistence Adapter ↓ implements Repository Port"). Não é uma 9ª camada — é a forma interna do grupo 4.
2. **Auth/Tenant/Authorization, Observability e Configuration tratados como transversais, não verticais**: forçá-los na cadeia vertical Controller→Application→Domain→Persistence seria arquiteturalmente incorreto, porque os três atravessam múltiplas camadas ao mesmo tempo (ex.: um Guard roda na borda HTTP, mas o contexto que ele produz é consumido por Application; Observability instrumenta Controller e Persistence simultaneamente). Cada um é definido abaixo com sua própria regra de dependência, sem virar uma 9ª/10ª/11ª camada vertical inventada.

Nenhuma camada além das 8 do modelo base obrigatório foi criada.

---

## Camadas

```text
LAYER:
HTTP / Controllers

RESPONSIBILITY:
Expor os 250 endpoints do contrato canônico (doc37). Receber a requisição HTTP, aplicar Guards (identidade/tenant/permissão coarse), mapear o body/query/params validados (via class-validator DTOs, doc44) para o input de exatamente 1 Application Use Case, invocar esse Use Case, e mapear o resultado (sucesso ou erro de domínio/aplicação) para status HTTP + shape de resposta já definido no contrato canônico.

MAY_DEPEND_ON:
- Application / Use Cases (chama, nunca é chamado por elas)
- Auth/Tenant/Authorization (consome o RequestContext validado produzido pelos Guards)
- Observability (interceptors de logging/tracing por request)
- DTOs HTTP (class-validator) definidos na própria camada

MUST_NOT_DEPEND_ON:
- Persistence (Drizzle) — nenhuma query, direta ou indireta
- Domain (o Controller não conhece entidades/regras de domínio, só os tipos de input/output do Use Case)
- Integrations (nenhum SDK externo importado diretamente)
- Repository Ports diretamente (só o Use Case os usa)

MAY_CONTAIN:
- Controllers NestJS (@Controller/@Get/@Post/etc.)
- DTOs de request/response HTTP (class-validator)
- Guards de AUTH/TENANT/permissão coarse (aplicados declarativamente por rota)
- Exception Filters (mapeamento de erro de domínio/aplicação → status HTTP)

MUST_NOT_CONTAIN:
- Regra de negócio
- SQL ou queries Drizzle
- Decisão de autorização de negócio contextual/fina (ex.: "este usuário pode editar ESTE artista porque é o gestor responsável" — isso é autorização de negócio, pertence ao Use Case/Domain, não ao Controller/Guard)
- Acesso direto a integração externa (Stripe, Supabase Admin, R2, ACRCloud, Spotify, etc.)
```

```text
LAYER:
Application / Use Cases

RESPONSIBILITY:
Orquestrar exatamente um caso de uso de negócio por classe/função: validação contextual (regras que dependem de estado, não só de formato — já coberto por class-validator), autorização de negócio fina, chamadas ao Domain, aos Repository Ports (via injeção), a Integration Ports, publicação de Domain Events, e controle explícito de transação (abrindo o escopo transacional necessário para o padrão RLS/SET LOCAL já herdado do legacy via doc45) — tudo isso sem conhecer detalhe nenhum de HTTP.

MAY_DEPEND_ON:
- Domain (entidades, value objects, domain services, Repository Ports/interfaces)
- Repository Ports (interfaces — nunca a implementação Drizzle diretamente)
- Integration Ports (interfaces — nunca o SDK externo diretamente)
- Auth/Tenant/Authorization (recebe o RequestContext já validado como parâmetro explícito — nunca o reconstrói nem o busca sozinho)
- Shared (tipos/utilitários técnicos sem regra de negócio)

MUST_NOT_DEPEND_ON:
- Express (Request/Response) ou qualquer decorator/tipo do @nestjs/common ligado a HTTP
- Drizzle diretamente (só via Repository Port)
- SDK de integração externa diretamente (só via Integration Port)
- Controllers (nunca importado por um Use Case)

MAY_CONTAIN:
- Classes/funções de Use Case (1 caso de uso de negócio = 1 unidade), com input/output como tipos puros TypeScript (não DTOs HTTP)
- Coordenação de transação (via o padrão de contexto transacional definido na Persistence)
- Publicação de Domain Events

MUST_NOT_CONTAIN:
- Qualquer import de "express" ou tipos HTTP
- Query Drizzle inline
- Regra de cálculo/invariante que pertence ao Domain (o Use Case orquestra, não decide a regra em si)
```

```text
LAYER:
Domain

RESPONSIBILITY:
Modelar as regras e invariantes de negócio de cada um dos 35 domínios (entidades, value objects, domain services, domain events, e os Repository Ports/Integration Ports que o próprio domínio precisa que existam) em TypeScript puro, sem nenhuma dependência de framework ou infraestrutura.

MAY_DEPEND_ON:
- Nada além de TypeScript puro e de outros elementos do próprio Domain
- Shared (somente os tipos/primitivos técnicos genéricos definidos na seção Shared abaixo — nunca outro Domain de negócio)

MUST_NOT_DEPEND_ON:
- NestJS HTTP (nenhum decorator @nestjs/common)
- Express
- Drizzle (nenhum tipo/import de drizzle-orm)
- Supabase SDK
- Vercel (nenhum tipo de runtime serverless)
- Controllers
- DTOs HTTP

MAY_CONTAIN:
- Entidades e value objects
- Domain services (regras que não pertencem a uma única entidade)
- Domain events (definição do evento, não a publicação/transporte)
- Repository Ports (interfaces — contrato abstrato, sem nenhum tipo Drizzle no assinatura)
- Integration Ports, quando a capacidade externa é vocabulário intrínseco do domínio (ex.: um "AudioFingerprintingPort" no domínio de monitoramento de catálogo é conceito de domínio, ainda que implementado por ACRCloud na Integrations)

MUST_NOT_CONTAIN:
- Qualquer import de pacote de infraestrutura (drizzle-orm, @nestjs/*, express, @supabase/supabase-js)
- Lógica de mapeamento HTTP↔Domain (isso é do Controller) ou Domain↔linha-de-banco (isso é da Persistence)
```

```text
LAYER:
Repositories / Persistence

RESPONSIBILITY:
Implementar, usando Drizzle ORM, os Repository Ports declarados pelo Domain — traduzindo entre linhas de banco (Drizzle) e entidades de Domain. É também a única camada autorizada a abrir/gerenciar a transação de sessão RLS (o padrão `SET LOCAL app.current_tenant_id`/`app.current_org_id`/`app.current_role` já provado no legacy e reavaliado no doc45), expondo essa capacidade ao Use Case através de um contrato explícito de execução transacional (não Drizzle bruto).

MAY_DEPEND_ON:
- Domain (para conhecer as entidades e implementar os Repository Ports que ele declara)
- Drizzle ORM (drizzle-orm, driver pg) — EXCLUSIVAMENTE aqui
- Configuration (connection string, feature flags de sessão RLS)

MUST_NOT_DEPEND_ON:
- Application / Use Cases (a Persistence nunca chama para cima)
- Controllers
- Integrations (persistência e integração externa são camadas irmãs, não uma depende da outra)

MAY_CONTAIN:
- Persistence Adapters (implementações Drizzle dos Repository Ports)
- Mapeamento linha↔entidade
- O primitivo de contexto transacional/RLS (equivalente ao `runInTenantContext()` do legacy, reimplementado sobre `db.transaction()` do Drizzle conforme já justificado no doc45)
- Schema Drizzle (pgTable/relations) — fonte da verdade tipada do schema relacional (doc46)

MUST_NOT_CONTAIN:
- Regra de negócio (validação, cálculo, decisão) — só tradução de dados
- Chamada a Use Case ou Controller
```

```text
LAYER:
Integrations

RESPONSIBILITY:
Encapsular todo SDK/API externa (Stripe, Supabase Admin, Cloudflare R2, ACRCloud, Spotify/Meta/TikTok/Google/DocuSign, Resend, Anthropic/OpenAI/Google AI, PostHog, Sentry) atrás de um adapter dedicado por integração, implementando um Integration Port declarado por quem precisa dele (Application ou, quando a capacidade é vocabulário de domínio, Domain).

MAY_DEPEND_ON:
- Domain ou Application (para implementar o Port declarado por um dos dois — nunca os dois ao mesmo tempo para a mesma integração, decidido caso a caso conforme a natureza da capacidade)
- Configuration (credenciais/URLs das 60+ variáveis de ambiente já inventariadas no doc42)
- Observability (para instrumentar chamadas externas)

MUST_NOT_DEPEND_ON:
- Controllers
- Drizzle/Persistence
- Outro domínio de negócio diretamente (uma integração não conhece "Artist" ou "Contract" — recebe/retorna tipos primitivos ou tipos do próprio Port)

MAY_CONTAIN:
- Um adapter por integração externa, cada um implementando exatamente 1 Integration Port
- Mapeamento entre o shape do SDK externo e o shape do Port (nunca vazando o tipo do SDK para fora da camada)

MUST_NOT_CONTAIN:
- Regra de negócio
- SDK externo importado ou usado fora do seu próprio adapter dedicado (nenhum "SDK espalhado" pelos domínios, conforme regra explícita do prompt)
```

```text
LAYER:
Auth / Tenant / Authorization (transversal)

RESPONSIBILITY:
Validar a identidade (JWT do Supabase Auth, preservado no frontend conforme Exceção Funcional do doc37) na borda HTTP, resolver tenant/org/role a partir dessa identidade validada (nunca do payload do cliente), e produzir um RequestContext imutável e tipado que é a ÚNICA fonte de identidade aceita pelas camadas internas. Cobre também o gate de permissão coarse (`{module}:read/write/delete/export`, já resolvido para 9/35 domínios no doc16) como Guard declarativo na borda.

MAY_DEPEND_ON:
- Nada de Application/Domain/Persistence (é consumido por elas, não o contrário)
- Configuration (segredos/URLs Supabase, JWKS)

MUST_NOT_DEPEND_ON:
- Domain (o RequestContext é um tipo do Shared, não um conceito de um domínio específico)

MAY_CONTAIN:
- Guards NestJS (validação de JWT, extração de tenant/org/role, gate de permissão coarse)
- A definição do tipo RequestContext (tenantId, orgId, userId, role, permissions) — este tipo vive no Shared (ver seção Shared), não nesta camada isoladamente, porque Application/Domain também precisam do TIPO (não da lógica de extração)

MUST_NOT_CONTAIN:
- Autorização de negócio fina (pertence ao Use Case/Domain, que recebe o RequestContext já validado e decide com base em regra de negócio, ex.: "é o dono do recurso")

REGRA OBRIGATÓRIA (verbatim do prompt, reforçada):
Domain e Application NUNCA confiam em tenant_id recebido do body, role enviada pelo cliente, ou user_id enviado como identidade — a única fonte aceita é o RequestContext produzido por esta camada a partir do JWT validado.
```

```text
LAYER:
Observability (transversal)

RESPONSIBILITY:
Logging estruturado, tracing e métricas em torno de requests (Controller), casos de uso (Application) e chamadas de infraestrutura (Persistence/Integrations), reutilizando bibliotecas genéricas Node já em uso no legacy (@sentry/node, prom-client — doc42), sem depender de nenhum domínio de negócio específico.

MAY_DEPEND_ON:
- Configuration (DSNs, níveis de log)

MUST_NOT_DEPEND_ON:
- Domain (nenhuma chamada de log/trace dentro de uma entidade ou domain service — se um evento de domínio precisa ser observado, ele é emitido como Domain Event e um listener FORA do Domain o registra)

MAY_CONTAIN:
- Interceptors NestJS (Controller/Application)
- Listeners de Domain Event dedicados a observabilidade (ex.: métricas de eventos de negócio)

MUST_NOT_CONTAIN:
- Regra de negócio
- Decisão que altera o resultado de um Use Case (Observability é estritamente um efeito colateral de leitura, nunca de escrita/decisão)
```

```text
LAYER:
Configuration (transversal)

RESPONSIBILITY:
Carregar e validar variáveis de ambiente (mesmo padrão Zod já provado em apps/api/src/core/config/env.schema.ts, doc42), expondo valores já resolvidos e tipados para Persistence, Integrations, Observability e o bootstrap da aplicação.

MAY_DEPEND_ON:
- Nada (é a camada mais de borda, consumida por todas as outras camadas de infraestrutura)

MUST_NOT_DEPEND_ON:
- Domain, Application, Controllers (nenhuma delas deve ler `process.env` diretamente — sempre recebem valor já resolvido via injeção)

MAY_CONTAIN:
- Schema Zod de validação de ambiente
- Provider NestJS que expõe a config validada

MUST_NOT_CONTAIN:
- Regra de negócio
- Lógica que decide comportamento de domínio com base em env (feature flags de negócio, se existirem, são uma decisão do Use Case que RECEBE o valor resolvido, não uma leitura direta de env dentro do Domain)
```

---

## Direção de dependências

```text
Controller (HTTP)
   │  chama, mapeia DTO HTTP → input puro
   ▼
Application / Use Case
   │  chama, usando tipos puros
   ▼
Domain (entidades, value objects, domain services, Repository Ports, Integration Ports)
   ▲
   │ implements
Persistence Adapter (Drizzle)  ──implements──▶  Repository Port (declarado no Domain)
Integrations Adapter           ──implements──▶  Integration Port (declarado no Domain ou na Application)

Cross-cutting (consumidos por várias camadas acima, nunca pelo Domain):
Auth/Tenant/Authorization  → produz RequestContext, consumido por Controller (Guard) e Application (parâmetro explícito)
Observability               → instrumenta Controller/Application/Persistence/Integrations
Configuration                → resolve valores para Persistence/Integrations/Observability/bootstrap
```

Regra de seta única: nenhuma camada superior é importada por uma camada inferior. Persistence e Integrations dependem do Domain (para implementar seus Ports) mas o Domain nunca importa Persistence nem Integrations — a relação é sempre "implementa uma interface declarada acima", nunca "importa a implementação concreta abaixo".

---

## Regras obrigatórias por camada (reforço explícito do prompt)

```text
Controllers não podem conter: regra de negócio, SQL, Drizzle queries, decisão de autorização de negócio espalhada, acesso direto a integração externa.
  → Coberto pelas seções MUST_NOT_CONTAIN/MUST_NOT_DEPEND_ON de HTTP/Controllers acima.

Application/Use Cases coordenam validação contextual, autorização de negócio, operações de domínio, repositories, transactions, integrações, eventos — sem conhecer HTTP.
  → Coberto pela seção Application/Use Cases acima (MUST_NOT_DEPEND_ON: Express/@nestjs/common HTTP).

Domain não depende de NestJS HTTP, Express, Drizzle, Supabase SDK, Vercel, controllers, DTOs HTTP.
  → Coberto integralmente pela seção Domain acima.

Persistence: Drizzle restrito a esta camada; nenhuma query Drizzle em controllers ou use cases.
  → Coberto: Drizzle só aparece em MAY_DEPEND_ON de Repositories/Persistence; explicitamente ausente/proibido em todas as outras camadas.

Integrations: SDKs externos atrás de adapters/services; nenhum SDK espalhado pelos domínios.
  → Coberto pela seção Integrations acima.

Auth/Tenant: identidade só entra via request context validado; domínio nunca confia em tenant_id do body, role do cliente, user_id enviado como identidade.
  → Coberto pela seção Auth/Tenant/Authorization acima, reforçada literalmente.
```

---

## Cross-domain — regra de comunicação entre os 35 domínios

Mecanismos permitidos, escolhidos de acordo com o tipo de dependência já registrado no doc39/41 para cada caso real deste projeto:

```text
MECANISMO: Public Application Service
QUANDO USAR: dependência tipo DATA entre domínios (a maioria dos casos do doc39/41)
COMO: o domínio dependente chama um método público, explicitamente exportado, do Application layer do domínio dependido (ex.: clients chama um método público de contracts.ApplicationService; dashboard chama métodos públicos de artists/contracts/leads/support/marketing/accounting/releases — doc40) — nunca acessa Domain, Repository Port ou Persistence Adapter do outro domínio diretamente.
EXEMPLOS REAIS DESTE PROJETO: clients→contracts, marketing→artists, admin-billing→billing, dashboard→{artists,contracts,leads,support,marketing,accounting,releases}, users→rbac.

MECANISMO: Domain Event
QUANDO USAR: dependência tipo EVENT (reação assíncrona/desacoplada a algo que aconteceu em outro domínio)
COMO: o domínio de origem publica um Domain Event (ex.: "LeadConverted"); domínios interessados reagem via listener próprio, sem chamada síncrona direta.
EXEMPLO REAL DESTE PROJETO: leads→artists — a conversão de lead (evento realtime já mapeado como crm.lead.converted no doc33/37) é modelada como Domain Event publicado pelo Use Case de conversão de lead, não como o domínio leads chamando diretamente Application/Domain de artists de forma síncrona obrigatória.

MECANISMO: Explicit Port/Interface (genérico, sem alvo nomeado)
QUANDO USAR: dependência estruturalmente genérica, sem lista fixa de domínios-alvo (caso já resolvido no doc40)
COMO: o domínio dependente declara um Port genérico (ex.: um "SchemaIntrospectionPort") implementado por um mecanismo transversal que enumera metadados de qualquer domínio, em vez de importar cada domínio individualmente.
EXEMPLO REAL DESTE PROJETO: reports — doc40 já concluiu que sua dependência é "genérica/dinâmica por design", sem lista fixa; o Port reflete exatamente essa conclusão.

MECANISMO: Shared Kernel
QUANDO USAR: EXCLUSIVAMENTE para as dependências universais AUTH/TENANT/PERMISSION (33/35 e 32/35 e 8/35 domínios, doc39/41) — nunca para regra de negócio.
COMO: tipos e primitivos técnicos (RequestContext, TenantId, PermissionKey) vivem no Shared e são importados por qualquer domínio — mas o Shared nunca contém uma entidade ou regra de negócio de um domínio específico (ver seção Shared abaixo).

PROIBIDO EXPLICITAMENTE:
Um domínio importar internals de outro domínio — classes de Domain, Repository Ports, Persistence Adapters ou schema Drizzle de outro domínio. Nenhuma query Drizzle de um domínio pode ler diretamente a tabela "gerida" por outro domínio; o acesso é sempre mediado pelo Public Application Service (ou Domain Event/Port genérico, conforme o caso) do domínio dono do dado.
```

---

## Shared

```text
PODE CONTER (exclusivamente):
- Tipos de identidade/tenant/permissão (RequestContext, TenantId, PermissionKey, RoleKey) — o "shared kernel" formal desta arquitetura, espelhando as dependências universais AUTH/TENANT/PERMISSION do doc39/41
- Primitivos técnicos sem significado de negócio (tipos Result/Either genéricos, classes base de erro de aplicação/domínio, interface genérica de Domain Event bus, helpers de paginação)
- Contratos puramente estruturais reutilizados por múltiplos domínios sem carregar regra (ex.: um tipo genérico de "PaginatedResult<T>")

PROIBIDO EXPLICITAMENTE:
- Qualquer entidade, value object ou regra de negócio específica de 1+ domínios (ex.: "Contract", "Artist", "InvoiceStatus", cálculo de royalties, regra de elegibilidade de desconto) — isso pertence ao domínio dono e só é exposto a outros via Public Application Service, nunca via Shared
- Transformar Shared num "depósito genérico": qualquer PR que adicione algo a Shared precisa justificar por que é técnico/identitário e não de negócio — na dúvida, o código pertence a um domínio, não ao Shared
```

---

## Validação (respostas objetivas exigidas pelo prompt)

```text
Controller pode acessar Drizzle diretamente?
NÃO

Use case pode depender de Express?
NÃO

Domain pode depender de NestJS?
NÃO

Repository implementation pode depender de Drizzle?
SIM

Um domínio pode importar internals de outro domínio?
NÃO

Tenant pode ser aceito do body como identidade?
NÃO
```

---

## Resumo

```text
LAYERS_DEFINED:
8 (HTTP/Controllers, Application/Use Cases, Domain, Repositories/Persistence, Integrations, Auth/Tenant/Authorization, Observability, Configuration)

DEPENDENCY_DIRECTION_DEFINED:
SIM

CROSS_DOMAIN_RULE_DEFINED:
SIM

UNRESOLVED_ARCHITECTURE_DECISIONS:
0
```

## Cobertura

As 8 camadas do modelo base obrigatório foram definidas com responsabilidade, dependências permitidas/proibidas e conteúdo permitido/proibido. A direção de dependências foi definida explicitamente, incluindo o padrão Port/Adapter para Persistence e Integrations. A regra de comunicação cross-domain foi definida com 4 mecanismos permitidos, cada um mapeado a um caso real já registrado nos docs 38-41, e a importação de internals de outro domínio foi explicitamente proibida. O conteúdo permitido em Shared foi restringido a identidade/tenant/permissão e primitivos técnicos, com proibição explícita de regra de negócio. Nenhuma estrutura de diretórios, código, schema, entidade ou migration foi criada. `apps/api-v2` não foi criado. `apps/web` e `apps/api` (legacy) não foram alterados. Nenhum documento anterior foi modificado.
