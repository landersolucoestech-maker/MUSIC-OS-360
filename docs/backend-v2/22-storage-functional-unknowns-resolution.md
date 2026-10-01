> Historical record. Kept as recorded; not the current contract.

# 22 — Resolução das Incertezas dos 5 Contratos Funcionais

Continuação read-only de [`21-storage-required-functional-contracts.md`](./21-storage-required-functional-contracts.md) (`UNRESOLVED_INPUTS: 2`, `UNRESOLVED_OUTPUTS: 3`, `UNRESOLVED_BEHAVIORS: 2` — 7 itens). Nenhum arquivo foi alterado, em `apps/web` ou `apps/api`. Nenhum doc anterior foi modificado. Nenhum endpoint/path/método/DTO/tabela/migration foi definido.

Evidência primária buscada em `apps/web/**`. Para os 2 casos com legacy parcial (Caso 2 e Caso 4), foram revisitados somente os arquivos legacy já identificados nos docs 20/21 (`contract-templates`, `external-data.*`) — nenhuma busca nova em `apps/api`.

---

## Item 1 — Caso 1, INPUT

```text
CASO:
1

TIPO_DA_INCERTEZA:
INPUT

DESCRIÇÃO_ANTERIOR:
campo `links` no create de FinancialCategoryRuleEntity — doc21 registrou "sempre null no create... UNRESOLVED se algum outro fluxo preenche links"

EVIDÊNCIA_FRONTEND:
grep dirigido por `\.links\s*[:=]|links:` em todo `apps/web/src/modules/accounting` (escrita) — único resultado de escrita real: `CategoriasFinanceiras.tsx:127` (`links: null`, no create) e nenhuma atribuição em `edit`(handleSubmit, modo "edit", não reatribui `links`, preserva o valor anterior via spread `...r`). `financialRules.utils.ts:155-157` (`getLinksFromRule`) e `useTransacaoFormController.ts` só LEEM `rule.links` (nunca escrevem). Nenhum outro arquivo do módulo accounting referencia `links` como campo de FinancialCategoryRuleEntity.

EVIDÊNCIA_LEGACY:
NÃO NECESSÁRIA — o legacy relacionado (`/financial-rules`) já foi classificado UNRELATED no doc20 (domínio de cálculo de taxa/imposto, sem campo `links`); consultá-lo não ajudaria a resolver o comportamento do frontend.

RESULTADO:
`links` nunca é populado com valor não-nulo por nenhum fluxo do frontend hoje — é gravado como `null` na criação e nunca reatribuído na edição (o modal de edição não tem campo de UI para ele). É um campo "morto" na escrita: declarado no tipo, lido defensivamente em dois lugares (sempre com fallback para `[]` quando null), mas nunca escrito com dado real.

STATUS:
RESOLVED

JUSTIFICATIVA:
Evidência concreta e exaustiva (todo o módulo `accounting` varrido para escritas do campo) mostra um único ponto de escrita, sempre `null`. Não é inferência por nome — é a leitura direta do único `handleSubmit` do módulo.
```

## Item 2 — Caso 5, INPUT

