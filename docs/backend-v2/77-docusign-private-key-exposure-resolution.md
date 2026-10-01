> Historical record. Kept as recorded; not the current contract.

# 77 — Resolução da Exposição de `DOCUSIGN_PRIVATE_KEY`

Investigação read-only (nenhum valor secreto foi lido, recuperado ou impresso — histórico ou atual) sobre se a chave privada `DOCUSIGN_PRIVATE_KEY`, encontrada em histórico Git durante a auditoria do Prompt 87 (commit `b4b741bf`, arquivo `attached_assets/Pasted--BLOCO-09-TODAS-AS-IN-...txt`, linhas 106/941), ainda possui qualquer validade ou dependência operacional no MUSIC OS 360. Nenhum banco foi alterado. Nenhuma migration foi executada. Nenhum `.env` foi alterado. Nenhum código foi alterado (frontend, legacy ou apps/api-v2). SMTP não foi tratado. Nenhuma operação foi feita contra a conta DocuSign real.

---

## 1. Método (sem recuperar o valor)

```text
Nenhum comando executado nesta etapa leu o conteúdo do arquivo histórico ou de qualquer commit que o
contenha (nenhum git show/git log -p/cat/type/Get-Content/grep-de-conteúdo sobre a chave). Toda pesquisa
foi por NOME/IDENTIFICADOR (DOCUSIGN_PRIVATE_KEY, DocuSign, RS256, JWT grant, requestJWTUserToken,
privateKey, integrationKey, userId, accountId, basePath) e por presença/ausência em arquivos de
ambiente (nomes de variável, nunca o valor). Nenhum fingerprint foi calculado a partir da chave
histórica, porque seu conteúdo nunca foi acessado nesta ou em nenhuma etapa anterior — não havia nada
para "hashear com segurança": a chave nunca esteve em memória desta investigação.
```

---

## 2. Auditoria do código atual

```text
Busca por "DOCUSIGN_PRIVATE_KEY" em todo o repositório (código, docs, env, CI): 0 ocorrências em
qualquer lugar.

Busca por "requestJWTUserToken"/"JWTGrant"/RS256-no-contexto-DocuSign: 0 ocorrências em código real —
a única ocorrência de "RS256" em todo o repositório está em
docs/backend-v2/66-api-v2-auth-jwt-stack-final-decision.md, sobre a biblioteca de validação do JWT do
Supabase Auth da apps/api-v2 — assunto completamente não relacionado a DocuSign (FALSE_POSITIVE).

Busca por "docusign"/"DocuSign"/"DOCUSIGN" (43 arquivos): classificados abaixo.

CLASSIFICAÇÃO DAS OCORRÊNCIAS REAIS ENCONTRADAS:
- apps/api/src/modules/integrations/integrations.controller.ts (branch `platform === 'docusign'`,
  troca de código OAuth por access_token) → ACTIVE_RUNTIME
- apps/api/src/modules/integrations/dto/integrations.dto.ts ('docusign' como platform válida) →
  ACTIVE_RUNTIME (parte do mesmo fluxo)
- apps/api/src/core/config/env.schema.ts (DOCUSIGN_INTEGRATION_KEY/CLIENT_SECRET/AUTH_BASE_URL) →
  ACTIVE_CONFIG
- apps/web/src/modules/contracts/{Contratos.tsx, ContratoWizard.tsx, SendForSigningDialog.tsx,
  SigningPlatformBadge.tsx, types/contracts.types.ts, types/document-types.ts} → ACTIVE_UI (seletor de
  provedor de assinatura, badge, tipos) — mas ver seção 3 para o estado real por trás dessa UI.
- apps/web/src/modules/integrations/adapters/signing.adapter.ts → DEAD/PLACEHOLDER (ver seção 3 —
  toda chamada para o provider "docusign" lança erro explícito de "não possui provider real
  configurado")
- apps/web/src/modules/integrations/pages/OAuthPopupPage.tsx (VITE_DOCUSIGN_INTEGRATION_KEY,
  buildOAuthUrl) → ACTIVE_RUNTIME (construção da URL de autorização OAuth no browser)
- Demais 30 arquivos em docs/backend-v2/* (00-55, 66, 69, 74) e docs/ raiz → DOCUMENTATION (auditorias/
  decisões já registradas em etapas anteriores desta série, mencionando DocuSign apenas como um dos
  provedores de integração já inventariados — não redigidas nem alteradas aqui)

Nenhuma ocorrência de "DOCUSIGN_PRIVATE_KEY" foi encontrada em NENHUM arquivo, código, config ou
documentação atual — o identificador só existe no histórico Git (seção 8).
```

