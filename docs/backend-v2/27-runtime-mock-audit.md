> Historical record. Kept as recorded; not the current contract.

# 27 — Auditoria dos Mocks de Runtime do Frontend

Continuação read-only de [`03-frontend-data-access-surface.md`](./03-frontend-data-access-surface.md) (`MOCK_FILES: 5`). Nenhum arquivo foi alterado, em `apps/web` ou `apps/api`. Nenhum doc anterior foi modificado. Nenhum mock foi removido ou corrigido. `apps/api` não foi consultado. Os 20 arquivos `MEMORY` (zustand stores) não foram analisados, conforme proibido.

## Achado geral (aplicável aos 5 casos)

Os 5 arquivos foram lidos por completo. Em nenhum deles existe um dataset de dados fictícios, nem um switch `if (MOCK_MODE)`/`isMockMode()` ativo, nem qualquer lógica condicional de "usar mock vs. usar API real". O grep original do doc03 (`mockData|MOCK_MODE|useMockData|isMockMode`) casou nos 5 casos por **menções em comentário** à palavra "mockData" (ou, no caso de `env.ts`, por documentar e **eliminar** a possibilidade de modo mock) — não por lógica de mock executável. Isso é registrado explicitamente por caso abaixo, seguindo a "REGRA IMPORTANTE" de não classificar como problema só pelo nome.

Adicionalmente, 4 dos 5 arquivos (todos exceto `env.ts`) são **código morto**: zero importadores em todo `apps/web/src`, confirmado por grep dos símbolos exportados de cada um.

---

## 1 — `apps/web/src/modules/integrations/services/contrato.mapper.ts`

```text
ARQUIVO:
apps/web/src/modules/integrations/services/contrato.mapper.ts

SÍMBOLO:
contratoMapper (toSigningInput, applySigningStatus, isInSigning, isDueToExpire) — mapper puro, sem dataset

CONSUMIDO_EM_RUNTIME:
NÃO

CONSUMIDO_EM_TESTES:
NÃO

FUNCIONALIDADE:
converte a entidade ContratoEntity para o input de criação de documento de assinatura digital (CreateSigningDocumentParams) e aplica de volta, na entidade, o status recebido de um SigningDocument — é um mapper de transformação puro, não contém nenhum dado

TELA/FLUXO:
NONE — grep por `contratoMapper` em todo apps/web/src encontra apenas a própria declaração; nenhum hook, serviço ou componente importa este arquivo

TIPO_DE_MOCK:
UNRESOLVED

API_REAL_EXISTE_NO_INVENTÁRIO:
NÃO

SE NÃO:
NONE — nenhum endpoint de "criar documento de assinatura" aparece no inventário do doc05 (as integrações de assinatura — Autentique/Clicksign/DocuSign — são geridas via sessionStorage local, doc18, não via endpoint HTTP)

PERSISTÊNCIA_REAL_NECESSÁRIA:
INCERTO

AÇÃO_FUTURA:
REQUIRES_FURTHER_ANALYSIS

EVIDÊNCIA:
apps/web/src/modules/integrations/services/contrato.mapper.ts (arquivo inteiro); grep de `contratoMapper` em apps/web/src sem resultado fora do próprio arquivo
```

**Justificativa do TIPO_DE_MOCK:** nenhuma das 6 categorias positivas (TEST_FIXTURE/DEV_ONLY/RUNTIME_PRIMARY_DATA/RUNTIME_FALLBACK/PLACEHOLDER/DEMO_DATA) descreve corretamente este arquivo — não é um mock em nenhum sentido funcional (não contém dado fictício, não é acionado condicionalmente), é uma função de transformação pura e completa, mas **órfã** (sem nenhum chamador). Marcá-lo em qualquer categoria de mock seria impreciso; por isso UNRESOLVED, com o achado real (código morto) registrado separadamente.

---

## 2 — `apps/web/src/modules/integrations/services/transacao.mapper.ts`

