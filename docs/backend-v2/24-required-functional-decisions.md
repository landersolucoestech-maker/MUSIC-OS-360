> Historical record. Kept as recorded; not the current contract.

# 24 — Decisões Funcionais Pendentes de Aprovação Humana

Continuação read-only de [`21-storage-required-functional-contracts.md`](./21-storage-required-functional-contracts.md), [`22-storage-functional-unknowns-resolution.md`](./22-storage-functional-unknowns-resolution.md) e [`23-storage-contract-final-conflicts.md`](./23-storage-contract-final-conflicts.md) (`BEHAVIORS_REQUIRING_DECISION: 2` — Caso 4 e Caso 5). Nenhum arquivo foi alterado, em `apps/web` ou `apps/api`. Nenhum doc anterior foi modificado. Nenhuma decisão foi tomada nesta etapa — apenas formuladas para aprovação humana. Nenhuma recomendação abaixo foi aplicada como escolha final.

---

## D1

```text
DECISÃO:
D1

CASO:
4 (doc19/20/21/23) — apps/web/src/modules/releases/services/distribution-platforms.ts

DOMÍNIO:
releases / integrations — conexão do tenant com distribuidoras digitais nomeadas

FUNCIONALIDADE:
determinar quais das 6 distribuidoras do catálogo fixo (ONErpm, DistroKid, Symphonic, SoundOn, MusicPro, SomVibe) aparecem como "conectadas" (com um username associado) no seletor de distribuidoras do fluxo de lançamento

COMPORTAMENTO ATUAL DO FRONTEND:
o lado de LEITURA está implementado e funcional: `getEnabledDistributionPlatforms()` lê a chave localStorage "musicos360_distributor_connections" e filtra o catálogo estático pelas entradas presentes, devolvendo `{id, name, description, username?}`. O lado de ESCRITA não existe em nenhum lugar do código atual — nenhuma função, botão, formulário ou handler grava essa chave. A tela que deveria fazer isso (Configuracoes.tsx, seção "Distribuidoras") hoje só renderiza links estáticos "Abrir portal oficial" (navegação de browser para o site de cada distribuidora), sem nenhum fluxo de conectar/desconectar.

MOTIVO DA AMBIGUIDADE:
o modelo de dados (`ConnectedDistributionPlatform.username?`) implica claramente que uma conexão deveria poder ser criada/atualizada com um identificador de conta, mas não há nenhum código — atual ou legacy — que defina COMO essa criação deveria acontecer (formulário manual, OAuth, ou nenhuma das duas). Rastreamento completo do fluxo (doc23) não encontrou nenhuma evidência adicional em 3 passagens sucessivas.

EVIDÊNCIA:
- apps/web/src/modules/releases/services/distribution-platforms.ts — readConnections()/getEnabledDistributionPlatforms() (leitura, funcional)
- apps/web/src/modules/releases/hooks/useDistributionPlatforms.ts (consumidor da leitura + listener do evento `storage`)
- apps/web/src/modules/settings/pages/Configuracoes.tsx:639-652,1508-1550 — seção "Distribuidoras" hoje é só links externos, sem escrita de storage
- apps/api/src/modules/integrations/external-data.controller.ts + apps/api/src/core/external-data/* (doc20/21) — framework legacy de submissão de metadados a um provider já registrado, sem nenhum endpoint de "conectar/registrar conta"; zero providers nomeados reais implementados

O QUE PRECISA SER DECIDIDO:
como (ou se) a operação de "conectar uma distribuidora" deve funcionar na API v2?
```

