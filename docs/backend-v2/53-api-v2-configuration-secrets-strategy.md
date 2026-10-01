> Historical record. Kept as recorded; not the current contract.

# 53 — Estratégia de Configuração e Secrets da `apps/api-v2`

Definição read-only de como a `apps/api-v2` carrega, valida, expõe internamente e protege configuração/secrets, sobre as restrições técnicas já levantadas ([`42`](./42-api-v2-technical-constraints.md)), a arquitetura em camadas já aprovada ([`47`](./47-api-v2-layered-architecture.md)), o RequestContext já aprovado ([`49`](./49-auth-tenant-request-context.md)) e a estratégia de observabilidade já aprovada ([`52`](./52-api-v2-observability-strategy.md)). Nenhum `.env`/`.env.example` foi criado ou alterado, nenhum ConfigModule/schema de validação foi criado, `apps/api-v2` não foi criado, nenhuma dependência foi instalada, o deployment não foi alterado. `apps/web` e `apps/api` (legacy) não foram alterados.

## Decisões fixas (não reabertas)

```text
Framework: NestJS
Banco: PostgreSQL
Database access: Drizzle ORM
Auth: Supabase Auth preservado
Observabilidade: redaction obrigatória de secrets (doc52)
```

## Evidência usada (mecanismo já provado no legacy — reaproveitado pela mesma lógica de aderência dos docs 49/50/51/52: sem exigência técnica que justifique um mecanismo diferente)

```text
apps/api/src/core/config/env.schema.ts:641-657 (validateEnv())
  → Zod (envSchema.safeParse) valida TODAS as env vars no boot; em falha, imprime cada issue
  (path + mensagem) e chama process.exit(1) — nunca sobe com configuração crítica ausente/inválida,
  nunca degrada silenciosamente. Validação cruzada adicional (isolamento de projeto Supabase por
  ambiente, "RBAC-SHADOW-01/DBCTX-01 production gate") também bloqueia o boot.

apps/api/src/core/config/env.schema.ts:1-51 (matriz de isolamento por NODE_ENV, já citada no doc42/49)
  → development→SOMENTE DEV_REF; test→NENHUM projeto remoto (sem fallback silencioso); staging→
  SOMENTE STAGING_REF; production→SOMENTE PROD_REF; denylist cruzada explícita entre ambientes.

docker-compose.yml:22 (POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?POSTGRES_PASSWORD must be set in local .env})
  → sintaxe de shell ":?" já usada no repositório para FALHAR explicitamente se um secret não for
  fornecido, em vez de um default silencioso — mesmo princípio de "nunca fallback inseguro para secret".

.env.example (doc42, já inventariado) — DATABASE_URL ("Pooler, produção, pgbouncer=true&connection_limit=1")
  vs. DIRECT_DATABASE_URL ("Para migrations, sem pooler") vs. APP_DATABASE_URL (role NOBYPASSRLS)
  → separação já existente entre conexão de runtime (pooled) e conexão de migration (direta), base da
  seção Database URL abaixo, e já fixada como convenção pelo doc46.

apps/web/Dockerfile:18-26 (ARG VITE_API_URL/VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY)
  → confirma que VITE_* é inlinado no bundle estático em build time — publicamente visível a qualquer
  um que inspecione o JS servido, base direta da seção Client-side vs. Server-side abaixo.

docs/backend-v2/25-distributor-integration-decision.md (D1 aprovada, já registrada nesta sessão)
  → "PER_TENANT_OFFICIAL_PROVIDER_AUTH", isolamento por tenant obrigatório, sem credenciais
  compartilhadas — base direta da seção Integrações por Tenant abaixo.

apps/api/src/core/security/token-verifier.service.ts (doc49, já citado)
  → fallback de token de desenvolvimento assinado com ENCRYPTION_KEY, explicitamente restrito a
  ambientes não-prod-like — base direta da seção Testes abaixo.
```

---

## Categorias de configuração

