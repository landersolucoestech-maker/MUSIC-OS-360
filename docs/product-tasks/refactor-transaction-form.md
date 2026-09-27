# Refactor TransacaoFormModal — Enterprise Architecture

## What & Why

`TransacaoFormModal.tsx` is a 1,069-line monolith with critical financial logic, validations, business rules and 5 chained reset `useEffect`s, all buried in the React component. The result is hard to maintain, carries a high risk of inconsistent states and is practically impossible to scale with new financial rules.

The goal is to reorganize this module into a modular, predictable architecture **without changing any business rule or the visual/functional behavior of the form**.

## Done looks like

- `TransacaoFormModal.tsx` in its current location becomes a re-export wrapper (<10 lines) — the 5+ existing import points do not break.
- New `transacao-form/` folder with the complete structure described below.
- **Zero** chained reset `useEffect`s — replaced by `updateField` + `applyResets` controlled via `RESET_MAP`.
- Display/required rules live in `financial-form-rules.ts` as a configurable map (`DISPLAY_RULES`), not as dozens of booleans in the component.
- Validation fully extracted into `financial-form-validation.ts` + `useFinancialValidation.ts`.
- Main component (`transacao-form/TransacaoFormModal.tsx`) ≤ 150 lines — it only orchestrates sections.
- Strict TypeScript: no `any`, strong typing for rules, validation and derived state.
- The form opens, fills in, validates, submits and resets exactly as before in mock mode.

## Out of scope

- Changing existing financial business rules.
- Integration with the real API (still mock mode).
- Refactoring `NotaFiscalFormModal.tsx` or other components of the module.
- Changing shared components (`shared/ui`, `shared/components`).
- New dynamic "Regras Financeiras" (Financial Rules) features — only prepare the architecture.

## Steps

1. **Create the folder and the file skeleton** — create `transacao-form/` inside `components/` with all the files empty according to the final structure; turn the existing `TransacaoFormModal.tsx` into an immediate re-export barrel so that the current imports do not break while the work is in progress.

2. **Extract `financial-form-rules.ts`** — move all the condition booleans (exibirArtista, exibirProjeto, projetoObrigatorio, exibirEvento, exibirFornecedor, exibirOrgaoArrecadador, exibirMotivoViagem, exibirNomePublicidade, exibirParcelamento) into a pure `DISPLAY_RULES` map, typed in TypeScript, derived only from the form values. No React logic here.

3. **Extract `financial-reset-rules.ts`** — implement the `RESET_MAP` that describes which dependent fields must be cleared when a parent field changes (e.g. `tipoTransacao` → resets category, subcategory, artistaVinculado…). Create `applyResets(field, map, currentData): Partial<TransacaoFormData>`.

4. **Create `useTransacaoForm.ts`** — encapsulates all the form state (`formData`, `errors`, `isSubmitting`), exposes `updateField` (calls `applyResets` internally), `handleSubmit`, `handleFileUpload`, `handleRemoveAnexo` and `initialize(transacao, open)`. Eliminates all the chained reset `useEffect`s; keeps only a single initialization `useEffect`.

5. **Create `useFinancialRules.ts`** — receives `formData` and returns the derived rules object (the result of `DISPLAY_RULES`). Uses `useMemo` for efficient derivation. Also exposes `categorias`, `subcategorias`, `itensInvestimento`, `projetosFiltrados`, `eventosFiltrados`, `valorParcela` and `labelTipoCliente`.

6. **Create `financial-form-validation.ts` + `useFinancialValidation.ts`** — extract the `validate` function into pure validation (no React), which receives `formData + rules` and returns a `ValidationResult`. The hook wraps that function and exposes `validate()` and `clearFieldError(field)`.

7. **Create the 3 reusable field components** — `FormSelectField.tsx`, `FormInputField.tsx`, `FormDateField.tsx` as thin wrappers over the existing `shadcn` primitives, with support for `error`, `disabled`, `label`, `required`. No business logic.

8. **Create the 5 sections** — `TransactionTypeSection.tsx`, `CategorySection.tsx`, `FinancialLinksSection.tsx`, `PaymentSection.tsx`, `DetailsSection.tsx`. Each section receives `formData`, `rules`, handlers and `errors` via props. No section contains derived logic — only rendering with the field components.

9. **Assemble the final `transacao-form/TransacaoFormModal.tsx`** — a component of ≤ 150 lines that composes the hooks + sections. Keeps the original props (`open`, `onOpenChange`, `transacao`, `mode`). Eliminate the duplicated `itemInvestimento` JSX that exists in lines 593-650 of the original.

10. **Remove `any` and strengthen typing** — the prop `transacao?: any` becomes `transacao?: Record<string, unknown>`. All types of rules, validation and derived state typed explicitly.

11. **Verify TypeScript and behavior** — run `npx tsc --noEmit` in the workspace, confirm zero errors. Manually test the flows: music revenue with a project, travel expense with an artist, tax with a collecting agency, installments, view mode.

## Relevant files

- `apps/web/src/modules/accounting/components/TransacaoFormModal.tsx`
- `apps/web/src/modules/accounting/constants/transacao-constants.ts`
- `apps/web/src/modules/accounting/services/entity-to-form.mapper.ts`
- `apps/web/src/modules/accounting/services/form-to-payload.mapper.ts`
- `apps/web/src/modules/accounting/mappers/index.ts`
- `apps/web/src/shared/components/FormField.tsx`
- `apps/web/src/shared/ui/date-picker-field.tsx`