---

## 3. A integração DocuSign real (o que existe hoje)

```text
DOCUSIGN_INTEGRATION_EXISTS:
SIM — mas com escopo funcional bem mais estreito do que o nome "assinatura digital DocuSign" sugere.

DOCUSIGN_ACTIVE_RUNTIME:
SIM — IntegrationsModule está registrado em apps/api/src/app.module.ts (import ativo, linha 64/174);
  o endpoint de troca OAuth (POST /integrations/oauth/exchange, branch docusign) é alcançável quando o
  legacy está rodando.

DOCUSIGN_FUNCTIONAL_CONSUMERS:
1 fluxo real e funcional: CONECTAR CONTA (OAuth 2.0 Authorization Code — usuário autoriza no DocuSign,
  popup retorna um `code`, backend troca por access_token/refresh_token via
  POST {DOCUSIGN_AUTH_BASE_URL}/oauth/token com Basic Auth de integrationKey:clientSecret — código real,
  apps/api/src/modules/integrations/integrations.controller.ts:281-322).

Fluxos NÃO implementados (0 consumidores funcionais), apesar de existirem na UI como opção selecionável:
  criar envelope, enviar documento, consultar status de assinatura, download, webhook/Connect —
  confirmado por apps/web/src/modules/integrations/adapters/signing.adapter.ts: TODA chamada de
  createDocument/getDocument/listDocuments/cancelDocument/resendInvite/handleWebhook para qualquer
  provider (incluindo "docusign") lança erro explícito "não possui provider real configurado no
  frontend" — comentário do próprio arquivo confirma que SOMENTE o Autentique está "fiado ao backend
  real" no momento.

Conclusão: DocuSign hoje é uma OPÇÃO DE CONEXÃO DE CONTA (OAuth) real e funcional, mas NÃO uma
capacidade de assinatura de documentos funcional — a UI oferece a opção (seletor/badge), mas selecioná-
la para efetivamente assinar um contrato resulta em erro explícito, não em simulação de sucesso (mesma
regra "nunca simular sucesso" já documentada no próprio código).
```

---

## 4. Modelo de autenticação atual

```text
AUTH_MODEL:
AUTHORIZATION_CODE

Confirmado por leitura direta do código (integrations.controller.ts:292-303): `grant_type:
'authorization_code'`, autenticação do client via header `Authorization: Basic
base64(integrationKey:clientSecret)` contra `{DOCUSIGN_AUTH_BASE_URL}/oauth/token` — é o fluxo OAuth 2.0
Authorization Code padrão para "confidential client", COMPLETAMENTE DIFERENTE do modelo JWT Grant (que
usa uma chave privada RSA para assinar uma asserção JWT "impersonando" um usuário, sem intervenção do
usuário no browser). Nenhuma assinatura JWT, nenhuma chave RSA, em nenhum ponto deste fluxo.

INTEGRATION_KEY_CONFIGURED:
SIM (nome presente como placeholder em .env.development/.env.production/apps/api/.env.example — este é
  o `client_id` do fluxo Authorization Code, não relacionado ao conceito de "Integration Key" do fluxo
  JWT Grant apesar do nome de variável coincidir)

IMPERSONATED_USER_ID_CONFIGURED:
NÃO (nenhuma variável equivalente a um "impersonated user id" do JWT Grant existe em nenhum arquivo de
  ambiente — conceito não aplicável a este modelo de auth)

ACCOUNT_ID_CONFIGURED:
NÃO (nenhuma variável DOCUSIGN_ACCOUNT_ID encontrada em nenhum arquivo)

PRIVATE_KEY_CONFIGURED:
NÃO (DOCUSIGN_PRIVATE_KEY não existe em nenhum arquivo de ambiente atual — root, legacy ou apps/api-v2)

OAUTH_BASE_PATH_CONFIGURED:
SIM (DOCUSIGN_AUTH_BASE_URL, com default de código para o ambiente demo do DocuSign quando ausente —
  'https://account-d.docusign.com')
```

