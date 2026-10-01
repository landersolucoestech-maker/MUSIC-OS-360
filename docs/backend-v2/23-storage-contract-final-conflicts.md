> Historical record. Kept as recorded; not the current contract.

# 23 — Resolução do Input Conflitante e dos 2 Comportamentos Restantes

Continuação read-only de [`21-storage-required-functional-contracts.md`](./21-storage-required-functional-contracts.md) e [`22-storage-functional-unknowns-resolution.md`](./22-storage-functional-unknowns-resolution.md) (`INPUTS_CONFLICTING: 1`, `BEHAVIORS_REMAINING: 2`). Nenhum arquivo foi alterado, em `apps/web` ou `apps/api`. Nenhum doc anterior foi modificado. Nenhum endpoint/path/método/DTO/tabela/migration foi definido.

Evidência adicional encontrada nesta etapa em `apps/web/**` (nenhuma busca ampla em `apps/api`, consistente com o escopo autorizado): `apps/web/src/modules/integrations/adapters/chat.adapter.ts` e `apps/web/src/modules/integrations/adapters/unavailable.provider.ts` — não lidos nas etapas anteriores, encontrados ao buscar todos os usos de `IChatProvider` (o tipo já conhecido do doc21/22) em todo `apps/web/src`.

---

## Caso 1 — Input Conflitante (Caso 5, `sendMessage`)

```text
CASO:
5

INPUT:
parâmetro(s) de "enviar mensagem" (sendMessage)

FRONTEND_EXIGE (fonte A):
string solta (`text: string`), sem `channel_id` nem qualquer outro campo — a função nem recebe o canal como parâmetro (nem o hook que a contém)

EVIDÊNCIA_FRONTEND (fonte A):
apps/web/src/modules/integrations/hooks/useChat.ts — `useChatChannel()` retorna `{ ..., sendMessage: (_text: string) => disabledIntegration("MusicChat"), ... }`. A função não está anotada com nenhum tipo de interface (não é `: IChatProvider` nem similar) — é um objeto solto.

LEGACY_EXIGE:
N/A — Caso 5 não possui legacy relacionado (doc20: `/conversations` classificado UNRELATED)

EVIDÊNCIA_LEGACY:
NÃO NECESSÁRIA

TIPO_DO_CONFLITO:
TYPE (string primitiva vs. objeto estruturado) — secundariamente também FIELD (ausência de `channel_id` e dos demais 5 campos)
```

### Evidência adicional (fonte B, encontrada nesta etapa)

```text
FRONTEND_EXIGE (fonte B):
objeto `SendMessageParams` — { channel_id: string; text?: string; type?: MessageType; attachments?: File[]; entity_ref?: EntityReference; mentions?: string[]; reply_to?: string } — retornando Promise<ChatMessage>

EVIDÊNCIA_FRONTEND (fonte B):
(1) apps/web/src/shared/integrations/contracts/chat.contract.ts — `IChatProvider.sendMessage(params: SendMessageParams): Promise<ChatMessage>` (já conhecido do doc21/22). (2) NOVO NESTA ETAPA: apps/web/src/modules/integrations/adapters/unavailable.provider.ts — `createUnavailableChatProvider(): IChatProvider` implementa `sendMessage: (_params: SendMessageParams): Promise<ChatMessage> => Promise.reject(unavailable("chat"))` — uma segunda implementação independente, com a assinatura de tipo verificada pelo compilador (`: IChatProvider`), que concorda com o contrato de tipos. (3) apps/web/src/modules/integrations/adapters/chat.adapter.ts — `export const chatAdapter: IChatProvider = createUnavailableChatProvider();` — consome a fonte B, não a fonte A.
```

### Aplicação da ordem de evidência