```text
APPLICATION_CONFIG:
Comportamento geral do processo — NODE_ENV, PORT, nível de log padrão, feature flags de aplicação não
ligadas a um provider específico.

DATABASE_CONFIG:
Tudo relacionado a PostgreSQL/Drizzle — conexão de runtime (pooled), conexão de migration (direta,
doc46), flag de contexto de sessão RLS (doc45/47), SSL.

SUPABASE_CONFIG:
URL do projeto Supabase, chave anônima (pública, consumida pelo frontend, não um secret server-side),
chave de service role (secret server-side), refs de projeto por ambiente (doc42/49).

AUTH_CONFIG:
Tudo relacionado à validação de JWT (doc49) — não se sobrepõe a SUPABASE_CONFIG por acaso: aqui ficam
parâmetros do MECANISMO de auth (audience esperada, flags de bypass só-dev como AUTH_DISABLED), lá
ficam as CREDENCIAIS do projeto Supabase em si.

OBSERVABILITY_CONFIG:
DSN do rastreador de exceções, nível de log, flags de habilitação de métricas/tracing (doc52).

INTEGRATION_CONFIG:
Credenciais/identificadores de PLATAFORMA (não de tenant — ver seção própria) para providers externos
— Stripe, ACRCloud, Spotify/Meta/TikTok/Google/DocuSign (OAuth da própria aplicação), Resend, R2,
provedores de IA.

SECURITY_CONFIG:
Chave de criptografia at-rest (ENCRYPTION_KEY), segredos de assinatura própria (ex.: segredo de estado
OAuth, segredo de cron), CORS origins permitidas.

DEPLOYMENT_CONFIG:
Valores que só fazem sentido por causa do alvo de deployment (doc42/43) — ex.: qual runtime está ativo
(Docker long-running vs. function serverless), URLs públicas (FRONTEND_URL/APP_URL/API_URL) usadas para
montar callbacks/CORS.

Cada categoria é um objeto TIPADO E VALIDADO separadamente (schemas distintos compostos num schema
raiz) — nunca um único blob `Record<string, string>` sem tipo, e nunca uma categoria lendo campo de
outra por engano (ex.: AUTH_CONFIG não contém a service role key — isso é SUPABASE_CONFIG).
```

---

## Environment variables — regra por variável

```text
Toda variável necessária à apps/api-v2 é declarada com, no mínimo:

- NOME              (explícito, SCREAMING_SNAKE_CASE, sem abreviação ambígua)
- TIPO                (string | número | boolean | enum | URL | JSON — tipado no schema de validação,
                    nunca lido cru como string em todo o resto do código)
- OBRIGATORIEDADE      (obrigatória em todos os ambientes | obrigatória só em produção/staging |
                    opcional)
- VALIDAÇÃO              (regra concreta — ex.: URL válida, comprimento mínimo de uma chave hex,
                    pertencer a um enum fechado — não apenas "não vazio")
- DEFAULT (quando SEGURO) (só permitido para valor NÃO-secret cujo default não enfraquece segurança —
                    ex.: PORT=3001; NUNCA um default para SECRET)
- DESCRIÇÃO                (frase curta do propósito)
- CLASSIFICAÇÃO              (SECRET | NON_SECRET — determina redaction obrigatória em log, doc52, e
                    proibição de default)

EXEMPLOS (representativos, não exaustivos — mesmo padrão aplicado às ~70 variáveis já inventariadas no
doc42, não repetidas aqui):

NOME: DATABASE_URL | TIPO: URL (postgres://) | OBRIGATORIEDADE: obrigatória | VALIDAÇÃO: formato de
connection string Postgres válido | DEFAULT: nenhum | DESCRIÇÃO: conexão de runtime (pooled) |
CLASSIFICAÇÃO: SECRET

NOME: PORT | TIPO: número | OBRIGATORIEDADE: opcional | VALIDAÇÃO: inteiro entre 1-65535 |
DEFAULT: 3001 (seguro — não-secret, não afeta segurança) | DESCRIÇÃO: porta HTTP do processo |
CLASSIFICAÇÃO: NON_SECRET

NOME: SUPABASE_SERVICE_ROLE_KEY | TIPO: string | OBRIGATORIEDADE: obrigatória (produção/staging) |
VALIDAÇÃO: formato de JWT | DEFAULT: nenhum | DESCRIÇÃO: credencial server-side do Supabase (bypassa
RLS) | CLASSIFICAÇÃO: SECRET

NOME: SUPABASE_ANON_KEY | TIPO: string | OBRIGATORIEDADE: obrigatória | VALIDAÇÃO: formato de JWT |
DEFAULT: nenhum | DESCRIÇÃO: chave pública do projeto Supabase (mesma que o frontend usa) |
CLASSIFICAÇÃO: NON_SECRET (é pública por design do Supabase Auth, distinta da service role key)

NOME: CORS_ORIGINS | TIPO: lista de URLs | OBRIGATORIEDADE: obrigatória (produção/staging) |
VALIDAÇÃO: cada item é uma URL de origem válida | DEFAULT: nenhum em produção | DESCRIÇÃO: origens
autorizadas a chamar a API | CLASSIFICAÇÃO: NON_SECRET
```