```text
OPÇÃO A:
conexão manual simples — o usuário digita/cola um identificador de conta (username) por distribuidora, sem nenhuma verificação/OAuth; a API v2 apenas grava e devolve esse par {distribuidora, username}

EFEITO:
o comportamento observável muda pouco em relação ao dado hoje guardado em localStorage — só passa a ser persistido no backend em vez do navegador; nenhuma validação de que o username realmente existe na distribuidora

IMPACTO NO CONTRATO:
API v2 precisa de uma operação de create/update/delete por (tenant, distribuidora) com um único campo de entrada (username, string livre) — sem necessidade de segredo, token, nem fluxo de redirecionamento externo

RISCOS:
o "username" nunca é validado contra a distribuidora real — pode ficar desatualizado ou incorreto sem o sistema saber; não resolve o problema de fundo (a distribuidora ainda não tem integração real, é só um rótulo)


OPÇÃO B:
conexão via OAuth real com cada distribuidora — seguindo o mesmo padrão já usado para Spotify/TikTok/GoogleAds/Instagram (GET /integrations/<provider>/status|auth|disconnect)

EFEITO:
usuário autentica de fato contra a distribuidora (se ela tiver esse suporte) e a conexão reflete um vínculo de conta real, verificável

IMPACTO NO CONTRATO:
API v2 precisaria de um fluxo completo de OAuth (ou equivalente) por distribuidora — status/auth/disconnect — igual às 8 integrações que já têm esse padrão hoje

RISCOS:
nenhuma das 6 distribuidoras do catálogo (ONErpm/DistroKid/Symphonic/SoundOn/MusicPro/SomVibe) tem evidência, em todo o código lido até aqui, de possuir uma API pública de OAuth documentada ou usada em algum lugar — o comportamento atual (links para o portal oficial) sugere que essas distribuidoras não expõem esse tipo de integração; construir isso pode não ser tecnicamente viável para todas as 6


OPÇÃO C:
abandonar o conceito de "conexão" — manter só o catálogo estático de distribuidoras suportadas e os links de portal externo (comportamento já em produção hoje em Configuracoes.tsx); remover a noção de "conectado/desconectado" do escopo da API v2

EFEITO:
o seletor de distribuidoras no fluxo de lançamento deixaria de filtrar por "conectado" e passaria a mostrar sempre as 6 distribuidoras do catálogo (ou seria removido)

IMPACTO NO CONTRATO:
nenhuma operação de escrita é necessária; API v2 não precisa de nenhum endpoint para este caso — o catálogo estático já vive no próprio frontend

RISCOS:
descarta a intenção original de dado (o campo `username` e o conceito `ConnectedDistributionPlatform` deixam de fazer sentido); se alguma tela depender de "só mostrar distribuidoras conectadas" para uma razão de negócio real (não verificada nesta auditoria, fora do escopo dos 36 arquivos de storage), essa regra desapareceria
```

```text
RECOMENDAÇÃO:
NENHUMA

JUSTIFICATIVA_DA_RECOMENDAÇÃO:
há um indício técnico a favor da Opção A (o shape de dado já existente, {id, username}, sem nenhum campo de token/segredo, é exatamente o que a Opção A exigiria, e nada mais) — mas isso não é evidência de que a Opção A é a decisão de produto correta, só de que é a mais barata de implementar sem descartar o dado já modelado. A escolha entre manter/reformular/abandonar esta feature depende de uma decisão de negócio sobre a importância do recurso "seletor de distribuidoras conectadas" no fluxo de lançamento, que não pode ser inferida do código.
```

---

## D2

```text
DECISÃO:
D2

CASO:
5 (doc19/20/21/22/23) — apps/web/src/modules/integrations/hooks/useChat.ts + apps/web/src/modules/integrations/adapters/chat.adapter.ts

DOMÍNIO:
integrations — comunicação interna da equipe (MusicChat)

FUNCIONALIDADE:
canais e mensagens de comunicação interna entre membros do tenant (IChatProvider — chat.contract.ts): canais diretos/grupo/projeto/artista/departamento/geral, mensagens com anexos/menções/threads/reações, notificações

COMPORTAMENTO ATUAL DO FRONTEND:
domínio 100% não implementado. Duas implementações candidatas existem, nenhuma funcional e nenhuma consumida por qualquer tela: (1) `useChat.ts` — hooks React que retornam dados estáticos vazios e chamam `disabledIntegration()` (lança erro 503) para qualquer escrita; (2) `chat.adapter.ts`/`unavailable.provider.ts` — implementação tipada de `IChatProvider` onde todo método rejeita a Promise com um erro genérico. As duas falham de formas diferentes entre si e nenhuma persiste, lê, atualiza ou remove nada de fato.

MOTIVO DA AMBIGUIDADE:
o tipo `ChatMessage` declara campos de soft-delete (`deleted_at`, `is_deleted`) e `ChatChannel` declara `is_archived` (arquivamento, não remoção física) — sinalizando uma INTENÇÃO de retenção permanente por quem desenhou o tipo — mas como nenhuma implementação real jamais gravou ou leu uma mensagem, não há nenhum comportamento observado que confirme essa intenção. Usar só o formato dos campos do tipo como prova seria decidir por convenção estrutural, não por evidência de comportamento (regra proibida nas etapas anteriores).

EVIDÊNCIA:
- apps/web/src/shared/integrations/contracts/chat.contract.ts — ChatMessage.deleted_at/is_deleted, ChatChannel.is_archived (design do tipo, nunca implementado)
- apps/web/src/modules/integrations/hooks/useChat.ts — useChatChannel()/useChatChannels()/useChatNotifications() (100% stub, sem consumidor de tela)
- apps/web/src/modules/integrations/adapters/chat.adapter.ts + unavailable.provider.ts — createUnavailableChatProvider() (100% stub, sem consumidor real — só export)
- busca por consumidores de ambas as implementações em todo apps/web/src: nenhum resultado além das próprias declarações (doc22/23)

O QUE PRECISA SER DECIDIDO:
o histórico de mensagens/canais do MusicChat deve ter retenção permanente (como um histórico de conversa pesquisável) ou é aceitável tratá-lo como efêmero/descartável — ou o domínio nem deveria ser construído na API v2 por enquanto?
```

