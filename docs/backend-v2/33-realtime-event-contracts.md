> Historical record. Kept as recorded; not the current contract.

# 33 — Contratos de Eventos Realtime/Assíncronos do Frontend

Continuação read-only de [`17-supabase-direct-access-audit.md`](./17-supabase-direct-access-audit.md), [`30-external-service-audit.md`](./30-external-service-audit.md) e [`31-external-service-final-resolution.md`](./31-external-service-final-resolution.md). Nenhum arquivo foi alterado. Nenhum channel/evento foi criado. `apps/api` não foi consultado — a única referência a `apps/api` é a citação do comentário já existente em `ws-events.ts` ("Keep in sync with apps/api/src/core/realtime/realtime.service.ts"), tratada como texto do frontend, não como verificação do backend.

## Metodologia e estrutura deste documento

Como a maioria dos 20 eventos do contrato Supabase Realtime tem **múltiplos call sites** (o mesmo evento é consumido por 2-3 arquivos diferentes com efeitos diferentes — invalidação de cache, toast, feed de atividade), este documento registra **um bloco por evento único** (`TRANSPORTE + CHANNEL + EVENT_NAME`), com todos os call sites preservados como uma lista dentro do bloco, em vez de repetir blocos quase idênticos. Nenhum call site foi omitido — a lista de "CALL SITES" de cada evento é exaustiva (confirmada por grep de `useWsEvent\(` em todo `apps/web/src`).

## Mecanismo de transporte (contexto, não é um evento em si)

`apps/web/src/shared/lib/ws-client.ts` (já auditado no doc17/18) abre 2 canais Supabase Realtime por sessão autenticada — `` `tenant:${orgId}` `` e `` `user:${userId}` `` (org_id/user_id extraídos do JWT em memória, `get-session-org-id.ts`) — e liga (`channel.on('broadcast', {event}, dispatch)`) um dispatcher para **cada um dos 20 nomes** de `ALL_WS_EVENT_NAMES` (`ws-events.ts`) em **ambos** os canais, antes de `subscribe()`. Não há distinção, no código do frontend, de qual canal efetivamente entregou um evento — por isso todo evento do contrato é tratado como potencialmente tenant-scoped E user-scoped simultaneamente. A conexão é estabelecida de forma preguiçosa: `onWsEvent()` (chamado por todo `useWsEvent()`) invoca `ensureRealtimeChannels()` internamente — não há nenhum outro gatilho de conexão. **Achado à parte:** o hook dedicado `useWebSocket()` (`shared/hooks/useWebSocket.ts`), que exporia `{connected}`, não tem nenhum chamador em `apps/web/src` — órfão, mas irrelevante para a conexão real, que já é acionada pelos `useWsEvent()` abaixo.

---

## Eventos Supabase Realtime (20, do contrato `WsEventMap`)

### `artist.created`

```text
TRANSPORTE: SUPABASE_REALTIME
DIREÇÃO: SUBSCRIBE
CHANNEL: `tenant:${orgId}` e `user:${userId}` (ambos)
EVENT_NAME: artist.created
PAYLOAD: WsBasePayload & { id: string } — consumidores leem também um campo não tipado `nome_artistico` via cast
PAYLOAD_TYPES: { org_id: string; id: string; [key: string]: unknown }
TRIGGER: backend publica ao criar um artista (inferido do nome do evento; não verificado em apps/api, fora do escopo)
TENANT_SCOPED: SIM
USER_SCOPED: SIM
AUTH_REQUIRED: SIM (ensureRealtimeChannels() exige org_id/user_id derivados do JWT; sem sessão, os canais nunca abrem)

CALL_SITES:
- apps/web/src/shared/infrastructure/RealtimeLayer.tsx:61 — RealtimeSyncAndNotify() — EFFECT: toast.success('Artista cadastrado', ...) usando `nome_artistico` do payload
- apps/web/src/shared/hooks/useRealtimeSync.ts:21 — useRealtimeSync() — EFFECT: invalida QUERY_KEYS.ARTISTAS e QUERY_KEYS.METRICS
- apps/web/src/modules/dashboard/pages/Dashboard.tsx:401 — EFFECT: adiciona item ao feed de atividade local (push)
```

### `artist.updated`