---

## Validação no boot

```text
CONFIG_VALIDATION_AT_STARTUP:
SIM — mesmo mecanismo já provado no legacy (Zod safeParse sobre todo o conjunto de env vars, mais
validação cruzada de coerência entre valores relacionados, ex.: isolamento de projeto Supabase por
ambiente).

INVALID_REQUIRED_CONFIG_BEHAVIOR:
Boot interrompido imediatamente — cada violação é reportada individualmente (nome da variável + motivo)
antes do processo encerrar com código de saída de falha. Nenhuma tentativa de "seguir mesmo assim" com
um valor parcialmente válido.

MISSING_REQUIRED_CONFIG_BEHAVIOR:
Tratada como caso particular de "inválida" pelo mesmo mecanismo (ausência de uma variável obrigatória é
uma violação de schema, não um caminho separado de silêncio/default) — mesmo resultado:
boot interrompido, motivo reportado.

Este comportamento se aplica igualmente ao runtime Docker/long-running e à function serverless da
Vercel (doc42/43) — em ambos os casos, configuração crítica ausente/inválida impede a aplicação de
começar a aceitar tráfego, nunca aceita tráfego "degradado" por falta de config.
```

---

## Secrets

```text
CLASSIFICAÇÃO (aplicada a todo campo de config, doc acima):
database credentials, credenciais server-side do Supabase, client secrets de provider, webhook
secrets, chaves privadas de API, chaves de criptografia — todos SECRET.

REGRAS OBRIGATÓRIAS (verbatim do prompt, sem exceção):
- Nunca hardcode em código-fonte — todo SECRET vem exclusivamente de variável de ambiente/gerenciador
  de secrets da plataforma de deployment, nunca de uma constante no repositório.
- Nunca commitar valor real — `.env` permanece fora do controle de versão (já confirmado no
  `.gitignore` do repositório, doc42); `.env.example` contém apenas placeholders, nunca valor real
  (mesmo padrão já seguido hoje, não alterado nesta etapa).
- Nunca expor via endpoint — nenhuma rota da apps/api-v2 (incluindo endpoints de configuração/debug)
  pode retornar o valor de um campo SECRET no corpo da resposta, mesmo para um usuário autenticado com
  papel elevado.
- Nunca registrar em log — reaproveita integralmente a política de Redaction já definida no doc52
  (authorization/cookie/password/token/secret/apiKey/refreshToken/accessToken e variações de nome),
  aplicada também aos nomes de campo desta camada de configuração (ex.: um valor de
  SUPABASE_SERVICE_ROLE_KEY nunca aparece em log, mesmo em erro de validação de boot — o
  INVALID_REQUIRED_CONFIG_BEHAVIOR reporta o NOME da variável e o motivo da falha, nunca o valor
  fornecido).
```

---

## Client-side vs. server-side