```text
OPÇÃO A:
retenção permanente com soft-delete/arquivamento — mensagens e canais nunca são fisicamente apagados; "excluir"/"arquivar" apenas marcam `deleted_at`/`is_deleted`/`is_archived`, mantendo o histórico completo acessível

EFEITO:
comportamento equivalente a ferramentas de chat de equipe convencionais (histórico pesquisável, nada se perde)

IMPACTO NO CONTRATO:
API v2 precisa de operações de "soft delete" (marcar, não remover), e de armazenamento permanente de mensagens/canais/reações/menções — volume de dados cresce indefinidamente por tenant

RISCOS:
nenhuma tela ou fluxo de negócio comprovou até agora que esse histórico é realmente necessário — construir retenção permanente para um recurso sem nenhum consumidor identificado é esforço não validado por uso real


OPÇÃO B:
retenção temporária/efêmera — mensagens podem expirar ou ser fisicamente removidas após um período, sem garantia de histórico de longo prazo

EFEITO:
menor custo de armazenamento; adequado se o "chat" for pensado como comunicação rápida/descartável, não como registro permanente

IMPACTO NO CONTRATO:
API v2 poderia implementar TTL/expiração ou remoção física em vez de soft-delete — contradiz os campos `deleted_at`/`is_deleted`/`is_archived` já declarados no tipo de contrato existente, que teriam de ser reformulados ou ignorados

RISCOS:
descarta o desenho já existente no tipo (chat.contract.ts) sem uma razão de negócio registrada em código para isso — a divergência entre "o que o tipo já modela" e "o que seria construído" ficaria maior, não menor


OPÇÃO C:
não construir este domínio na API v2 por enquanto — mantê-lo fora de escopo até haver uma tela real que o consuma

EFEITO:
nenhuma mudança de comportamento (o domínio já não é usado por nenhuma tela hoje); evita construir armazenamento/API para um recurso sem consumidor comprovado

IMPACTO NO CONTRATO:
nenhuma operação é necessária na API v2 para este caso, adiando toda a decisão de retenção para quando (se) o domínio for retomado

RISCOS:
se houver um plano de produto (fora do escopo desta auditoria, que cobre só `apps/web`/`apps/api` como estão hoje) para lançar o MusicChat em breve, adiar pode custar retrabalho depois
```

```text
RECOMENDAÇÃO:
NENHUMA

JUSTIFICATIVA_DA_RECOMENDAÇÃO:
diferente do D1, aqui não há sequer um indício técnico de menor esforço claramente superior: a Opção C é a mais barata a curto prazo, mas a Opção A é a mais alinhada ao único artefato de design já escrito (o tipo `ChatMessage`/`ChatChannel`) — e escolher entre "não construir" e "construir seguindo o tipo já desenhado" é uma decisão sobre se este recurso (comunicação interna do MusicChat) entra ou não no roadmap da API v2, o que é uma decisão de produto, não uma inferência técnica.
```

---

## Resumo

```text
DECISIONS_PREPARED:
2
```

Nenhuma das duas decisões foi tomada nesta etapa — ambas aguardam resposta humana no formato `D1: <A|B|C>` / `D2: <A|B|C>`. Nenhum arquivo foi alterado. Nenhum doc anterior foi modificado.
