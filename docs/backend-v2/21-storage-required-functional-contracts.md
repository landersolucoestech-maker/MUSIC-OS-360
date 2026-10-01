> Historical record. Kept as recorded; not the current contract.

# 21 — Contrato Funcional dos 5 Casos de Storage Local Sem Endpoint

Continuação read-only de [`19-backend-required-storage-map.md`](./19-backend-required-storage-map.md) e [`20-storage-cases-legacy-check.md`](./20-storage-cases-legacy-check.md). Nenhum arquivo foi alterado, em `apps/web` ou `apps/api`. Nenhum doc anterior foi modificado. Nenhum path, método HTTP, controller, service, repository, tabela, migration ou DTO de backend foi definido — apenas o comportamento funcional exigido, comprovado pelo código atual.

Numeração idêntica à do doc19/doc20: Caso 1 (financial category rules), Caso 2 (variable registry), Caso 3 (NFe), Caso 4 (distribution platforms), Caso 5 (chat). Para os Casos 2 e 4 (legacy parcial), foram relidos somente os arquivos de `apps/api/**` já identificados no doc20 — nenhum domínio novo foi explorado. Para completar CONSUMIDORES/COMPORTAMENTOS com evidência direta, 4 arquivos adicionais de `apps/web/**` foram lidos nesta etapa: `CategoriasFinanceiras.tsx`, `VariableRegistry.tsx` (grep dirigido), `ContractImportWorkspace.tsx` (grep dirigido) e `Configuracoes.tsx` + `useDistributionPlatforms.ts`.

---

## Caso 1

```text
CASO:
1

DOMÍNIO:
accounting — matriz de validade de categorização financeira

FUNCIONALIDADE:
definir quais combinações de categoria/subcategoria/vínculos são válidas para cada par (tipo de transação × tipo de contraparte), usada tanto para administrar essas combinações quanto para alimentar sugestões no formulário de lançamento de transações

ORIGEM_ATUAL_DOS_DADOS:
localStorage, chave "musicos360_financial_category_rules"

CONSUMIDORES:
- apps/web/src/modules/accounting/pages/CategoriasFinanceiras.tsx (tela de administração — CRUD completo)
- apps/web/src/modules/accounting/components/transacao-form/hooks/useTransacaoFormController.ts (consumido em TransacaoFormModal.tsx — somente leitura, usa `rules` para sugerir categoria/subcategoria/vínculos ao lançar uma transação)

OPERAÇÕES_FUNCIONAIS:
- listar (tabela paginada/ordenável de todas as regras do tenant)
- consultar (visualização somente-leitura de uma regra — modo "view" do modal)
- criar (nova regra individual, via modal)
- atualizar (editar regra individual, via modal)
- excluir (individual, com confirmação; e em lote, múltiplas regras selecionadas, com confirmação)
- outra (resetRules — restaura o conjunto para o seed padrão; exportada pelo hook mas SEM nenhum chamador identificado em `apps/web/src` — funcionalidade morta/não exercida por nenhuma tela)
```

### Entradas e saídas por operação

```text
OPERAÇÃO: listar / consultar
ENTRADAS:
- nenhum filtro de servidor comprovado (toda ordenação/paginação/filtro observada é client-side, sobre o array completo já carregado)
SAÍDA_ESPERADA:
array de regras
CAMPOS:
- id: string
- transaction_type: "Receita"|"Despesa"|"Investimento"|"Imposto"|"Transferência"
- counterparty_type: "Empresa"|"Pessoa"|"Artista"|"Governo"|"Conta Própria"
- category: string
- subcategory: string | null
- links: ("Artista"|"Projeto"|"Contrato"|"Evento"|"Centro de custo"|"Competência"|"Conta Origem"|"Conta Destino")[] | null
- active: boolean
- sort_order: number
- created_at: string (ISO)
- updated_at: string (ISO)
```