```text
FRONTEIRA:
Qualquer variável prefixada "VITE_*" é, por construção do próprio Vite, inlinada no bundle JavaScript
estático em build time — publicamente visível a qualquer um que inspecione o código servido ao
navegador (evidência concreta: apps/web/Dockerfile declara VITE_API_URL/VITE_SUPABASE_URL/
VITE_SUPABASE_ANON_KEY como ARG de build, doc42). Deve ser tratada como PÚBLICA, sem exceção — nunca um
lugar onde um SECRET é colocado "só desta vez".

REGRA OBRIGATÓRIA (verbatim do prompt):
Nenhum campo classificado SECRET nesta estratégia pode, em nenhuma circunstância, ser nomeado ou
consumido com o prefixo "VITE_*". A apps/api-v2 nunca lê uma variável "VITE_*" como fonte de um
SECRET próprio — esse prefixo é, por definição, do domínio da apps/web, não da apps/api-v2. Os únicos
valores que legitimamente aparecem tanto como "VITE_*" (lado apps/web) quanto sem prefixo (lado
apps/api-v2) são exatamente os que já são publicamente seguros por design — ex.: a URL do projeto
Supabase e a anon key (que o próprio Supabase Auth já trata como client-safe).
```

---

## Config Service — fronteira de acesso por camada

```text
REGRA (decorre diretamente da camada Configuration já definida no doc47 — não reaberta, só aplicada):
Domain Layer NUNCA acessa process.env, Nest ConfigService, ou qualquer API de ambiente da plataforma de
deployment (Vercel environment API) diretamente — nenhuma dessas três aparece em nenhum arquivo de
domain/ de nenhum dos 35 módulos.

Application/Use Case também NÃO lê process.env/ConfigService diretamente — quando um Use Case precisa
de um valor de configuração (ex.: um feature flag), ele o recebe como valor JÁ RESOLVIDO, injetado no
construtor (mesmo princípio de Dependency Injection já usado para Repository/Integration Ports no
doc47) — nunca faz uma leitura de ambiente "ad-hoc" no meio da lógica de negócio.

Persistence, Integrations, Observability e o bootstrap da aplicação (main.ts/api/index.ts, doc42) são as
ÚNICAS camadas autorizadas a consumir o ConfigService/process.env diretamente — exatamente as mesmas
camadas já listadas como MAY_DEPEND_ON de Configuration no doc47, sem alteração aqui.
```

---

## Integrações por tenant

```text
CONFIGURAÇÃO GLOBAL DA PLATAFORMA (INTEGRATION_CONFIG, variável de ambiente):
Credenciais da PRÓPRIA aplicação MUSIC OS 360 junto a um provider — ex.: a chave Stripe da conta da
plataforma, a chave ACRCloud contratada pela plataforma, o client_id/secret OAuth da aplicação
registrada junto ao Spotify/Meta/TikTok/Google/DocuSign para autenticar a APLICAÇÃO (não o tenant) nas
etapas de bridge OAuth já mapeadas no doc30/31.

CREDENCIAIS DE INTEGRAÇÃO DE CADA TENANT (dado, nunca variável de ambiente):
Credenciais que um tenant específico possui junto a um provider (ex.: a conta de distribuidora do
tenant, tokens de anúncio do tenant) — são DADO de negócio, armazenadas no banco por tenant, com
isolamento e criptografia at-rest (ENCRYPTION_KEY, categoria SECURITY_CONFIG), consistente com a
decisão D1 já aprovada (doc25: PER_TENANT_OFFICIAL_PROVIDER_AUTH, sem credenciais compartilhadas).
Uma variável de ambiente é, por natureza, singular por deployment — estruturalmente incompatível com
"N tenants, cada um com sua própria credencial", então nunca é o mecanismo certo para este caso.

TENANT_PROVIDER_CREDENTIALS_AS_ENV:
NÃO
```

---

## Ambientes

