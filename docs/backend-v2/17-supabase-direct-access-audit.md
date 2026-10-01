> Historical record. Kept as recorded; not the current contract.

# 17 — Auditoria do Único Acesso Direto ao Supabase no Frontend

Continuação read-only de [`03-frontend-changes-audit.md`](./03-frontend-changes-audit.md) (classificação `SUPABASE_DIRECT`) e [`04-frontend-data-access-points.md`](./04-frontend-data-access-points.md). Nenhum arquivo foi alterado. Nenhum doc anterior foi modificado. `apps/api` não foi consultado — não foi necessário para responder ao escopo desta etapa.

Escopo: `apps/web/src/lib/supabase.ts` (o único arquivo classificado `SUPABASE_DIRECT`) + `apps/web/**` apenas para localizar consumidores/tipos. Confirmado por grep dedicado nesta etapa: **zero** ocorrências de `supabase.from(`, `supabase.rpc(` ou `supabase.functions.` em todo `apps/web/src` — nenhuma persistência de domínio (tabelas de negócio) é acessada diretamente via Supabase em nenhum ponto do frontend.

## Nota de correção

O doc04 (Prompt 07) caracterizou `ws-client.ts` como consumidor do cliente Supabase "para obter o token de sessão". Grep direcionado nesta etapa (`getSupabaseClient|supabase\.auth\.|\.auth\.`) não encontrou nenhuma ocorrência em `ws-client.ts` — leitura completa do arquivo confirmou que ele **não** chama `.auth.*`. Ele usa a mesma instância `supabase` para **Realtime** (`supabase.channel(...)`, `supabase.removeChannel(...)`), não para Auth. O comentário do próprio arquivo (linhas 16-18) explica a confusão de origem: "o cliente Supabase já encaminha o JWT da sessão atual para o Realtime automaticamente (mesmo singleton `supabase` usado para Auth)" — ou seja, o token é reaproveitado *implicitamente* pelo SDK, mas `ws-client.ts` nunca chama um método `.auth.*` explicitamente. Esta seção corrige o registro sem alterar o doc04 (que permanece como está).

---

## Caso 1 — Supabase Auth

```text
ARQUIVO: apps/web/src/lib/supabase.ts (client factory) — operações reais chamadas pelos consumidores abaixo via getSupabaseClient()
FUNÇÃO: .auth.getSession() | .auth.onAuthStateChange() | .auth.signInWithPassword() | .auth.signUp() | .auth.signOut() | .auth.resetPasswordForEmail() | .auth.updateUser({password}) | .auth.updateUser({data}) | .auth.refreshSession()
TIPO_DE_ACESSO: SDK direto (@supabase/supabase-js), sem fetch manual
RECURSO_SUPABASE: Supabase Auth (GoTrue)
OPERAÇÃO: leitura de sessão em bootstrap (getSession), listener de mudança de estado (onAuthStateChange), login (signInWithPassword), cadastro (signUp), logout (signOut), recuperação de senha (resetPasswordForEmail), troca de senha (updateUser({password})), atualização de metadata de perfil (updateUser({data})), refresh de token (refreshSession, 2 call sites)
DADOS_ENVIADOS: email+password (signIn/signUp), email (resetPassword), password (updatePassword), objeto arbitrário de metadata de perfil {data: metaUpdate} (ex.: phone — useUserSettings.ts), nenhum payload em getSession/onAuthStateChange/refreshSession
DADOS_ESPERADOS: objeto Session do supabase-js (access_token, refresh_token, expires_at, user{id, email, app_metadata, user_metadata}) ou AuthError{message, status}
FILTROS: NONE — Supabase Auth não usa filtros de query
TENANT_ISOLATION: NÃO IDENTIFICADO neste arquivo — Supabase Auth não tem conceito de tenant. O org_id chega embutido no JWT via app_metadata.org_id (Custom Access Token Hook do Supabase, confirmado em shared/lib/get-session-org-id.ts:20-29). O isolamento de tenant real acontece a jusante, fora deste arquivo: AuthContext.tsx repassa o token para apps/web/src/shared/lib/api-client.ts (setAccessToken/setTenantId), e cada chamada subsequente a apps/api é que aplica o tenant.
CONSUMIDORES: apps/web/src/app/providers/AuthContext.tsx (9 call sites: linhas 153, 200, 202, 218, 264, 284, 306, 315, 321, 342 — refreshSession aparece 2x), apps/web/src/modules/settings/hooks/useUserSettings.ts:138 (updateUser({data: metaUpdate}), condicional a metaUpdate ter chaves)
FINALIDADE: gerenciar o ciclo de vida da sessão de autenticação do próprio app (login/logout/signup/refresh/reset/troca de senha) e persistir metadata de perfil do usuário (ex.: telefone) no user_metadata do Supabase Auth. Nenhuma operação de dado de negócio (obras, contratos, projetos etc.) ocorre aqui.
```

