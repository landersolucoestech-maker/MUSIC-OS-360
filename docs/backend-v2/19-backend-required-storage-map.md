> Historical record. Kept as recorded; not the current contract.

# 19 — Mapa dos 6 Usos de Storage Local que Exigem Backend

Continuação read-only de [`18-local-storage-audit.md`](./18-local-storage-audit.md) (`BACKEND_REQUIRED_USAGES: 6`) e [`05-http-endpoint-inventory.md`](./05-http-endpoint-inventory.md) (inventário de 250 endpoints únicos). Nenhum arquivo foi alterado. Nenhum doc anterior foi modificado. `apps/api` não foi consultado. Nenhum endpoint foi inventado — todo `SIM`/`NÃO` abaixo foi verificado linha a linha contra o inventário do doc05.

Os 6 casos correspondem aos Casos 3, 4, 7, 9, 12 e 13 do doc18. Para confirmar/descartar correspondência de endpoint com precisão (evitar falso positivo por nome parecido), 3 arquivos adicionais de `apps/web/**` foram lidos: `financial-categories.service.ts` (comparar campos com o `/financial-categories/rules` já existente) e `financial-category-rules.types.ts` (Caso 1), além de um grep de callers para preencher TELA/FLUXO com evidência real.

---

## Caso 1

```text
CASO:
1

ARQUIVO:
apps/web/src/modules/accounting/hooks/useFinancialCategoryRulesStore.ts

CHAVE_STORAGE:
"musicos360_financial_category_rules"

CLASSIFICAÇÃO_ATUAL:
BUSINESS_DATA

FUNCIONALIDADE:
matriz de validade "quais categoria/subcategoria/vínculos são permitidos para uma combinação de tipo de transação × tipo de contraparte" — usada para popular as opções disponíveis no formulário de lançamento de transações financeiras

TELA/FLUXO:
modules/accounting/pages/CategoriasFinanceiras.tsx (tela de administração das regras) e modules/accounting/components/transacao-form/hooks/useTransacaoFormController.ts (consumido dentro de TransacaoFormModal.tsx, formulário de lançamento de transação)

ENTIDADE/DOMÍNIO:
FinancialCategoryRuleEntity (apps/web/src/modules/accounting/types/financial-category-rules.types.ts) — campos: id, transaction_type, counterparty_type, category, subcategory, links, active, sort_order, created_at, updated_at

OPERAÇÕES NECESSÁRIAS:
- LIST (loadRules)
- READ (leitura do array completo)
- UPDATE (setRules substitui o array inteiro; resetRules restaura o seed)

ENDPOINT_JÁ_EXISTENTE_NO_INVENTÁRIO:
NÃO

SE SIM:
N/A

SE NÃO:
NÃO IDENTIFICADO

DADOS_PERSISTIDOS:
array de FinancialCategoryRuleEntity — transaction_type (Receita|Despesa|Investimento|Imposto|Transferência), counterparty_type (Empresa|Pessoa|Artista|Governo|Conta Própria), category, subcategory, links (Artista|Projeto|Contrato|Evento|Centro de custo|Competência|Conta Origem|Conta Destino), active, sort_order

MOTIVO_DO_STORAGE_LOCAL:
não declarado explicitamente no código (nenhum comentário "MOCK"/"aguardando backend"); o hook simplesmente lê/escreve localStorage com fallback para um seed estático (financialCategoryRulesSeed) quando a chave está vazia

SUBSTITUIÇÃO_FUTURA:
API_V2_REQUIRED

EVIDÊNCIA:
apps/web/src/modules/accounting/hooks/useFinancialCategoryRulesStore.ts — loadRules()/persistRules()/useFinancialCategoryRulesStore()

ATENÇÃO — falso positivo descartado: existe um endpoint `/financial-categories/rules` (GET/POST/PATCH/DELETE) já implementado em apps/web/src/modules/accounting/services/financial-categories.service.ts:108-125 (financeCategorizationRulesService), MAS seu contrato (name, description, priority, category_id, conditions{transaction_type, description_contains: keywords[]}, actions{category_id, category_name, confidence}) é um motor de SUGESTÃO AUTOMÁTICA por palavra-chave — um domínio estruturalmente diferente da matriz de validade transaction_type×counterparty_type→category/subcategory/links usada por este hook. Comparação de campos feita explicitamente para não registrar um falso SIM só pelo nome parecido.
```

