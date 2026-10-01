> Historical record. Kept as recorded; not the current contract.

# 32 — Auditoria de `PENDING_TABLES` e Tabelas Sem Endpoint

Continuação read-only de [`04-http-client-architecture.md`](./04-http-client-architecture.md), [`05-http-endpoint-inventory.md`](./05-http-endpoint-inventory.md), [`27-runtime-mock-audit.md`](./27-runtime-mock-audit.md) e [`28-runtime-mock-final-resolution.md`](./28-runtime-mock-final-resolution.md). Nenhum arquivo foi alterado. `PENDING_TABLES`/`TABLE_ENDPOINT` não foram alterados. Nenhum endpoint foi criado. `apps/api` não foi consultado.

## Mecanismo confirmado

`apps/web/src/shared/lib/api-client.ts:93-100` define `PENDING_TABLES` (6 entradas, com o motivo já documentado no próprio código). `apps/web/src/shared/lib/storage.ts:66-78` (`resolveTable()`) verifica `TABLE_ENDPOINT` primeiro; se a tabela só existe em `PENDING_TABLES`, todo método de `storage.*` (`list/findById/create/update/delete`) chama `unavailableTable()` (linha 80-86), que lança `IntegrationError("module-unavailable", ..., { retryable: false, statusCode: 503 })` **antes de qualquer fetch** — não há fallback de memória, localStorage ou mock: é uma falha imediata e explícita. Nenhuma chave aparece nos dois mapas simultaneamente (conjuntos disjuntos, confirmado por inspeção).

---

## 1 — `regras`

