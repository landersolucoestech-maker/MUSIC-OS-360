# Enterprise Design System — Spacing + Grids + Loading + Empty States + Forms

## What & Why
The frontend has 15+ modules developed incrementally without a centralized design system applied consistently. This results in: inconsistent spacing (some use `gap-4`, others `gap-6`, others `space-y-3`), no standardized empty states (some modules show an empty table, others nothing), heterogeneous loading states (some use Skeleton, others a spinner, some nothing), forms with different visual density between modules, and motion/transitions missing from many components. The result is a UX with an amateur look even though the data is enterprise-grade.

## Done looks like
- `shared/design-system/tokens.ts` documents all decisions: spacing scale, border-radius, shadows, motion durations
- A standardized `<EmptyState>` component: icon + title + description + optional CTA; applied to all tables and lists when `data.length === 0`
- Standardized `<PageSkeleton>` and `<TableSkeleton rows={N}>` components; they replace ad-hoc spinners in all modules
- A standardized `<SectionCard>` component for content cards with an optional header, body and footer; replace generic divs in the dashboards
- Forms: all critical forms (Artist, Phonogram, Contract, Transaction, Lead) use the same 2-col layout with semantic `fieldset/legend`, `gap-6` spacing, labels above the fields, standardized helper text and error messages
- A unified `<StatusBadge>` that replaces the multiple badge variants scattered around: it accepts `status` and `variant` and maps them to the semantically correct color (success=green, warning=yellow, destructive=red, pending=blue)
- Motion: modal transitions (fade + scale 200ms), accordion (height 150ms), hover on table rows (bg 100ms) — all via Tailwind `transition-*`
- Mobile: all modals have `max-h-[90vh] overflow-y-auto`; tables scroll horizontally on screens < 768px
- No functional regression: operational UX fully preserved

## Out of scope
- Rewriting whole modules
- Dark mode (already configured)
- Changing the visual identity (colors, typography already defined)
- Storybook / visual documentation

## Steps
1. **Inconsistency audit** — produce a list of: all existing (or missing) empty states, all loading patterns, all badge/status components, inconsistent spacing in the main forms — the basis for the work in the following steps
2. **EmptyState component** — create `shared/components/EmptyState.tsx`: props `{ icon, title, description, action?: { label, onClick } }`; apply it to: `ArtistasList`, `ObrasList`, `FonogramasList`, `ContratosList`, `LeadsList`, `TransaçõesList`, `ProjetosList`, `EventosList`, `InventárioList`
3. **Skeleton components** — create `shared/components/skeletons/TableSkeleton.tsx` and `PageSkeleton.tsx`; replace every `isLoading && <Spinner>` with `<TableSkeleton rows={5} />` or `<PageSkeleton />`; ensure the dimensions match the real layout
4. **Unified StatusBadge** — create `shared/components/StatusBadge.tsx`, which consolidates `ContratoStatusBadge` and the status badges for releases, transactions and leads; centralized `status → variant → label` mapping; replace the scattered instances with the unified component
5. **Critical forms** — standardize the layout of the 5 main forms (ArtistaFormModal, FonogramaFormModal, ContratoFormModal, TransacaoFormModal, LeadFormModal): consistent 2-col grid, labels above, helper text via `<FormDescription>`, errors via `<FormMessage>`, `gap-6` between field groups
6. **Motion + mobile** — add `transition-colors duration-100` to all table rows; `max-h-[90vh] overflow-y-auto` on every Dialog/Sheet with long content; `overflow-x-auto` wrapping all tables; verify that no modal breaks at 375px

## Relevant files
- `client/src/shared/components/`
- `client/src/shared/design-system/`
- `client/src/modules/artist/components/ArtistaFormModal.tsx`
- `client/src/modules/catalog/components/FonogramaFormModal.tsx`
- `client/src/modules/contracts/components/ContratoFormModal.tsx`
- `client/src/modules/accounting/components/TransacaoFormModal.tsx`
- `client/src/modules/crm/components/LeadFormModal.tsx`
