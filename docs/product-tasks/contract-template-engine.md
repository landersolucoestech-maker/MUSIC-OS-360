# Contract Template Engine — Complete Refactor

## What & Why
The current "Tipos de Contratos" (Contract Types) module is a simple CRUD form with flat fields. The goal is to turn it into a professional music contract template system: typed participants with automatic variable generation, a clause editor with variable autocomplete, musical work sections, digital signature (structure), branding, and dynamic preview — all inside an 8-section multi-tab modal. No existing business logic is removed; the existing `contract_service_types` system is extended.

## Done looks like
- The "Tipos de Contratos" tab at `/contratos/templates` opens a multi-tab modal with 8 tabs: "Informações Gerais", "Envolvidos", "Financeiro", "Obra Musical", "Cláusulas", "Assinaturas", "Branding", "Preview" (General Information, Parties, Financial, Musical Work, Clauses, Signatures, Branding, Preview)
- **Tab 1 — General Information**: name, category, contract type (select), description; slug and order live in a collapsible "Avançado" (Advanced) section
- **Tab 2 — Parties**: add participants with a role (CONTRATANTE, CONTRATADO, ARTISTA, PRODUTOR, EMPRESA, LABEL, EMPRESÁRIO, COMPOSITOR, TESTEMUNHA, REPRESENTANTE LEGAL), entity type (PF / PJ — individual / legal entity); when PF is selected, the variables `{{ROLE_NOME_COMPLETO}}`, `{{ROLE_CPF}}`, `{{ROLE_RG}}`, `{{ROLE_EMAIL}}` etc. are generated automatically; when PJ is selected, `{{ROLE_RAZAO_SOCIAL}}`, `{{ROLE_CNPJ}}`, `{{ROLE_REPRESENTANTE_LEGAL}}` etc. are generated; the generated variables are displayed as badges on the participant's row
- **Tab 3 — Financial**: checkboxes for royalties, fixed amount, advance, monthly support, installments; fields for default currency, payment frequency, penalty, interest, due date; default financial category
- **Tab 4 — Musical Work**: title, ISRC, UPC, genre, language, release date, platforms (multi-select), distribution type
- **Tab 5 — Clauses**: list of clauses (title + content) with an internal ScrollArea; typing `{{` in the content textarea opens an autocomplete popover with search, categories ("Participantes", "Financeiro", "Obra Musical", "Vigência", "Sistema", "Personalizadas" — Participants, Financial, Musical Work, Term, System, Custom), and a description and example for each variable; variables are visually highlighted in the editor; nonexistent variables show an error indicator
- **Tab 6 — Signatures**: "habilitar assinatura digital" (enable digital signature) toggle; signing order (drag or selection); "exigir testemunhas" (require witnesses) option; provider field (Autentique, DocuSign — placeholder); "trilha de auditoria" (audit trail) toggle field
- **Tab 7 — Branding**: header and footer upload (existing, kept); watermark toggle; logo field; alignment, margins, document font, page numbering
- **Tab 8 — Preview**: dynamic render of the contract replacing all variables with realistic mock values; updates in real time when switching tabs; displays the final formatting with header/footer/logo if defined
- The modal has width `max-w-5xl` and height `90vh`; navigating between tabs preserves all the form data (internal state with no reset between tabs)
- The variable system has a typed structure: `{ id, key, label, type, source, category, required, example, participantReference }`; participant variables are generated automatically when participants are added/changed; fixed system variables (dates, work) are always available
- All mandatory validations: unique slug, non-empty clauses, at least one participant, consistent dates
- The payload saved in `contract_service_types` is backward compatible with the existing schema — the new fields (participants, variables, music_work, signature_settings, branding_settings) are stored as serialized JSON in existing text fields or in new fields on the object stored in localStorage (mock mode); no production data migration is necessary
- Visuals consistent with the MUSIC OS 360 design system: dark mode, card sections, badges, Plus Jakarta Sans typography

## Out of scope
- Real PDF generation
- Real integration with Autentique / DocuSign (structure prepared, not functional)
- Publishing on the NestJS / TypeORM backend (stays in mock mode)
- AI for clause generation (structure prepared with an `aiGenerated` field on the types, no implementation)
- Changes to modules outside `contracts/`
- Changes to `ContratoFormModal`, `ContratoViewModal`, `TemplateContratoFormModal`

## Steps

1. **New TypeScript types** — In `contracts/types/contracts.types.ts`, define the interfaces `ContractTemplate`, `Participant`, `ContractVariable`, `ContractClause`, `FinancialSettings`, `MusicWork`, `SignatureSettings`, `BrandingSettings`, `ParticipantRole`, `EntityType`. Ensure that the existing `ContractServiceType` is kept or is an alias/subset of `ContractTemplate` for backward compat.