```text
OPERAÇÃO: criar
ENTRADAS:
- transaction_type — enum acima — obrigatório — Select do modal (default "Despesa")
- counterparty_type — enum acima — obrigatório — Select do modal (default "Empresa")
- category — string — obrigatório (validado no client: não pode ser vazio) — Input do modal
- subcategory — string | null — opcional — Input do modal (vazio vira null)
- active — boolean — obrigatório — Checkbox do modal (default true)
- sort_order — number — obrigatório — Input numérico do modal (default 0)
- links — sempre null no create (não há campo de UI para links neste modal, apesar do tipo permitir) — UNRESOLVED se algum outro fluxo preenche links
SAÍDA_ESPERADA:
a regra criada, com id/created_at/updated_at atribuídos
CAMPOS:
mesmos campos da operação listar
```

```text
OPERAÇÃO: atualizar
ENTRADAS:
- id (do registro a atualizar) — string — obrigatório — selecionado na tabela
- os mesmos 6 campos editáveis do create (transaction_type, counterparty_type, category, subcategory, active, sort_order) — obrigatório/opcional conforme acima — modal em modo "edit"
SAÍDA_ESPERADA:
a regra atualizada (updated_at renovado)
CAMPOS:
mesmos campos da operação listar
```

```text
OPERAÇÃO: excluir
ENTRADAS:
- id (individual) ou ids[] (lote) — string / string[] — obrigatório — seleção na tabela
SAÍDA_ESPERADA:
confirmação de remoção (o frontend apenas remove do array local após confirmar; nenhum shape de resposta específico é consumido)
CAMPOS:
UNRESOLVED (frontend não lê nenhum campo da resposta desta operação)
```

```text
PERSISTÊNCIA_NECESSÁRIA:
SIM

ESCOPO:
TENANT — nenhum campo de user_id existe na entidade; é uma tabela de configuração de negócio (categorização financeira) usada por todos os usuários do tenant que lançam transações

DURABILIDADE:
PERMANENTE
```

```text
LEGACY_COVERAGE:
NONE — o endpoint /financial-rules já existente (doc20) é um domínio diferente (motor de cálculo de taxa/imposto/comissão), sem nenhum campo em comum com esta entidade

REQUIRED_BEHAVIOR_FROM_FRONTEND:
CRUD completo (listar/consultar/criar/atualizar/excluir individual e em lote) de uma entidade com 8 campos próprios (transaction_type, counterparty_type, category, subcategory, links, active, sort_order) mais auditoria (created_at/updated_at), escopada ao tenant, sem paginação/filtro de servidor comprovados (tudo client-side hoje sobre o array completo).
```

---

## Caso 2

```text
CASO:
2

DOMÍNIO:
contracts — registro de variáveis/placeholders de template

FUNCIONALIDADE:
manter um registro reutilizável de variáveis (placeholders como {{ARTISTA.NAME}}) usadas na geração/edição de templates de contrato, incluindo importação em lote de variáveis detectadas automaticamente durante o parsing de um contrato existente

ORIGEM_ATUAL_DOS_DADOS:
localStorage (via wrapper `localStore`, prefixo "musicos360:"), chave "musicos360:variable_registry"

CONSUMIDORES:
- apps/web/src/modules/contracts/pages/VariableRegistry.tsx (tela de administração — usa addVariable/updateVariable/removeVariable/removeVariables/importVariables, confirmado por leitura direta)
- apps/web/src/modules/contracts/components/ContractImportWorkspace.tsx (workspace de importação de contrato — usa `variables` (leitura) e `addVariable` (criação), confirmado por leitura direta — variáveis sugeridas pelo parser semântico podem ser adicionadas ao registro)

OPERAÇÕES_FUNCIONAIS:
- listar (variables — array completo do registro)
- criar (addVariable — variável individual)
- atualizar (updateVariable — variável individual)
- excluir (removeVariable individual; removeVariables em lote por array de ids)
- outra (importVariables — merge em lote com deduplicação case-insensitive por placeholder, retorna contagem {added, skipped})
```