```text
ARQUIVO:
apps/web/src/modules/integrations/services/transacao.mapper.ts

SÍMBOLO:
transacaoMapper (fromOfxEntry, calcNetProfit, groupByCategoria) — mapper puro, sem dataset

CONSUMIDO_EM_RUNTIME:
NÃO

CONSUMIDO_EM_TESTES:
NÃO

FUNCIONALIDADE:
converte uma linha de extrato OFX (pós-parse) numa TransacaoEntity (import bancário), mais dois utilitários de cálculo (saldo líquido, agrupamento por categoria) — mapper de transformação puro, sem dado próprio

TELA/FLUXO:
NONE — grep por `transacaoMapper` em todo apps/web/src encontra apenas a própria declaração

TIPO_DE_MOCK:
UNRESOLVED

API_REAL_EXISTE_NO_INVENTÁRIO:
SIM (parcial)

SE SIM:
GET/POST/PATCH/DELETE /transactions (TABLE_ENDPOINT["transacoes"], doc05) — existe endpoint real para a entidade Transação em si, mas NENHUM endpoint de "importar extrato OFX" especificamente aparece no inventário

PERSISTÊNCIA_REAL_NECESSÁRIA:
INCERTO

AÇÃO_FUTURA:
REQUIRES_FURTHER_ANALYSIS

EVIDÊNCIA:
apps/web/src/modules/integrations/services/transacao.mapper.ts (arquivo inteiro); grep de `transacaoMapper` em apps/web/src sem resultado fora do próprio arquivo
```

**Justificativa do TIPO_DE_MOCK:** mesma razão do Caso 1 — função de transformação pura, órfã, sem dataset. A entidade-alvo (Transação) já tem endpoint real (`/transactions`), mas a funcionalidade específica deste arquivo (import de OFX) não tem contraparte confirmada no inventário — por isso o `API_REAL_EXISTE_NO_INVENTÁRIO` é parcial: SIM para a entidade, sem confirmação para a operação de import em si.

---

## 3 — `apps/web/src/modules/integrations/webhooks/stripe.webhook.ts`

```text
ARQUIVO:
apps/web/src/modules/integrations/webhooks/stripe.webhook.ts

SÍMBOLO:
STRIPE_WEBHOOK_EVENTS, StripeWebhookPayload, STRIPE_WEBHOOK_ACTIONS — constantes/tipos de documentação, sem dataset e sem lógica executável

CONSUMIDO_EM_RUNTIME:
NÃO

CONSUMIDO_EM_TESTES:
NÃO

FUNCIONALIDADE:
documentação (como código TypeScript, não como lógica executada) do contrato de webhooks Stripe processados pelo BACKEND — o próprio arquivo declara explicitamente, em comentário, a regra "webhooks são SEMPRE processados no backend. O frontend NUNCA recebe webhooks diretamente."

TELA/FLUXO:
NONE — nem mesmo o barrel `webhooks/index.ts` que re-exporta este arquivo tem algum importador em apps/web/src

TIPO_DE_MOCK:
UNRESOLVED

API_REAL_EXISTE_NO_INVENTÁRIO:
NÃO

SE NÃO:
NONE — por definição, `POST /webhooks/stripe` é um endpoint que a STRIPE chama contra o BACKEND, nunca uma chamada originada do frontend; não apareceria (nem deveria aparecer) no inventário de chamadas HTTP do frontend (doc05)

PERSISTÊNCIA_REAL_NECESSÁRIA:
NÃO

AÇÃO_FUTURA:
NO_ACTION_REQUIRED

EVIDÊNCIA:
apps/web/src/modules/integrations/webhooks/stripe.webhook.ts (arquivo inteiro, incluindo o comentário "REGRA CRÍTICA" nas linhas 6-9); grep de `STRIPE_WEBHOOK_EVENTS|StripeWebhookPayload|STRIPE_WEBHOOK_ACTIONS` em apps/web/src — só o próprio arquivo e o barrel webhooks/index.ts, que por sua vez também não é importado por ninguém
```

