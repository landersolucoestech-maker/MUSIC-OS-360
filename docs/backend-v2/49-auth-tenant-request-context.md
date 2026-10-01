> Historical record. Kept as recorded; not the current contract.

# 49 — Fluxo de Auth, Usuário e Tenant da `apps/api-v2`

Definição read-only do fluxo de autenticação/tenant/contexto de request, aplicando a arquitetura em camadas já aprovada ([`47`](./47-api-v2-layered-architecture.md), [`48`](./48-api-v2-directory-structure.md)) sobre os contratos reais já mapeados em [`15`](./15-frontend-auth-permission-contracts.md)/[`16`](./16-permission-final-resolution.md)/[`17`](./17-supabase-direct-access-audit.md)/[`37`](./37-canonical-frontend-contract-final.md). Nenhum código, guard, módulo, tabela ou migration foi criado. `apps/api-v2` não foi criado. Nenhuma dependência foi instalada. Supabase não foi alterado. `apps/web` e `apps/api` (legacy) não foram alterados.

## Decisões fixas (não reabertas)

```text
Supabase Auth permanece inicialmente.
O frontend continua obtendo o JWT.
A API v2 valida o JWT.
Identidade não pode vir do body.
tenant_id recebido do cliente não pode ser confiado como identidade.
role/permission recebidas do frontend não podem ser confiadas.
Cada request autenticado deve possuir contexto interno confiável.
```

## Evidência usada (mecanismo já provado no legacy, reaproveitado como base — ver nota de aderência ao final)

```text
apps/api/src/core/security/token-verifier.service.ts + apps/api/src/core/guards/auth.guard.ts
  → validação real via JWKS do Supabase (jwks-rsa + jsonwebtoken), algoritmo ES256, issuer
  "${SUPABASE_URL}/auth/v1", audience "authenticated"; fallback HS256 assinado com ENCRYPTION_KEY
  EXPLICITAMENTE restrito a ambientes não-prod-like (dev local); mecanismo de rota pública via
  metadata "isPublic" (Reflector), nunca implícito.

apps/api/src/core/guards/tenant.guard.ts
  → prova concreta do padrão exigido pela REGRA CRÍTICA deste prompt: o tenant é resolvido a partir
  de auth.orgId (claim do JWT, app_metadata.org_id), NUNCA do header X-Tenant-ID; o header só é usado
  para CONFERIR (tenantHeader !== tenantId/orgId/externalOrgId → 403 "Tenant header does not match
  resolved tenant"); a seguir resolve membership real (resolveMembership(tenant.id, auth.userId)) —
  sem membership ativa → 403 "User is not an active member of this tenant".

apps/api/src/core/guards/roles.guard.ts
  → política fail-closed já comprovada: rota de mutação (POST/PATCH/PUT/DELETE) SEM @Roles/@Permissions
  declarado é bloqueada por padrão ("bloqueado por politica fail-closed"), nunca liberada implicitamente.

apps/api/src/database/migrations/20260614000000_CreateUsersProjection.ts
  → tabela de projeção de usuários já existente no legacy, chave UNIQUE(auth_user_id) — evidência direta
  do mapeamento identidade externa (JWT sub) → usuário interno.

docs/backend-v2/15-frontend-auth-permission-contracts.md / 16
  → GET /auth/context é a fonte real de tenant+membership+permissions consumida pelo frontend
  (TenantContext.tsx); membership.permissions (resource:action[]) é a ÚNICA fonte real de permissão
  fina no frontend — role decodificada do JWT é só fallback otimista, nunca autoridade.
```

**Nota de aderência:** o mecanismo acima já está implementado, testado (`*.guard.spec.ts`) e resolve exatamente os requisitos desta etapa (hint-nunca-prova de tenant, fail-closed de permissão, JWKS real). Esta decisão de fluxo o adota como base para a `apps/api-v2` — não porque "já existe no legacy" por si só, mas porque nenhuma exigência técnica desta etapa justifica um mecanismo diferente (regra explícita do prompt: "ajuste somente se houver exigência técnica comprovada"). A adaptação necessária é de FORMA, não de mecanismo: em vez de anexar `request.auth`/`request.tenant`/`request.currentMember` ao objeto Express Request (padrão do legacy), a `apps/api-v2` monta um `RequestContext` imutável e explícito, porque o doc47 já exige que Application/Domain recebam identidade como parâmetro explícito, nunca implícito no objeto HTTP.