### Entradas e saídas por operação

```text
OPERAÇÃO: listar
ENTRADAS:
- nenhuma (retorna o array completo)
SAÍDA_ESPERADA:
array de RegistryVariable
CAMPOS:
- id: string
- name: string
- group: string (normalizado para maiúsculas/underscore no create/update)
- field: string (idem)
- placeholder: string (derivado, formato "{{GROUP.FIELD}}")
- internalGroup: string | undefined
- createdAt: string (ISO)
```

```text
OPERAÇÃO: criar
ENTRADAS:
- name — string — obrigatório — form da tela VariableRegistry.tsx
- group — string — obrigatório — form (normalizado para UPPER_SNAKE)
- field — string — obrigatório — form (normalizado para UPPER_SNAKE)
- internalGroup — string | undefined — opcional — form
SAÍDA_ESPERADA:
a variável criada (id gerado client-side hoje: `rv-${Date.now()}-${random}`; placeholder derivado)
CAMPOS:
mesmos campos da operação listar
```

```text
OPERAÇÃO: atualizar
ENTRADAS:
- id — string — obrigatório — selecionado na tela
- name, group, field, internalGroup — mesmos tipos do create — todos opcionais na chamada (Partial), mas quando ausentes mantêm o valor anterior
SAÍDA_ESPERADA:
a variável atualizada (placeholder recalculado a partir de group+field)
CAMPOS:
mesmos campos da operação listar
```

```text
OPERAÇÃO: excluir
ENTRADAS:
- id (individual) ou ids[] (lote) — string / string[] — obrigatório
SAÍDA_ESPERADA:
UNRESOLVED (frontend não lê retorno desta operação além de atualizar o estado local)
CAMPOS:
UNRESOLVED
```

```text
OPERAÇÃO: outra (importar em lote)
ENTRADAS:
- incoming — RegistryVariable[] — obrigatório — variáveis detectadas pelo parser semântico de contrato (semantic-parser.service.ts) ou por outra fonte externa ao registro
SAÍDA_ESPERADA:
contagem de resultado da importação
CAMPOS:
- added: number
- skipped: number (quando o placeholder já existe, case-insensitive)
```

```text
PERSISTÊNCIA_NECESSÁRIA:
SIM

ESCOPO:
TENANT — variáveis de template de contrato são um recurso compartilhado entre quem gera contratos no tenant, sem segmentação por usuário observada no código

DURABILIDADE:
PERMANENTE
```

```text
LEGACY_COVERAGE:
existe uma coluna `variaveis` (jsonb, default []) na entidade ContractTemplateEntity (apps/api/src/database/entities.ts:805) e o DTO de criação de template aceita um campo `variables?: unknown[]` (apps/api/src/modules/contract-templates/dto/create-contract-template.dto.ts) — mas embutido DENTRO de cada template individual, não como registro compartilhado entre templates

MISSING_BEHAVIOR:
(1) um registro de variáveis independente de qualquer template específico, reutilizável entre templates — o legacy só guarda variáveis já associadas a UM template; (2) a estrutura própria da variável (name/group/field/placeholder/internalGroup) — o legacy trata `variaveis`/`variables` como `unknown[]` sem schema; (3) operação de importação em lote com deduplicação por placeholder; (4) a própria gravação do campo pode não estar funcionando no legacy — o nome do campo no DTO (`variables`, inglês) diverge do nome da coluna na entidade (`variaveis`, português), e o service faz um spread genérico (`{ ...(dto as any) }`) sem mapeamento explícito entre os dois nomes (não testado em runtime, então registrado como observação, não como certeza).
```

---

## Caso 3