```text
TRANSPORTE: SUPABASE_REALTIME
DIREÇÃO: SUBSCRIBE
CHANNEL: `tenant:${orgId}` e `user:${userId}`
EVENT_NAME: artist.updated
PAYLOAD: WsBasePayload & { id: string }
PAYLOAD_TYPES: { org_id: string; id: string; [key: string]: unknown }
TRIGGER: backend publica ao atualizar um artista (inferido)
TENANT_SCOPED: SIM
USER_SCOPED: SIM
AUTH_REQUIRED: SIM

CALL_SITES:
- apps/web/src/shared/hooks/useRealtimeSync.ts:22 — EFFECT: invalida QUERY_KEYS.ARTISTAS
- apps/web/src/modules/dashboard/pages/Dashboard.tsx:404 — EFFECT: push ao feed de atividade
```

### `artist.deleted`

```text
TRANSPORTE: SUPABASE_REALTIME
DIREÇÃO: SUBSCRIBE
CHANNEL: `tenant:${orgId}` e `user:${userId}`
EVENT_NAME: artist.deleted
PAYLOAD: WsBasePayload & { id: string }
PAYLOAD_TYPES: { org_id: string; id: string; [key: string]: unknown }
TRIGGER: backend publica ao remover um artista (inferido)
TENANT_SCOPED: SIM
USER_SCOPED: SIM
AUTH_REQUIRED: SIM

CALL_SITES:
- apps/web/src/shared/hooks/useRealtimeSync.ts:23 — EFFECT: invalida QUERY_KEYS.ARTISTAS e QUERY_KEYS.METRICS
- apps/web/src/modules/dashboard/pages/Dashboard.tsx:407 — EFFECT: push ao feed de atividade
```

### `catalog.music.registered`

```text
TRANSPORTE: SUPABASE_REALTIME
DIREÇÃO: SUBSCRIBE
CHANNEL: `tenant:${orgId}` e `user:${userId}`
EVENT_NAME: catalog.music.registered
PAYLOAD: WsBasePayload & { id: string } — consumidores leem também `titulo` via cast
PAYLOAD_TYPES: { org_id: string; id: string; [key: string]: unknown }
TRIGGER: backend publica ao registrar uma obra (inferido)
TENANT_SCOPED: SIM
USER_SCOPED: SIM
AUTH_REQUIRED: SIM

CALL_SITES:
- apps/web/src/shared/infrastructure/RealtimeLayer.tsx:96 — EFFECT: toast.success('Música registrada', ...)
- apps/web/src/shared/hooks/useRealtimeSync.ts:26 — EFFECT: invalida QUERY_KEYS.OBRAS, FONOGRAMAS, METRICS
- apps/web/src/modules/dashboard/pages/Dashboard.tsx:410 — EFFECT: push ao feed de atividade
```

### `catalog.phonogram.registered`

```text
TRANSPORTE: SUPABASE_REALTIME
DIREÇÃO: SUBSCRIBE
CHANNEL: `tenant:${orgId}` e `user:${userId}`
EVENT_NAME: catalog.phonogram.registered
PAYLOAD: WsBasePayload & { id: string }
PAYLOAD_TYPES: { org_id: string; id: string; [key: string]: unknown }
TRIGGER: backend publica ao registrar um fonograma (inferido)
TENANT_SCOPED: SIM
USER_SCOPED: SIM
AUTH_REQUIRED: SIM

CALL_SITES:
- apps/web/src/shared/hooks/useRealtimeSync.ts:27 — EFFECT: invalida QUERY_KEYS.FONOGRAMAS
- apps/web/src/modules/dashboard/pages/Dashboard.tsx:413 — EFFECT: push ao feed de atividade
```

### `contract.created`

```text
TRANSPORTE: SUPABASE_REALTIME
DIREÇÃO: SUBSCRIBE
CHANNEL: `tenant:${orgId}` e `user:${userId}`
EVENT_NAME: contract.created
PAYLOAD: WsBasePayload & { id: string }
PAYLOAD_TYPES: { org_id: string; id: string; [key: string]: unknown }
TRIGGER: backend publica ao criar um contrato (inferido)
TENANT_SCOPED: SIM
USER_SCOPED: SIM
AUTH_REQUIRED: SIM

CALL_SITES:
- apps/web/src/shared/infrastructure/RealtimeLayer.tsx:68 — EFFECT: toast.info('Novo contrato criado', ...)
- apps/web/src/shared/hooks/useRealtimeSync.ts:30 — EFFECT: invalida QUERY_KEYS.CONTRATOS, METRICS, NOTIFICATIONS
- apps/web/src/modules/dashboard/pages/Dashboard.tsx:416 — EFFECT: push ao feed de atividade
```