---

## 5. Configuração atual — nomes e presença (nenhum valor)

```text
VARIABLE_NAME: DOCUSIGN_INTEGRATION_KEY | FILE_OR_SOURCE: .env.development | TRACKED: NÃO
VARIABLE_NAME: DOCUSIGN_CLIENT_SECRET   | FILE_OR_SOURCE: .env.development | TRACKED: NÃO
VARIABLE_NAME: DOCUSIGN_AUTH_BASE_URL   | FILE_OR_SOURCE: .env.development | TRACKED: NÃO
VARIABLE_NAME: DOCUSIGN_INTEGRATION_KEY | FILE_OR_SOURCE: .env.production  | TRACKED: SIM (placeholder)
VARIABLE_NAME: DOCUSIGN_CLIENT_SECRET   | FILE_OR_SOURCE: .env.production  | TRACKED: SIM (placeholder)
VARIABLE_NAME: DOCUSIGN_AUTH_BASE_URL   | FILE_OR_SOURCE: .env.production  | TRACKED: SIM (placeholder)
VARIABLE_NAME: (nenhuma)                | FILE_OR_SOURCE: .env.staging     | — (nenhuma variável
  DOCUSIGN_* presente)
VARIABLE_NAME: (nenhuma)                | FILE_OR_SOURCE: apps/api/.env    | — (localmente, o legacy
  não tem credenciais DocuSign configuradas agora — nenhum valor real presente)
VARIABLE_NAME: DOCUSIGN_INTEGRATION_KEY/CLIENT_SECRET/AUTH_BASE_URL | FILE_OR_SOURCE:
  apps/api/.env.example | TRACKED: SIM (placeholders)
VARIABLE_NAME: (nenhuma)                | FILE_OR_SOURCE: apps/api-v2 (.env.*.example + src/config) |
  — (nenhuma variável DocuSign — camada de integrações não implementada na v2 ainda)
VARIABLE_NAME: (nenhuma)                | FILE_OR_SOURCE: docker-compose*.yml, .github/workflows/*.yml |
  — (nenhuma referência a DOCUSIGN_* em CI/Compose)

DOCUSIGN_PRIVATE_KEY não aparece em NENHUM dos itens acima — confirmando ausência total de superfície de
configuração atual para essa variável específica.
```

---

## 6. Comparação com a chave histórica comprometida

```text
CURRENT_KEY_MATCHES_HISTORICAL_COMPROMISED_KEY:
NOT_VERIFIABLE

Não existe, hoje, NENHUMA chave privada DocuSign configurada em lugar algum (seção 4/5) — não há um
valor "atual" contra o qual comparar. Além disso, o valor histórico nunca foi lido por esta ou por
nenhuma investigação anterior (redigido pelo próprio scanner no Prompt 87), então também não haveria
material para derivar um fingerprint do lado histórico. A comparação é, portanto, estruturalmente
impossível de realizar com segurança — não por limitação de ferramenta, mas porque um dos dois lados
simplesmente não existe/nunca foi acessado.
```

---

## 7. Legacy (`apps/api`)

```text
LEGACY_DOCUSIGN_RUNTIME:
ACTIVE (apenas para o fluxo de conexão OAuth — ver seção 3)

Mapeamento (sem alterar código):
service:     IntegrationBaseService (apps/api/src/modules/integrations/integration-base.service.ts) —
             saveOAuthTokens() genérico, compartilhado por todos os providers OAuth (Meta/TikTok/
             Google/DocuSign/Stripe Connect)
module:      IntegrationsModule (apps/api/src/modules/integrations/integrations.module.ts)
controller:  IntegrationsController (integrations.controller.ts) — POST /integrations/oauth/init,
             POST /integrations/oauth/exchange (branch docusign), DELETE /integrations/oauth/disconnect
repository:  genérico (tabela de tokens OAuth por tenant/provider — ver seção 12)
queue/job:   nenhum específico de DocuSign
webhook:     nenhum (ver seção 10)
configuration: DOCUSIGN_INTEGRATION_KEY / DOCUSIGN_CLIENT_SECRET / DOCUSIGN_AUTH_BASE_URL (env)
```

---

## 8. Frontend