---

## Fluxo completo

```text
HTTP request
↓
Authorization: Bearer <JWT>                         [Controller/borda HTTP — extrai o header, não decide nada]
↓
JWT validation                                        [AuthGuard, src/auth/ — JWKS/ES256, issuer/audience,
                                                        expiração; ver seção JWT]
↓
Supabase user identity                                 [claim "sub" do JWT validado → authUserId]
↓
internal user resolution                                [TenantGuard/etapa de resolução — auth_user_id →
                                                        usuário interno, via lookup equivalente à projeção
                                                        já existente no legacy; ver seção USUÁRIO INTERNO]
↓
tenant membership resolution                             [TenantGuard, src/tenant/ — tenant resolvido do JWT
                                                        (nunca do header), header só conferido contra o
                                                        resultado, membership ativa validada; ver seção TENANT]
↓
role/permission resolution                                [PermissionGuard, src/authorization/ — carrega
                                                        role/permissions da membership já resolvida (nunca
                                                        do JWT/body/header do cliente)]
↓
request context                                            [RequestContext imutável montado; ver seção
                                                        REQUEST CONTEXT]
↓
controller                                                  [mapeia DTO HTTP → Command/Query; injeta o
                                                        RequestContext já pronto, nunca o reconstrói]
↓
use case                                                     [recebe RequestContext como parâmetro explícito;
                                                        autorização de negócio fina ocorre aqui, não antes]
```

Fluxo mantido sem alteração estrutural em relação ao modelo conceitual do prompt — o único ajuste é nomear explicitamente qual camada/Guard executa cada etapa, com base no mecanismo já evidenciado acima.

---

## JWT

```text
TOKEN_SOURCE:
Header HTTP "Authorization: Bearer <JWT>" — mesma convenção já usada pelo frontend congelado
(api-client.ts injeta este header em toda chamada via `api.*`, doc15) e pelo legacy (auth.guard.ts)

TOKEN_VALIDATION_METHOD:
Verificação de assinatura via JWKS do Supabase Auth (algoritmo ES256), buscando a chave pública pelo
"kid" do header do JWT em "${SUPABASE_URL}/auth/v1/.well-known/jwks.json", validando "issuer" =
"${SUPABASE_URL}/auth/v1" e "audience" = "authenticated". Mesmo mecanismo já provado e testado no
legacy (token-verifier.service.ts/auth.guard.ts) — reaproveitado por não haver exigência técnica que
justifique um método diferente. Nenhum segredo/chave real é citado aqui, apenas o mecanismo.

TOKEN_SUBJECT:
Claim "sub" do JWT (UUID do usuário no Supabase Auth/GoTrue) — é a identidade externa (EXTERNAL_IDENTITY),
nunca a identidade interna final.

TOKEN_FAILURE_BEHAVIOR:
Token ausente → requisição rejeitada (autenticação obrigatória por padrão, exceto em rota explicitamente
marcada pública — ver seção ENDPOINTS PÚBLICOS). Token malformado/assinatura inválida/emissor ou
audiência incorretos → requisição rejeitada. Token expirado → requisição rejeitada com motivo distinto
de "inválido" (permite ao frontend, que já implementa refresh de sessão via Supabase SDK, distinguir
"token velho, tentar refresh" de "token nunca foi válido"). Em nenhum caso a requisição prossegue para
TenantGuard/PermissionGuard/Controller sem uma identidade validada.
```

---

## Usuário interno