### `contract.updated`

```text
TRANSPORTE: SUPABASE_REALTIME
DIREÇÃO: SUBSCRIBE
CHANNEL: `tenant:${orgId}` e `user:${userId}`
EVENT_NAME: contract.updated
PAYLOAD: WsBasePayload & { id: string }
PAYLOAD_TYPES: { org_id: string; id: string; [key: string]: unknown }
TRIGGER: backend publica ao atualizar um contrato (inferido)
TENANT_SCOPED: SIM
USER_SCOPED: SIM
AUTH_REQUIRED: SIM

CALL_SITES:
- apps/web/src/shared/hooks/useRealtimeSync.ts:31 — EFFECT: invalida QUERY_KEYS.CONTRATOS
- apps/web/src/modules/dashboard/pages/Dashboard.tsx:419 — EFFECT: push ao feed de atividade
```

### `contract.signed`

```text
TRANSPORTE: SUPABASE_REALTIME
DIREÇÃO: SUBSCRIBE
CHANNEL: `tenant:${orgId}` e `user:${userId}`
EVENT_NAME: contract.signed
PAYLOAD: WsBasePayload & { id: string }
PAYLOAD_TYPES: { org_id: string; id: string; [key: string]: unknown }
TRIGGER: backend publica ao concluir assinatura de um contrato (inferido)
TENANT_SCOPED: SIM
USER_SCOPED: SIM
AUTH_REQUIRED: SIM

CALL_SITES:
- apps/web/src/shared/infrastructure/RealtimeLayer.tsx:72 — EFFECT: toast.success('Contrato assinado', ...)
- apps/web/src/shared/hooks/useRealtimeSync.ts:32 — EFFECT: invalida QUERY_KEYS.CONTRATOS, NOTIFICATIONS
- apps/web/src/modules/dashboard/pages/Dashboard.tsx:422 — EFFECT: push ao feed de atividade
```

### `crm.lead.captured`

```text
TRANSPORTE: SUPABASE_REALTIME
DIREÇÃO: SUBSCRIBE
CHANNEL: `tenant:${orgId}` e `user:${userId}`
EVENT_NAME: crm.lead.captured
PAYLOAD: WsBasePayload & { id: string } — consumidores leem também `nome` via cast
PAYLOAD_TYPES: { org_id: string; id: string; [key: string]: unknown }
TRIGGER: backend publica ao capturar um lead (inferido)
TENANT_SCOPED: SIM
USER_SCOPED: SIM
AUTH_REQUIRED: SIM

CALL_SITES:
- apps/web/src/shared/infrastructure/RealtimeLayer.tsx:76 — EFFECT: toast.info('Novo lead capturado', ...)
- apps/web/src/shared/hooks/useRealtimeSync.ts:35 — EFFECT: invalida QUERY_KEYS.LEADS, METRICS
- apps/web/src/modules/dashboard/pages/Dashboard.tsx:425 — EFFECT: push ao feed de atividade
```

### `crm.lead.converted`

```text
TRANSPORTE: SUPABASE_REALTIME
DIREÇÃO: SUBSCRIBE
CHANNEL: `tenant:${orgId}` e `user:${userId}`
EVENT_NAME: crm.lead.converted
PAYLOAD: WsBasePayload & { id: string }
PAYLOAD_TYPES: { org_id: string; id: string; [key: string]: unknown }
TRIGGER: backend publica ao converter um lead em artista/cliente (inferido)
TENANT_SCOPED: SIM
USER_SCOPED: SIM
AUTH_REQUIRED: SIM

CALL_SITES:
- apps/web/src/shared/infrastructure/RealtimeLayer.tsx:83 — EFFECT: toast.success('Lead convertido', ...)
- apps/web/src/shared/hooks/useRealtimeSync.ts:36 — EFFECT: invalida QUERY_KEYS.LEADS, ARTISTAS, METRICS
- apps/web/src/modules/dashboard/pages/Dashboard.tsx:428 — EFFECT: push ao feed de atividade
```

### `finance.transaction.created`