```text
CLASSIFICAÇÃO: AUTH_REQUIRED_DIRECT_ACCESS
JUSTIFICATIVA: Todas as operações são exclusivas da API de Auth do Supabase (GoTrue). signInWithPassword/signUp/signOut/resetPasswordForEmail/refreshSession são fluxos que o próprio provedor de Auth escolhido (Supabase Auth) exige serem chamados via SDK client-side — não têm equivalente de "proxy via apps/api" sem reimplementar o protocolo de Auth do zero, o que contradiria o próprio motivo de usar Supabase Auth como provedor. Zero chamadas a .from()/.rpc()/.functions() nesta seção (confirmado por grep em todo apps/web/src). A única operação que roça dado de perfil é updateUser({data: metaUpdate}) — mas grava no user_metadata do próprio registro de Auth do usuário, não em tabela de negócio, portanto não se qualifica como "persistência de domínio" sob o critério MUST_MOVE_TO_API_V2.
```

## Caso 2 — Supabase Realtime

```text
ARQUIVO: apps/web/src/lib/supabase.ts (client factory) — instância consumida por apps/web/src/shared/lib/ws-client.ts
FUNÇÃO: supabase.channel(topic, {config:{private:true}}) + channel.on('broadcast', {event}, cb) + channel.subscribe() + supabase.removeChannel(channel) — em ws-client.ts:81-103 (ensureRealtimeChannels, disconnectRealtimeChannels)
TIPO_DE_ACESSO: SDK direto (@supabase/supabase-js Realtime)
RECURSO_SUPABASE: Supabase Realtime (broadcast channels)
OPERAÇÃO: subscribe a 2 canais privados por sessão — tenant:<org_id> e user:<user_id> — recebendo eventos de domínio via broadcast; não há leitura/escrita de tabela
DADOS_ENVIADOS: nenhum payload de aplicação — apenas o nome do canal (derivado de org_id/user_id extraídos do JWT em memória, ver get-session-org-id.ts) e o JWT em si, encaminhado automaticamente pelo SDK para autorizar a subscription (não é uma chamada .auth.* explícita neste arquivo)
DADOS_ESPERADOS: payloads de broadcast ({payload: unknown}) para os nomes de evento listados em ALL_WS_EVENT_NAMES (shared/lib/ws-events.ts) — publicados pelo backend (apps/api/src/core/realtime/realtime.service.ts, citado em comentário mas não lido nesta etapa — fora do escopo autorizado)
FILTROS: implícito pelo nome do canal (tenant:<org_id> / user:<user_id>); nenhum filtro de conteúdo dentro do canal
TENANT_ISOLATION: SIM, identificado — o nome do canal tenant:${orgId} usa o org_id decodificado do JWT (get-session-org-id.ts:23-33: prioridade app_metadata.org_id, fallback org_id top-level), e o acesso ao canal é reforçado no lado do Supabase por policies de RLS da migration 20260801000001_RealtimeBroadcastAuthorization (citada em comentário em ws-client.ts:14-15) — dupla camada: nome do canal + RLS.
CONSUMIDORES: apps/web/src/shared/lib/ws-client.ts (ensureRealtimeChannels/disconnectRealtimeChannels chamadas por onWsEvent/onWsConnectionChange, expostas a outros módulos fora do escopo desta auditoria específica)
FINALIDADE: substituir o antigo cliente Socket.IO como transporte de push de eventos de domínio em tempo real — justificativa registrada em comentário de código (ws-client.ts:8-11): Vercel Functions não sustentam WebSocket persistente entre invocações, então o backend publica os eventos e o Supabase Realtime apenas os retransmite ao canal já autorizado por RLS.
```

```text
CLASSIFICAÇÃO: MAY_REMAIN_DIRECT
JUSTIFICATIVA: Não é persistência de domínio (nenhuma leitura/escrita de tabela via .from()/.rpc() — é transporte de broadcast efêmero, não armazenamento), logo não se enquadra em MUST_MOVE_TO_API_V2 pelo critério dado. Não é um fluxo de Auth, logo também não se enquadra em AUTH_REQUIRED_DIRECT_ACCESS. Há justificativa técnica explícita e já registrada em código (não inventada por esta auditoria): ambiente serverless (Vercel Functions) não sustenta WebSocket persistente entre invocações, tornando o acesso direto ao Supabase Realtime a alternativa arquitetural adotada para viabilizar push em tempo real — com autorização garantida por RLS (migration 20260801000001_RealtimeBroadcastAuthorization) e não pela ausência de verificação. Atende ao critério "MAY_REMAIN_DIRECT somente com justificativa técnica explícita".
```

---

## Resumo

```text
SUPABASE_DIRECT_FILES_ANALYZED: 1
RESOURCE_CLUSTERS_FOUND: 2 (Supabase Auth, Supabase Realtime)
BUSINESS_DOMAIN_PERSISTENCE_FOUND: 0 (zero supabase.from/rpc/functions em todo apps/web/src)
CLASSIFICATION_AUTH: AUTH_REQUIRED_DIRECT_ACCESS
CLASSIFICATION_REALTIME: MAY_REMAIN_DIRECT
UNRESOLVED_ITEMS: 0
```

## Cobertura

`apps/web/src/lib/supabase.ts` lido por completo (client factory, sem operações próprias além de `createClient`). Consumidores localizados e lidos: `apps/web/src/app/providers/AuthContext.tsx` (bloco Auth completo), `apps/web/src/modules/settings/hooks/useUserSettings.ts` (linha 138), `apps/web/src/shared/lib/ws-client.ts` (lido por completo), `apps/web/src/shared/lib/get-session-org-id.ts` (lido por completo, evidência de tenant isolation do canal Realtime). `apps/api` não foi consultado. Nenhum arquivo existente foi alterado.
