# Categorias e Subcategorias Dinâmicas

## What & Why
O sistema financeiro tem ~200 linhas de categorias/subcategorias hardcoded em `transacao-constants.ts` e replicadas no backend validator. Qualquer nova categoria exige edição de código em 4+ ficheiros. Esta task cria o alicerce: categorias e subcategorias tornam-se dados configuráveis, não código.

## Done looks like
- Tabela `transaction_categories` e `transaction_subcategories` no mock data com todas as categorias actuais migradas
- Página `/accounting/rules` (já existente) expande-se com duas tabs novas: "Categorias" e "Subcategorias", cada uma com CRUD completo (criar, editar, desactivar, ordenar)
- Cada categoria tem: nome, tipo de transação aplicável, cor, ícone, ordem, ativo
- Cada subcategoria tem: nome, categoria pai, campos que exige (artista, projeto, evento), ativo
- O formulário de transação passa a ler categorias/subcategorias do storage em vez de arrays estáticos
- Os arrays hardcoded em `transacao-constants.ts` são mantidos como fallback de seed apenas, com um comentário de deprecação
- Backend validator aceita qualquer string para categoria/subcategoria (validação passa a ser "não vazio" em vez de enum fechado)

## Out of scope
- Regras de visibilidade dinâmicas (a lógica de DISPLAY_RULES continua no código por ora — task separada)
- Migração de dados históricos no localStorage (patch no patchMockData garante seed)
- Contas financeiras e centros de custo (tasks separadas)

## Steps
1. **Adicionar tabelas ao mock data** — criar `transaction_categories` e `transaction_subcategories` em `buildSeedData()` + patch em `patchMockData()` com todas as categorias actuais migradas para linhas de dados
2. **Service methods** — adicionar `listCategories`, `createCategory`, `updateCategory`, `listSubcategories`, `createSubcategory`, `updateSubcategory` ao `accounting.service.ts`
3. **Hook de categorias** — criar `useTransactionCategories.ts` com React Query para leitura e mutações; usar no formulário de transação em vez dos arrays estáticos
4. **CRUD de categorias na página Rules** — adicionar tab "Categorias" à página `/accounting/rules` com tabela + modal criar/editar (nome, tipo, cor, ícone, ordem, ativo)
5. **CRUD de subcategorias na página Rules** — adicionar tab "Subcategorias" com tabela + modal (nome, categoria pai, campos exigidos, ativo); mostrar apenas subcategorias da categoria seleccionada
6. **Formulário de transação data-driven** — substituir os arrays estáticos nos selects de categoria e subcategoria por dados vindos do hook; manter o comportamento visual idêntico

## Relevant files
- `apps/web/src/modules/accounting/constants/transacao-constants.ts`
- `apps/web/src/modules/accounting/pages/TransacaoRules.tsx`
- `apps/web/src/modules/accounting/services/accounting.service.ts`
- `apps/web/src/modules/accounting/components/transacao-form/sections/CategorySection.tsx`
- `apps/web/src/shared/data/mockData.ts`
- `apps/api/src/modules/transactions/validators/transacao.validator.ts`