```text
1. Consumo real no frontend — AUSENTE para as duas fontes: grep por `chatAdapter` em todo apps/web/src encontra só a própria declaração/export (adapters/index.ts) e nenhum import real em nenhum componente; useChatChannel/useChatChannels/useChatNotifications (doc21/22, Prompt 22) também não têm nenhum consumidor de tela. Empate — este critério não desempata.

2. Validação/form/schema do frontend — AUSENTE para as duas fontes (nenhum formulário de UI monta um payload de mensagem em lugar nenhum). Empate — não desempata.

3. Tipos/interfaces do frontend — DESEMPATA: a fonte B tem DUAS evidências independentes concordando (o próprio contrato `IChatProvider`/`SendMessageParams`, e uma segunda implementação — `createUnavailableChatProvider()` — que foi escrita e é verificada pelo compilador contra esse mesmo tipo). A fonte A (useChat.ts) é a ÚNICA peça de código de todo o frontend que diverge do contrato — e não está sequer anotada contra `IChatProvider`, ou seja, nunca foi obrigada pelo compilador a corresponder à interface. Além disso, o padrão arquitetural de `createUnavailable<X>Provider(): I<X>Provider` (visto em unavailable.provider.ts) é usado de forma consistente para TODAS as outras 7 integrações do mesmo arquivo (auth, email, storage, payments, rights, streaming, ads) — chat é a única categoria com uma segunda implementação paralela (useChat.ts) fora desse padrão. Isso não é usado aqui como "convenção arquitetural" para inventar comportamento novo (regra proibida) — é usado apenas para explicar por que a contagem de evidências de tipo é 2×1 e não 1×1: já existiam duas fontes de tipo escritas por desenvolvedores diferentes concordando entre si.

4. Testes do frontend — AUSENTE: grep por `sendMessage|SendMessageParams|useChat` em `**/*.test.ts*` de todo apps/web/src não encontrou nenhum arquivo. Não contribui.

5/6. Legacy — N/A (Caso 5 é NO_LEGACY).
```

```text
RESOLUTION_SOURCE:
FRONTEND

STATUS:
RESOLVED

RESULTADO:
O contrato de entrada correto (mais bem evidenciado) para "enviar mensagem" é o objeto `SendMessageParams` (channel_id obrigatório; text/type/attachments/entity_ref/mentions/reply_to opcionais), não a string solta de `useChat.ts`. `useChat.ts` é tratado como a fonte divergente e mais fraca: é a única implementação de todo o domínio de chat que não está tipada contra `IChatProvider`, não tem nenhum consumidor de tela (igual à fonte B, então esse critério não pesa a favor dela), e diverge sozinha de duas fontes concordantes (o contrato de tipos e uma segunda implementação real, ainda que "indisponível", verificada pelo compilador).

JUSTIFICATIVA:
Resolvido por evidência de tipo (critério 3 da ordem estabelecida nesta etapa), não por nome de função nem por convenção — a diferença decisiva é numérica e verificável: 2 artefatos de código concordam com `SendMessageParams`, 1 diverge, e o único critério anterior na ordem (consumo real, validação) não desempata por estarem ambos igualmente ausentes.
```

---

## Caso 2 — Comportamento Pendente (Caso 4 — gap de escrita de conexão com distribuidora)

```text
CASO:
4

COMPORTAMENTO_PENDENTE:
como/onde a operação de "conectar/atualizar uma distribuidora" (escrever a chave "musicos360_distributor_connections") deveria ocorrer

FLUXO_DE_ORIGEM:
apps/web/src/modules/releases/services/distribution-platforms.ts — readConnections()/getEnabledDistributionPlatforms() (somente leitura)

CONSUMIDORES:
- apps/web/src/modules/releases/hooks/useDistributionPlatforms.ts (leitura + listener do evento `storage`)
```

### Rastreamento completo do fluxo (frontend)

```text
EVIDÊNCIAS:
- ONDE É CRIADO: nenhum lugar em todo apps/web/src (grep repetido pela 3ª vez, incluindo agora apps/web/src/modules/releases/services/form-to-payload.mapper.test.ts como fonte de teste candidata — sem resultado).
- ONDE É ATUALIZADO: nenhum lugar.
- ONDE É LIDO: distribution-platforms.ts:38 (readConnections, localStorage.getItem), encadeado em getEnabledDistributionPlatforms() (linhas 49-55), consumido por useDistributionPlatforms.ts (linha 26 e 30).
- ONDE É REMOVIDO: nenhum lugar (nenhum removeItem para esta chave em todo o repositório; shared/lib/migrations.ts remove 7 outras chaves de credenciais, mas não esta).
- CONDIÇÕES DE EXECUÇÃO: getEnabledDistributionPlatforms() filtra o catálogo estático DISTRIBUTION_PLATFORMS (6 entradas fixas) por `Boolean(connections[p.id])`.
- EFEITOS APÓS SUCESSO/FALHA: readConnections() está em try/catch — qualquer erro de parse ou ausência de chave retorna `{}` silenciosamente, sem propagar erro à UI.
- ORDENAÇÃO: segue a ordem de declaração do array DISTRIBUTION_PLATFORMS (onerpm, distrokid, symphonic, soundon, musicpro, somvibe), sem sort adicional.
- DEDUPLICAÇÃO: N/A — connections é um objeto indexado por id (Record), inerentemente sem duplicatas.
- SUBSTITUIÇÃO / MERGE / LIMPEZA: N/A — não há nenhuma operação de escrita para observar essas dimensões.
- PERSISTÊNCIA: localStorage, sem escopo por tenant (chave fixa "musicos360_distributor_connections", sem tenant_id embutido — diferente de tenantStorageKey(), disponível no repo mas não usado aqui, achado já registrado no doc19/20).
- RELAÇÃO COM TENANT: nenhuma relação explícita — a chave é compartilhada globalmente no navegador, não por tenant.
- RELAÇÃO COM OUTROS REGISTROS: o `id` de cada conexão corresponde a um dos 6 ids fixos do catálogo estático DISTRIBUTION_PLATFORMS; não há relação com nenhum Release/lançamento específico — é uma conexão de conta ao nível do tenant, não por lançamento individual.
```

```text
COMPORTAMENTO_RESOLVIDO:
O lado de LEITURA está integralmente resolvido (documentado acima, sem nenhuma lacuna remanescente). O lado de ESCRITA continua sem nenhuma evidência em código: não há função, botão, formulário, handler ou teste em todo `apps/web/src` que grave essa chave. Rastrear o fluxo mais uma vez (incluindo um novo teste candidato) não produziu nenhum dado novo — a ausência já era completa desde o doc21.

STATUS:
REQUIRES_DECISION

JUSTIFICATIVA:
Conforme a regra desta etapa ("não transformar ausência de implementação em regra de negócio"), não é legítimo inventar um contrato de escrita (ex.: assumir que "conectar" precisaria de OAuth, ou de um formulário de usuário/senha, ou de qualquer shape específico) apenas porque o dado de leitura tem um campo `username`. Isso não é uma lacuna que mais busca em código resolveria — é uma decisão de produto ainda não tomada (se/como a conexão com distribuidoras deve ser implementada), por isso REQUIRES_DECISION em vez de UNRESOLVED.
```

---

## Caso 3 — Comportamento Pendente (Caso 5 — durabilidade de mensagens/canais)

```text
CASO:
5

COMPORTAMENTO_PENDENTE:
se mensagens/canais de chat interno devem ter durabilidade PERMANENTE (retenção definitiva, inclusive após "exclusão" via soft-delete) ou TEMPORÁRIA

FLUXO_DE_ORIGEM:
nenhum (domínio 100% não implementado — nem useChat.ts nem chatAdapter/createUnavailableChatProvider executam qualquer operação real)

CONSUMIDORES:
- NENHUM identificado (confirmado outra vez nesta etapa: chatAdapter também não tem nenhum importador real, igual a useChat.ts — ver Caso 1 acima)
```

### Rastreamento completo do fluxo (frontend)

```text
EVIDÊNCIAS:
- ONDE É CRIADO: nenhum lugar — createChannel/sendMessage (nas duas implementações, useChat.ts e chatAdapter) sempre lançam/rejeitam antes de qualquer gravação.
- ONDE É ATUALIZADO: nenhum lugar — editMessage/markChannelRead/markNotificationRead nunca têm corpo de implementação real em nenhum dos dois arquivos.
- ONDE É LIDO: useChatChannel().messages sempre `[]`; useChatChannels().data sempre `null`; chatAdapter.listChannels()/listMessages() sempre rejeitam a Promise.
- ONDE É REMOVIDO: deleteMessage/archiveChannel declarados no tipo (chat.contract.ts) e no adapter (sempre rejeitam), nunca implementados de fato em nenhum dos dois.
- CONDIÇÕES DE EXECUÇÃO: nenhuma — toda chamada falha incondicionalmente, sem branch de sucesso.
- EFEITOS APÓS SUCESSO: N/A (nunca há sucesso em nenhuma das duas implementações).
- EFEITOS APÓS FALHA: as duas implementações falham de formas DIFERENTES entre si (achado adicional, fora do escopo desta pergunta específica mas relevante ao domínio): useChat.ts lança `DisabledIntegrationError` síncrono (status 503, code "integration_disabled"); chatAdapter rejeita a Promise com um `Error` genérico ("chat nao possui provider real configurado no frontend...").
- ORDENAÇÃO / DEDUPLICAÇÃO / MERGE / LIMPEZA / PERSISTÊNCIA: N/A — nenhuma dessas dimensões tem qualquer implementação a observar.
- RELAÇÃO COM TENANT: ChatChannel.tenant_id existe no tipo (chat.contract.ts), mas nunca é populado por código real.
- RELAÇÃO COM OUTROS REGISTROS: EntityReference (obra/fonograma/artista/contrato/lancamento/projeto/transacao/campanha) permite vincular mensagens a entidades de negócio no TIPO, mas também nunca é exercitado por nenhuma implementação real.
```

```text
COMPORTAMENTO_RESOLVIDO:
Não há nenhum comportamento observável em nenhuma das 13 dimensões rastreadas — o domínio inteiro (2 implementações candidatas, ambas 100% stub/reject, nenhuma consumida por tela) não produz nenhum dado real para inspecionar. A intenção de durabilidade permanece apenas nos NOMES dos campos do tipo (deleted_at/is_deleted/is_archived), que a regra desta etapa proíbe usar como evidência suficiente (é convenção estrutural, não comportamento observado).

STATUS:
REQUIRES_DECISION

JUSTIFICATIVA:
Assim como o Caso 2 (distribuidoras), esta não é uma lacuna que mais busca resolveria — já é a terceira vez que o domínio é rastreado (docs 21, 22 e agora 23) sem nenhum dado novo além da confirmação de que também o adapter alternativo (chatAdapter) é igualmente não-implementado e não-consumido. A política de retenção de mensagens é uma decisão de produto/arquitetura que este domínio simplesmente nunca chegou a definir em código, não um fato a ser descoberto.
```

---

## Resumo

```text
INPUT_CONFLICTS_INITIAL:
1

INPUT_CONFLICTS_RESOLVED:
1

INPUTS_REQUIRING_DECISION:
0

BEHAVIORS_INITIAL:
2

BEHAVIORS_RESOLVED:
0

BEHAVIORS_REQUIRING_DECISION:
2

BEHAVIORS_REMAINING:
0
```

## Cobertura

Os 3 itens pendentes do doc22 foram revisitados. O input conflitante foi resolvido com evidência de tipo adicional encontrada nesta etapa (uma segunda implementação de `IChatProvider`, `chat.adapter.ts`/`unavailable.provider.ts`, não lida em nenhuma etapa anterior). Os 2 comportamentos foram integralmente rastreados (todas as dimensões pedidas: criação/atualização/leitura/remoção/condições/efeitos/ordenação/dedup/substituição/merge/limpeza/persistência/tenant/relações) e, por não terem nenhum dado de código para resolvê-los — não por falta de busca —, foram classificados `REQUIRES_DECISION` em vez de forçados a `RESOLVED` ou deixados vagamente `UNRESOLVED`. Nenhuma regra de negócio foi inventada a partir da ausência de implementação. `apps/web` e `apps/api` não foram alterados. Nenhum storage local foi alterado.