```text
TRANSPORTE: SUPABASE_REALTIME
DIREÇÃO: SUBSCRIBE
CHANNEL: `tenant:${orgId}` e `user:${userId}`
EVENT_NAME: finance.transaction.created
PAYLOAD: WsBasePayload & { id: string } — consumidores leem também `tipo` via cast
PAYLOAD_TYPES: { org_id: string; id: string; [key: string]: unknown }
TRIGGER: backend publica ao criar uma transação financeira (inferido)
TENANT_SCOPED: SIM
USER_SCOPED: SIM
AUTH_REQUIRED: SIM

CALL_SITES:
- apps/web/src/shared/infrastructure/RealtimeLayer.tsx:87 — EFFECT: toast.info('Nova {tipo} registrada', ...)
- apps/web/src/shared/hooks/useRealtimeSync.ts:39 — EFFECT: invalida QUERY_KEYS.TRANSACOES, METRICS
- apps/web/src/modules/dashboard/pages/Dashboard.tsx:431 — EFFECT: push ao feed de atividade
```

### `finance.transaction.updated`

```text
TRANSPORTE: SUPABASE_REALTIME
DIREÇÃO: SUBSCRIBE
CHANNEL: `tenant:${orgId}` e `user:${userId}`
EVENT_NAME: finance.transaction.updated
PAYLOAD: WsBasePayload & { id: string }
PAYLOAD_TYPES: { org_id: string; id: string; [key: string]: unknown }
TRIGGER: backend publica ao atualizar uma transação (inferido)
TENANT_SCOPED: SIM
USER_SCOPED: SIM
AUTH_REQUIRED: SIM

CALL_SITES:
- apps/web/src/shared/hooks/useRealtimeSync.ts:40 — EFFECT: invalida QUERY_KEYS.TRANSACOES
- apps/web/src/modules/dashboard/pages/Dashboard.tsx:434 — EFFECT: push ao feed de atividade
```

### `finance.calculated`

```text
TRANSPORTE: SUPABASE_REALTIME
DIREÇÃO: SUBSCRIBE
CHANNEL: `tenant:${orgId}` e `user:${userId}`
EVENT_NAME: finance.calculated
PAYLOAD: WsBasePayload & { period?: string }
PAYLOAD_TYPES: { org_id: string; period?: string; [key: string]: unknown }
TRIGGER: backend publica ao concluir uma apuração financeira (inferido)
TENANT_SCOPED: SIM
USER_SCOPED: SIM
AUTH_REQUIRED: SIM

CALL_SITES:
- apps/web/src/shared/infrastructure/RealtimeLayer.tsx:92 — EFFECT: toast.success('Apuração concluída', ...)
- apps/web/src/shared/hooks/useRealtimeSync.ts:41 — EFFECT: invalida QUERY_KEYS.METRICS, TRANSACOES
- apps/web/src/modules/dashboard/pages/Dashboard.tsx:437 — EFFECT: push ao feed de atividade
```

### `audit.entry.created`

```text
TRANSPORTE: SUPABASE_REALTIME
DIREÇÃO: SUBSCRIBE
CHANNEL: `tenant:${orgId}` e `user:${userId}`
EVENT_NAME: audit.entry.created
PAYLOAD: WsBasePayload & { action: string }
PAYLOAD_TYPES: { org_id: string; action: string; [key: string]: unknown } — consumidor no Dashboard também lê `entity` via cast (não tipado no WsEventMap)
TRIGGER: backend publica ao criar uma entrada de auditoria (inferido)
TENANT_SCOPED: SIM
USER_SCOPED: SIM
AUTH_REQUIRED: SIM

CALL_SITES:
- apps/web/src/shared/hooks/useRealtimeSync.ts:44 — EFFECT: nenhum (`() => {}`) — comentário do código: "no query to invalidate — feed handles via ActivityFeed"
- apps/web/src/modules/dashboard/pages/Dashboard.tsx:440 — EFFECT: push ao feed de atividade (label com `action`/`entity`)
```

### `notification:new`