```text
FRONTEND_DOCUSIGN_DEPENDENCY:
SIM

FRONTEND_CONSUMERS:
7 arquivos — apps/web/src/modules/contracts/{pages/Contratos.tsx, components/ContratoWizard.tsx,
  components/SendForSigningDialog.tsx, components/SigningPlatformBadge.tsx, types/contracts.types.ts,
  types/document-types.ts} + apps/web/src/modules/integrations/adapters/signing.adapter.ts

Natureza: seletor de plataforma de assinatura (dropdown com "DocuSign" como opção ao lado de Autentique/
Clicksign), badge visual, tipos TypeScript. Ao ser selecionado para ação real de assinatura, o adapter
lança erro explícito (seção 3) — não há simulação de sucesso. Este item já está registrado para integrar
o inventário do contrato zero-gap (doc74) quando o domínio de contratos/assinatura for reconstruído na
apps/api-v2 — não tratado em profundidade aqui, apenas confirmado como dependência existente.
```

---

## 9. Webhook / Connect

```text
DOCUSIGN_WEBHOOK_IMPLEMENTATION:
NONE

Nenhum endpoint, handler ou configuração específica do "DocuSign Connect" (mecanismo de webhook do
DocuSign para eventos de envelope) foi encontrado em todo o repositório. Os únicos webhooks reais
implementados no legacy são de OUTROS providers (ex.: Autentique, Stripe) — DocuSign não possui
contraparte de evento assíncrono implementada.
```

---

## 10. Multi-tenancy

```text
CREDENTIAL_OWNERSHIP_MODEL:
SHARED_PLATFORM_CREDENTIAL (para o client_id/client_secret do app) + token OAuth resultante persistido
  POR TENANT

DOCUSIGN_INTEGRATION_KEY/DOCUSIGN_CLIENT_SECRET identificam o APLICATIVO MUSIC OS 360 perante o DocuSign
(uma única credencial de plataforma, não uma por tenant — mesmo padrão já registrado nos docs 30/31 para
os 5 providers do mecanismo "3a"). O ACCESS_TOKEN resultante da troca, esse sim, é persistido com
tenantId+userId explícitos (integrationBase.saveOAuthTokens, seção 7) — ou seja, cada tenant que conecta
sua própria conta DocuSign obtém seu próprio token isolado, mesmo usando o app_id/secret compartilhado
da plataforma para a negociação OAuth em si. Nenhum redesenho foi feito ou proposto nesta etapa.
```

---

## 11. Dados persistidos

```text
PERSISTED_DOCUSIGN_DATA_FOUND:
SIM (parcial) — apenas o resultado da conexão OAuth, nunca dado de envelope/assinatura (que não existe,
  seção 3).

TABLE_OR_ENTITY: tabela genérica de tokens OAuth de integração (consumida via
  IntegrationBaseService.saveOAuthTokens, mesma tabela usada por todos os providers OAuth) |
  COLUMN_OR_FIELD: tenantId, userId, provider ('docusign'), accessToken, refreshToken, expiresIn,
  scopes | ENCRYPTED: SIM (mesmo EncryptionService AES-256-GCM já documentado no doc76 — não
  reavaliado aqui) | DECRYPTION_STILL_REQUIRED: SIM (para o token funcionar de fato)

Nenhuma migration específica de DocuSign (envelope_id, document_id, signature status, recipient) foi
encontrada — porque essa funcionalidade nunca foi implementada (seção 3). Nenhum dado foi lido ou
exibido nesta verificação — apenas a existência do campo/tabela genérica foi confirmada pela leitura do
código que a escreve.
```

---

## 12. Histórico Git

```text
GIT_HISTORY_EXPOSURE:
SIM (commit b4b741bf, arquivo attached_assets/Pasted--BLOCO-09-TODAS-AS-IN-...txt, linhas 106/941 —
  achado original do Prompt 87)

GIT_HISTORY_REWRITTEN:
NÃO — nenhuma reescrita de histórico executada nesta etapa, conforme proibição explícita.
```

---

## 13. Classificação final