2. **Variable system** — Create `contracts/utils/contract-variables.ts` with: (a) a list of fixed system variables grouped by category (Term, Musical Work, System); (b) a function `generateParticipantVariables(role, entityType)` that returns the `ContractVariable` array for a PF or PJ participant; (c) a function `resolveAllVariables(participants)` that merges fixed + generated variables and returns the complete list sorted by category.

3. **General Information tab** — Refactor the equivalent section of `ServiceTypeFormModal` into Tab 1: name, category (select with: "Agenciamento", "Distribuição", "Produção", "Licenciamento", "Publicação", "Outros" — Booking agency, Distribution, Production, Licensing, Publishing, Other), contract type (free text), description; collapsible slug + order.

4. **Parties tab** — Build `ParticipantEditor`: the "Adicionar Envolvido" (Add Party) button opens an inline form with a role select + PF/PJ toggle; on confirm, the participant appears in a card with the role name, entity type, and badges for the automatically generated variables; allow removal; the cards can be reordered by drag (or ↑↓ buttons as a fallback).

5. **Financial tab** — Keep the existing checkboxes (requires_royalties, requires_fixed_value, requires_advance, requires_financial_support, allow_installments) and add: currency select (BRL default), payment frequency select (one-off, monthly, quarterly, yearly), penalty (%) and interest (% per month) fields, default due date field (days), default financial category.

6. **Musical Work tab** — Build a form with the fields: work title, ISRC, UPC, genre (select), language (select), release date, platforms (multi-checkbox: Spotify, Apple Music, YouTube Music, Deezer, Tidal, Amazon Music, others), distribution type (exclusive / non-exclusive / license).

7. **Variable autocomplete in the clause editor** — In each clause's content textarea, detect when the user types `{{` (via `onChange`) and open a positioned `Popover` with the list of available variables filtered by search; clicking a variable inserts `{{VARIABLE_KEY}}` at the cursor; already inserted variables that exist in the list are visually highlighted (background with `bg-primary/10`); variables not found in the list get `bg-destructive/10`.

8. **Signatures tab** — Build a form with a "habilitar assinatura" (enable signature) toggle, a list of participants in signing order (reorderable), an "exigir testemunhas" (require witnesses) toggle, a provider select (Autentique, DocuSign — disabled with an "em breve" (coming soon) tooltip), and a "trilha de auditoria" (audit trail) toggle.

9. **Branding tab** — Keep the existing header/footer upload; add: logo upload, watermark toggle (watermark text field), text alignment select (left/center/justified), font select (Plus Jakarta Sans, Arial, Times New Roman), page numbering toggle, margin fields (top/bottom/left/right in mm with defaults).

10. **Preview tab** — Build a `ContractPreview` component that: (a) collects all the form data via `useWatch` or by passing props; (b) replaces each `{{VARIABLE_KEY}}` with a mock value from the `example` property of the corresponding variable; (c) renders the clauses as formatted HTML in a div with typography classes (`prose`-like); (d) shows the header and footer if they are defined as images.

11. **Multi-tab modal orchestration** — Refactor `ServiceTypeFormModal` to use `Tabs`/`TabsList`/`TabsContent` (shadcn); move all the submit logic and state to the top of the component; ensure that switching tabs does not erase data; the "Salvar" (Save) button in the footer works on any active tab; visual indicators for tabs with errors (red dot on the tab label if `formState.errors` touches fields on that tab).

12. **Persistence** — Update `contractsService.createContractServiceType` / `updateContractServiceType` to serialize the new fields (participants, variables, music_work, signature_settings, branding_settings) as part of the saved object; update the `useContractServiceTypes` hook to deserialize and expose the new fields; ensure backward compatibility with old records that lack the new fields (safe defaults).

## Relevant files
- `apps/web/src/modules/contracts/components/ServiceTypeFormModal.tsx`
- `apps/web/src/modules/contracts/hooks/useContractServiceTypes.ts`
- `apps/web/src/modules/contracts/pages/TemplatesContratos.tsx`
- `apps/web/src/modules/contracts/services/contracts.service.ts`
- `apps/web/src/modules/contracts/types/contracts.types.ts`
- `apps/web/src/shared/data/mockData.ts`
- `apps/web/src/shared/lib/storage.ts`
- `apps/web/src/shared/ui/tabs.tsx`
- `apps/web/src/shared/ui/popover.tsx`
- `apps/web/src/shared/ui/collapsible.tsx`