```text
CASO:
3

DOMÍNIO:
integrations — configuração fiscal (NF-e)

FUNCIONALIDADE:
armazenar a configuração usada para emitir Notas Fiscais Eletrônicas em nome da empresa: CNPJ, inscrição estadual, regime tributário, ambiente (produção/homologação), tipo/serial do certificado digital, provedor fiscal terceirizado e o token de autenticação desse provedor

ORIGEM_ATUAL_DOS_DADOS:
sessionStorage, chave "musicos360_nfe_credentials"

CONSUMIDORES:
- apps/web/src/modules/integrations/components/NfeConfigDialog.tsx (dialog de configuração, em Integrações)

OPERAÇÕES_FUNCIONAIS:
- consultar (useNfeStatus — deriva `connected`/`has_credentials` a partir da presença da config salva)
- criar (primeira gravação da configuração — mesma função que atualizar, ver abaixo)
- atualizar (useNfeSaveCredentials — upsert; sobrescreve integralmente a configuração anterior, sem merge parcial)
- excluir (useNfeDeleteCredentials — remove a configuração)
```

### Entradas e saídas por operação

```text
OPERAÇÃO: consultar
ENTRADAS:
- nenhuma
SAÍDA_ESPERADA:
NfeStatus
CAMPOS:
- connected: boolean
- has_credentials: boolean
- cnpj?: string
- ambiente?: "producao"|"homologacao"
- provedor?: string
- certificado_tipo?: "A1"|"A3"
- regime_tributario?: string
- saved_at?: string (ISO)
```

```text
OPERAÇÃO: criar / atualizar (upsert — mesma chamada de rede no frontend hoje)
ENTRADAS:
- cnpj — string — obrigatório (implícito pelo tipo NfeCredentials; não há validação client visível além de required no formulário do dialog, não lido em detalhe aqui pois já coberto pelo hook)
- ie — string — opcional
- regime_tributario — "simples_nacional"|"lucro_presumido"|"lucro_real" — obrigatório
- ambiente — "producao"|"homologacao" — obrigatório
- certificado_tipo — "A1"|"A3" — obrigatório
- certificado_serial — string — opcional
- token_provedor — string — opcional (mas é o segredo de autenticação do provedor fiscal — dado sensível)
- provedor — "focusnfe"|"nfeio"|"emites"|"plugnotas"|"proprio" — obrigatório
SAÍDA_ESPERADA:
nenhuma — useNfeSaveCredentials apenas invalida a query de status após salvar, não consome o corpo de resposta
CAMPOS:
N/A
```

```text
OPERAÇÃO: excluir
ENTRADAS:
- nenhuma (a operação é implicitamente escopada ao tenant/config atual — não há id, pois é uma configuração singleton por tenant)
SAÍDA_ESPERADA:
nenhuma — mutation apenas invalida a query de status
CAMPOS:
N/A
```

```text
PERSISTÊNCIA_NECESSÁRIA:
SIM

ESCOPO:
TENANT — um CNPJ/configuração fiscal por empresa (tenant), não por usuário

DURABILIDADE:
PERMANENTE
```

```text
LEGACY_COVERAGE:
NONE — nenhum módulo, controller, DTO ou entidade fiscal/NFe foi encontrado em apps/api (doc20, Caso 3)

REQUIRED_BEHAVIOR_FROM_FRONTEND:
configuração singleton por tenant (não é uma lista — um único registro ativo por vez), com upsert (criar=atualizar na prática atual) e exclusão, guardando um segredo (token_provedor) que hoje é persistido sem nenhuma proteção client-side (nem sequer o `safeSessionSet` que outras integrações do mesmo módulo usam) — o comportamento funcional exigido é: 1 GET de status, 1 upsert de configuração completa, 1 remoção; sem paginação, sem listagem de múltiplas configurações.
```

---

## Caso 4

