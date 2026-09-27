# Dynamic Categories and Subcategories

## What & Why
The financial system has ~200 lines of categories/subcategories hardcoded in `transacao-constants.ts` and replicated in the backend validator. Any new category requires a code edit in 4+ files. This task lays the foundation: categories and subcategories become configurable data, not code.

## Done looks like
- `transaction_categories` and `transaction_subcategories` tables in the mock data with all current categories migrated
- The `/accounting/rules` page (already existing) expands with two new tabs: "Categorias" (Categories) and "Subcategorias" (Subcategories), each with full CRUD (create, edit, deactivate, reorder)
- Each category has: name, applicable transaction type, color, icon, order, active
- Each subcategory has: name, parent category, fields it requires (artist, project, event), active
- The transaction form now reads categories/subcategories from storage instead of static arrays
- The hardcoded arrays in `transacao-constants.ts` are kept as a seed fallback only, with a deprecation comment
- The backend validator accepts any string for category/subcategory (validation becomes "non-empty" instead of a closed enum)

## Out of scope
- Dynamic visibility rules (the DISPLAY_RULES logic stays in code for now — separate task)
- Migration of historical data in localStorage (the patch in patchMockData guarantees the seed)
- Financial accounts and cost centers (separate tasks)

## Steps
1. **Add tables to the mock data** — create `transaction_categories` and `transaction_subcategories` in `buildSeedData()` + patch in `patchMockData()` with all current categories migrated to data rows
2. **Service methods** — add `listCategories`, `createCategory`, `updateCategory`, `listSubcategories`, `createSubcategory`, `updateSubcategory` to `accounting.service.ts`
3. **Categories hook** — create `useTransactionCategories.ts` with React Query for reads and mutations; use it in the transaction form instead of the static arrays
4. **Categories CRUD on the Rules page** — add a "Categorias" tab to the `/accounting/rules` page with a table + create/edit modal (name, type, color, icon, order, active)
5. **Subcategories CRUD on the Rules page** — add a "Subcategorias" tab with a table + modal (name, parent category, required fields, active); show only the subcategories of the selected category
6. **Data-driven transaction form** — replace the static arrays in the category and subcategory selects with data coming from the hook; keep the visual behavior identical

## Relevant files
- `apps/web/src/modules/accounting/constants/transacao-constants.ts`
- `apps/web/src/modules/accounting/pages/TransacaoRules.tsx`
- `apps/web/src/modules/accounting/services/accounting.service.ts`
- `apps/web/src/modules/accounting/components/transacao-form/sections/CategorySection.tsx`
- `apps/web/src/shared/data/mockData.ts`
- `apps/api/src/modules/transactions/validators/transacao.validator.ts`