```text
CASO:
5

TIPO_DA_INCERTEZA:
INPUT

DESCRIÇÃO_ANTERIOR:
ENTRADAS de "criar" (sendMessage/sendAttachment/createChannel) — doc21 registrou UNRESOLVED, citando que os parâmetros são prefixados `_` (nunca lidos) e a implementação real é `disabledIntegration(...)`

EVIDÊNCIA_FRONTEND:
(1) apps/web/src/modules/integrations/hooks/useChat.ts — assinaturas reais: `sendMessage: (_text: string) => disabledIntegration(...)`, `sendAttachment: (_file: File) => disabledIntegration(...)`, `createChannel: (_name: string) => disabledIntegration(...)` — cada uma aceita exatamente 1 campo, e nenhuma das três funções-hook (`useChatChannel()`, `useChatChannels()`) recebe um parâmetro de canal (ex.: `channelId`) sequer. (2) apps/web/src/shared/integrations/contracts/chat.contract.ts — `IChatProvider.sendMessage(params: SendMessageParams): Promise<ChatMessage>`, onde `SendMessageParams` = { channel_id: string; text?: string; type?: MessageType; attachments?: File[]; entity_ref?: EntityReference; mentions?: string[]; reply_to?: string }.

EVIDÊNCIA_LEGACY:
NÃO NECESSÁRIA — Caso 5 não tem legacy relacionado (doc20: `/conversations` é UNRELATED); e a questão aqui é puramente frontend-interna (contrato de tipos vs. implementação do hook).

RESULTADO:
Divergência real dentro do próprio frontend: o CONTRATO DE TIPOS (`chat.contract.ts`) declara `sendMessage` recebendo um objeto `SendMessageParams` com 7 campos (incluindo `channel_id` obrigatório), enquanto a ÚNICA IMPLEMENTAÇÃO EXISTENTE (`useChat.ts`) declara `sendMessage` recebendo só uma string solta, sem `channel_id` nem qualquer outro campo, e nunca a executa de fato. Os dois são incompatíveis em forma (objeto vs. string) e em conteúdo (7 campos vs. 1). Não há como determinar qual dos dois é "o" contrato de entrada real, porque nenhum dos dois foi de fato exercitado por uma tela.

STATUS:
CONFLICTING

JUSTIFICATIVA:
A regra de conflito do prompt é descrita para frontend×legacy, mas o princípio ("não escolha arbitrariamente, registre a divergência") se aplica igualmente aqui: há duas fontes de evidência do próprio frontend (um contrato de tipos e uma implementação de hook) que divergem estruturalmente sobre o mesmo campo de entrada, e escolher uma das duas sem justificativa seria uma decisão arbitrária. Registrado como CONFLICTING em vez de UNRESOLVED porque, ao contrário de uma ausência de evidência, aqui há duas evidências concretas e concorrentes.
```

## Item 3 — Caso 1, OUTPUT

```text
CASO:
1

TIPO_DA_INCERTEZA:
OUTPUT

DESCRIÇÃO_ANTERIOR:
SAÍDA_ESPERADA de "excluir" — doc21 registrou UNRESOLVED ("frontend não lê nenhum campo da resposta desta operação")

EVIDÊNCIA_FRONTEND:
apps/web/src/modules/accounting/pages/CategoriasFinanceiras.tsx — `confirmDelete()`: `if (deleteTarget) setRules(rules.filter((r) => r.id !== deleteTarget.id))`. `confirmBulkDelete()`: mesmo padrão com múltiplos ids. `setRules` (apps/web/src/modules/accounting/hooks/useFinancialCategoryRulesStore.ts) é síncrono: `setRulesState(nextRules); persistRules(nextRules)` — não há `await`, não há chamada de rede, não há variável de retorno consumida em lugar nenhum.

EVIDÊNCIA_LEGACY:
NÃO NECESSÁRIA — a pergunta é sobre o que o FRONTEND consome, não sobre o que um backend deveria devolver; o frontend não consome nada.

RESULTADO:
Não existe, hoje, nenhuma chamada individual de "excluir" com resposta a ser lida — a operação de exclusão é implementada como um filtro do array em memória seguido de reescrita completa do storage local (`persistRules`), 100% síncrono e client-side. Portanto, nenhum shape de saída é exigido pelo comportamento atual do frontend.

STATUS:
RESOLVED

JUSTIFICATIVA:
Evidência direta e completa do código: a função é síncrona, não `async`, sem `await`, sem leitura de retorno — não há ambiguidade sobre "o que falta ler", porque nada é lido.
```

## Item 4 — Caso 2, OUTPUT

