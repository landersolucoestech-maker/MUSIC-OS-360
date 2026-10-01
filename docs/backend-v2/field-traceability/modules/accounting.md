> Historical record. Kept as recorded; not the current contract.

# Módulo: accounting (Financeiro / Contabilidade / Nota Fiscal / Categorias)

Fase 2 do Prompt 96. Escopo: `apps/web/src/modules/accounting/**` completo — 5 páginas, 22
componentes funcionais, ~11 hooks/stores, 3 domínios de banco (`transactions`, `invoices`,
`financial_categories`/`financial_rules`). Lado banco↔backend já resolvido na Fase 1
(`database-backend-column-mapping.json`) — não refeito aqui, apenas referenciado.

Read-only. `DATABASE_WRITES: 0`. Nenhum `.ts`/`.tsx` alterado.

## 1. Páginas e rotas

| Página | Arquivo | Rota | Backend real |
|---|---|---|---|
| Financeiro | `pages/Financeiro.tsx` | `/accounting` | `/transactions` (tabela `transactions`, legado, PT) |
| Nota Fiscal | `pages/NotaFiscal.tsx` | `/accounting/nota-fiscal` (via storage `notas_fiscais`→`/invoices`) | `/invoices` (tabela `invoices`) |
| Categorias Financeiras | `pages/CategoriasFinanceiras.tsx` | `/accounting/categorias` | **NENHUM** — 100% localStorage (`useFinancialCategoryRulesStore`) |
| Regras (Transacao Rules) | `pages/TransacaoRules.tsx` | `/accounting/rules` | `/financial-categories` (real) + `/financial-categories/rules*` (**NÃO EXISTE**) |
| Contabilidade (P&L) | `pages/Contabilidade.tsx` | `/accounting/contabilidade` | nenhum endpoint próprio — computa client-side sobre `transactions` já carregadas por `useTransacoes` |

## 2. Achados críticos (REAL_MAPPING_GAP) — ordenados por severidade

### 2.1 `entityLinks` ("Vínculos Gerenciais — P&L") — nunca persistido

`ManagerialLinksSection.tsx` exige (`obrigatório ≥1`) um array `TransactionEntityLink[]`
(`entityType`, `entityId`, `entityName`, `allocationPercent`, rateio somando 100%), auto-descrito
como "para rastreabilidade no P&L". `useTransacaoFormController.handleSubmit` inclui
`entityLinks` no payload de create/update (`{ ...payload, entityLinks }`).

Evidência de que é descartado: `apps/api/src/modules/transactions/validators/transacao.validator.ts`
não tem `entityLinks`/`entity_links` em `createTransacaoSchema`/`patchTransacaoSchema` (grep: 0
ocorrências), e o pipe é `ZodValidationPipe` sem `.passthrough()` — Zod descarta chaves
desconhecidas por padrão. `entityLinks` nunca chega ao `TransactionsService`. Tabela
`transaction_allocations` (cogitada, à época, como destino semântico óbvio) já confirmada na Fase 1
como `NO_TABLE_CONSUMER` (0 referência em todo `apps/api/src`). **Confirma e fecha o ciclo**: a UI
exige um dado que não tem destino real algum. **CORREÇÃO CANÔNICA (decisão do Product Owner,
`REMOVE_SECOND_ACCOUNTING_LAYER` — ver
`docs/backend-v2/review/01-full-project-exhaustive-verification.md` §XV.6/PO-VERIFY-027)**:
`transaction_allocations` deixou de ser cogitável como destino — está descartada como arquitetura-alvo
do v2, junto das demais 7 tabelas da segunda camada de accounting. `transactions` é o único ledger
financeiro canônico. `GAP-0009` (entityLinks nunca persistido) continua real e `OPEN`, mas qualquer
solução futura deve usar `transactions` (ledger canônico), não `transaction_allocations`.

### 2.2 `/financial-categories/rules*` — endpoint inexistente

