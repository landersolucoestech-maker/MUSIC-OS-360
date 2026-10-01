> Historical record. Kept as recorded; not the current contract.

# 28 — Resolução Final dos 5 Mocks Ainda Não Classificados

Continuação read-only de [`27-runtime-mock-audit.md`](./27-runtime-mock-audit.md) (`UNRESOLVED_MOCKS: 5`). Nenhum arquivo foi alterado, em `apps/web` ou `apps/api`. Nenhum doc anterior foi modificado. Nenhum mock foi removido. Os 20 arquivos `MEMORY` (zustand) não foram analisados.

O rastreamento de importadores/chamadores para os 5 casos já havia sido feito por completo no doc27 (greps exaustivos dos símbolos exportados de cada arquivo em todo `apps/web/src`); nenhum resultado mudou nesta etapa. A mudança aqui é a classificação final, usando o conjunto de categorias mais preciso desta etapa (`DEAD_CODE`, `STATIC_REFERENCE_DATA`, `OTHER`), que não estava disponível no doc27. Nenhum dos 5 casos exigiu consulta ao backend legacy — todos foram resolvíveis inteiramente por evidência de `apps/web`.

---

## 1 — `contrato.mapper.ts`

```text
ARQUIVO:
apps/web/src/modules/integrations/services/contrato.mapper.ts

SÍMBOLO:
contratoMapper (toSigningInput, applySigningStatus, isInSigning, isDueToExpire)

IMPORTERS:
- NENHUM (grep de `contratoMapper` em todo apps/web/src retorna só a própria declaração)

CALLERS:
- NENHUM

ACTIVE_RUNTIME_PATH:
NÃO

ACTIVE_SCREEN_OR_ROUTE:
NONE

ENVIRONMENT_GUARD:
NONE (não há branch condicional algum — o código simplesmente nunca é alcançado por falta de importador)

API_DEPENDENCY:
NONE — nenhum endpoint de "criar/assinar documento" existe no inventário do doc05; as integrações de assinatura (Autentique/Clicksign/DocuSign) hoje vivem inteiramente em sessionStorage (doc18), sem chamada HTTP

FINAL_CLASSIFICATION:
DEAD_CODE

API_V2_REQUIRED:
NÃO

SAFE_TO_KEEP:
SIM

JUSTIFICATIVA:
código com lógica de transformação completa e correta, mas inalcançável — nenhum componente, hook ou serviço importa `contratoMapper`. Não substitui dado funcional nenhum porque não está no caminho de nenhuma tela: um usuário nunca vê o resultado (real ou fictício) desta função. É seguro manter porque não pode enganar ninguém sobre o estado de uma integração real — ele simplesmente não executa.
```

## 2 — `transacao.mapper.ts`

```text
ARQUIVO:
apps/web/src/modules/integrations/services/transacao.mapper.ts

SÍMBOLO:
transacaoMapper (fromOfxEntry, calcNetProfit, groupByCategoria)

IMPORTERS:
- NENHUM (grep de `transacaoMapper` em todo apps/web/src retorna só a própria declaração)

CALLERS:
- NENHUM

ACTIVE_RUNTIME_PATH:
NÃO

ACTIVE_SCREEN_OR_ROUTE:
NONE

ENVIRONMENT_GUARD:
NONE

API_DEPENDENCY:
GET/POST/PATCH/DELETE /transactions existe (TABLE_ENDPOINT["transacoes"], doc05) para a entidade Transação em geral, mas nenhum endpoint de "importar OFX" especificamente está no inventário — a função `fromOfxEntry` não tem contraparte de API confirmada

FINAL_CLASSIFICATION:
DEAD_CODE

API_V2_REQUIRED:
NÃO

SAFE_TO_KEEP:
SIM

JUSTIFICATIVA:
mesmo padrão do Caso 1 — lógica de transformação completa (parse de linha OFX → TransacaoEntity, cálculo de saldo líquido, agrupamento por categoria), mas sem nenhum chamador em todo o frontend. Não há tela de "importar extrato bancário" consumindo isso. Seguro manter pelo mesmo motivo: código inalcançável não pode substituir ou mascarar dado real de nenhuma tela.
```