## Caso 2

```text
CASO:
2

ARQUIVO:
apps/web/src/modules/contracts/hooks/useVariableRegistry.ts

CHAVE_STORAGE:
"musicos360:variable_registry" (via wrapper localStore, prefixo "musicos360:")

CLASSIFICAÇÃO_ATUAL:
BUSINESS_DATA

FUNCIONALIDADE:
registro de variáveis/placeholders (ex.: {{ARTISTA.NAME}}) usado na geração de templates de contrato — CRUD completo client-side, com seed de variáveis padrão (artista, gravadora, licenciante, contratante) na primeira execução

TELA/FLUXO:
apps/web/src/modules/contracts/pages/VariableRegistry.tsx (tela de administração do registro de variáveis) e apps/web/src/modules/contracts/components/ContractImportWorkspace.tsx (workspace de importação de contratos, que também consome o registro)

ENTIDADE/DOMÍNIO:
RegistryVariable — campos: id, name, group, field, placeholder, internalGroup?, createdAt

OPERAÇÕES NECESSÁRIAS:
- CREATE (addVariable)
- READ (load)
- UPDATE (updateVariable)
- DELETE (removeVariable / removeVariables em lote)
- LIST (variables)
- OUTRO (importVariables — merge em lote com deduplicação por placeholder)

ENDPOINT_JÁ_EXISTENTE_NO_INVENTÁRIO:
NÃO

SE SIM:
N/A

SE NÃO:
NÃO IDENTIFICADO

DADOS_PERSISTIDOS:
array de RegistryVariable — name, group, field, placeholder (derivado de group+field), internalGroup, createdAt

MOTIVO_DO_STORAGE_LOCAL:
não declarado explicitamente no código; nenhum comentário indicando planejamento de backend

SUBSTITUIÇÃO_FUTURA:
API_V2_REQUIRED

EVIDÊNCIA:
apps/web/src/modules/contracts/hooks/useVariableRegistry.ts — load()/save()/addVariable()/updateVariable()/removeVariable()/removeVariables()/importVariables()

ATENÇÃO — descartado por não corresponder: TABLE_ENDPOINT (doc05) mapeia `templates_contratos`/`contract_templates` → `/contract-templates`, mas esse é o endpoint dos TEMPLATES de contrato em si (documentos), não das VARIÁVEIS/placeholders reutilizáveis entre templates — nenhum endpoint `/contract-templates/variables` ou equivalente aparece no inventário do doc05.
```

## Caso 3