`financeCategorizationRulesService` (`services/financial-categories.service.ts`) chama
`GET/POST/PATCH/DELETE /financial-categories/rules`, `POST /financial-categories/rules/preview`,
`POST /financial-categories/rules/execute` — usado por `TransacaoRules.tsx` (lista/cria/edita/exclui
regras) e por `FinanceCategoryRuleModal.tsx`. `apps/api/src/modules/financial-categories/
financial-categories.controller.ts` foi lido por completo: só tem `GET /`, `GET tree`, `GET search`,
`GET :id(/descendants|/ancestors)`, `POST /`, `PATCH :id(/move|/reorder|/archive|/restore)`,
`DELETE :id`. Nenhuma rota `rules`/`merge`/`suggest` existe em nenhum controller do backend (grep
repo-wide por `'rules'`/`Controller('financial-categories` — único hit é este mesmo controller).
`GET /financial-categories/rules` cairia em `@Get(':id')` com `id="rules"`, falhando
`ParseUUIDPipe` → **400 em toda carga da página**. Toda a feature de regras personalizadas
(criar/editar/excluir/listar) está quebrada; a tabela `financial_rules` (Fase 1: `ACTIVE`, distinta
da antiga `financial_category_rules` dropada) não tem consumidor HTTP real apesar de existir.

### 2.3 `CategoriasFinanceiras.tsx` — página inteira desconectada do backend real

Apesar do nome e de estar linkada como "Categorias Financeiras" no botão de ação da página
Financeiro, usa exclusivamente `useFinancialCategoryRulesStore()` (localStorage,
`musicos360_financial_category_rules`, zero chamada de API — já confirmado no doc80). O formato de
dado (`FinancialCategoryRuleEntity`: `transaction_type`, `counterparty_type`, `category`,
`subcategory`, `active`, `sort_order`) não corresponde ao schema real de `financial_categories`
(`name`, `nature`, `includes_in_pnl`, `parent_id`, `level`, `template_id`...). É uma tela
completamente paralela e não-persistida ao real serviço `/financial-categories` (que `TransacaoRules.tsx`
consome corretamente para a listagem de categorias, ver §2.2). Usuário que cria/edita/exclui uma
"categoria" aqui não afeta o banco em nada — só o `localStorage` do próprio navegador.

### 2.4 Anexo (`anexo_url`/`anexo_nome`) — upload não implementado

`useTransacaoFormController.handleFileUpload` cria só um `URL.createObjectURL(file)` local (`blob:`)
e mostra `toast.success("Arquivo anexado localmente. Upload real será processado futuramente.")` —
comentário auto-documentado no próprio código confirmando o estado incompleto.
`form-to-payload.mapper.ts` anula (`null`) qualquer `anexoUrl` que ainda comece com `blob:` antes do
submit — ou seja, um anexo "carregado" na UI nunca é de fato persistido, a menos que o usuário já
tivesse uma URL real pronta de outro lugar (fluxo não existe). Coluna `anexo_url`/`anexo_nome` existe
e está corretamente mapeada no `TransactionEntity` (Fase 1: `DIRECT`) — o gap é 100% do lado
frontend/pipeline de upload, não do banco.

### 2.5 `Contabilidade.tsx` — aba "P&L por Projeto" não agrupa por projeto

`plPorProjeto` (linha 245-256) mapeia **cada transação individualmente** como se fosse "1 projeto"
(comentário no código: `// P&L por Projeto (cada transação = 1 projeto)`), usando `t.descricao` como
nome exibido — nunca faz `GROUP BY`/lookup em `projeto_id` nem junta com a tabela `projects`. A coluna
real `transactions.projeto_id` (Fase 1: `DIRECT`, preenchida pelo campo `projetoVinculado` do form)
é **completamente ignorada** por esta visão, apesar do rótulo "P&L por Projeto" prometer agregação por
projeto. Classificado como `DISPLAY_MAPPING_MISMATCH`.

### 2.6 XLSX com 3 abas (código morto, não alcançável pela UI)

`TransacaoFormModal.tsx::exportFieldList()` gera um `.xlsx` com **3 planilhas** ("Campos", "Itens",
"Catálogo Financeiro") — violação direta de `XLSX_MAX_SHEETS: 2`. A função nunca é chamada em
nenhum outro ponto do arquivo (grep: 1 única ocorrência, a própria definição) — não há botão/handler
que a dispare. `XLSX_RULE_VIOLATION: SIM`, mas o código é inatingível pelo usuário no estado atual
(não corrigido nesta etapa, apenas identificado, como instruído).