```text
EXTERNAL_IDENTITY:
claim "sub" do JWT do Supabase Auth (authUserId)

INTERNAL_USER_LOOKUP:
Por auth_user_id (chave lógica de correspondência 1:1 entre a identidade externa do Supabase Auth e o
registro de usuário interno) — mesmo padrão já existente no legacy (projeção de usuários com
UNIQUE(auth_user_id)). Nenhuma tabela é criada nesta etapa; apenas a chave lógica de resolução é definida.

USER_NOT_FOUND_BEHAVIOR:
Se o JWT é válido mas não existe (ainda) um usuário interno correspondente ao auth_user_id, a requisição
é rejeitada — EXCETO para rotas explicitamente marcadas como fluxo de provisionamento/onboarding (uma
3ª categoria de marcação explícita, distinta de "pública" e de "protegida" — ver seção ENDPOINTS
PÚBLICOS), que são as únicas autorizadas a operar com um JWT válido mas sem usuário interno ainda
resolvido (ex.: completar cadastro/onboarding após o signup no Supabase Auth).

USER_INACTIVE_BEHAVIOR:
Usuário interno existente mas marcado inativo é tratado de forma equivalente a "sem membership válida"
para fins de autorização (rejeitado) — sem distinguir na resposta entre "inativo" e "sem acesso", para
não revelar a um chamador não autorizado se um determinado usuário existe/está ativo em um tenant.
```

---

## Tenant

```text
TENANT_HINT_SOURCE:
Header "X-Tenant-ID" — mesmo header já injetado automaticamente pelo frontend congelado em toda chamada
via `api.*` (doc15, api-client.ts) — mas tratado estritamente como INDÍCIO de intenção do cliente, nunca
como prova de autorização (ver REGRA CRÍTICA).

TENANT_MEMBERSHIP_VALIDATION:
1. O tenant é resolvido pelo SERVIDOR a partir do claim do JWT (app_metadata.org_id), nunca a partir do
   header do cliente.
2. O tenant resolvido precisa estar ativo — caso contrário, rejeitado.
3. O header X-Tenant-ID (se presente) é CONFERIDO contra os identificadores do próprio tenant resolvido
   no passo 1 — se não corresponder a nenhum deles, a requisição é rejeitada (ver REGRA CRÍTICA).
4. É resolvida uma membership real e ativa do usuário interno (ver seção Usuário Interno) nesse tenant —
   sem membership ativa, a requisição é rejeitada.
Nenhum desses 4 passos pode ser pulado nem reordenado de forma que o header do cliente decida sozinho o
tenant antes da resolução server-side.

TENANT_NOT_FOUND_BEHAVIOR:
Requisição rejeitada — tenant inexistente não é distinguido de tenant inativo na resposta (mesma decisão
registrada em TENANT_INACTIVE_BEHAVIOR abaixo), para não revelar a existência de tenants a um chamador
não autorizado.

USER_NOT_MEMBER_BEHAVIOR:
Requisição rejeitada — usuário autenticado e tenant existente/ativo, mas sem membership válida nesse
tenant especificamente.

TENANT_INACTIVE_BEHAVIOR:
Requisição rejeitada, mesma resposta de TENANT_NOT_FOUND_BEHAVIOR (tenant existente porém inativo não é
diferenciado de inexistente, pelo mesmo motivo de não revelar informação a um chamador não autorizado).
```

---

## Regra crítica (reforço literal do prompt)

```text
Se o frontend enviar X-Tenant-ID: tenant-b mas o usuário autenticado não possuir membership válida em
tenant-b, a requisição DEVE ser rejeitada.

O header pode indicar qual tenant o usuário deseja usar (TENANT_HINT_SOURCE).
Ele NUNCA comprova autorização — a prova vem exclusivamente da resolução server-side (JWT → tenant →
membership), com o header servindo apenas de checagem de consistência contra o resultado dessa
resolução, nunca como entrada primária dela.
```

---

## Request Context