```text
CASO:
4

DOMÍNIO:
releases / integrations — conexão com distribuidoras digitais

FUNCIONALIDADE:
determinar quais distribuidoras digitais nomeadas (do catálogo fixo de 6: ONErpm, DistroKid, Symphonic, SoundOn, MusicPro, SomVibe) estão conectadas para o tenant, e com qual username, para popular o seletor de distribuidoras no fluxo de criação de lançamento

ORIGEM_ATUAL_DOS_DADOS:
localStorage, chave "musicos360_distributor_connections"

CONSUMIDORES:
- apps/web/src/modules/releases/hooks/useDistributionPlatforms.ts (leitura + escuta do evento `storage` do navegador para refletir mudanças entre abas)
- (uso final em telas de criação/edição de lançamento, não lido em detalhe nesta etapa — fora do necessário para o contrato funcional desta chave)

OPERAÇÕES_FUNCIONAIS:
- listar (getEnabledDistributionPlatforms — plataformas do catálogo filtradas pelas conectadas)
- sincronizar (useDistributionPlatforms reage a eventos `storage` do navegador para refletir conexões feitas "em outra aba", segundo o comentário do hook)
```

### Entradas e saídas por operação

```text
OPERAÇÃO: listar
ENTRADAS:
- nenhuma
SAÍDA_ESPERADA:
array de ConnectedDistributionPlatform (subconjunto do catálogo fixo DISTRIBUTION_PLATFORMS, apenas os conectados)
CAMPOS:
- id: string (um dos 6 ids fixos do catálogo: onerpm|distrokid|symphonic|soundon|musicpro|somvibe)
- name: string (do catálogo estático, não da persistência)
- description: string (do catálogo estático, não da persistência)
- username?: string (da persistência)
```

```text
OPERAÇÃO: sincronizar
ENTRADAS:
- nenhuma (reage passivamente ao evento `storage` do browser quando a chave muda)
SAÍDA_ESPERADA:
re-execução de "listar"
CAMPOS:
mesmos da operação listar
```

```text
PERSISTÊNCIA_NECESSÁRIA:
SIM

ESCOPO:
TENANT — conexão com distribuidora é um recurso do tenant/label, não do usuário individual

DURABILIDADE:
PERMANENTE
```

```text
LEGACY_COVERAGE:
existe um framework genérico de troca de dados com distribuidoras em apps/api/src/modules/integrations/external-data.controller.ts (Controller('integrations/external-data')): GET /providers?kind=distributor, POST /distributor/submit, POST /distributor/status-check, POST /webhooks/:providerId — mas ZERO providers nomeados reais (ONErpm/DistroKid/Symphonic/SoundOn/MusicPro/SomVibe) estão registrados; o único provider `kind: distributor` é um stub (`UnconfiguredDistributorProvider`) que sempre lança erro, e nem esse é registrado em produção/staging (doc20, Caso 4)

MISSING_BEHAVIOR:
(1) os 6 providers nomeados concretos não existem no legacy, só a infraestrutura genérica de submissão; (2) o legacy não tem NENHUM endpoint que devolva "status de conexão + username por plataforma" — os endpoints existentes são de submissão de metadados de release/artista/fonograma a um provedor (ação de envio), não de consulta de estado de conexão (ação de leitura de configuração); (3) ATENÇÃO — achado adicional desta etapa: a própria escrita desta chave no frontend está morta hoje. Um grep dedicado por `DISTRIBUTOR_CONNECTIONS_KEY`/`musicos360_distributor_connections` em todo `apps/web/src` encontrou só 2 arquivos (o que define+lê a chave, e o hook que escuta o evento `storage`) — NENHUM arquivo grava essa chave. `apps/web/src/modules/settings/pages/Configuracoes.tsx`, citado em comentário como a origem da escrita ("mesma chave usada por Configurações"), hoje só renderiza links estáticos "Abrir portal oficial" (navegação de browser para o site da distribuidora) para cada uma das 6 distribuidoras — sem nenhum botão de conectar/desconectar, sem nenhuma chamada de storage. Ou seja, o comportamento de "criar/atualizar uma conexão" é estruturalmente implícito pelo formato do dado (existe um campo `username`), mas não há NENHUMA evidência de código atual de como/onde essa gravação deveria ocorrer — UNRESOLVED, não inventado.
```