## 3 — `stripe.webhook.ts`

```text
ARQUIVO:
apps/web/src/modules/integrations/webhooks/stripe.webhook.ts

SÍMBOLO:
STRIPE_WEBHOOK_EVENTS, StripeWebhookPayload, STRIPE_WEBHOOK_ACTIONS

IMPORTERS:
- apps/web/src/modules/integrations/webhooks/index.ts (barrel de re-export) — e este barrel, por sua vez, não tem NENHUM importador em todo apps/web/src (confirmado por grep dedicado)

CALLERS:
- NENHUM

ACTIVE_RUNTIME_PATH:
NÃO

ACTIVE_SCREEN_OR_ROUTE:
NONE

ENVIRONMENT_GUARD:
NONE

API_DEPENDENCY:
NONE, por definição — `POST /webhooks/stripe` é um endpoint que a Stripe chama contra `apps/api` (backend), nunca uma chamada originada do frontend; o próprio arquivo declara isso explicitamente em comentário ("webhooks são SEMPRE processados no backend. O frontend NUNCA recebe webhooks directamente")

FINAL_CLASSIFICATION:
STATIC_REFERENCE_DATA

API_V2_REQUIRED:
NÃO

SAFE_TO_KEEP:
SIM

JUSTIFICATIVA:
não é código morto no sentido de "funcionalidade abandonada" — é documentação de um contrato de backend, escrita como constantes/tipos TypeScript por convenção do projeto, nunca destinada a ser importada por lógica de runtime do frontend (o próprio arquivo diz isso). Classificado `STATIC_REFERENCE_DATA` em vez de `DEAD_CODE` porque a ausência de importador é esperada pelo desenho do arquivo, não um sintoma de feature quebrada. Não substitui nenhum dado funcional porque nunca teve essa função.
```

## 4 — `naming.ts`

```text
ARQUIVO:
apps/web/src/shared/governance/naming.ts

SÍMBOLO:
FILE_NAMING_RULES, COMPONENT_NAMING, HOOK_NAMING, SERVICE_NAMING, ENTITY_NAMING, DTO_NAMING, CONSTANTS_NAMING, ROUTE_PATTERNS, LOCALSTORAGE_KEYS, CUSTOM_EVENTS, TEST_ID_PATTERNS

IMPORTERS:
- NENHUM (grep de todas as 11 constantes exportadas em todo apps/web/src retorna só o próprio arquivo)

CALLERS:
- NENHUM

ACTIVE_RUNTIME_PATH:
NÃO

ACTIVE_SCREEN_OR_ROUTE:
NONE

ENVIRONMENT_GUARD:
NONE

API_DEPENDENCY:
N/A — não é uma funcionalidade de dado, é documentação de convenções de nomenclatura

FINAL_CLASSIFICATION:
STATIC_REFERENCE_DATA

API_V2_REQUIRED:
NÃO

SAFE_TO_KEEP:
SIM

JUSTIFICATIVA:
documento normativo do projeto, expresso como código TypeScript (provavelmente para aparecer em buscas/autocomplete de IDE), nunca destinado a ser importado por lógica de runtime. Não substitui dado funcional de nenhuma tela. Achado à parte, já registrado no doc27 e não repetido em detalhe aqui: a chave documentada `LOCALSTORAGE_KEYS.mockData = "musicos360_mock_data"` não corresponde a nenhuma das 36 chaves reais catalogadas no doc18 — é uma imprecisão de documentação, não um risco de runtime (o arquivo não executa).
```

## 5 — `env.ts`