```text
CASO:
2

TIPO_DA_INCERTEZA:
OUTPUT

DESCRIÇÃO_ANTERIOR:
SAÍDA_ESPERADA de "excluir" — doc21 registrou UNRESOLVED ("frontend não lê retorno desta operação além de atualizar o estado local")

EVIDÊNCIA_FRONTEND:
apps/web/src/modules/contracts/hooks/useVariableRegistry.ts — `removeVariable`: `useCallback((id) => { setVariables((prev) => prev.filter((v) => v.id !== id)); }, [])`. `removeVariables` (lote): mesmo padrão com `Set<string>`. Nenhuma das duas é `async`; a persistência real ocorre no `useEffect` que chama `save(variables)` sempre que o estado muda — não há retorno de função de "excluir" consumido em VariableRegistry.tsx (confirmado por grep: `removeVariable(v.id);`/`removeVariables(ids);` são chamadas sem capturar retorno, apps/web/src/modules/contracts/pages/VariableRegistry.tsx:513,549).

EVIDÊNCIA_LEGACY:
NÃO DISPONÍVEL para esta pergunta específica — o legacy parcial (`contract-templates`) tem um `DELETE /contract-templates/:id` que devolve `{ deleted: true }` (apps/api/src/modules/contract-templates/contract-templates.service.ts:55-60, já identificado no doc20), mas essa resposta não é comparável: é de um domínio estruturalmente diferente (template inteiro, não uma variável do registro) e o frontend deste caso não consome resposta alguma de qualquer forma — a existência de uma resposta legacy não muda o resultado desta pergunta específica sobre o que O FRONTEND exige.

RESULTADO:
Igual ao Item 3: nenhum shape de saída é exigido — a exclusão é um filtro de estado em memória, síncrono, seguido de reescrita completa do `localStore` no efeito colateral; nenhum valor de retorno é lido em nenhum dos dois chamadores (individual e em lote).

STATUS:
RESOLVED

JUSTIFICATIVA:
Mesma evidência direta de código-fonte do Item 3, confirmada também nos dois call sites em VariableRegistry.tsx.
```

## Item 5 — Caso 5, OUTPUT

```text
CASO:
5

TIPO_DA_INCERTEZA:
OUTPUT

DESCRIÇÃO_ANTERIOR:
SAÍDA_ESPERADA de "criar" (mensagem/anexo/canal) — doc21 registrou UNRESOLVED ("nenhuma implementação real para inspecionar o shape de retorno")

EVIDÊNCIA_FRONTEND:
apps/web/src/shared/lib/disabled-integration.ts — `disabledIntegration(name): never` sempre lança `DisabledIntegrationError`, com `status: 503`, `code: "integration_disabled"` (`INTEGRATION_DISABLED_CODE`), `message: "Integração ${name} desativada — backend não configurado. Conecte um backend ao app para reativá-la."`. `sendMessage`/`sendAttachment`/`createChannel` (useChat.ts) chamam exatamente essa função e nada mais.

EVIDÊNCIA_LEGACY:
NÃO NECESSÁRIA — pergunta é sobre o comportamento atual do frontend, sem legacy relacionado (Caso 5 é NO_LEGACY).

RESULTADO:
O comportamento comprovável pelo consumo atual é: a chamada sempre lança de forma síncrona um `DisabledIntegrationError` (nunca retorna com sucesso). Shape do erro: `{ name: "DisabledIntegrationError", message: string, code: "integration_disabled", status: 503 }`. Não existe, em código real (fora do tipo de contrato `IChatProvider.sendMessage(): Promise<ChatMessage>`, que nunca foi implementado), nenhuma evidência do shape de sucesso — essa parte especificamente permanece sem comprovação, mas a pergunta original ("shape comprovável pelo consumo atual") tem resposta definitiva: é sempre o erro acima.

STATUS:
RESOLVED

JUSTIFICATIVA:
"SAÍDA_ESPERADA: shape comprovável pelo consumo atual" (definição do próprio doc21) tem resposta objetiva e verificável no código: o único shape que o consumo atual produz é o erro padronizado de integração desativada. O shape de sucesso (`ChatMessage`) é aspiracional/declarado só no contrato de tipos, nunca exercitado — não é reivindicado aqui como resolvido, só o comportamento atual.
```

## Item 6 — Caso 4, BEHAVIOR