```text
CASO:
3

ARQUIVO:
apps/web/src/modules/integrations/hooks/useNfe.ts

CHAVE_STORAGE:
"musicos360_nfe_credentials" (sessionStorage)

CLASSIFICAÇÃO_ATUAL:
INTEGRATION_STATE (registrado no doc18 como "outra", não BUSINESS_DATA nem MOCK_OR_FALLBACK)

FUNCIONALIDADE:
configuração de emissão de NF-e (Nota Fiscal Eletrônica) por empresa — CNPJ, inscrição estadual, regime tributário, ambiente (produção/homologação), tipo e serial de certificado digital, provedor fiscal e o token de autenticação desse provedor

TELA/FLUXO:
apps/web/src/modules/integrations/components/NfeConfigDialog.tsx (dialog de configuração da integração NF-e, em Integrações)

ENTIDADE/DOMÍNIO:
NfeCredentials — campos: cnpj, ie?, regime_tributario, ambiente, certificado_tipo, certificado_serial?, token_provedor?, provedor, saved_at

OPERAÇÕES NECESSÁRIAS:
- CREATE/UPDATE (useNfeSaveCredentials — upsert de um único registro por empresa)
- READ (loadCredentials/useNfeStatus)
- DELETE (useNfeDeleteCredentials)

ENDPOINT_JÁ_EXISTENTE_NO_INVENTÁRIO:
NÃO

SE SIM:
N/A

SE NÃO:
NÃO IDENTIFICADO

DADOS_PERSISTIDOS:
cnpj, ie, regime_tributario (simples_nacional|lucro_presumido|lucro_real), ambiente (producao|homologacao), certificado_tipo (A1|A3), certificado_serial, token_provedor (segredo do provedor fiscal), provedor (focusnfe|nfeio|emites|plugnotas|proprio), saved_at

MOTIVO_DO_STORAGE_LOCAL:
não declarado explicitamente; comentário do arquivo apenas descreve migração futura ("Integração com SEFAZ via webservice... Suporte a certificado A1/A3... Emissão, cancelamento, inutilização e consulta de status SEFAZ") sem justificar por que a config atual vive em sessionStorage

SUBSTITUIÇÃO_FUTURA:
API_V2_REQUIRED

EVIDÊNCIA:
apps/web/src/modules/integrations/hooks/useNfe.ts — loadCredentials()/useNfeStatus()/useNfeSaveCredentials()/useNfeDeleteCredentials()

ATENÇÃO — descartado por não corresponder: TABLE_ENDPOINT mapeia `notas_fiscais` → `/invoices`, mas esse endpoint é para os REGISTROS de nota fiscal já emitidos (o resultado de uma emissão), não para a CONFIGURAÇÃO do provedor/certificado usada para emitir. Nenhum endpoint `/integrations/nfe/*` ou `/nfe/config` aparece no inventário do doc05 (diferente de outras integrações como Spotify/TikTok/GoogleAds, que têm `/integrations/<provider>/status|configure|auth|disconnect`).
```

## Caso 4

```text
CASO:
4

ARQUIVO:
apps/web/src/modules/releases/services/distribution-platforms.ts

CHAVE_STORAGE:
"musicos360_distributor_connections" (localStorage)

CLASSIFICAÇÃO_ATUAL:
BUSINESS_DATA

FUNCIONALIDADE:
estado de conexão do tenant com cada distribuidora digital (ONErpm, DistroKid, Symphonic, SoundOn, MusicPro, SomVibe) — determina quais distribuidoras aparecem como selecionáveis no fluxo de criação de lançamento

TELA/FLUXO:
leitura consumida por apps/web/src/modules/releases/hooks/useDistributionPlatforms.ts (fluxo de criação/edição de lançamento, módulo Releases); a escrita da mesma chave ocorre em apps/web/src/modules/settings/pages/Configuracoes.tsx (não incluído nos 6 arquivos de storage-local originais, mas consome a mesma chave — "compartilhada com Configurações" segundo o comentário do próprio arquivo)

ENTIDADE/DOMÍNIO:
ConnectedDistributionPlatform — id, name, description, username? (conexão com uma distribuidora do catálogo DISTRIBUTION_PLATFORMS)

OPERAÇÕES NECESSÁRIAS:
- READ (readConnections)
- LIST (getEnabledDistributionPlatforms filtra o catálogo estático pelas conexões)

ENDPOINT_JÁ_EXISTENTE_NO_INVENTÁRIO:
NÃO

SE SIM:
N/A

SE NÃO:
NÃO IDENTIFICADO

DADOS_PERSISTIDOS:
Record<platformId, {username?}> — para cada uma das 6 distribuidoras do catálogo, se está conectada e o nome de usuário/conta (quando disponível)

MOTIVO_DO_STORAGE_LOCAL:
comentário do próprio arquivo (linhas 2-4): "As plataformas conectadas vêm de localStorage (mesma chave usada por Configurações), que é o estado REAL do app — nada é simulado aqui" — motivo declarado é que esta é a fonte de verdade atual, não uma simulação temporária

SUBSTITUIÇÃO_FUTURA:
API_V2_REQUIRED

EVIDÊNCIA:
apps/web/src/modules/releases/services/distribution-platforms.ts — readConnections()/getEnabledDistributionPlatforms()

ATENÇÃO — descartado por não corresponder: nenhum endpoint contendo "distribut" aparece no inventário do doc05. As únicas referências a distribuidoras no inventário são navegações de browser (window.location.href para portais como distrokid.com/app.onerpm.com), explicitamente registradas no doc05 como NÃO sendo chamadas HTTP request-response, portanto não contam como endpoint correspondente.
```

## Caso 5

```text
CASO:
5

ARQUIVO:
apps/web/src/modules/integrations/hooks/useChat.ts

CHAVE_STORAGE:
N/A (nenhuma chamada real de storage no arquivo — ver doc18, Caso 12: uso é apenas planejado em comentário, não implementado)

CLASSIFICAÇÃO_ATUAL:
MOCK_OR_FALLBACK

FUNCIONALIDADE:
comunicação interna entre membros do time (canais, mensagens, notificações) — contrato IChatProvider (chat.contract.ts) define o modelo completo (canais direct/group/project/artist/department/general, mensagens com anexos/menções/reações/threads, notificações), mas a implementação atual é 100% stub desabilitado

TELA/FLUXO:
rota /chat (segundo comentário do arquivo) — MAS busca de callers em todo apps/web/src não encontrou nenhum componente de página/UI consumindo useChatChannel/useChatChannels/useChatNotifications/useChatStatus além do próprio arquivo que os declara; ou seja, a feature parece não ter nenhuma tela ativa consumindo este hook no estado atual do código

ENTIDADE/DOMÍNIO:
ChatChannel / ChatMessage / ChatNotification (apps/web/src/shared/integrations/contracts/chat.contract.ts — IChatProvider)

OPERAÇÕES NECESSÁRIAS:
- CREATE (createChannel, sendMessage)
- READ (getChannel)
- UPDATE (editMessage, markChannelRead, markNotificationRead, addMember/removeMember)
- DELETE (deleteMessage, archiveChannel)
- LIST (listChannels, listMessages, listNotifications)
- OUTRO (subscribe — tempo real)

ENDPOINT_JÁ_EXISTENTE_NO_INVENTÁRIO:
NÃO

SE SIM:
N/A

SE NÃO:
NÃO IDENTIFICADO

DADOS_PERSISTIDOS:
nenhum atualmente — useChatChannel/useChatChannels/useChatNotifications retornam estruturas estáticas vazias e chamam disabledIntegration("MusicChat") para qualquer ação de escrita

MOTIVO_DO_STORAGE_LOCAL:
comentário do arquivo (linhas 5-14): "ESTADO ACTUAL: standalone — mensagens simuladas com MOCK_DATA em /chat. MIGRAÇÃO FUTURA: 1. Backend WebSocket... 2. Persistência em base de dados multi-tenant..." — o comentário descreve um plano de mock em localStorage que não está implementado; o código real está desabilitado, não mockado

SUBSTITUIÇÃO_FUTURA:
API_V2_REQUIRED

EVIDÊNCIA:
apps/web/src/modules/integrations/hooks/useChat.ts — useChatStatus()/useChatChannel()/useChatChannels()/useChatNotifications()

ATENÇÃO — ambiguidade de nome registrada, não resolvida como correspondência: existe um cluster de endpoints `/conversations`, `/conversations/:id/messages`, `/conversations/:id/notes`, `/conversations/:id/transfer`, `/conversations/:id/close`, `/conversations/:id/reopen` implementado em apps/web/src/modules/musicchat/services/conversations.service.ts — módulo com nome próximo ("musicchat"), mas a forma dos dados (transfer/close/reopen, típico de thread de atendimento/suporte) não corresponde ao modelo de canais/membros/reações de IChatProvider (chat.contract.ts) usado por useChat.ts. Sem comparar request/response bodies (fora do escopo desta etapa) não há evidência suficiente para declarar equivalência — por isso registrado NÃO, com esta ambiguidade destacada em vez de presumida.
```

## Caso 6

```text
CASO:
6

ARQUIVO:
apps/web/src/modules/monitoring/rights/services/catalog-lookup.ts

CHAVE_STORAGE:
N/A (nenhuma chamada real de storage no arquivo — ver doc18, Caso 13: getCatalogObras()/getCatalogArtistas() retornam array vazio hard-coded, apesar do comentário do arquivo)

CLASSIFICAÇÃO_ATUAL:
MOCK_OR_FALLBACK

FUNCIONALIDADE:
construir um índice ISRC → obra do catálogo musical do tenant, usado para enriquecer execuções de monitoramento de direitos (Rights Monitoring) com dados reais de catálogo (calcular taxa de match com ECAD e encontrar ISRCs órfãos)

TELA/FLUXO:
apps/web/src/modules/monitoring/rights/pages/RightsMonitoring.tsx (tela de Monitoramento de Direitos)

ENTIDADE/DOMÍNIO:
CatalogObra — id, titulo, compositor, compositores, editora, isrc, iswc, cod_ecad, cod_entidade, genero, status, duracao

OPERAÇÕES NECESSÁRIAS:
- READ
- LIST (getCatalogObras/getCatalogArtistas)

ENDPOINT_JÁ_EXISTENTE_NO_INVENTÁRIO:
SIM

SE SIM:
GET /works (dinâmico, via shared/lib/storage.ts + TABLE_ENDPOINT["obras"]="/works", doc05 linha 22-23)

SE NÃO:
N/A

DADOS_PERSISTIDOS:
nenhum atualmente — getCatalogObras()/getCatalogArtistas() são stubs que sempre retornam [] (array vazio hard-coded), apesar do comentário do arquivo dizer "Reads obras from MOCK_DATA (which itself reads localStorage and falls back to seed data)"

MOTIVO_DO_STORAGE_LOCAL:
comentário do arquivo (linha 3) descreve uma leitura de MOCK_DATA/localStorage que o código não implementa — divergência entre comentário e implementação já registrada no doc18 (Caso 13)

SUBSTITUIÇÃO_FUTURA:
API_V2_REQUIRED

EVIDÊNCIA:
apps/web/src/modules/monitoring/rights/services/catalog-lookup.ts — getCatalogObras()/getCatalogArtistas()/buildIsrcIndex()/computeEcadMatchRate()/findOrphanIsrcs()

NOTA: este é o único dos 6 casos com endpoint já existente no inventário — a entidade "obras" (mesmo nome usado no comentário do arquivo) já é servida por GET /works, usado em outros pontos do app via storage.ts. computeEcadMatchRate()/findOrphanIsrcs() hoje operam sempre sobre um índice vazio porque getCatalogObras() nunca chama esse endpoint.
```

---

## Resumo

```text
BACKEND_REQUIRED_USAGES_ANALYZED:
6

BUSINESS_DATA_CASES:
3

MOCK_OR_FALLBACK_CASES:
2

CASES_WITH_EXISTING_HTTP_ENDPOINT:
1

CASES_WITHOUT_EXISTING_HTTP_ENDPOINT:
5

CRUD_CASES:
3

NON_CRUD_CASES:
3

UNRESOLVED_CASES:
0
```

`BUSINESS_DATA_CASES` (3) + `MOCK_OR_FALLBACK_CASES` (2) = 5, não 6 — o Caso 3 (`useNfe.ts`) foi registrado no doc18 como `INTEGRATION_STATE`, uma terceira classificação ("outra", conforme o template desta etapa permite), não somada em nenhum dos dois contadores pedidos no resumo. `CRUD_CASES` (3: Casos 2, 3, 5 — expõem create+read+update+delete) vs `NON_CRUD_CASES` (3: Casos 1, 4, 6 — expõem apenas leitura/listagem ou substituição em bloco, sem create/delete granular).

## Cobertura

6/6 casos `BACKEND_REQUIRED: SIM` do doc18 analisados. Cada `SIM`/`NÃO` de `ENDPOINT_JÁ_EXISTENTE_NO_INVENTÁRIO` foi verificado contra as 250 linhas de endpoints únicos do doc05 (não apenas contra nomes parecidos — o Caso 1 exigiu comparar campos para descartar um falso positivo com `/financial-categories/rules`, que existe mas é um domínio diferente). Nenhum endpoint foi proposto ou inventado. `apps/api` não foi consultado.
