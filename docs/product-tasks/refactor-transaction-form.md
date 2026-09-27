# Refactor TransacaoFormModal — Arquitectura Enterprise

## What & Why

O `TransacaoFormModal.tsx` é um monólito de 1 069 linhas com lógica financeira crítica, validações, regras de negócio e 5 `useEffect` de reset encadeados, todos enterrados no componente React. O resultado é difícil de manter, alto risco de estados inconsistentes e praticamente impossível de escalar com novas regras financeiras.

O objectivo é reorganizar esse módulo numa arquitectura modular e previsível **sem alterar nenhuma regra de negócio nem o comportamento visual/funcional do formulário**.

## Done looks like

- `TransacaoFormModal.tsx` na localização actual torna-se um wrapper de re-export (<10 linhas) — os 5+ pontos de importação existentes não quebram.
- Nova pasta `transacao-form/` com a estrutura completa descrita abaixo.
- **Zero** `useEffect` de reset encadeados — substituídos por `updateField` + `applyResets` controlados via `RESET_MAP`.
- Regras de exibição/obrigatoriedade residem em `financial-form-rules.ts` como mapa configurável (`DISPLAY_RULES`), não como dezenas de booleans no componente.
- Validação completamente extraída para `financial-form-validation.ts` + `useFinancialValidation.ts`.
- Componente principal (`transacao-form/TransacaoFormModal.tsx`) ≤ 150 linhas — apenas orquestra sections.
- TypeScript estrito: sem `any`, tipagem forte para regras, validação e estado derivado.
- Formulário abre, preenche, valida, submete e reseta exactamente como antes em mock mode.

## Out of scope

- Alteração de regras de negócio financeiro existentes.
- Integração com API real (ainda mock mode).
- Refactor de `NotaFiscalFormModal.tsx` ou outros componentes do módulo.
- Alteração de componentes partilhados (`shared/ui`, `shared/components`).
- Novas funcionalidades de "Regras Financeiras" dinâmicas — apenas preparar a arquitectura.

## Steps

1. **Criar a pasta e o esqueleto de ficheiros** — criar `transacao-form/` dentro de `components/` com todos os ficheiros vazios conforme a estrutura final; transformar o `TransacaoFormModal.tsx` existente num re-export barrel imediato para que os imports actuais não quebrem enquanto o trabalho decorre.

2. **Extrair `financial-form-rules.ts`** — mover todos os booleans de condição (exibirArtista, exibirProjeto, projetoObrigatorio, exibirEvento, exibirFornecedor, exibirOrgaoArrecadador, exibirMotivoViagem, exibirNomePublicidade, exibirParcelamento) para um `DISPLAY_RULES` map puro, tipado em TypeScript, derivado apenas dos valores do formulário. Nenhuma lógica de React aqui.

3. **Extrair `financial-reset-rules.ts`** — implementar o `RESET_MAP` que descreve quais campos dependentes devem ser limpos quando um campo pai muda (ex: `tipoTransacao` → reseta categoria, subcategoria, artistaVinculado…). Criar `applyResets(field, map, currentData): Partial<TransacaoFormData>`.

4. **Criar `useTransacaoForm.ts`** — encapsula todo o estado do formulário (`formData`, `errors`, `isSubmitting`), expõe `updateField` (chama `applyResets` internamente), `handleSubmit`, `handleFileUpload`, `handleRemoveAnexo` e `initialize(transacao, open)`. Elimina todos os `useEffect` de reset encadeados; mantém apenas um único `useEffect` de inicialização.

5. **Criar `useFinancialRules.ts`** — recebe `formData` e retorna o objecto de regras derivadas (resultado de `DISPLAY_RULES`). Usa `useMemo` para derivação eficiente. Expõe também `categorias`, `subcategorias`, `itensInvestimento`, `projetosFiltrados`, `eventosFiltrados`, `valorParcela` e `labelTipoCliente`.

6. **Criar `financial-form-validation.ts` + `useFinancialValidation.ts`** — extrair a função `validate` para validação pura (sem React), que recebe `formData + rules` e devolve `ValidationResult`. O hook envolve essa função e expõe `validate()` e `clearFieldError(field)`.

7. **Criar os 3 field components reutilizáveis** — `FormSelectField.tsx`, `FormInputField.tsx`, `FormDateField.tsx` como wrappers finos sobre os primitivos `shadcn` existentes, com suporte a `error`, `disabled`, `label`, `required`. Sem lógica de negócio.

8. **Criar as 5 sections** — `TransactionTypeSection.tsx`, `CategorySection.tsx`, `FinancialLinksSection.tsx`, `PaymentSection.tsx`, `DetailsSection.tsx`. Cada section recebe `formData`, `rules`, handlers e `errors` por props. Nenhuma section contém lógica derivada — apenas renderização com os field components.

9. **Montar o `transacao-form/TransacaoFormModal.tsx` final** — componente ≤ 150 linhas que compõe os hooks + sections. Mantém as props originais (`open`, `onOpenChange`, `transacao`, `mode`). Eliminar o JSX duplicado do `itemInvestimento` que existe nas linhas 593-650 do original.

10. **Remover `any` e reforçar tipagem** — a prop `transacao?: any` passa a `transacao?: Record<string, unknown>`. Todos os tipos de regras, validação e estado derivado tipados explicitamente.

11. **Verificar TypeScript e comportamento** — correr `npx tsc --noEmit` no workspace, confirmar zero erros. Testar manualmente os fluxos: receita musical com projecto, despesa viagem com artista, imposto com órgão arrecadador, parcelamento, modo view.

## Relevant files

- `apps/web/src/modules/accounting/components/TransacaoFormModal.tsx`
- `apps/web/src/modules/accounting/constants/transacao-constants.ts`
- `apps/web/src/modules/accounting/services/entity-to-form.mapper.ts`
- `apps/web/src/modules/accounting/services/form-to-payload.mapper.ts`
- `apps/web/src/modules/accounting/mappers/index.ts`
- `apps/web/src/shared/components/FormField.tsx`
- `apps/web/src/shared/ui/date-picker-field.tsx`