---

## Caso 5

```text
CASO:
5

DOMÍNIO:
integrations — comunicação interna da equipe (MusicChat)

FUNCIONALIDADE:
canais e mensagens de comunicação interna entre membros do tenant — canais diretos, de grupo, ou associados a projeto/artista/departamento/geral; mensagens com anexos, menções, respostas em thread e reações; notificações de menção/resposta/convite

ORIGEM_ATUAL_DOS_DADOS:
nenhuma (nenhuma chamada real de storage — useChat.ts é 100% stub desabilitado; ver doc18 Caso 12/doc19 Caso 5)

CONSUMIDORES:
- NENHUM identificado — busca por `useChatChannel|useChatStatus|useChatChannels|useChatNotifications` em todo `apps/web/src` (Prompt 22) não encontrou nenhum componente de tela consumindo estes hooks além do próprio arquivo que os declara

OPERAÇÕES_FUNCIONAIS:
(apenas as operações que o próprio useChat.ts stub declara — evidência mais forte que a interface `IChatProvider`, que descreve um contrato mais amplo nunca sequer stubado)
- consultar (useChatStatus — status estático da integração)
- listar (useChatChannel.messages sempre [] ; useChatChannels.data sempre null — stubs)
- criar (sendMessage, sendAttachment, createChannel — todos chamam disabledIntegration("MusicChat") em vez de executar)
- outra (subscribe/unsubscribe de notificações — tempo real, stub)
```

### Entradas e saídas por operação

```text
OPERAÇÃO: consultar (status)
ENTRADAS:
- nenhuma
SAÍDA_ESPERADA:
ChatStatus
CAMPOS:
- integration_id: "musicroomchat"
- status: string (hoje sempre "disabled")
- connected: boolean (hoje sempre false)
- websocket_url: string | null
- push_notifications_enabled: boolean
- max_channels_per_tenant: number
- last_error: string | null
- last_checked_at: string (ISO)
```

```text
OPERAÇÃO: criar (mensagem/anexo/canal)
ENTRADAS:
UNRESOLVED — sendMessage(_text: string)/sendAttachment(_file: File)/createChannel(_name: string) declaram um parâmetro cada, mas o parâmetro é prefixado `_` (nunca lido) e a implementação real é `disabledIntegration("MusicChat")`, então não há evidência de todos os campos que uma chamada real exigiria além do único parâmetro nomeado em cada assinatura
SAÍDA_ESPERADA:
UNRESOLVED — nenhuma implementação real para inspecionar o shape de retorno
CAMPOS:
UNRESOLVED
```

```text
OPERAÇÃO: listar (canais/mensagens)
ENTRADAS:
- nenhuma
SAÍDA_ESPERADA:
sempre vazio hoje ([] / null) — não há evidência de um shape de listagem real além dos tipos declarados em chat.contract.ts (ChatChannel[]/ChatMessage[])
CAMPOS:
ChatChannel: id, tenant_id, type, name, description?, entity_id?, members (ChatMember[]), unread_count, last_message?, created_at, updated_at, is_archived
ChatMessage: id, channel_id, sender_id, sender_name, sender_avatar?, type, text?, attachments?, entity_ref?, mentions?, reply_to?, reactions?, created_at, updated_at?, deleted_at?, is_edited, is_deleted
(campos declarados no contrato de tipos chat.contract.ts — nunca populados por nenhuma implementação real; listados porque são "comprováveis pelo consumo atual" do tipo, não por uso real)
```