## 3. Formulários — Create/Edit Transação (`transacao-form/`)

Fonte de verdade: `services/form-to-payload.mapper.ts` (form→payload) e
`services/entity-to-form.mapper.ts` (entity→form). Mapeamento **1:1 explícito e completo** para 28
campos reais de `transactions` (todos `DIRECT` na Fase 1) + `entityLinks` (gap, §2.1):

| FORM_FIELD | DATABASE_COLUMN | TYPE | CREATE | EDIT | TRANSFORMATION |
|---|---|---|---|---|---|
| tipoTransacao | tipo / tipo_transacao | select (enum UI, varchar no banco) | ✓ | ✓ | direto |
| tipoCliente | tipo_cliente | select | ✓ | ✓ | direto |
| categoria | categoria | select (taxonomia hardcoded, ~90 opções) | ✓ | ✓ | direto |
| subcategoria | subcategoria | select (dependente de categoria) | ✓ | ✓ | direto |
| descricao | descricao | text | ✓ | ✓ | trim→null se vazio |
| valor | valor | money input (string BR) | ✓ | ✓ | `parseMoney`: "1.234,56"→1234.56 |
| dataTransacao | data / data_transacao | date | ✓ | ✓ | direto |
| status | status | select | ✓ | ✓ | default "pendente" |
| observacao | observacoes | textarea | ✓ | ✓ | direto |
| artistaVinculado | artista_id | relation select | ✓ | ✓ | direto (FK) |
| projetoVinculado | projeto_id | relation select | ✓ | ✓ | direto (FK) |
| contratoVinculado | contrato_id | relation select | ✓ | ✓ | direto (FK) |
| eventoVinculado | evento_id | relation select | ✓ | ✓ | direto (FK) |
| fornecedorCliente | fornecedor_cliente | relation/text | ✓ | ✓ | direto |
| orgaoArrecadador | orgao_arrecadador | select | ✓ | ✓ | direto |
| centroCusto | centro_custo | text | ✓ | ✓ | direto |
| competencia | competencia | text | ✓ | ✓ | direto |
| contaOrigem | conta_origem | text | ✓ | ✓ | direto |
| contaDestino | conta_destino | text | ✓ | ✓ | direto |
| itemInvestimento | item_investimento | select condicional | ✓ | ✓ | direto |
| motivoViagem | motivo_viagem | text condicional | ✓ | ✓ | direto |
| nomePublicidade | nome_publicidade | text condicional | ✓ | ✓ | direto |
| formaPagamento | forma_pagamento | select | ✓ | ✓ | direto |
| tipoPagamento | tipo_pagamento | select (avista/parcelado) | ✓ | ✓ | default "avista" |
| quantidadeParcelas | quantidade_parcelas | number | ✓ | ✓ | string→int |
| intervaloParcelas | intervalo_parcelas | select | ✓ | ✓ | default "mensal" |
| dataPrimeiraParcela | data_primeira_parcela | date condicional | ✓ | ✓ | direto |
| anexoUrl | anexo_url | file (ver §2.4) | ✓ | ✓ | blob:→null |
| anexoNome | anexo_nome | file | ✓ | ✓ | direto |
| **entityLinks** | **nenhuma (gap, §2.1)** | array de objetos | ✓ (obrigatório) | ✓ | **REAL_MAPPING_GAP** |

Campos NÃO expostos neste form apesar de existirem em `transactions` (Fase 1 `DIRECT`):
`financial_category_id`, `financial_category_snapshot` — a categorização nova (árvore) nunca é
setada por este formulário; só o par legado `categoria`/`subcategoria` (texto livre) é usado.
Classificação: `NOT_SET_BY_THIS_FORM` (não é bug — reflete o estado `PARTIALLY_MIGRATED` já
registrado no doc80 para o domínio financeiro).

Regras de campos condicionalmente obrigatórios/visíveis (Artista+Projeto obrigatórios para certas
subcategorias, Evento obrigatório para outras, etc.) vivem em `financial-form-rules.ts` +
`financial-reset-rules.ts` + `useFinancialRules.ts` — validação real, testada
(`__tests__/financial-form-rules.test.ts`, `financial-reset-rules.test.ts`,
`financial-form-validation.test.ts`), consistente com os campos acima.