```text
REQUEST_CONTEXT_FIELDS:
- authUserId       (identidade externa — claim "sub" do JWT)
- userId            (identidade interna — resolvida via INTERNAL_USER_LOOKUP, distinta de authUserId)
- tenantId           (resolvido server-side a partir do JWT, nunca do header — ver seção TENANT)
- role                (papel do usuário DENTRO do tenant resolvido — vem da membership, não do JWT)
- permissions          (conjunto de permissões finas — resource:action[] — resolvido a partir da mesma
                      membership, mesma fonte que GET /auth/context já expõe ao frontend hoje, doc15)
- correlationId          (identificador de rastreamento do request, para Observability/auditoria — não
                      participa de nenhuma decisão de autorização)

SOURCE_OF_EACH_FIELD:
- authUserId: claim "sub" do JWT validado (AuthGuard)
- userId: lookup por auth_user_id (etapa de resolução de usuário interno)
- tenantId: resolução server-side a partir de app_metadata.org_id do JWT, confirmada ativa (TenantGuard)
- role: membership do usuário no tenant resolvido (TenantGuard/PermissionGuard) — NUNCA do JWT
  app_metadata.role diretamente nem de qualquer valor enviado pelo cliente, exatamente para evitar que
  um JWT desatualizado (role alterada no backend mas token ainda não renovado) carregue uma role obsoleta
- permissions: mesma membership, mesma fonte que já alimenta membership.permissions em GET /auth/context
- correlationId: gerado por request (ou propagado de um header de rastreamento, se presente), pela camada
  Observability — nunca usado para autorização
```

Nenhum campo do RequestContext é preenchido a partir do body da requisição, de um header controlado
livremente pelo cliente sem checagem, ou de qualquer valor não resolvido/validado server-side.

---

## Autorização — separação por camada

```text
authentication:
AuthGuard (src/auth/) — "este JWT é válido e pertence a algum usuário real do Supabase Auth?"

tenant membership:
TenantGuard (src/tenant/) — "este usuário pertence, de fato, ao tenant que ele diz/indica querer usar?"

role/permission authorization (coarse):
PermissionGuard (src/authorization/) — "a role/permissions desta membership satisfazem o requisito
declarado desta rota (ex.: contracts:write)?" — decisão binária, declarativa, sem olhar dado de negócio
específico do recurso sendo acessado.

business authorization (fine, contextual):
Application / Use Case (doc47) — "além de ter a permissão coarse do módulo, este usuário específico pode
executar esta ação neste recurso específico?" (ex.: é o gestor responsável por este artista; o contrato
ainda está em rascunho e só o criador pode editá-lo). Nunca ocorre em Controller/Guard — sempre dentro do
Use Case, com acesso a RequestContext + dado de domínio já carregado.
```

---

## Guards (responsabilidades futuras, não implementadas)

```text
AuthGuard:
Extrair o Bearer token, validar assinatura/emissor/audiência/expiração via JWKS (ver seção JWT), rejeitar
requisições sem token válido, reconhecer explicitamente rotas marcadas @Public()/@AuthBootstrap() como
exceção ao requisito de token — nunca como padrão implícito. Produz authUserId.

TenantGuard:
Resolver o usuário interno (ver seção Usuário Interno), resolver o tenant a partir do JWT (nunca do
header), validar tenant ativo, conferir o header X-Tenant-ID contra o tenant resolvido (Regra Crítica),
resolver membership ativa. Produz userId, tenantId, role (parcial, base para o PermissionGuard).

PermissionGuard:
Avaliar o requisito de permissão declarado na rota (module:action / resource:action) contra
role/permissions já resolvidos pelo TenantGuard — política fail-closed por padrão para rotas de mutação
sem requisito declarado (mesmo padrão já comprovado no legacy). Não decide autorização de negócio fina.
```

Nenhum outro mecanismo além destes 3 Guards foi identificado como necessário para o fluxo HTTP síncrono
desta etapa.

---

## Endpoints públicos