```text
PERSISTÊNCIA_NECESSÁRIA:
SIM (para que mensagens/canais sobrevivam entre sessões — presumido pelo próprio modelo de dados com created_at/updated_at/deleted_at; não há hoje nenhuma persistência real, nem local nem remota)

ESCOPO:
TENANT (canais pertencem ao tenant; membros e autoria de mensagens são por usuário — escopo misto, mas a unidade de dados —canal— é do tenant)

DURABILIDADE:
PERMANENTE (implícito pelo modelo de dados — histórico de conversa) — mas UNRESOLVED com certeza total, pois não há nenhuma implementação real hoje para confirmar a intenção
```

```text
LEGACY_COVERAGE:
NONE — `/conversations` (apps/api/src/modules/conversations) existe e está funcional, mas é um sistema de atendimento ao cliente/CRM (assign/transfer/close/reopen/notes internas, `assignee_id`, filas/setores), sem nenhum conceito de canal, membro de canal, reação ou menção — UNRELATED ao domínio de chat interno (doc20, Caso 5)

REQUIRED_BEHAVIOR_FROM_FRONTEND:
o contrato completo é o definido por IChatProvider (chat.contract.ts): CRUD de canais (listar/obter/criar/arquivar/adicionar-membro/remover-membro), CRUD de mensagens (listar/enviar/editar/excluir), reações (adicionar/remover), notificações (listar/marcar-lida-mensagem/marcar-lida-canal) e um mecanismo de tempo real (subscribe/unsubscribe por canal) — mas como NENHUMA tela consome isso hoje e a implementação é 100% stub, este é o caso com menor comprovação real de comportamento entre os 5; o contrato de tipos é a única evidência disponível, não o comportamento observado em uso.
```

---

## Resumo

```text
CASES_ANALYZED:
5

FUNCTIONAL_OPERATIONS_IDENTIFIED:
21

CASES_REQUIRING_PERSISTENCE:
5

TENANT_SCOPED_CASES:
5

USER_SCOPED_CASES:
0

GLOBAL_CASES:
0

PARTIAL_LEGACY_CASES:
2

NO_LEGACY_CASES:
3

UNRESOLVED_INPUTS:
2

UNRESOLVED_OUTPUTS:
3

UNRESOLVED_BEHAVIORS:
2
```

`FUNCTIONAL_OPERATIONS_IDENTIFIED` (21) é a soma dos bullets em `OPERAÇÕES_FUNCIONAIS` de cada caso: Caso 1 = 6 (listar, consultar, criar, atualizar, excluir, outra/resetRules), Caso 2 = 5 (listar, criar, atualizar, excluir, outra/importar), Caso 3 = 4 (consultar, criar, atualizar, excluir), Caso 4 = 2 (listar, sincronizar), Caso 5 = 4 (consultar, listar, criar, outra/subscribe). Exclusão individual e em lote (Casos 1 e 2) foram contadas como uma única operação "excluir" cada, por serem a mesma operação funcional com granularidade de entrada diferente (um id vs. array de ids), não duas operações distintas. `UNRESOLVED_INPUTS` (2): campo `links` no create do Caso 1, e o corpo completo de `criar` (mensagem/anexo/canal) no Caso 5. `UNRESOLVED_OUTPUTS` (3): saída de `excluir` no Caso 1, saída de `excluir` no Caso 2, e saída de `criar` no Caso 5. `UNRESOLVED_BEHAVIORS` (2): o gap de escrita do Caso 4 (como/onde conectar uma distribuidora deveria acontecer — nenhum código atual grava a chave) e a durabilidade/persistência real presumida, mas não confirmável, do Caso 5 (contrato quase inteiramente não-exercitado por nenhuma implementação real).

## Cobertura

5/5 casos do doc19/doc20 documentados funcionalmente. Nenhum path, método, controller, service, repository, tabela, migration ou DTO de backend foi definido nesta etapa — apenas o comportamento comprovado pelo frontend (e, nos 2 casos de legacy parcial, a lacuna precisa entre o que existe e o que falta). `apps/web` e `apps/api` não foram alterados. Nenhum storage local foi alterado.