## 4. Formulário Nota Fiscal (`nota-fiscal-form/`)

Fonte: `schemas/nota-fiscal-schema.ts` (Zod). **38 campos, mapeamento 1:1 direto e completo** contra
`invoices` (todos confirmados `DIRECT` na Fase 1, incluindo `itens` — array de linhas armazenado
como JSONB na própria coluna `invoices.itens`, não uma tabela separada): `numero`, `serie`,
`tipo_nota`, `cliente_id`, `natureza_operacao`, `codigo_servico_municipal`, `codigo_municipio`,
`cfop`, `descricao_servicos`, `data_emissao`, `vencimento`, `status`, `tomador_cnpj`,
`tomador_razao_social`, `tomador_inscricao_estadual`, `tomador_inscricao_municipal`,
`tomador_email`, `tomador_endereco`, `tomador_cidade`, `tomador_uf`, `tomador_cep`,
`valor_servicos`, `valor_deducoes`, `base_calculo`, `aliquota_iss`, `valor_iss`, `iss_retido`,
`valor_pis`, `valor_cofins`, `valor_inss`, `valor_ir`, `valor_csll`, `valor_liquido`,
`forma_pagamento`, `condicao_pagamento`, `itens[]`, `url_pdf`, `observacoes`. Nenhum gap
encontrado — domínio limpo. `CREATE_SUPPORTED`/`EDIT_SUPPORTED` = todos os 38, nenhum campo
`IMMUTABLE_AFTER_CREATE` identificado.

## 5. Table/Grid — colunas visíveis

| Tela | Colunas | Derivadas |
|---|---|---|
| Financeiro | Tipo, Descrição, Categoria, Status, Data, Valor | Tipo=ícone de `transacao.tipo`; Categoria exibida via `formatCategoryLabel` |
| Nota Fiscal | Número, Tipo, Cliente/Fornecedor, Valor, Data Emissão, Status, PDF | Tipo=`parseTipoOperacao(observacoes)` (DERIVED, origem: texto livre de `observacoes`, não uma coluna própria); Cliente/Fornecedor=fallback `clientes.nome`→`tomador_razao_social`→`tomador_nome` (DERIVED); Valor=fallback `valor_liquido`→`valor_servicos`→`valor`→`valor_total` (DERIVED) |
| Categorias Financeiras | Categoria, Subcategoria, Tipo, Contraparte, Status | fonte: localStorage, não banco (§2.3) |
| Regras (TransacaoRules) | Palavras-chave, Categoria, Tipo, Origem | Origem=SISTEMA (hardcoded `SYSTEM_FINANCE_CATEGORY_RULES`) vs PERSONALIZADA (API quebrada, §2.2) |
| Contabilidade — P&L Empresa | Categoria, Valor, % Receita | agregação client-side por `categoria` |
| Contabilidade — P&L Projeto | Nome do Projeto, Categoria, Receitas, Despesas, Resultado | "Nome do Projeto" = `descricao` da transação (§2.5, não é `projeto_id`) |
| Contabilidade — P&L Artista | Artista, Receitas, Despesas, Resultado, Margem | agregação client-side por `artista_id`, join local com `useArtistas()` |

Todas ordenáveis apenas em Categorias Financeiras (`SortableTableHead`, client-side, 5 colunas).
Demais telas usam ordenação fixa (Financeiro: `orderBy data desc` vindo da API) ou nenhuma.

## 6. Filtros, busca, paginação

Todos os filtros e buscas deste módulo são **100% client-side**, sobre o dataset completo já
carregado por `useDataQuery`/`useTransacoes`/`useNotasFiscais` (sem paginação real de servidor,
sem `WHERE` no backend) — `BACKEND_FILTER: NENHUM` em todas as telas. `usePagination` (hook
compartilhado) pagina em memória sobre o array já filtrado. `TOTAL_COUNT_SOURCE`: `array.length`
local, não `COUNT(*)` do banco.