```text
ARQUIVO:
apps/web/src/shared/lib/env.ts

SÍMBOLO:
AUTH_DISABLED, API_BASE_URL, IS_DEV, IS_PROD, WS_ENABLED, ENV_MODE, IS_PROD_LIKE, validateFrontendEnv, extractSupabaseRef, deriveAuthEnvironmentLabel, deriveMaskedSupabaseRef, BUILD_COMMIT_SHA

IMPORTERS:
- 20 arquivos confirmados por grep, entre eles: main.tsx, App.tsx, app/providers/{AuthContext,TenantContext,BillingContext}.tsx, shared/infrastructure/{AdminRoute,ProtectedRoute,ErrorFallback}.tsx, shared/hooks/{usePermissions,usePlanFeatures}.ts, modules/admin/pages/{AdminSettings,AdminKnowledge}.tsx, modules/settings/pages/Configuracoes.tsx, modules/auth/pages/Auth.tsx, modules/integrations/{components/MarketingOAuthDialog,pages/OAuthCallbackPage}.tsx, modules/reports/services/reports-api.ts, modules/settings/services/company-logo.service.ts, shared/domain-events/consistency.ts, shared/lib/ws-client.ts

CALLERS:
- main.tsx chama `validateFrontendEnv()` no boot da aplicação; os demais 19 arquivos leem as constantes exportadas (IS_PROD, API_BASE_URL, WS_ENABLED, AUTH_DISABLED etc.) diretamente

ACTIVE_RUNTIME_PATH:
SIM

ACTIVE_SCREEN_OR_ROUTE:
toda a aplicação — main.tsx (boot) e App.tsx (roteador raiz) importam este arquivo; não é específico de uma tela, é infraestrutura transversal

ENVIRONMENT_GUARD:
`import.meta.env.DEV`/`.PROD`/`.MODE`/`VITE_*` — múltiplas flags de ambiente; é o próprio propósito do arquivo (fonte única de leitura dessas flags)

API_DEPENDENCY:
NONE — não é uma funcionalidade de dado de negócio, é configuração de ambiente do bundle Vite

FINAL_CLASSIFICATION:
OTHER

API_V2_REQUIRED:
NÃO

SAFE_TO_KEEP:
SIM

JUSTIFICATIVA:
nenhuma das 8 categorias descreve corretamente este arquivo — não é teste, não é "dev only" (é usado em produção também), não é dado de runtime nem fallback nem placeholder nem demo nem código morto nem dado de referência estático (contém lógica ativa, não uma tabela de valores fixos). É infraestrutura de configuração de ambiente, ativamente usada por 20 arquivos, com teste próprio (env-auth-badge.test.ts). Quanto à pergunta original de "mock": o arquivo prova, em código e comentário, que o modo mock foi fisicamente removido (`AUTH_DISABLED` é sobre bypass de autenticação em dev, não sobre dado mockado; não existe mais nenhuma constante `MOCK_MODE` exportada). Não substitui nenhum dado funcional — pelo contrário, garante que nenhum dado simulado chegue ao bundle de produção.
```

---

## Resumo

```text
UNRESOLVED_MOCKS_INITIAL:
5

TEST_FIXTURES:
0

DEV_ONLY_MOCKS:
0

RUNTIME_PRIMARY_DATA_MOCKS:
0

RUNTIME_FALLBACK_MOCKS:
0

PLACEHOLDER_MOCKS:
0

DEMO_DATA_MOCKS:
0

DEAD_CODE_MOCKS:
2

STATIC_REFERENCE_DATA:
2

OTHER_MOCKS:
1

MOCKS_REQUIRING_API_V2:
0

MOCKS_SAFE_TO_KEEP:
5

UNRESOLVED_MOCKS_REMAINING:
0
```

Todos os 5 casos foram classificados com evidência concreta de importadores/chamadores (ou ausência confirmada deles) em `apps/web/**`; nenhum exigiu consulta ao backend legacy. Nenhum dos 5 requer suporte da API v2: os 2 `DEAD_CODE` (mappers órfãos) não são alcançados por nenhuma tela hoje; os 2 `STATIC_REFERENCE_DATA` (documentação de webhook e de convenções) nunca foram destinados a ser dado de runtime; o 1 `OTHER` (`env.ts`) é configuração de ambiente, não dado de negócio. Todos os 5 são `SAFE_TO_KEEP` — cada um com justificativa própria de por que não mascara nem substitui dado funcional que deveria vir de uma API real, conforme exigido pela regra desta etapa.

## Cobertura

5/5 mocks `UNRESOLVED` do doc27 resolvidos, `0` remanescentes. Nenhuma consulta a `apps/api` foi necessária. Os 20 arquivos `MEMORY` não foram analisados. `apps/web` e `apps/api` não foram alterados. Nenhum mock foi removido.