```text
TABLE_KEY:
regras

DOMÍNIO:
accounting (motivo documentado no código: "Rules UI storage table has no backend controller")

TABLE_ENDPOINT_EXISTS:
NÃO

ENDPOINT:
NONE

ACTIVE_FRONTEND_CONSUMER:
NÃO

SCREENS:
NONE

CRUD_EXPECTED:
INCERTO — o nome sugere um CRUD de regras de negócio, mas nenhum código chama storage.*("regras", ...) para confirmar o shape esperado

OPERATIONS_EXPECTED:
- nenhuma comprovada (nenhum chamador para inferir)

CURRENT_BEHAVIOR:
nunca é alcançado — grep de `storage\.\w+\(\s*["']regras["']` em todo apps/web/src não encontrou nenhum call site

CURRENT_FALLBACK:
NONE (não há fallback nem chamada — código simplesmente não é exercitado)

API_V2_REQUIRED:
NÃO

JUSTIFICATIVA:
esta chave específica de `storage.ts` está órfã. A funcionalidade real de "regras" (matriz de categorização financeira) já existe e já foi auditada em [`19-backend-required-storage-map.md`](./19-backend-required-storage-map.md) (Caso 1) — mas vive inteiramente em `useFinancialCategoryRulesStore.ts` via `localStorage` direto (chave `musicos360_financial_category_rules`), sem NUNCA passar por `storage.ts`/`resolveTable()`. São dois mecanismos paralelos e desconectados: a chave `PENDING_TABLES.regras` é vestígio morto de uma tentativa anterior (ou planejada) de rotear "regras" pelo wrapper genérico; a necessidade real de backend já está corretamente rastreada no doc19, não aqui.
```

## 2 — `tarefas_marketing`

```text
TABLE_KEY:
tarefas_marketing

DOMÍNIO:
marketing (motivo documentado no código: "Marketing tasks have no backend controller")

TABLE_ENDPOINT_EXISTS:
NÃO

ENDPOINT:
NONE (para esta chave específica) — mas existe endpoint REAL e funcional para tarefas de marketing por outro caminho: POST/GET/PATCH/DELETE `/marketing/tasks` (marketing.service.ts, doc05, linhas 395-405)

ACTIVE_FRONTEND_CONSUMER:
NÃO

SCREENS:
NONE

CRUD_EXPECTED:
NÃO (a funcionalidade real de tarefas de marketing já é servida por outro caminho, ver abaixo)

OPERATIONS_EXPECTED:
- LIST (única operação referenciada, dentro de código morto)

CURRENT_BEHAVIOR:
referenciado uma única vez, em `apps/web/src/modules/dashboard/hooks/useOperationalDashboard.ts:88` (`storage.list<Row>("tarefas_marketing")`), dentro da função `computeFromMockStorage()` — que é código morto: `export function useOperationalDashboard()` (linha 222, o hook realmente exportado e consumido) NÃO chama `computeFromMockStorage()`; ele chama `api.get<OperationalDashboard>("/analytics/dashboard")` diretamente (endpoint real, já confirmado no doc05). Confirmado por grep: `computeFromMockStorage` não tem nenhum chamador em `apps/web/src`.

CURRENT_FALLBACK:
NONE (a função que a referenciaria nunca executa)

API_V2_REQUIRED:
NÃO

JUSTIFICATIVA:
achado duplo: (1) a única referência a esta chave está em uma função inteiramente inalcançável, então não há bug ativo (mesmo que `storage.list("tarefas_marketing")` sempre lançasse, nunca é chamado); (2) a funcionalidade real de tarefas de marketing já tem um endpoint funcional e ativo por outro caminho (`marketing.service.ts` → `/marketing/tasks`, usado pelo restante da aplicação). A chave `PENDING_TABLES.tarefas_marketing` é vestígio morto de uma versão anterior do dashboard, de antes de `/analytics/dashboard` existir.
```

## 3 — `monitoramentos`

```text
TABLE_KEY:
monitoramentos

DOMÍNIO:
monitoring (motivo documentado no código: "Monitoring table has no backend controller")

TABLE_ENDPOINT_EXISTS:
NÃO

ENDPOINT:
NONE

ACTIVE_FRONTEND_CONSUMER:
NÃO

SCREENS:
NONE

CRUD_EXPECTED:
INCERTO — o service que a referencia (monitoringService) sugere um CRUD (list/findById/update de "alertas"), mas nenhuma tela o consome hoje

OPERATIONS_EXPECTED:
- LIST (listAlerts)
- GET (findAlert)
- UPDATE (updateAlert)

CURRENT_BEHAVIOR:
referenciado em `apps/web/src/modules/monitoring/services/monitoring.service.ts:4-7` (`listAlerts`/`findAlert`/`updateAlert`) — mas `monitoringService` inteiro (incluindo os métodos que usam tabelas reais, como `takedowns`/`ecad_reports`/`content_detections`) não tem NENHUM importador em todo `apps/web/src`, confirmado por grep dedicado. É um service inteiramente órfão, não apenas a parte "monitoramentos".

CURRENT_FALLBACK:
NONE

API_V2_REQUIRED:
NÃO

JUSTIFICATIVA:
diferente dos Casos 1 e 2, aqui não foi encontrada nenhuma funcionalidade real equivalente em outro caminho dentro do escopo verificado (apps/web/**) — mas como o service inteiro está órfão (nenhuma tela chama `monitoringService`, nem para as tabelas reais que ele também expõe), não há evidência de que a tela de Monitoramento/Rights Monitoring dependa deste service para alertas hoje. Não foi possível, dentro do escopo autorizado desta etapa (não ampliar a busca), determinar de onde a tela real de monitoramento obtém dados de alertas, se é que obtém — registrado como achado, não investigado além disso.
```

## 4 — `roles`

```text
TABLE_KEY:
roles

DOMÍNIO:
settings / RBAC (motivo documentado no código: "RBAC is currently exposed through /users and auth context, not a /roles CRUD")

TABLE_ENDPOINT_EXISTS:
NÃO (para esta chave) — mas existe endpoint REAL: GET/POST/PATCH `/rbac/roles` (useRoles.ts, doc05, linhas 100-136,148-260)

ACTIVE_FRONTEND_CONSUMER:
NÃO (para o caminho storage.ts/PENDING_TABLES) — SIM para a funcionalidade real (useRoles.ts)

SCREENS:
NONE (via storage.ts) — a tela real de gestão de papéis (Configurações → Papéis/Roles) usa useRoles.ts diretamente contra `/rbac/roles`, não storage.ts

CRUD_EXPECTED:
NÃO — via este caminho especificamente

OPERATIONS_EXPECTED:
- nenhuma (zero chamadas a storage.*("roles", ...) em todo apps/web/src)

CURRENT_BEHAVIOR:
nunca é alcançado — grep confirma zero call sites

CURRENT_FALLBACK:
NONE

API_V2_REQUIRED:
NÃO

JUSTIFICATIVA:
o próprio motivo documentado no código está correto e confirmado pela evidência: RBAC já é servido por um contrato real e completo (`/rbac/roles`, `/rbac/permissions`, `/rbac/grants`, `/users/invitations` — todos em useRoles.ts, já mapeados em detalhe no doc05/15). A entrada `PENDING_TABLES.roles` não representa uma lacuna — representa a decisão consciente de NÃO rotear RBAC pelo wrapper genérico de tabelas, porque o domínio já tem uma API dedicada e mais expressiva.
```

## 5 — `permissions`

```text
TABLE_KEY:
permissions

DOMÍNIO:
settings / RBAC (motivo documentado no código: "Permissions are computed server-side, not exposed as a /permissions CRUD")

TABLE_ENDPOINT_EXISTS:
NÃO (para esta chave) — mas existe endpoint REAL: GET `/rbac/permissions` (useRoles.ts) e o campo `membership.permissions` de GET `/auth/context` (TenantContext.tsx, já mapeado no doc15)

ACTIVE_FRONTEND_CONSUMER:
NÃO (via storage.ts) — SIM para a funcionalidade real

SCREENS:
NONE (via storage.ts) — permissões reais chegam via `/auth/context` (bootstrap de sessão) e `/rbac/permissions` (tela de papéis)

CRUD_EXPECTED:
NÃO — permissões são computadas no servidor, não editadas via CRUD de tabela

OPERATIONS_EXPECTED:
- nenhuma (zero chamadas a storage.*("permissions", ...) em todo apps/web/src)

CURRENT_BEHAVIOR:
nunca é alcançado

CURRENT_FALLBACK:
NONE

API_V2_REQUIRED:
NÃO

JUSTIFICATIVA:
mesma natureza do Caso 4 — o motivo documentado no código é preciso e confirmado: permissões não são uma entidade CRUD, são um resultado computado (papel × módulo × operação) exposto via `/auth/context` e `/rbac/permissions`. Não é uma lacuna a preencher.
```

## 6 — `integrations`

```text
TABLE_KEY:
integrations

DOMÍNIO:
integrations (motivo documentado no código: "Integrations are exposed via sub-routes (integrations/autentique, integrations/external-data), not a flat /integrations CRUD")

TABLE_ENDPOINT_EXISTS:
NÃO (para uma rota `/integrations` plana) — mas existem DEZENAS de endpoints reais por sub-rota (`/integrations/spotify/*`, `/integrations/tiktok/*`, `/integrations/google-ads/*` etc. — todos já mapeados em detalhe no doc05)

ACTIVE_FRONTEND_CONSUMER:
NÃO (via storage.ts) — SIM para as integrações individuais, cada uma com seu próprio hook (useSpotify.ts, useTikTok.ts etc., já auditados nos docs 05/18/19)

SCREENS:
NONE via este caminho — `apps/web/src/modules/settings/services/settings.service.ts:41-46` (`listIntegrations`/`updateIntegration`) é o único código que referencia esta chave, e ele próprio não tem nenhum chamador real fora de `settings.service.test.ts` (confirmado por grep)

CRUD_EXPECTED:
NÃO — via este caminho especificamente; cada integração já tem seu próprio ciclo de vida (status/configure/auth/disconnect) por sub-rota

OPERATIONS_EXPECTED:
- LIST (listIntegrations, via safeGetRaw — nem passa por resolveTable/PENDING_TABLES, usa o stub getRaw que sempre lança)
- UPDATE (updateIntegration, via storage.update — este sim passa por resolveTable/PENDING_TABLES)

CURRENT_BEHAVIOR:
`listIntegrations()` usa `safeGetRaw("integrations", [])` — um mecanismo DIFERENTE (stub `getRaw`, não `resolveTable`), que sempre falha silenciosamente e devolve `[]` (comportamento documentado no próprio arquivo: "Sem backend real... o comportamento correto é falhar de forma silenciosa e segura"). `updateIntegration()` usa `storage.update("integrations", id, data)`, que de fato passa por `resolveTable()`/`PENDING_TABLES` e lançaria o erro 503. Nenhuma das duas funções tem chamador real fora do arquivo de teste.

CURRENT_FALLBACK:
NONE (listIntegrations tecnicamente tem um fallback — `[]` via safeGetRaw — mas isso é irrelevante porque a função não é chamada por nenhuma tela)

API_V2_REQUIRED:
NÃO

JUSTIFICATIVA:
mesmo padrão dos Casos 4/5 — o motivo documentado é preciso: o estado real de cada integração já é obtido por dezenas de endpoints por sub-rota, extensivamente mapeados nos docs 05/18/19/20. A camada genérica `settingsService.listIntegrations/updateIntegration` é vestígio morto (sem consumidor real), coerente com o padrão já visto nos Casos 1-3.
```

---

## Comparação com `TABLE_ENDPOINT` (45 entradas)

Verificação (não exaustiva entrada-a-entrada, conforme pedido "compare") contra as 4 perguntas do prompt:

**(a) Chave presente em ambos os mapas simultaneamente:** nenhuma — os conjuntos de chaves de `TABLE_ENDPOINT` (45) e `PENDING_TABLES` (6) são disjuntos, confirmado por inspeção direta dos dois blocos em `api-client.ts`.

**(b) Mapping existe mas sem consumidor ativo via `storage.ts`:** achado relevante — de um grep dirigido a todas as 45 chaves como argumento literal de `storage.<método>(...)`, **13 arquivos de serviço** usam `storage.ts` ativamente para suas tabelas (`artista.service.ts`, `catalog.service.ts`, `contracts.service.ts`, `accounting.service.ts`, `licensing.service.ts`, `releases.service.ts`, `events.service.ts`, `projects.service.ts`, `inventory.service.ts`, `rh.service.ts`, `monitoring.service.ts` [órfão, ver acima], `settings.service.ts`, `shared/domain-events/consistency.ts`) — cobrindo as chaves: artistas, obras, fonogramas, contratos, contract_templates, contract_service_types, transacoes, notas_fiscais, licencas, regras_financeiras (parcial, só `list`), lancamentos, shares, eventos, projetos, inventario, funcionarios, folha_pagamento, afastamentos, takedowns, ecad_reports, content_detections, users. As demais chaves de `TABLE_ENDPOINT` (leads, clientes, contatos, campanhas, marketing_projects, conteudos, briefings, financial_categories, categorias_financeiras, support_tickets, audit_logs, proposals, proposal_items, followups, lead_interactions, metas_artistas, relatorios_ecad, deteccoes, documentos_funcionario, templates_contratos, ferias_ausencias, org_members, usuarios) **não são alcançadas via `storage.ts`** — mas isso não significa ausência de consumidor: a maioria delas (leads, clientes, campanhas, marketing_projects, conteudos, briefings, financial_categories, support_tickets, audit_logs) já foi confirmada nos docs 05/06 como consumida via chamadas DIRETAS a `api-client.ts` (`api.get/post/...`) em serviços dedicados (`leads.service.ts`, `clients.service.ts`, `marketing.service.ts`, `financial-categories.service.ts`, `useSupport.ts`, `useAuditTrail.ts`), usando o MESMO path final, sem passar pelo wrapper genérico — arquitetura duplicada (dois caminhos possíveis, só um exercitado por entidade), não uma lacuna.

**(c) Consumidor ativo mas também em `PENDING_TABLES`:** impossível por construção (ver item "a") — não verificado caso a caso além disso.

**(d) Aponta para endpoint sem confirmação no inventário do doc05:** não encontrado nenhum caso — todos os paths de `TABLE_ENDPOINT` correspondem a padrões de endpoint já vistos no doc05 (diretamente, via `storage.ts`, ou via a rota equivalente chamada diretamente por um serviço dedicado).

**Achado à parte, não pedido explicitamente mas relevante:** duas chaves de `TABLE_ENDPOINT` parecem ser aliases nunca usados por nenhum caminho — `usuarios` e `org_members` (ambas mapeando para `/users`, mesmo endpoint de `users`, que É usado via `settings.service.ts`). Grep dedicado confirma zero ocorrências de `storage.*("usuarios"...)` ou `storage.*("org_members"...)` em `apps/web/src` — "usuarios" só aparece como label de aba/chave de query, nunca como argumento de tabela.

---

## Resumo

```text
PENDING_TABLES_TOTAL:
6

PENDING_WITH_ACTIVE_CONSUMER:
0

PENDING_WITHOUT_ACTIVE_CONSUMER:
6

PENDING_WITH_EXISTING_TABLE_ENDPOINT:
0

PENDING_WITHOUT_TABLE_ENDPOINT:
6

PENDING_USING_MEMORY_FALLBACK:
0

PENDING_USING_LOCAL_STORAGE:
0

PENDING_USING_MOCK:
0

API_V2_REQUIRED:
0

NON_CRUD_BY_DESIGN:
3

NO_ACTIVE_CONSUMER:
3

REQUIRES_DECISION:
0

TABLE_ENDPOINT_ENTRIES_CHECKED:
45
```

`NON_CRUD_BY_DESIGN` (3: roles, permissions, integrations) — o motivo documentado no próprio código está correto: cada um já tem uma funcionalidade real por um caminho diferente e mais específico (não-CRUD-genérico), confirmada nos docs 05/15/18/19/20. `NO_ACTIVE_CONSUMER` (3: regras, tarefas_marketing, monitoramentos) — código totalmente inalcançável, seja por estar dentro de uma função nunca chamada (`computeFromMockStorage`), seja por o service inteiro não ter importador (`monitoringService`), seja por nunca ter sido referenciado em lugar nenhum (`regras`). Nenhuma das 6 entradas de `PENDING_TABLES` exige trabalho novo de API v2 — 2 (regras, integrations) já têm sua necessidade real rastreada em outros documentos desta auditoria (doc19 e doc05/18-20, respectivamente), e as demais não representam funcionalidade pendente real.

## Cobertura

6/6 entradas de `PENDING_TABLES` auditadas com evidência de consumidor (ou ausência dele). 45 entradas de `TABLE_ENDPOINT` comparadas quanto às 4 perguntas do prompt (não exaustivamente, uma por uma, mas com evidência quantitativa suficiente para responder cada pergunta). `apps/api` não foi consultado. Nenhum arquivo foi alterado.