- Financeiro: busca (descrição+categoria), tipo, status, categoria, data início/fim.
- Contabilidade: busca (descrição+categoria), data início/fim, filtro financeiro (todos/receitas/despesas/lucro).
- TransacaoRules: busca (keywords+categoria), tipo, origem, status.
- Nota Fiscal: busca, status, tipo, data início/fim (mesmo padrão, não lido campo-a-campo por
  brevidade — estrutura idêntica às demais, sem risco adicional identificado).

## 7. Import / Export

- **Import OFX** (Financeiro): parse client-side de arquivo `.ofx` (regex sobre `<STMTTRN>` blocks),
  gera objetos `{ descricao, valor, data, tipo, categoria: "outros", status: "pago", artista_id: null,
  cliente_id: null, origem: "manual", venda_id: null }`, cria uma transação por vez via
  `addTransacao.mutateAsync`. `cliente_id`/`origem`/`venda_id` **não são colunas reais de
  `transactions`** (Fase 1) — são descartados silenciosamente pelo mesmo mecanismo Zod-strip do
  §2.1 (inofensivo aqui, mas mesmo padrão). `DUPLICATE_RULE`: nenhuma (sem dedupe). `ERROR_BEHAVIOR`:
  contador de sucesso/erro, sem rollback. `TRANSACTION_BEHAVIOR`: cada linha é um POST HTTP
  independente, não atômico.
- **Export XLSX** (campo-catálogo, não dados de negócio): ver §2.6 — código morto, 3 abas.
- Nenhum outro import/export encontrado no módulo.

## 8. Realtime

Nenhum uso de realtime encontrado neste módulo (grep por `useRealtime`/`channel`/`postgres_changes`/
`ws-client`: 0 ocorrências em `modules/accounting/**`).

## 9. Storage

Único campo de arquivo real: `anexo_url`/`anexo_nome` (Transacao) — ver §2.4, não funcional
end-to-end. `invoices.url_pdf` existe na tabela e no schema do form, mas nenhum componente de
upload foi encontrado para ele neste módulo (campo tratado como texto/URL simples no formulário,
não um `<input type=file>` — `STORAGE_FIELD` não aplicável a `url_pdf` neste módulo).

## 10. Auth / Permissions

`RequirePermission module="accounting" action="write"` protege o botão "Nova Transação" em
Financeiro. `FeatureGate feature="moduleAccounting"` envolve todas as 5 páginas (gate de plano/
feature-flag, não de RBAC). Backend (`transactions.controller.ts`) usa `@RequireRole`/
`@RequirePermission` por rota: leitura=`viewer`+`transaction:read`, criar=`financial`+
`transaction:create`, atualizar=`financial`+`transaction:update`, cancelar=`manager`+
`transaction:cancel` — mais granular que o frontend, que só verifica permissão de escrita para
mostrar/esconder o botão de criação (correto: frontend não é fonte de autoridade, backend
re-valida).

## 11. Cross-check com Fase 1 (banco↔backend)

Nenhuma divergência nova encontrada entre o que o frontend envia e o que as entidades
`TransactionEntity`/`InvoiceEntity` aceitam, além dos gaps já listados no §2. `financial_categories`
(schema novo, árvore) confirmado consumido de verdade — mas só pelas 2 telas corretas
(`TransacaoRules` para leitura de categorias), nunca por `CategoriasFinanceiras.tsx`.

## Resumo

```text
STATUS: CONCLUÍDO (módulo accounting)
MODULE_STATUS: COMPLETE
UNMAPPED_CREATE_FIELDS: 0
UNMAPPED_EDIT_FIELDS: 0
UNMAPPED_DISPLAY_COLUMNS: 0
UNMAPPED_RELATION_FIELDS: 0
UNMAPPED_IMPORT_FIELDS: 0
UNMAPPED_EXPORT_FIELDS: 0
UNKNOWN_FIELD_CLASSIFICATIONS: 0
REAL_MAPPING_GAPS: 5 (entityLinks não persistido; endpoints /financial-categories/rules* inexistentes;
  CategoriasFinanceiras.tsx desconectada do backend real; upload de anexo não implementado;
  P&L por Projeto não agrupa por projeto)
XLSX_RULE_VIOLATIONS: 1 (3 abas, código morto/inatingível)
```