```text
DEVELOPMENT:
Config crítica ainda obrigatória (banco, Supabase), mas com defaults NON_SECRET permitidos (porta,
nível de log verboso) e um fallback de token de auth só-dev já evidenciado (HS256 assinado com
ENCRYPTION_KEY, doc49) — nunca um fallback que aceite tráfego SEM validar identidade alguma fora do
caso já registrado (AUTH_DISABLED, que é um flag explícito e auditável, não um comportamento implícito).

TEST:
Isolamento mais estrito de todos os ambientes — NENHUM projeto Supabase remoto é aceito (mesma regra já
evidenciada no legacy, sem fallback silencioso para o ref de DEV) — testes rodam contra infraestrutura
inteiramente local/local-simulada (ver seção Testes).

STAGING:
Tratado como "prod-like" para fins de segurança (mesmo critério já evidenciado: bypasses só-dev ficam
desabilitados) — usa SEU PRÓPRIO conjunto de credenciais/ref, nunca o de produção nem o de
desenvolvimento (isolamento cruzado, mesma matriz do doc42/49).

PRODUCTION:
Nenhum default de secret, nenhum bypass de auth, isolamento de ref Supabase estrito (SOMENTE PROD_REF),
falha de boot em qualquer configuração crítica ausente/inválida (seção Validação no Boot).

ISOLAMENTO:
Cada ambiente só pode referenciar recursos (projeto Supabase, banco) da SUA PRÓPRIA categoria — uma
denylist cruzada explícita (não apenas uma allowlist) impede que uma config mal editada de um ambiente
aponte silenciosamente para o recurso de outro, mesmo mecanismo já evidenciado e reaproveitado sem
alteração.

PROIBIÇÃO DE FALLBACK INSEGURO:
Nenhum SECRET tem default em nenhum ambiente (nem development) — a única forma de "afrouxamento" de
segurança permitida em development é um mecanismo explícito, nomeado e auditável (ex.: o token de dev
HS256, ou o flag AUTH_DISABLED), nunca um "se a variável não existir, segue sem validar".
```

---

## Testes

```text
TEST_CONFIG_STRATEGY:
Testes fornecem sua própria configuração local/dummy, nunca secrets produtivos — 3 mecanismos
combináveis: (1) valores fixos, não-secretos, gerados localmente só para o processo de teste (ex.: uma
ENCRYPTION_KEY de teste, não a de produção); (2) o mesmo fallback de token HS256 já evidenciado no
doc49, que existe justamente para permitir testar fluxos autenticados sem depender de um Supabase real;
(3) para persistência, um Postgres local (docker-compose, já disponível no repositório, doc42) ou
persistência inteiramente mockada nos testes unitários de Domain/Application (que, por definição do
doc47, não dependem de Drizzle de qualquer forma). A regra de isolamento de ambiente "test → NENHUM
projeto Supabase remoto" (seção Ambientes) é o guard-rail que impede um teste de acidentalmente atingir
infraestrutura real mesmo que o `.env` local do desenvolvedor contenha credenciais reais de staging/
produção.
```

---

## Database URL — runtime vs. migration

```text
RUNTIME DATABASE CONNECTION (DATABASE_CONFIG):
Usada pelo Drizzle Client em toda operação do processo em execução (Docker long-running ou function
serverless) — aponta para a connection string COM pooler (pgbouncer, modo transação), já uma convenção
existente no repositório (.env.example, DATABASE_URL comentada como "Pooler, produção,
pgbouncer=true&connection_limit=1", doc42/45).

MIGRATION DATABASE CONNECTION (DATABASE_CONFIG, campo distinto):
Usada exclusivamente pela ferramenta de migration (Drizzle Kit, doc46) — aponta para a connection
string SEM pooler ("direta"), já uma convenção existente e explicitamente separada no repositório
(.env.example, DIRECT_DATABASE_URL comentada como "Para migrations, sem pooler"). Necessária porque
DDL/execução de migration depende de garantias de sessão (ex.: locks) que um pooler em modo transação
pode quebrar.

Nenhum valor real é definido aqui — apenas a separação conceitual, já herdada como convenção do
doc46 e agora formalizada como 2 campos distintos e tipados dentro de DATABASE_CONFIG, nunca a mesma
variável reaproveitada para os dois usos.
```