```text
ESTRATÉGIA: marcação explícita e inequívoca, nunca implícita.

@Public() — decorator explícito por controller/handler, reconhecido pelos 3 Guards (AuthGuard/
TenantGuard/PermissionGuard) como isenção total — usado apenas onde nenhuma identidade é necessária
(ex.: health check, endpoints de terceiros como ViaCEP/IBGE já mapeados no doc37 como NÃO sendo endpoints
de apps/api).

@AuthBootstrap() — decorator explícito, distinto de @Public(): exige token JWT válido (NÃO isenta o
AuthGuard), mas isenta TenantGuard/PermissionGuard — único uso legítimo é o fluxo de onboarding/
provisionamento, onde o usuário já está autenticado no Supabase Auth mas ainda não tem usuário interno
e/ou membership resolvida (ver USER_NOT_FOUND_BEHAVIOR).

Ausência de qualquer um dos dois decorators = rota protegida por padrão (AuthGuard + TenantGuard +
PermissionGuard aplicados integralmente). Não existe estado "talvez público" — toda rota é
protegida-por-padrão até prova explícita em contrário no próprio código da rota.
```

---

## RLS — relação entre enforcement de aplicação e RLS de banco

```text
A aplicação (TenantGuard resolvendo tenantId no RequestContext + cada Use Case/Repository OBRIGADO a
escopar toda query por esse tenantId) é o controle PRIMÁRIO e OBRIGATÓRIO de isolamento multi-tenant —
nenhuma query roda sem um tenantId de RequestContext já validado antes dela.

RLS no PostgreSQL (o padrão de sessão transacional com set_config('app.current_tenant_id', ...) já
definido nos docs 45/47, aplicado à camada de Persistence) é uma camada ADICIONAL de isolamento — defesa
em profundidade contra um bug de aplicação que, por erro, execute uma query sem o filtro de tenant
esperado. RLS NUNCA substitui a validação de aplicação: mesmo com RLS habilitada em todas as tabelas
multi-tenant, o TenantGuard/PermissionGuard continuam sendo executados em toda requisição, e o Use Case
continua escopando explicitamente por tenantId — a ausência de qualquer uma das duas camadas é tratada
como falha de design, não como redundância aceitável de se remover.
```

---

## Realtime (não redesenhado)

```text
O fluxo de Supabase Realtime já aprovado (doc17: canais "tenant:${orgId}"/"user:${userId}", autorizados
por RLS de broadcast — migration 20260801000001_RealtimeBroadcastAuthorization) permanece uma superfície
de autorização SEPARADA do RequestContext HTTP definido nesta etapa — não foi redesenhado, não foi
alterado, e este documento não define nenhuma relação nova entre os dois além de constatar que ambos
partem da mesma identidade JWT do Supabase Auth, cada um com seu próprio mecanismo de autorização já
resolvido em etapa anterior (HTTP: Guards + RLS de tabela; Realtime: RLS de canal).
```

---

## Validação (respostas objetivas exigidas pelo prompt)

```text
JWT vindo do frontend é validado?
SIM

user_id do body pode definir identidade?
NÃO

X-Tenant-ID é confiado sem membership check?
NÃO

role enviada pelo frontend é confiada?
NÃO

permission enviada pelo frontend é confiada?
NÃO

RequestContext possui tenant resolvido internamente?
SIM

RLS substitui autorização da aplicação?
NÃO
```

---

## Resumo

```text
UNRESOLVED_AUTH_TENANT_DECISIONS:
0
```

## Cobertura

Fluxo completo definido e ajustado apenas na atribuição explícita de responsabilidade por etapa (Guard/camada), sem alteração estrutural do modelo conceitual do prompt. JWT, usuário interno, tenant, RequestContext, separação de autorização em 4 níveis, 3 Guards, estratégia de endpoints públicos (2 decorators explícitos), relação aplicação/RLS e nota de não-redesenho do Realtime — todos definidos com evidência concreta do mecanismo já implementado e testado no legacy (`apps/api/src/core/guards/*`, `core/security/token-verifier.service.ts`, migration de projeção de usuários), citada e não copiada cegamente — adotada porque nenhuma exigência técnica desta etapa justificou um mecanismo diferente. Nenhum guard, módulo, tabela ou migration foi criado. `apps/api-v2` não foi criado. Nenhuma dependência foi instalada. Supabase não foi alterado. `apps/web` e `apps/api` (legacy) não foram alterados. Nenhum documento anterior foi modificado.