```text
TRANSPORTE: SUPABASE_REALTIME
DIREÇÃO: SUBSCRIBE
CHANNEL: `tenant:${orgId}` e `user:${userId}`
EVENT_NAME: notification:new
PAYLOAD: WsNotificationPayload
PAYLOAD_TYPES: { id: string|null; title: string; body?: string|null; type: string; entity?: string|null; entityId?: string|null; createdAt: string|Date }
TRIGGER: comentário do código: "backend → fila NOTIFICATIONS → WS" (fila/processador de notificações do backend)
TENANT_SCOPED: SIM
USER_SCOPED: SIM
AUTH_REQUIRED: SIM

CALL_SITES:
- apps/web/src/shared/infrastructure/RealtimeLayer.tsx:31 — EFFECT: toast (success/warning/error/info conforme `n.type`) + invalida QUERY_KEYS.NOTIFICATIONS (badge/dropdown da topbar)
```

### `billing:plan_upgraded`

```text
TRANSPORTE: SUPABASE_REALTIME
DIREÇÃO: SUBSCRIBE
CHANNEL: `tenant:${orgId}` e `user:${userId}`
EVENT_NAME: billing:plan_upgraded
PAYLOAD: { org_id: string; plan: string }
PAYLOAD_TYPES: { org_id: string; plan: string }
TRIGGER: backend publica após processar webhook Stripe checkout.session.completed (achado do doc27/28 — stripe.webhook.ts documenta essa ação server-side)
TENANT_SCOPED: SIM
USER_SCOPED: SIM
AUTH_REQUIRED: SIM

CALL_SITES:
- apps/web/src/modules/settings/pages/Billing.tsx:103 — EFFECT: invalida ["billing","subscription"] + toast.success
```

### `billing:trial_ending`