**Justificativa do TIPO_DE_MOCK:** este arquivo não é um mock em nenhum sentido — é documentação de um contrato de backend, escrita como TypeScript por convenção do projeto, nunca executada em runtime nenhum (nem frontend, nem — por definição — poderia ser o backend, já que webhooks reais rodam em `apps/api`, fora do escopo desta auditoria). Classificado UNRESOLVED por não caber em nenhuma categoria de mock; o achado real é "documentação-como-código órfã", não um mock.

---

## 4 — `apps/web/src/shared/governance/naming.ts`

```text
ARQUIVO:
apps/web/src/shared/governance/naming.ts

SÍMBOLO:
FILE_NAMING_RULES, COMPONENT_NAMING, HOOK_NAMING, SERVICE_NAMING, ENTITY_NAMING, DTO_NAMING, CONSTANTS_NAMING, ROUTE_PATTERNS, LOCALSTORAGE_KEYS, CUSTOM_EVENTS, TEST_ID_PATTERNS — 11 constantes de documentação normativa, sem dataset e sem lógica

CONSUMIDO_EM_RUNTIME:
NÃO

CONSUMIDO_EM_TESTES:
NÃO

FUNCIONALIDADE:
documento normativo (como código TypeScript) das convenções de nomenclatura obrigatórias do projeto — arquivos, componentes, hooks, serviços, entidades, DTOs, constantes, rotas, chaves localStorage, eventos customizados, IDs de teste

TELA/FLUXO:
NONE — grep por todas as 11 constantes exportadas em todo apps/web/src encontra apenas o próprio arquivo

TIPO_DE_MOCK:
UNRESOLVED

API_REAL_EXISTE_NO_INVENTÁRIO:
N/A — não é uma funcionalidade de dado

PERSISTÊNCIA_REAL_NECESSÁRIA:
NÃO

AÇÃO_FUTURA:
NO_ACTION_REQUIRED

EVIDÊNCIA:
apps/web/src/shared/governance/naming.ts (arquivo inteiro); grep das 11 constantes exportadas em apps/web/src sem resultado fora do próprio arquivo
```

**Justificativa do TIPO_DE_MOCK:** o grep do doc03 casou por causa de `LOCALSTORAGE_KEYS.mockData: "musicos360_mock_data"` (linha 346), um EXEMPLO documentado de convenção de chave — não um mock ativo. **Achado destacado (não é a pergunta desta linha, mas relevante ao domínio):** a chave `"musicos360_mock_data"` documentada aqui como "dados mock principais (MOCK_DATA)" **não corresponde a nenhuma das 36 chaves reais catalogadas no doc18** — nenhum dos 36 arquivos `STORAGE_LOCAL` usa essa chave específica; cada domínio usa sua própria chave (`musicos360_rule_overrides`, `musicos360_nfe_credentials` etc.). Isso sugere que `naming.ts` documenta, nesse ponto, uma arquitetura antiga (um blob único `MOCK_DATA`) já substituída pelas chaves por domínio — a documentação está desatualizada nesse detalhe específico, mas isso não afeta nenhum mock em runtime porque a documentação em si não é executada.

---

## 5 — `apps/web/src/shared/lib/env.ts`