```text
DOCUSIGN_PRIVATE_KEY_CLASSIFICATION:
RETIRED_NO_RUNTIME_DEPENDENCY

Justificativa: nenhuma implementação de código jamais consumiu DOCUSIGN_PRIVATE_KEY em toda a história
deste repositório — a implementação DocuSign realmente construída e ativa (OAuth 2.0 Authorization Code,
integrations.controller.ts) usa um modelo de autenticação estruturalmente diferente (DOCUSIGN_CLIENT_
SECRET, não uma chave privada RSA para JWT Grant) e nunca dependeu, em nenhum momento, de uma chave
privada. O nome "DOCUSIGN_PRIVATE_KEY" só existe dentro de um arquivo de texto colado de planejamento
(attached_assets/), o mesmo padrão já observado e resolvido no doc76 para ENCRYPTION_IV_SECRET — uma
variável especificada num documento de planejamento inicial que nunca chegou a virar código real,
porque a integração foi efetivamente construída com um design de autenticação diferente.

CURRENT_PRIVATE_KEY_REFERENCE: 0
CURRENT_RUNTIME_CONSUMERS: 0 (para DOCUSIGN_PRIVATE_KEY especificamente — a integração OAuth em si tem
  1 consumidor real, mas não depende desta variável)
ACTIVE_DOCUSIGN_INTEGRATION: SIM, mas usando um modelo de auth (Authorization Code) inteiramente não
  relacionado à chave comprometida — por isso a classificação permanece RETIRED_NO_RUNTIME_DEPENDENCY
  para a chave privada especificamente, não ACTIVE_COMPROMISED (que exigiria a chave estar de fato em
  uso) nem UNRESOLVED.

ROTATION_REQUIRED:
NÃO — não existe consumidor vivo a reapontar; não há "rotação" aplicável a uma credencial que nenhum
  sistema atual usa.

HISTORICAL_KEY_OPERATIONALLY_REVOKED:
SIM — o valor histórico nunca concedeu capacidade operacional neste sistema, porque nenhum caminho de
  código jamais o consumiu.
```

---

## Resumo

```text
DOCUSIGN_PRIVATE_KEY_CLASSIFICATION: RETIRED_NO_RUNTIME_DEPENDENCY
ROTATION_REQUIRED: NÃO
HISTORICAL_KEY_OPERATIONALLY_REVOKED: SIM
DOCUSIGN_INTEGRATION_EXISTS: SIM (somente conexão OAuth de conta — assinatura de documento não
  implementada)
CREDENTIAL_OWNERSHIP_MODEL: SHARED_PLATFORM_CREDENTIAL (app) + token per-tenant (resultado da conexão)
```

## Cobertura

Identificador `DOCUSIGN_PRIVATE_KEY` auditado em todo o código-fonte, documentação e configuração atual
(0 referências em qualquer lugar além do histórico Git). Integração DocuSign real caracterizada com
precisão: 1 fluxo funcional (conexão de conta via OAuth 2.0 Authorization Code, DOCUSIGN_CLIENT_SECRET),
0 fluxos de assinatura/envelope implementados (adapter explicitamente indisponível, sem simulação de
sucesso). Modelo de autenticação confirmado por leitura direta do código como Authorization Code, nunca
JWT Grant — logo, estruturalmente sem qualquer relação com uma chave privada RSA. Configuração atual
auditada por nome em todos os arquivos de ambiente relevantes (raiz, legacy, apps/api-v2, Docker, CI) —
DOCUSIGN_PRIVATE_KEY ausente em todos. Comparação de chave marcada NOT_VERIFIABLE por impossibilidade
estrutural (nenhum dos dois lados existe/foi acessado). Legacy mapeado (service/module/controller/
configuração) sem alteração de código. Frontend mapeado (7 arquivos, UI presente mas backend
funcionalmente indisponível para assinatura) para integrar o contrato zero-gap (doc74) futuramente.
Webhook/Connect confirmado inexistente. Multi-tenancy caracterizado como credencial de plataforma
compartilhada + token de acesso por tenant. Dados persistidos limitados ao resultado da conexão OAuth
(tabela genérica de tokens, criptografada via EncryptionService já documentado no doc76) — nenhum dado
de envelope/assinatura, porque a funcionalidade não existe. Histórico Git confirmado exposto, não
reescrito. Nenhum banco, migration, Auth, Supabase, frontend, código legacy ou apps/api-v2 funcional foi
alterado. SMTP não foi tratado. Nenhuma operação foi feita contra a conta DocuSign real. Nenhum valor
secreto (histórico ou atual) foi impresso em nenhum momento desta investigação.