```text
TRANSPORTE: SUPABASE_REALTIME
DIREÇÃO: SUBSCRIBE (declarado no contrato; sem consumidor)
CHANNEL: `tenant:${orgId}` e `user:${userId}`
EVENT_NAME: billing:trial_ending
PAYLOAD: { org_id: string; days_left: number }
PAYLOAD_TYPES: { org_id: string; days_left: number }
TRIGGER: inferido do nome — aviso de trial prestes a expirar
TENANT_SCOPED: SIM
USER_SCOPED: SIM
AUTH_REQUIRED: SIM

CALL_SITES:
NENHUM — grep de `useWsEvent\(` em todo apps/web/src não encontrou nenhuma chamada com este nome de evento. O evento está no contrato de tipos e ganha um dispatcher registrado em ambos os canais (bindKnownEvents itera ALL_WS_EVENT_NAMES incondicionalmente), mas nenhum componente escuta — se o backend publicar este evento hoje, nada visível acontece na UI.
```

### `billing:payment_failed`

```text
TRANSPORTE: SUPABASE_REALTIME
DIREÇÃO: SUBSCRIBE (declarado no contrato; sem consumidor)
CHANNEL: `tenant:${orgId}` e `user:${userId}`
EVENT_NAME: billing:payment_failed
PAYLOAD: { org_id: string; invoice_id: string }
PAYLOAD_TYPES: { org_id: string; invoice_id: string }
TRIGGER: inferido do nome — falha de cobrança (stripe.webhook.ts documenta a ação server-side: "notificar admin via email + marcar tenant em grace period" — mas via email, não necessariamente via este evento WS)
TENANT_SCOPED: SIM
USER_SCOPED: SIM
AUTH_REQUIRED: SIM

CALL_SITES:
NENHUM — mesmo achado do evento anterior: contrato declarado, dispatcher registrado, zero consumidor via `useWsEvent`.
```

### `billing:cancelled`

```text
TRANSPORTE: SUPABASE_REALTIME
DIREÇÃO: SUBSCRIBE
CHANNEL: `tenant:${orgId}` e `user:${userId}`
EVENT_NAME: billing:cancelled
PAYLOAD: { org_id: string }
PAYLOAD_TYPES: { org_id: string }
TRIGGER: backend publica após processar webhook Stripe customer.subscription.deleted (doc27/28)
TENANT_SCOPED: SIM
USER_SCOPED: SIM
AUTH_REQUIRED: SIM

CALL_SITES:
- apps/web/src/modules/settings/pages/Billing.tsx:108 — EFFECT: invalida ["billing","subscription"] + toast.error
```

### `data:changed`

```text
TRANSPORTE: SUPABASE_REALTIME
DIREÇÃO: SUBSCRIBE
CHANNEL: `tenant:${orgId}` e `user:${userId}`
EVENT_NAME: data:changed
PAYLOAD: { entity: string; id: string }
PAYLOAD_TYPES: { entity: string; id: string }
TRIGGER: comentário do código: "invalidate entity cache when another user mutates data" — evento genérico de invalidação, não ligado a um domínio específico
TENANT_SCOPED: SIM
USER_SCOPED: SIM
AUTH_REQUIRED: SIM

CALL_SITES:
- apps/web/src/shared/infrastructure/RealtimeLayer.tsx:55 — EFFECT: invalida queryKey [entity, id] e [entity] genericamente
```

---

## Eventos fora do Supabase Realtime

### `musicos360_oauth_success` (postMessage entre popup e janela principal)

```text
TRANSPORTE: BROWSER_EVENT (window.postMessage / evento "message")
DIREÇÃO: BOTH (publica em 1 arquivo, assina em outro)
CHANNEL: NÃO APLICÁVEL (mensagem direta window→window.opener, restrita por `window.location.origin`, não um canal nomeado)
EVENT_NAME: musicos360_oauth_success (campo `type` do payload)
PAYLOAD: { type: "musicos360_oauth_success"; platform: string }
PAYLOAD_TYPES: { type: "musicos360_oauth_success"; platform: string } — já documentado em detalhe no doc30 (Caso 2, OAuthCallbackPage.tsx)
TRIGGER: publicado após o backend confirmar `connected: true` na troca de código OAuth (POST /oauth/exchange, doc30 Caso 2)
CONSUMER: MarketingOAuthDialog.tsx — fecha o popup e chama onConnect() do componente pai
EFFECT: setStep('success'), toast (indireto via onConnect), fecha o dialog após 1.8s
TENANT_SCOPED: NÃO APLICÁVEL
USER_SCOPED: NÃO APLICÁVEL
AUTH_REQUIRED: NÃO (o postMessage em si só verifica `event.origin === window.location.origin`, não um token — a autenticação já ocorreu antes, na chamada HTTP /oauth/init, doc30)

CALL_SITES:
- apps/web/src/modules/integrations/pages/OAuthCallbackPage.tsx:118-122 — PUBLISH: `window.opener.postMessage({type:"musicos360_oauth_success", platform}, window.location.origin)`
- apps/web/src/modules/integrations/components/MarketingOAuthDialog.tsx:515-528 — SUBSCRIBE: `window.addEventListener("message", handler)`, valida `event.origin` e `event.data.type`/`platform` antes de aceitar
```

### `storage` (evento nativo do browser — sincronização entre abas)

```text
TRANSPORTE: BROWSER_EVENT (StorageEvent nativo)
DIREÇÃO: SUBSCRIBE (não há publish explícito no código — o evento é disparado automaticamente pelo browser quando OUTRA aba grava a mesma chave de localStorage; hoje nenhuma aba grava essa chave, achado já registrado no doc23/24)
CHANNEL: NÃO APLICÁVEL
EVENT_NAME: storage (nome do evento DOM nativo), filtrado por `e.key === DISTRIBUTOR_CONNECTIONS_KEY` ("musicos360_distributor_connections")
PAYLOAD: StorageEvent nativo do browser (key, oldValue, newValue, url, storageArea)
PAYLOAD_TYPES: StorageEvent (tipo padrão do DOM, não um contrato próprio da aplicação)
TRIGGER: gravação de `localStorage["musicos360_distributor_connections"]` em OUTRA aba do mesmo navegador — comentário do próprio hook diz "refletir conexões feitas em Configurações", mas o achado do doc23/24 já confirmou que nenhum código atual escreve essa chave
CONSUMER: useDistributionPlatforms.ts
EFFECT: refresh() — reexecuta getEnabledDistributionPlatforms() e atualiza o estado local
TENANT_SCOPED: NÃO APLICÁVEL
USER_SCOPED: NÃO APLICÁVEL
AUTH_REQUIRED: NÃO

CALL_SITES:
- apps/web/src/modules/releases/hooks/useDistributionPlatforms.ts:34-36 — SUBSCRIBE: `window.addEventListener("storage", onStorage)`
```

---

## Lista consolidada de eventos únicos (TRANSPORTE + CHANNEL + EVENT_NAME)

```text
1.  SUPABASE_REALTIME | tenant:${orgId}+user:${userId} | artist.created
2.  SUPABASE_REALTIME | tenant:${orgId}+user:${userId} | artist.updated
3.  SUPABASE_REALTIME | tenant:${orgId}+user:${userId} | artist.deleted
4.  SUPABASE_REALTIME | tenant:${orgId}+user:${userId} | catalog.music.registered
5.  SUPABASE_REALTIME | tenant:${orgId}+user:${userId} | catalog.phonogram.registered
6.  SUPABASE_REALTIME | tenant:${orgId}+user:${userId} | contract.created
7.  SUPABASE_REALTIME | tenant:${orgId}+user:${userId} | contract.updated
8.  SUPABASE_REALTIME | tenant:${orgId}+user:${userId} | contract.signed
9.  SUPABASE_REALTIME | tenant:${orgId}+user:${userId} | crm.lead.captured
10. SUPABASE_REALTIME | tenant:${orgId}+user:${userId} | crm.lead.converted
11. SUPABASE_REALTIME | tenant:${orgId}+user:${userId} | finance.transaction.created
12. SUPABASE_REALTIME | tenant:${orgId}+user:${userId} | finance.transaction.updated
13. SUPABASE_REALTIME | tenant:${orgId}+user:${userId} | finance.calculated
14. SUPABASE_REALTIME | tenant:${orgId}+user:${userId} | audit.entry.created
15. SUPABASE_REALTIME | tenant:${orgId}+user:${userId} | notification:new
16. SUPABASE_REALTIME | tenant:${orgId}+user:${userId} | billing:plan_upgraded
17. SUPABASE_REALTIME | tenant:${orgId}+user:${userId} | billing:trial_ending
18. SUPABASE_REALTIME | tenant:${orgId}+user:${userId} | billing:payment_failed
19. SUPABASE_REALTIME | tenant:${orgId}+user:${userId} | billing:cancelled
20. SUPABASE_REALTIME | tenant:${orgId}+user:${userId} | data:changed
21. BROWSER_EVENT      | N/A (postMessage same-origin) | musicos360_oauth_success
22. BROWSER_EVENT      | N/A (storage nativo)          | storage (filtrado por musicos360_distributor_connections)
```

## Resumo

```text
REALTIME_CALL_SITES:
43

UNIQUE_REALTIME_EVENTS:
22

PUBLISH_EVENTS:
0

SUBSCRIBE_EVENTS:
21

BIDIRECTIONAL_EVENTS:
1

SUPABASE_REALTIME_EVENTS:
20

WEBSOCKET_EVENTS:
0

SSE_EVENTS:
0

TENANT_SCOPED_EVENTS:
20

AUTH_REQUIRED_EVENTS:
20

EVENTS_WITH_UNKNOWN_PAYLOAD:
0

EVENTS_WITH_UNKNOWN_AUTH:
0

UNRESOLVED_EVENTS:
0
```

`REALTIME_CALL_SITES` (43) = 40 call sites dos 18 eventos Supabase Realtime com consumidor (soma individual por evento, listada em cada bloco) + 2 do `musicos360_oauth_success` (1 publish + 1 subscribe) + 1 do `storage` nativo. `PUBLISH_EVENTS` (0) porque nenhum evento é EXCLUSIVAMENTE publicado pelo frontend sem também ser assinado em algum lugar — `musicos360_oauth_success` tem os dois lados, por isso conta em `BIDIRECTIONAL_EVENTS` (1), não em `PUBLISH_EVENTS`. `WEBSOCKET_EVENTS`/`SSE_EVENTS` são 0 porque, apesar do nome legado `ws-client.ts`/`useWebSocket`, o transporte real e único é Supabase Realtime (WebSocket bruto e Socket.IO foram descontinuados, conforme o próprio comentário do arquivo). `EVENTS_WITH_UNKNOWN_PAYLOAD`/`EVENTS_WITH_UNKNOWN_AUTH`/`UNRESOLVED_EVENTS` são todos 0 — mesmo os 2 eventos de billing sem consumidor (`billing:trial_ending`, `billing:payment_failed`) têm payload e modelo de auth plenamente comprováveis pelo contrato de tipos e pelo mecanismo de conexão, só não têm efeito nenhum na UI hoje.

## Cobertura

20/20 eventos do contrato `WsEventMap` mapeados, com todos os call sites de `useWsEvent` preservados (43 no total, incluindo os 2 eventos-canal externos ao Supabase Realtime). Nenhuma auditoria de endpoints HTTP foi feita nesta etapa. `apps/api` não foi consultado. Nenhum arquivo foi alterado.
