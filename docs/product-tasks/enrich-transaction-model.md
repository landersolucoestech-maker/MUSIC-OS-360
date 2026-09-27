# Enriquecer Modelo de Transação — Campos Financeiros Completos

## What & Why
A tabela `transacoes` actual tem apenas `valor` (um único número), sem distinção entre valor bruto, descontos, impostos e valor líquido. Também não tem moeda, vencimento separado de pagamento, nem campos para recorrência. Isso impede cálculos financeiros correctos como gross-to-net, apuração de impostos por transação, e controlo de recorrências contratuais. Esta task enriquece o modelo sem quebrar dados existentes (todos os campos novos são nullable).

## Done looks like
- Mock data `transacoes` recebe os novos campos opcionais: `valor_bruto`, `desconto`, `impostos_valor`, `valor_liquido`, `moeda` (default `BRL`), `data_vencimento`, `data_pagamento`, `numero_documento`, `recorrente` (boolean), `recorrencia_tipo` (`mensal`/`trimestral`/`anual`), `recorrencia_fim`
- Formulário de transação exibe novos campos na secção "Pagamento": Valor Bruto, Desconto (%), Impostos (valor), e calcula automaticamente o Valor Líquido = Bruto – Desconto – Impostos
- Campo "Data de Vencimento" aparece no formulário (era apenas Data da Transação antes)
- Toggle "Transação Recorrente" abre campos de frequência e data de fim
- Tabela de transações na página `/accounting` mostra coluna "Valor Líquido" em vez de "Valor" quando existe distinção; indicador visual para transações recorrentes
- Todos os dados históricos do localStorage continuam a funcionar (campos novos têm fallback para `valor` se `valor_liquido` não existir)
- Backend entity `TransactionEntity` atualizado com os novos campos tipados

## Out of scope
- Geração automática de transações recorrentes (cron job — futura task)
- Moedas estrangeiras com câmbio automático (apenas BRL na fase actual)
- Integração bancária OFX com reconciliação de `data_pagamento` (futura task)

## Steps
1. **Mock data** — adicionar campos novos a todas as transações seed em `buildSeedData()`; patch em `patchMockData()` que preenche `valor_liquido = valor` para transações sem o campo
2. **Tipos TypeScript** — atualizar `Transacao` em `accounting.types.ts` com os novos campos opcionais
3. **Formulário — secção de valores** — criar sub-secção "Decomposição do Valor" na `PaymentSection` com Valor Bruto, Desconto %, Impostos, e Valor Líquido calculado reactivamente; o campo existente `valor` passa a ser alias de `valor_liquido` para compatibilidade
4. **Formulário — recorrência** — adicionar toggle "Recorrente" que abre selects de frequência e data de fim; estes dados são guardados mas não geram transações automaticamente ainda
5. **Tabela de transações** — mostrar `valor_liquido` (ou fallback para `valor`) na coluna de valor; adicionar ícone de recorrência; adicionar coluna "Vencimento" opcionalmente visível
6. **Backend entity** — atualizar `TransactionEntity` com todos os novos campos `@Column({ nullable: true })`; atualizar `transacao.validator.ts` para aceitar os novos campos opcionais

## Relevant files
- `apps/web/src/modules/accounting/types/accounting.types.ts`
- `apps/web/src/modules/accounting/components/transacao-form/sections/PaymentSection.tsx`
- `apps/web/src/modules/accounting/pages/Financeiro.tsx`
- `apps/web/src/shared/data/mockData.ts`
- `apps/api/src/modules/transactions/entities/transaction.entity.ts`
- `apps/api/src/modules/transactions/validators/transacao.validator.ts`