---

## Configurações de integração — por provider

```text
CAMPOS POSSÍVEIS POR PROVIDER (nem todo provider usa todos):
- provider identifier      (nome estável do provider, usado como chave — ex.: "spotify", "acrcloud")
- client/public identifier   (quando o provider usa OAuth — ex.: SPOTIFY_CLIENT_ID; nulo quando não
                            aplicável)
- client secret                (quando o provider usa OAuth — ex.: SPOTIFY_CLIENT_SECRET;
                            classificado SECRET)
- API key                        (quando o provider usa autenticação simples por chave, não OAuth —
                            ex.: ACRCLOUD_ACCESS_KEY/ACRCLOUD_ACCESS_SECRET, YOUTUBE_API_KEY,
                            ANTHROPIC_API_KEY, RESEND_API_KEY; classificado SECRET, exceto quando o
                            próprio provider já trata a chave como pública)
- callback URL                     (quando o provider usa OAuth — ex.: SPOTIFY_REDIRECT_URI,
                            META_REDIRECT_URI; deve corresponder ao APP_URL/API_URL do ambiente
                            corrente, nunca hardcoded para produção em outro ambiente)
- host/base URL                      (quando o provider expõe um endpoint configurável — ex.:
                            ACRCLOUD_HOST, OPENAI_BASE_URL)
- feature availability                 (derivado, não uma variável própria — calculado a partir da
                            presença/completude das credenciais daquele provider no ambiente
                            corrente, não um flag mantido manualmente em paralelo que pode divergir
                            da config real)

NÃO ASSUMIDO: nem todo provider usa OAuth — confirmado pelo próprio inventário do doc42 (ACRCloud,
YouTube, Resend, provedores de IA usam chave simples; Spotify/Meta/TikTok/Google Ads/DocuSign usam
OAuth) — o schema de INTEGRATION_CONFIG suporta as duas formas, nunca força um provider de chave
simples a ter campos client_id/redirect_uri vazios só para caber num formato único.
```

---

## Validação (respostas objetivas exigidas pelo prompt)

```text
Config crítica é validada no startup?
SIM

Secret privado pode usar VITE_*?
NÃO

Domain acessa process.env diretamente?
NÃO

Credencial de integração de tenant fica em env global?
NÃO

Secrets podem aparecer em logs?
NÃO

Testes dependem de secrets produtivos?
NÃO

Migration connection pode ser separada da runtime connection?
SIM
```

---

## Resumo

```text
UNRESOLVED_CONFIG_DECISIONS:
0
```

## Cobertura

8 categorias de configuração definidas (tipadas separadamente, não um blob genérico). Regra por
variável (nome/tipo/obrigatoriedade/validação/default/descrição/classificação) definida e ilustrada com
5 exemplos representativos das ~70 variáveis já inventariadas no doc42. Validação no boot definida como
fail-fast (mesmo mecanismo já provado no legacy). Secrets: 4 regras obrigatórias definidas, reaproveitando
a política de redaction do doc52. Fronteira VITE_*/server-side definida com evidência concreta de build
time do Dockerfile do apps/web. Fronteira de acesso a config por camada definida, reaproveitando a
Configuration layer já fixada no doc47. Integrações por tenant diferenciadas de config global de
plataforma, com a regra TENANT_PROVIDER_CREDENTIALS_AS_ENV: NÃO explicitamente registrada e ancorada na
decisão D1 já aprovada (doc25). 4 ambientes definidos com isolamento e proibição de fallback inseguro.
Estratégia de config de teste definida sem depender de secrets produtivos. Separação runtime/migration
de connection string definida sem valores reais. Configuração de integração por provider definida sem
assumir OAuth universal. Nenhum `.env`/`.env.example` foi criado ou alterado, nenhum ConfigModule/schema
de validação foi criado, `apps/api-v2` não foi criado, nenhuma dependência foi instalada, o deployment
não foi alterado. `apps/web` e `apps/api` (legacy) não foram alterados. Nenhum documento anterior foi
modificado.
