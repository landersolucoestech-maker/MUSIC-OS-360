> Historical record. Kept as recorded; not the current contract.

# 04 — Arquitetura da Camada HTTP do Frontend (`apps/web`)

Mapeamento read-only, a partir de [`03-frontend-data-access-surface.md`](./03-frontend-data-access-surface.md), aprofundando os arquivos que efetivamente implementam ou configuram transporte HTTP. Nenhum arquivo foi alterado. Não foram listados endpoints, bodies ou responses específicas de domínio.

## Resumo executivo

Existe **um cliente HTTP canônico** (`shared/lib/api-client.ts`, re-exportado por `lib/api.ts`) que a maioria dos `*.service.ts` e hooks usa. Em paralelo, há **9 outros pontos** que fazem `fetch()` fora desse cliente — a maioria por necessidade legítima (upload multipart, download de blob, redirecionamento OAuth, chamada a serviço externo de terceiro), mas **2 deles (`useAI.ts`, `useACRCloud.ts`) chamam o backend diretamente sem reusar a injeção de `Authorization`/`X-Tenant-ID` do cliente canônico** — divergência real de arquitetura, registrada abaixo, sem correção.

---

## CANONICAL

### ARQUIVO: `apps/web/src/shared/lib/api-client.ts`

```text
RESPONSABILIDADE:
Cliente HTTP central da aplicação. Gerencia token/tenant em memória (module-level
singletons `_accessToken`/`_tenantId`), injeta headers de auth em toda chamada,
mapeia status HTTP para subclasses de DomainError, expõe `api` (autenticado) e
`publicApi` (sem auth). Também expõe TABLE_ENDPOINT (mapa tabela lógica → rota
REST) e PENDING_TABLES (tabelas sem endpoint backend ainda).

TRANSPORTE:
fetch

BASE URL:
`${API_BASE_URL}/api/v1${path}` — API_BASE_URL vem de shared/lib/env.ts (ver seção
"API_BASE_URL" abaixo). String vazia = URL relativa (mesma origem, proxy do Vite
em dev).

MÉTODOS DISPONÍVEIS:
- GET    (api.get, publicApi.get)
- POST   (api.post, publicApi.post)
- PUT    (api.put)
- PATCH  (api.patch)
- DELETE (api.delete)
(publicApi só expõe GET e POST)

AUTENTICAÇÃO:
Token e tenant NÃO são lidos de storage no momento da chamada — ficam em
variáveis de módulo (`_accessToken`, `_tenantId`) setadas externamente via
`setAccessToken()`/`setTenantId()`. Quem chama esses setters é
`apps/web/src/app/providers/AuthContext.tsx`, toda vez que a sessão Supabase
muda (`sb.auth.getSession()`, `sb.auth.onAuthStateChange(...)`,
`refreshSession()`) — ver seção "JWT_INJECTION_LOCATION" abaixo. O próprio
lifecycle do token (refresh automático, persistência) é delegado ao SDK do
Supabase, não ao api-client.

HEADERS GLOBAIS:
- `Content-Type: application/json` (sempre)
- `Authorization: Bearer <token>` (se `_accessToken` setado — `api`, não `publicApi`)
- `X-Tenant-ID: <tenantId>` (se `_tenantId` setado — `api`, não `publicApi`)
- `credentials: "include"` em toda chamada de `api` (não em `publicApi`)

TRATAMENTO DE RESPONSE:
Espera envelope `{ data: T, timestamp: string }` e retorna só `payload.data`.
Status 204 retorna `undefined`.

TRATAMENTO DE ERRO:
`mapError()` lê `res.json()` (com fallback silencioso se não for JSON) e lança
subclasses tipadas de erro por status: 400→ValidationError, 403→TenantError
(ou PasswordChangeRequiredError se `body.error === "MUST_CHANGE_PASSWORD"`),
404→NotFoundError, 409→ConflictError, default→IntegrationError. Em 401,
adicionalmente: limpa o token (`setAccessToken(null)`) e ativa um circuit-breaker
de 30s (`AUTH_BACKOFF_MS`) — durante essa janela, `request()` nem chega a
chamar `fetch`, e um EventTarget (`_authBus`) emite `"invalid"` para quem
escutar via `onAuthInvalidated()`.

TIMEOUT:
NÃO IDENTIFICADO — nenhum `AbortController`/timeout no `request()`/`publicRequest()`.

RETRY:
Não. Nenhuma lógica de retry automático (o circuit-breaker de 401 é supressão,
não retry).

CONSUMIDORES PRINCIPAIS:
- Todos os 34 arquivos `*.service.ts` de `apps/web/src/modules/**` (ver doc 03)
- A maior parte dos hooks classificados API_HTTP em `03-frontend-data-access-surface.md`
- `apps/web/src/lib/api.ts` (re-export)
- `apps/web/src/shared/lib/storage.ts`, `apps/web/src/modules/reports/services/reports-api.ts`,
  `apps/web/src/modules/integrations/clients/stripe.client.ts`, `apps/web/src/shared/hooks/useUploadToR2.ts`
  (todos reusam `api`/`getAccessToken`/`getTenantId` como base)
```

### ARQUIVO: `apps/web/src/lib/api.ts`

```text
RESPONSABILIDADE:
Barrel de re-export — não é uma implementação separada. Re-exporta
`api, setAccessToken, getAccessToken, TABLE_ENDPOINT, PENDING_TABLES` de
`shared/lib/api-client.ts`. Comentário no próprio arquivo: "Ponto de entrada
canónico para o cliente HTTP [...] para que novos módulos importem sempre de
@/lib/api em vez de @/shared/lib/api-client".

TRANSPORTE: (mesmo de api-client.ts — não implementa transporte próprio)
BASE URL: (mesmo de api-client.ts)
MÉTODOS DISPONÍVEIS: (mesmos de api-client.ts, subset re-exportado)
AUTENTICAÇÃO: (mesma de api-client.ts)
HEADERS GLOBAIS: (mesmos de api-client.ts)
TRATAMENTO DE RESPONSE: (mesmo de api-client.ts)
TRATAMENTO DE ERRO: (mesmo de api-client.ts)
TIMEOUT: NÃO IDENTIFICADO (herdado)
RETRY: Não (herdado)

CONSUMIDORES PRINCIPAIS:
- `apps/web/src/modules/settings/services/company-logo.service.ts` (import dinâmico
  `await import("@/shared/lib/api-client")` para `removeLogo`, mas importa de
  `@/lib/api` implicitamente em outros pontos do módulo — uso misto observado)
```

**Observação:** apesar de o comentário do arquivo dizer que `@/lib/api` deveria ser o ponto de entrada preferido, a maioria esmagadora do código (34 services + dezenas de hooks) importa diretamente de `@/shared/lib/api-client`, não de `@/lib/api`. Registrado como fato — não investigado se é intencional ou uma migração incompleta.

---

## SPECIALIZED

### ARQUIVO: `apps/web/src/shared/lib/storage.ts`

```text
RESPONSABILIDADE:
Camada de abstração genérica "tabela lógica → CRUD REST", construída sobre `api`
(api-client.ts). Implementa uma interface `StoragePort` (list/findById/getById/
create/update/updateOptimistic/delete/getAuditLog) que traduz um nome de tabela
(ex.: "artistas") para a rota real via `TABLE_ENDPOINT`.

TRANSPORTE: fetch (indireto, via `api` de api-client.ts — não chama fetch diretamente)
BASE URL: herdada de api-client.ts
MÉTODOS DISPONÍVEIS: GET, POST, PUT/PATCH, DELETE (via api.*, mapeados para os
  verbos do StoragePort)
AUTENTICAÇÃO: herdada de api-client.ts (nenhuma injeção própria)
HEADERS GLOBAIS: herdados de api-client.ts
TRATAMENTO DE RESPONSE: delega a api-client.ts, mais mapeamento de envelope
  `ListEnvelope<T>` (data + meta.total/limit/offset) para paginação
TRATAMENTO DE ERRO: delega a api-client.ts (NotFoundError, IntegrationError
  re-usados de ./errors)
TIMEOUT: NÃO IDENTIFICADO (herdado)
RETRY: Não (herdado)

CONSUMIDORES PRINCIPAIS:
- Não determinado nesta etapa (fora de escopo — doc 03 não isolou consumidores
  específicos de storage.ts; aparece como um dos 60 arquivos API_HTTP)
```

### ARQUIVO: `apps/web/src/modules/reports/services/reports-api.ts`

```text
RESPONSABILIDADE:
Cliente dedicado da Central de Relatórios. Usa `api` (api-client.ts) para chamadas
JSON normais, mas implementa fetch cru próprio para dois casos que retornam
binário: exportBlob() e importTemplateBlob() (download de arquivo .xlsx).

TRANSPORTE: fetch direto (para os 2 métodos de blob) + api.* (para o resto)
BASE URL: `${API_BASE_URL}/api/v1/reports/...` — mesma fonte (env.ts) que api-client.ts,
  montada manualmente nesses 2 métodos em vez de delegar a request() interno de
  api-client.ts
MÉTODOS DISPONÍVEIS: GET (blob), demais via api.* (não enumerado aqui — fora do
  escopo "não mapear endpoints ainda")
AUTENTICAÇÃO:
  Própria função local `authenticatedHeaders()` reconstrói manualmente
  `Authorization: Bearer <token>` e `X-Tenant-ID`, chamando
  `getAccessToken()`/`getTenantId()` importados de api-client.ts — ou seja, reusa
  o MESMO estado de token/tenant do cliente canônico, mas monta o header à mão
  em vez de passar pelo `request()` interno (necessário porque `api.*` só
  devolve JSON, não Response/Blob cru).
HEADERS GLOBAIS: Authorization + X-Tenant-ID (via authenticatedHeaders()) +
  `credentials: "include"`
TRATAMENTO DE RESPONSE: `response.blob()` + leitura de `content-type`/filename
  do header (não usa o envelope `{data, timestamp}` do api-client.ts — resposta
  é binária)
TRATAMENTO DE ERRO: `responseError(response, ...)` próprio (não é o `mapError`
  de api-client.ts)
TIMEOUT: NÃO IDENTIFICADO
RETRY: Não

CONSUMIDORES PRINCIPAIS:
- `apps/web/src/modules/reports/hooks/useReports.ts` (presumido pela nomenclatura
  do módulo — não confirmado nesta etapa)
```

### ARQUIVO: `apps/web/src/modules/settings/services/company-logo.service.ts`

```text
RESPONSABILIDADE:
Upload/remoção da logo do workspace. `saveLogo()` monta um fetch multipart
(FormData) próprio porque `api.post()` de api-client.ts só serializa JSON
(`JSON.stringify(body)`), incompatível com upload de arquivo. `removeLogo()`,
por outro lado, usa `api.delete()` normalmente (import dinâmico de api-client.ts).

TRANSPORTE: fetch direto (saveLogo) + api.* (removeLogo)
BASE URL: `${API_BASE_URL}/api/v1/workspaces/{id}/logo` — montada manualmente,
  mesma fonte de env.ts
MÉTODOS DISPONÍVEIS: POST (saveLogo, multipart), DELETE (removeLogo, via api.delete)
AUTENTICAÇÃO: manual — `getAccessToken()`/`getTenantId()` de api-client.ts,
  header montado à mão (mesmo padrão de reports-api.ts)
HEADERS GLOBAIS: Authorization + X-Tenant-ID; SEM Content-Type manual — deixa o
  browser definir o boundary multipart automaticamente
TRATAMENTO DE RESPONSE: `res.json()` com fallback `payload.data?.logoUrl ??
  payload.logoUrl`
TRATAMENTO DE ERRO: `throw new Error("Falha ao enviar a logo...")` genérico —
  não usa as subclasses de DomainError de api-client.ts
TIMEOUT: NÃO IDENTIFICADO
RETRY: Não

CONSUMIDORES PRINCIPAIS:
- Não determinado nesta etapa (presumido: tela de Configurações/Perfil de workspace)
```

### ARQUIVO/TRECHO: `apps/web/src/modules/settings/pages/Configuracoes.tsx` (função `openExternalOAuth`)

```text
RESPONSABILIDADE:
Inicia o fluxo OAuth de integrações externas (ex.: DocuSign) que precisam abrir
um popup e navegar o popup para uma URL de terceiro — algo que o wrapper `api`
não faz (ele só retorna dados, não controla navegação de janela).

TRANSPORTE: fetch direto
BASE URL: `${API_BASE_URL}/api/v1/integrations/oauth/init` — montada manualmente
MÉTODOS DISPONÍVEIS: POST
AUTENTICAÇÃO: manual — `getAccessToken()` de api-client.ts, header montado à mão
  (mesmo padrão dos dois itens acima). SEM injeção de X-Tenant-ID aqui (diferença
  notada frente a reports-api.ts/company-logo.service.ts, que injetam os dois).
HEADERS GLOBAIS: Content-Type + Authorization (sem X-Tenant-ID)
TRATAMENTO DE RESPONSE: `response.json()` para extrair `exchange_token`, guardado
  em `sessionStorage`, depois navega o popup (`popup.location.href =
  "/oauth/{platform}?nonce=..."`)
TRATAMENTO DE ERRO: `throw new Error("Não foi possível iniciar a autorização.")`
  genérico, capturado localmente e mostrado via toast
TIMEOUT: NÃO IDENTIFICADO
RETRY: Não

CONSUMIDORES PRINCIPAIS:
- Uso local, inline dentro do componente `Configuracoes.tsx` — não é um módulo
  reutilizável por outros arquivos.
```

### ARQUIVO: `apps/web/src/shared/hooks/useUploadToR2.ts`

```text
RESPONSABILIDADE:
Upload de arquivo direto ao Cloudflare R2 via URL pré-assinada, em 3 passos
documentados no próprio cabeçalho do arquivo: (1) POST /uploads/presign via
`api` (backend) → (2) PUT direto à `presignedUrl` retornada (fetch cru, direto
ao R2, SEM headers de auth — a própria URL já contém a assinatura) →
(3) POST /uploads/:id/confirm via `api` (backend, não mostrado no trecho lido).

TRANSPORTE: api.* (passos 1 e 3, backend) + fetch direto (passo 2, Cloudflare R2 —
  NÃO é o backend `apps/api`)
BASE URL: passo 1/3 herdam API_BASE_URL de api-client.ts; passo 2 usa a URL
  completa retornada pelo backend (domínio R2/Cloudflare, fora do controle deste
  arquivo)
MÉTODOS DISPONÍVEIS: POST (presign, confirm, via api.*), PUT (upload direto ao R2)
AUTENTICAÇÃO: passo 1/3 herdam de api-client.ts; passo 2 NÃO tem Authorization —
  comentário explícito no código: "PUT directo ao R2 — sem headers de auth (URL
  já está assinada)"
HEADERS GLOBAIS: passo 2 só define `Content-Type: <mime do arquivo>`
TRATAMENTO DE RESPONSE: passo 2 checa `putRes.ok`; resposta do R2 não é parseada
  (é um upload, não uma leitura)
TRATAMENTO DE ERRO: classe própria `R2NotConfiguredError` para status 503 do
  backend (detectado via `isR2NotConfigured()`); erro genérico
  `Error("R2 upload falhou: ...")` para falha do PUT ao R2
TIMEOUT: NÃO IDENTIFICADO
RETRY: Não

CONSUMIDORES PRINCIPAIS:
- Não determinado nesta etapa (hook reutilizável, presumivelmente usado em
  qualquer tela com upload de arquivo)
```

### ARQUIVO: `apps/web/src/shared/lib/masks.ts` (função de busca de CEP)

```text
RESPONSABILIDADE:
Consulta de CEP (código postal brasileiro) via ViaCEP — serviço de TERCEIRO,
não é o backend `apps/api` nem storage interno.

TRANSPORTE: fetch direto
BASE URL: `https://viacep.com.br/ws/{cep}/json/` — hard-coded, domínio externo
MÉTODOS DISPONÍVEIS: GET
AUTENTICAÇÃO: nenhuma (API pública, sem chave)
HEADERS GLOBAIS: nenhum além do padrão do fetch
TRATAMENTO DE RESPONSE: `response.json()`, retorna `null` se `data.erro`
TRATAMENTO DE ERRO: não detalhado no trecho lido (fora de escopo aprofundar)
TIMEOUT: 5000ms — ÚNICO client desta lista com timeout explícito, via
  `AbortController` + `setTimeout(() => controller.abort(), 5000)`
RETRY: Não

CONSUMIDORES PRINCIPAIS:
- Não determinado nesta etapa (presumido: formulários com campo de endereço)
```

### ARQUIVO: `apps/web/src/modules/marketing/components/campaign-builder/useIbgeLocations.ts`

```text
RESPONSABILIDADE:
Consulta de localidades brasileiras (estados/municípios) via API do IBGE
(governo brasileiro) e geocodificação via Nominatim (OpenStreetMap) — ambos
serviços de TERCEIRO.

TRANSPORTE: fetch direto (2 bases distintas)
BASE URL: `IBGE_BASE` (`.../localidades/estados/{uf}/municipios`) e
  `NOMINATIM_BASE` (`.../search?...`) — constantes não lidas neste trecho, mas
  hard-coded no arquivo (domínios externos)
MÉTODOS DISPONÍVEIS: GET
AUTENTICAÇÃO: nenhuma (APIs públicas)
HEADERS GLOBAIS: NÃO IDENTIFICADO no trecho lido
TRATAMENTO DE RESPONSE / ERRO: NÃO aprofundado nesta etapa
TIMEOUT: NÃO IDENTIFICADO
RETRY: NÃO IDENTIFICADO

CONSUMIDORES PRINCIPAIS:
- Uso local, dentro do campaign-builder de Marketing.
```

### ARQUIVO: `apps/web/src/shared/components/ChatAttachment.tsx`

```text
RESPONSABILIDADE:
Faz `fetch(attachment.url)` para baixar/exibir um anexo já enviado — a URL já
vem pronta (provavelmente uma URL assinada de storage), o componente não
constrói base URL nem injeta auth.

TRANSPORTE: fetch direto
BASE URL: N/A — usa `attachment.url` já resolvida por quem chamou o componente
MÉTODOS DISPONÍVEIS: GET (implícito)
AUTENTICAÇÃO: nenhuma injetada aqui
HEADERS GLOBAIS: nenhum
TRATAMENTO DE RESPONSE / ERRO: NÃO aprofundado nesta etapa
TIMEOUT: NÃO IDENTIFICADO
RETRY: NÃO IDENTIFICADO

CONSUMIDORES PRINCIPAIS:
- Componente de UI usado onde anexos de chat são exibidos.
```

---

## DUPLICATE

### ARQUIVO: `apps/web/src/shared/hooks/useAI.ts`

```text
RESPONSABILIDADE:
Chama o endpoint de geração de IA do backend diretamente via fetch cru — reimplementa
um subconjunto do que api-client.ts já faz (POST + JSON + tratamento de erro),
SEM reusar api-client.ts.

TRANSPORTE: fetch direto
BASE URL: string relativa hard-coded `"/api/v1/ai/generate"` — não usa
  `API_BASE_URL` de env.ts nem a função `request()` de api-client.ts
MÉTODOS DISPONÍVEIS: POST
AUTENTICAÇÃO: NENHUMA injeção de Authorization/X-Tenant-ID neste arquivo —
  não importa `getAccessToken`/`getTenantId` de api-client.ts. Depende
  inteiramente de cookie same-origin (se o backend aceitar) ou está,
  na prática, sem autenticação explícita nesta chamada.
HEADERS GLOBAIS: apenas `Content-Type: application/json`
TRATAMENTO DE RESPONSE: `res.json()` direto (não espera o envelope
  `{data, timestamp}` de api-client.ts)
TRATAMENTO DE ERRO: `Error(err.error || "Erro ${res.status}")` genérico —
  não usa as subclasses de DomainError
TIMEOUT: NÃO IDENTIFICADO
RETRY: Não

CONSUMIDORES PRINCIPAIS:
- `useAI()` hook (useMutation), consumido em telas com geração de conteúdo IA
  (não enumerado nesta etapa).
```

### ARQUIVO: `apps/web/src/modules/integrations/hooks/useACRCloud.ts`

```text
RESPONSABILIDADE:
Chama o endpoint de reconhecimento ACRCloud do backend diretamente via fetch
cru, mesmo padrão de useAI.ts — reimplementação paralela, não reuso de
api-client.ts. O próprio arquivo trata os outros 3 sub-endpoints ("copyright",
"catalog", "monitor") como NÃO IMPLEMENTADOS (`apiPath = null` → throw).

TRANSPORTE: fetch direto
BASE URL: string relativa hard-coded `"/api/v1/integrations/acrcloud/recognize"`
  — mesmo padrão de useAI.ts, não usa API_BASE_URL nem request() de api-client.ts
MÉTODOS DISPONÍVEIS: POST (só "recognize" tem endpoint real; "copyright",
  "catalog", "monitor" lançam erro "Endpoint ACRCloud real nao implementado")
AUTENTICAÇÃO: NENHUMA injeção de Authorization/X-Tenant-ID neste arquivo —
  mesmo padrão de useAI.ts.
HEADERS GLOBAIS: apenas `Content-Type: application/json`
TRATAMENTO DE RESPONSE: `unwrapApiResponse()` própria (extrai `.data` se existir,
  senão usa o payload cru) — reimplementa parcialmente o que `request()` de
  api-client.ts já faz (`payload.data`)
TRATAMENTO DE ERRO: `Error(err.error ?? err.message ?? "HTTP ${res.status}")`
  genérico — não usa as subclasses de DomainError
TIMEOUT: NÃO IDENTIFICADO
RETRY: Não

CONSUMIDORES PRINCIPAIS:
- Hooks/telas de monitoramento de conteúdo via ACRCloud (não enumerado nesta etapa).
```

**Observação sobre os dois DUPLICATE:** ambos convergem no mesmo padrão — path relativo hard-coded, sem import de api-client.ts, sem header de auth, tratamento de erro próprio e ligeiramente diferente do canônico. Não foi verificado nesta etapa (fora do escopo — "não analisar bodies/regras de negócio ainda") se as rotas correspondentes no backend (`/api/v1/ai/generate`, `/api/v1/integrations/acrcloud/recognize`) toleram chamada sem `Authorization`/`X-Tenant-ID` explícitos (ex.: por estarem atrás de outro mecanismo, ou por dependerem de cookie de sessão same-origin) ou se isso é uma lacuna real de autenticação — registrado como fato a investigar em etapa futura, não como correção.

---

## LEGACY

Nenhum arquivo identificado nesta etapa se encaixa como "implementação antiga, substituída mas ainda presente" — não há evidência (comentário, nome, ou padrão morto) de um cliente HTTP anterior ao atual sendo mantido por compatibilidade. `0` arquivos nesta categoria.

## UNKNOWN

Nenhum arquivo ficou sem classificação clara dentro do escopo "cliente/wrapper HTTP". `0` arquivos nesta categoria.

**Fora do escopo desta classificação (não é HTTP):** `apps/web/src/shared/lib/ws-client.ts` implementa um cliente **Socket.IO** (WebSocket persistente para a API NestJS), não um cliente HTTP request/response — mencionado aqui para registro, mas não contado nos totais abaixo por não se encaixar em nenhuma das 5 categorias pedidas (todas pressupõem semântica HTTP request/response).

---

## API_BASE_URL — origem e resolução

Definida em `apps/web/src/shared/lib/env.ts`:

```ts
export const API_BASE_URL: string = sanitizeApiBase(
  (import.meta.env.VITE_API_URL as string | undefined) ?? "",
);
```

- Lida de `VITE_API_URL` (variável de ambiente Vite).
- `sanitizeApiBase()` remove sufixos `/api/v1` ou `/api` e barra final, para evitar duplicação — o próprio api-client.ts já anexa `/api/v1` na frente de cada `path`.
- Se `VITE_API_URL` não estiver definida: `API_BASE_URL = ""` → URLs relativas (mesma origem, resolvidas pelo proxy do Vite em dev). Em produção, `validateFrontendEnv()` (também em env.ts) torna `VITE_API_URL` **obrigatória** e interrompe a renderização (`root.innerHTML` = tela de erro) se estiver ausente.
- Os clientes SPECIALIZED que montam URL manualmente (`reports-api.ts`, `company-logo.service.ts`, `Configuracoes.tsx`) todos importam o mesmo `API_BASE_URL` de `env.ts` — não há uma segunda fonte de verdade para a base URL. Os dois DUPLICATE (`useAI.ts`, `useACRCloud.ts`) usam string relativa hard-coded, ignorando `API_BASE_URL` completamente (equivalente na prática quando `API_BASE_URL === ""`, mas divergente em builds onde `VITE_API_URL` aponta para outro host).

## JWT — como chega ao cliente HTTP

1. `apps/web/src/lib/supabase.ts` cria o client Supabase (`persistSession: true`, `autoRefreshToken: true`, `storageKey: "musicos360_auth"`, `storage: window.localStorage`).
2. `apps/web/src/app/providers/AuthContext.tsx` é o único lugar que chama `setAccessToken()`/`setTenantId()` (além do próprio api-client.ts e seu teste). Isso acontece em 3 pontos do arquivo:
   - Na carga inicial, via `sb.auth.getSession()`.
   - A cada mudança de estado de auth, via `sb.auth.onAuthStateChange((event, sbSession) => ...)`.
   - Após `ensureWorkspaceProvisioned()` (fluxo de provisionamento de workspace novo).
3. `api-client.ts` guarda esses valores em variáveis de módulo (`_accessToken`, `_tenantId`) e os injeta em todo request feito via `api.*` (não via `publicApi.*`).
4. Os SPECIALIZED que montam fetch manualmente (`reports-api.ts`, `company-logo.service.ts`, `Configuracoes.tsx`) leem o token via `getAccessToken()`/`getTenantId()` **exportados do mesmo api-client.ts** — ou seja, é a mesma fonte de verdade, só que a montagem do header é manual em vez de passar por `request()`.
5. Os DUPLICATE (`useAI.ts`, `useACRCloud.ts`) não leem token nenhum.

---

## Totais

```text
TOTAL_HTTP_CLIENTS: 12

CANONICAL_CLIENTS: 2

SPECIALIZED_CLIENTS: 8

LEGACY_CLIENTS: 0

DUPLICATE_CLIENTS: 2

UNKNOWN_CLIENTS: 0

PRIMARY_HTTP_CLIENT: apps/web/src/shared/lib/api-client.ts

API_BASE_URL_SOURCE: VITE_API_URL (Vite env var, lida e sanitizada em apps/web/src/shared/lib/env.ts; string vazia = URL relativa)

JWT_INJECTION_LOCATION: apps/web/src/shared/lib/api-client.ts (função request(), headers Authorization/X-Tenant-ID) — alimentado por apps/web/src/app/providers/AuthContext.tsx via setAccessToken()/setTenantId()
```

Contagem detalhada (12 = 2 CANONICAL + 8 SPECIALIZED + 2 DUPLICATE):

- CANONICAL: `shared/lib/api-client.ts`, `lib/api.ts`
- SPECIALIZED: `shared/lib/storage.ts`, `modules/reports/services/reports-api.ts`, `modules/settings/services/company-logo.service.ts`, `modules/settings/pages/Configuracoes.tsx` (trecho `openExternalOAuth`), `shared/hooks/useUploadToR2.ts`, `shared/lib/masks.ts` (ViaCEP), `modules/marketing/components/campaign-builder/useIbgeLocations.ts` (IBGE/Nominatim), `shared/components/ChatAttachment.tsx`
- DUPLICATE: `shared/hooks/useAI.ts`, `modules/integrations/hooks/useACRCloud.ts`

## Cobertura

Esta lista não é necessariamente exaustiva — foi construída a partir dos arquivos já mapeados em `03-frontend-data-access-surface.md` (categorias API_HTTP e alguns WRAPPER) mais 1 rodada de leitura de código de cada candidato para confirmar se implementa/configura request diretamente. Não foi lido o conteúdo completo de todos os 60 arquivos API_HTTP do doc 03 — apenas os que continham `fetch(` direto ou evidência de montar headers/URL manualmente; os demais (a maioria) foram tratados como consumidores do CANONICAL, não como clientes próprios. `apps/web/src/shared/lib/ws-client.ts` foi lido mas excluído dos totais por não ser HTTP.
