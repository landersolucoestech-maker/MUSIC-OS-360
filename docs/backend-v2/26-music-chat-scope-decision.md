> Historical record. Kept as recorded; not the current contract.

# 26 — Decisão de Escopo: MusicChat (D2)

Verificação read-only para `D2` (doc24 — [`24-required-functional-decisions.md`](./24-required-functional-decisions.md)). Nenhum arquivo foi alterado, em `apps/web` ou `apps/api`. Nenhum tipo ou código de MusicChat foi removido. Nenhum doc anterior foi modificado. Nenhuma tabela/schema/endpoint/migration foi criada. D1 (distribuidoras) não foi tratado nesta etapa.

## Escopo exato de "MusicChat" verificado

O domínio D2, conforme definido no doc24, é especificamente: `apps/web/src/shared/integrations/contracts/chat.contract.ts` (tipo `IChatProvider`, `ChatChannel`, `ChatMessage`, `ChatNotification`) + `apps/web/src/modules/integrations/hooks/useChat.ts` + `apps/web/src/modules/integrations/adapters/chat.adapter.ts`/`unavailable.provider.ts` (`createUnavailableChatProvider`) — comunicação interna de equipe (canais direct/group/project/artist/department/general).

**Achado de desambiguação necessário nesta etapa:** a busca pelos termos pedidos (`ChatMessage`, `ChatChannel`, `mensagens`, `canais`, `chat`) encontra, além do domínio D2, DOIS outros recursos de "chat" no código que são domínios diferentes e não fazem parte de D2:

- `apps/web/src/modules/support/` (`SupportChat.tsx`, `useSupport.ts`) — chat de suporte ao cliente (widget de atendimento), com seu PRÓPRIO tipo `ChatMessage` (declarado em `modules/support/types/index.ts`, campos diferentes dos de `chat.contract.ts`). Tem uma tela real (`SupportChat.tsx`), mas `useChatMessages()` é também um stub — comentário no próprio código: "Chat messages (sem endpoint real)", `messages` sempre `[]`, `sendMessage` chama `supportUnavailable()`. Módulo diferente, não avaliado por este doc (fora do escopo de D2).
- `apps/web/src/modules/musicchat/services/conversations.service.ts` — apesar do nome de pasta "musicchat", implementa `MusicChatMessage`/`MusicChatChannel` (tipos próprios, diferentes de `ChatMessage`/`ChatChannel` de `chat.contract.ts`) e chama endpoints REAIS (`GET/POST /conversations/:id/messages`, já mapeados no doc05/20 como o backend de atendimento/CRM `ConversationsController`). Este é o mesmo `/conversations` já classificado `UNRELATED` ao domínio D2 no doc20 (Caso 5) — é um inbox de conversas de cliente (whatsapp/instagram/facebook/tiktok), não canais internos de equipe.

Nenhum dos dois acima é o domínio D2. A verificação abaixo é estritamente sobre `chat.contract.ts`/`useChat.ts`/`chat.adapter.ts`.

## Verificação

```text
FRONTEND_CONSUMER_EXISTS:
NÃO

ACTIVE_ROUTE_EXISTS:
NÃO

ACTIVE_SCREEN_EXISTS:
NÃO

HTTP_CONTRACT_EXISTS:
NÃO

CURRENT_RUNTIME_USAGE:
Nenhum. Evidência: (1) grep por `useChatStatus\(|useChatChannel\(|useChatChannels\(|useChatNotifications\(` (as 4 funções exportadas por useChat.ts) em todo apps/web/src — únicos resultados são as próprias declarações em useChat.ts, nenhum call site em qualquer componente/página. (2) grep por `/chat` em apps/web/src/App.tsx (arquivo de rotas) — nenhuma rota corresponde (o comentário do próprio useChat.ts menciona "Rota MusicChat: /chat", mas essa rota não existe no roteador atual). (3) grep por imports de `chat.contract.ts` em todo apps/web/src — só 2 arquivos, ambos barrels de re-exportação (integrations/dto/index.ts, shared/integrations/contracts/index.ts), nenhum consumidor real. (4) grep por `chatAdapter` (doc23) — só a própria declaração/export, sem importador. (5) as duas implementações existentes (useChat.ts e chat.adapter.ts/unavailable.provider.ts) nunca executam uma chamada HTTP real — todo método declarado lança/rejeita antes de qualquer fetch/api.* — não há, portanto, nenhum contrato HTTP em uso (nem mesmo um endpoint tentado e falho).
```

## Aplicação da regra de decisão

Como não existe tela, rota ou fluxo funcional consumindo o domínio D2 (`IChatProvider`/`ChatChannel`/`ChatMessage`/`useChat.ts`/`chat.adapter.ts`) hoje:

```text
DECISION:
DEFER_FROM_API_V2
```

Isso significa:

```text
MusicChat (domínio IChatProvider — canais internos de equipe) não entra no escopo inicial da reconstrução da API v2.

Nenhum schema, tabela, endpoint, repository, service ou migration de MusicChat deve ser criado agora.

Os tipos existentes em chat.contract.ts (não consumidos por nenhuma tela) não são suficientes para justificar implementação.

O domínio somente poderá entrar posteriormente quando houver requisito funcional real e contrato explícito.
```

## Nota — não confundir com escopo já decidido/existente

Esta decisão não afeta: (a) `modules/support/` (SupportChat.tsx) — módulo diferente, com tela real, fora do escopo de D2 e não avaliado quanto a inclusão na API v2 nesta etapa; (b) `modules/musicchat/services/conversations.service.ts` + backend `/conversations` (`ConversationsController`) — já é uma funcionalidade REAL e implementada (não um caso de storage local pendente), completamente fora do escopo desta auditoria de storage (docs 18-26), que trata exclusivamente dos 6 casos `BACKEND_REQUIRED` identificados no doc18/19. Nenhum tipo, arquivo ou código de nenhum dos três domínios foi removido ou alterado.

---

## Resumo

```text
DECISION: DEFER_FROM_API_V2
FRONTEND_CONSUMER_EXISTS: NÃO
ACTIVE_ROUTE_EXISTS: NÃO
ACTIVE_SCREEN_EXISTS: NÃO
HTTP_CONTRACT_EXISTS: NÃO
MUSICCHAT_INCLUDED_IN_INITIAL_API_V2_SCOPE: NÃO
D1_TOUCHED: NÃO
```

## Cobertura

Domínio D2 (chat.contract.ts/useChat.ts/chat.adapter.ts) verificado por completo quanto a consumidores reais em `apps/web/**`. Dois domínios homônimos-mas-diferentes ("support chat" e "musicchat/conversations") foram identificados e explicitamente excluídos desta decisão, para não contaminar o resultado com funcionalidades reais não relacionadas. Nenhum tipo ou código foi removido. Nenhuma tabela, endpoint, schema ou migration foi criada. D1 não foi tratado. `apps/web` e `apps/api` não foram alterados.