```text
CASO:
4

TIPO_DA_INCERTEZA:
BEHAVIOR

DESCRIÇÃO_ANTERIOR:
como/onde a operação de "conectar/atualizar uma distribuidora" (escrever `musicos360_distributor_connections`) deveria ocorrer — doc21 registrou UNRESOLVED, confirmando que nenhum código atual escreve essa chave

EVIDÊNCIA_FRONTEND:
grep repetido por `DISTRIBUTOR_CONNECTIONS_KEY`/`musicos360_distributor_connections` em todo `apps/web/src` (já feito no doc21) — confirma novamente: só 2 arquivos referenciam a chave (`distribution-platforms.ts` define+lê; `useDistributionPlatforms.ts` escuta o evento `storage`), nenhum escreve.

EVIDÊNCIA_LEGACY:
apps/api/src/modules/integrations/external-data.controller.ts, apps/api/src/core/external-data/external-data-provider-registry.service.ts, apps/api/src/core/external-data/unconfigured-distributor.provider.ts, apps/api/src/core/external-data/external-data.types.ts (todos já identificados nos docs 20/21) — revisitados nesta etapa. `ExternalDataProviderMetadata` (external-data.types.ts:11-18) tem apenas `providerId, displayName, kind, supportsSubmit, supportsStatusCheck, mock` — nenhum campo de conexão por tenant (sem `connected`, sem `username`, sem `tenantId`). Os únicos payloads existentes (`DistributorSubmissionPayload`, `ExternalDataRequestContext`) são para SUBMETER metadados de release/artista a um provider já assumido como conectado — não para registrar/consultar a conexão em si.

RESULTADO:
Nem o frontend nem os arquivos legacy já identificados contêm qualquer evidência de como uma conexão com distribuidora nomeada deveria ser criada, atualizada ou onde um `username` por plataforma seria persistido. Permanece sem resposta.

STATUS:
UNRESOLVED

JUSTIFICATIVA:
Busca completa (repetida) no frontend e releitura dirigida dos 4 arquivos legacy já identificados, sem qualquer novo dado. Não há indício em nenhum dos dois lados — não é ausência de tentativa, é ausência de evidência mesmo após a segunda checagem.
```

## Item 7 — Caso 5, BEHAVIOR

```text
CASO:
5

TIPO_DA_INCERTEZA:
BEHAVIOR

DESCRIÇÃO_ANTERIOR:
DURABILIDADE presumida como PERMANENTE "implícito pelo modelo de dados", mas doc21 marcou UNRESOLVED "com certeza total, pois não há nenhuma implementação real hoje para confirmar a intenção"

EVIDÊNCIA_FRONTEND:
apps/web/src/shared/integrations/contracts/chat.contract.ts — `ChatMessage` tem `deleted_at?: string | null` e `is_deleted: boolean` (padrão de soft-delete) e `ChatChannel.is_archived: boolean` (padrão de arquivamento, não remoção física). Nenhuma implementação real (useChat.ts é 100% stub) executa qualquer uma dessas operações.

EVIDÊNCIA_LEGACY:
NÃO NECESSÁRIA — Caso 5 é NO_LEGACY (doc20).

RESULTADO:
Os campos `deleted_at`/`is_deleted`/`is_archived` no tipo são consistentes com um padrão de retenção permanente (soft-delete), mas isso é uma leitura de convenção estrutural do tipo — exatamente o tipo de inferência que a "REGRA DE EVIDÊNCIA" desta etapa proíbe ("não resolver por inferência baseada... em convenção arquitetural"). Como nenhuma linha de código realmente grava, lê de volta, ou expira uma mensagem/canal, não há comportamento observável para confirmar a durabilidade pretendida.

STATUS:
UNRESOLVED

JUSTIFICATIVA:
A única evidência disponível (forma dos campos do tipo) é do tipo explicitamente excluído pela regra desta etapa ("convenção arquitetural"). Mantido UNRESOLVED por disciplina de evidência, não por falta de indício circunstancial.
```

---

## Resumo

```text
UNRESOLVED_INPUTS_INITIAL:
2

INPUTS_RESOLVED:
1

INPUTS_CONFLICTING:
1

INPUTS_REMAINING:
0

UNRESOLVED_OUTPUTS_INITIAL:
3

OUTPUTS_RESOLVED:
3

OUTPUTS_CONFLICTING:
0

OUTPUTS_REMAINING:
0

UNRESOLVED_BEHAVIORS_INITIAL:
2

BEHAVIORS_RESOLVED:
0

BEHAVIORS_CONFLICTING:
0

BEHAVIORS_REMAINING:
2
```

## Cobertura

7/7 itens `UNRESOLVED` do doc21 revisitados. 3 resolvidos com evidência direta de código (Casos 1 e 2, ambos sobre a natureza síncrona/client-side da operação de exclusão, e Caso 1 sobre o campo `links` nunca escrito), 1 registrado como conflito interno do frontend (contrato de tipos × implementação real do hook, Caso 5 input), e 3 permanecem sem resposta (Caso 5 output quanto ao shape de sucesso não foi contado como pendência porque a pergunta original já tinha resposta objetiva quanto ao comportamento atual; os 2 itens de BEHAVIOR seguem genuinamente sem evidência, mesmo após releitura dos arquivos legacy já identificados). `apps/web` e `apps/api` não foram alterados. Nenhum storage local foi alterado.