```text
ARQUIVO:
apps/web/src/shared/lib/env.ts

SÍMBOLO:
AUTH_DISABLED, API_BASE_URL, IS_DEV, IS_PROD, WS_ENABLED, ENV_MODE, IS_PROD_LIKE, validateFrontendEnv, extractSupabaseRef, deriveAuthEnvironmentLabel, deriveMaskedSupabaseRef, BUILD_COMMIT_SHA — configuração de ambiente real, sem dataset

CONSUMIDO_EM_RUNTIME:
SIM

CONSUMIDO_EM_TESTES:
SIM

FUNCIONALIDADE:
fonte única de verdade para variáveis de ambiente do frontend (URL da API, flags de dev/prod, feature flag de Realtime, validação de env obrigatórias na inicialização) — quanto a "mock" especificamente, o arquivo **documenta e garante a remoção** do modo mock: comentário explícito "Não existe modo mock: o frontend consome exclusivamente o backend real" e "Modo mock foi REMOVIDO: literal false... impossível ligar"; não há mais nenhuma constante `MOCK_MODE` exportada pelo arquivo

TELA/FLUXO:
main.tsx (validateFrontendEnv no boot da aplicação), app/providers/AuthContext.tsx, TenantContext.tsx, BillingContext.tsx, App.tsx, shared/infrastructure/{AdminRoute,ProtectedRoute,ErrorFallback}.tsx, shared/hooks/{usePermissions,usePlanFeatures}.ts, modules/admin/pages/{AdminSettings,AdminKnowledge}.tsx, modules/settings/pages/Configuracoes.tsx, modules/auth/pages/Auth.tsx, modules/integrations/{components/MarketingOAuthDialog,pages/OAuthCallbackPage}.tsx, modules/reports/services/reports-api.ts, modules/settings/services/company-logo.service.ts, shared/domain-events/consistency.ts, shared/lib/ws-client.ts — 20 arquivos importadores confirmados por grep

TIPO_DE_MOCK:
UNRESOLVED

API_REAL_EXISTE_NO_INVENTÁRIO:
N/A — não é uma funcionalidade de dado

PERSISTÊNCIA_REAL_NECESSÁRIA:
NÃO

AÇÃO_FUTURA:
NO_ACTION_REQUIRED

EVIDÊNCIA:
apps/web/src/shared/lib/env.ts:6-9,19-27 (comentários que declaram a remoção do modo mock); grep de `from ".../shared/lib/env"` em apps/web/src — 20 arquivos; apps/web/src/shared/lib/env-auth-badge.test.ts (testa extractSupabaseRef/deriveAuthEnvironmentLabel/deriveMaskedSupabaseRef)
```

**Justificativa do TIPO_DE_MOCK:** este é o exemplo mais claro da "REGRA IMPORTANTE" desta etapa — o arquivo só casou no grep do doc03 por MENCIONAR "mock" em comentários que **provam a ausência** de modo mock, não por implementá-lo. É infraestrutura real, amplamente usada (20 importadores, com teste próprio), e funcionalmente é o OPOSTO de um mock: existe especificamente para impedir que dados simulados entrem no bundle de produção (dead-code-elimination do branch `MOCK_MODE`, já removido do próprio código-fonte).

---

## Resumo

```text
MOCK_FILES_ANALYZED:
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

UNRESOLVED_MOCKS:
5

MOCKS_REQUIRING_API_V2:
0

MOCKS_SAFE_TO_KEEP:
3
```

Nenhum dos 5 arquivos se encaixa em `RUNTIME_PRIMARY_DATA`, `RUNTIME_FALLBACK` ou `PLACEHOLDER` — portanto nenhum destaque obrigatório de dependência da API v2 se aplica a este lote (`MOCKS_REQUIRING_API_V2: 0`). Todos os 5 foram registrados `UNRESOLVED` quanto a `TIPO_DE_MOCK` porque nenhum deles é, de fato, um mock funcional — 4 são código-fonte não executado (2 mappers órfãos, 1 documentação de webhook backend, 1 documentação de convenções) e 1 (`env.ts`) é infraestrutura real que, especificamente, elimina a possibilidade de mock. `MOCKS_SAFE_TO_KEEP` (3) refere-se aos arquivos com `AÇÃO_FUTURA: NO_ACTION_REQUIRED` (`stripe.webhook.ts`, `naming.ts`, `env.ts`); os outros 2 (`contrato.mapper.ts`, `transacao.mapper.ts`) foram marcados `REQUIRES_FURTHER_ANALYSIS` por serem código morto de funcionalidade potencialmente incompleta (mappers para fluxos — assinatura digital, import OFX — que não têm nenhum chamador nem endpoint confirmado), não por risco de dado simulado em produção.

## Cobertura

5/5 arquivos `MOCK` do doc03 lidos por completo. Callers/importadores verificados em todo `apps/web/src` para cada um dos símbolos exportados. Os 20 arquivos `MEMORY` (zustand) não foram analisados. `apps/api` não foi consultado. Nenhum mock foi removido, corrigido ou alterado.
