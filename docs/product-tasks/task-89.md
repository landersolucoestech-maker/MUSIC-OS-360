---
title: New Contract Wizard — Template-Driven
---
# "Novo Contrato" (New Contract) Wizard — Template-Driven

## What & Why
The `ContratoFormModal` modal still uses fixed fields (`client_type`, `artist_id`, `company_id`, `contractor_contact`, `responsible_person`) that are architecturally incompatible with the semantic template engine that already exists in the system. The modal must be replaced by a professional 6-step wizard, fully controlled by the selected template. The form never again assumes "client + artist + company" — everything is derived from the template's semantic manifest.

## Done looks like
- Clicking "Novo Contrato" opens a full-page wizard (or fullscreen dialog) split into two panels: left (wizard steps + dynamic form) and right (real-time legal preview).
- Step 1 — Template: the dropdown shows only the active templates with their CategoryRegistry label; on selection, the system reads the `variables_manifest` and extracts placeholders, parties and signers.
- Step 2 — Parties: the system automatically detects the roles present in the template's placeholders (e.g. `{{REPRESENTANTE.NAME}}` generates the role "REPRESENTANTE") and renders a form per role with the correct fields (PF — individual: name, CPF, RG, address, profession, marital status; PJ — legal entity: corporate name, CNPJ, address, legal representative; Artist: stage name, legal name, CPF). Each party can be filled in manually, or come from the CRM or from Artists.
- Step 3 — Variables: inputs generated dynamically from the manifest (`text`, `textarea`, `number`, `percentage`, `currency`, `boolean`, `select`, `date`). No hardcoded financial fields.
- Step 4 — Document: the template is rendered with the filled-in variables/parties; the preview on the right updates in real time; unresolved placeholders are highlighted in yellow with ⚠.
- Step 5 — Signers: signers detected automatically via `{{SIGNATURE.ROLE}}` in the template; each signer has name, email, required, order, provider (DocuSign / Clicksign / Autentique).
- Step 6 — Review: a summary of everything before saving. The "Guardar Rascunho" (Save Draft) button creates the contract with `status: draft`. The "Enviar para Assinatura" (Send for Signature) button creates the contract and simulates sending it.
- The edit modal (`mode: "edit"`) hydrates the wizard with the existing data.
- The `client_type`, `artist_id`, `company_id`, `contractor_contact`, `responsible_person` fields are completely removed from the modal.
- TypeScript with no errors (`tsc --noEmit` EXIT:0).

## Out of scope
- Real integration with DocuSign / Clicksign / Autentique (webhook infra, OAuth) — only the UI and data structure.
- PDF export / PDF file generation (HTML preview only).
- Changes to the template engine (ContractImportWorkspace, parseContractText, useTemplatesContratos).
- Backend/API changes.
- A separate signature module — only the flow inside the wizard.

## Steps

1. **New `ContratoWizard` component** — Create `apps/web/src/modules/contracts/components/ContratoWizard.tsx`. 6-step wizard with a navigation sidebar (Template → Parties → Variables → Document → Signers → Review). Layout: left panel 55% (form) + right panel 45% (preview). Uses `useState` for the current step and the wizard data. Replace the opening of `ContratoFormModal` in `Contratos.tsx` with this wizard (fullscreen dialog or drawer).

2. **Step 1 — Template selection** — Dropdown with the active templates (hook `useTemplatesContratos`). On selection, parse the `variables_manifest` (JSON) to extract variables, and parse the `conteudo` via the regex `\{\{([A-Z_]+)\.([A-Z_]+)\}\}` to extract party roles (e.g. `REPRESENTANTE`, `REPRESENTADO`, `TESTEMUNHA_1`). Store in the wizard state: `{ templateId, manifest, detectedRoles, rawContent }`.

3. **Step 2 — Dynamic contracting parties** — For each detected role, render a card with: a source selector (Manual / CRM / Artists) and the correct fields according to the expected type (PF / PJ / Artist). The PF/PJ/Artist fields must be in a `PartyForm` sub-component. The "CRM" choice shows a Select with `useClientes()`; "Artistas" shows a Select with artists; "Manual" shows the fields directly.

4. **Step 3 — Dynamic variables** — Read the variables from the manifest (the `variables` array or every `{{PLACEHOLDER}}` in the content that is neither a party role nor `SIGNATURE.*`). For each variable, render the correct input for its type (`text` → `<Input>`, `textarea` → `<Textarea>`, `number`/`currency`/`percentage` → `<Input type="number">`, `date` → `<DatePickerField>`, `boolean` → `<Checkbox>`, `select` → `<Select>`). Store values in a `Record<string, string>`.

5. **Step 4 — Document preview** — Render the template's `conteudo`, replacing all placeholders with the values filled in during steps 2 and 3. Unresolved placeholders are rendered as `<span class="bg-yellow-100 text-yellow-800">⚠ {{PLACEHOLDER}}</span>`. Preview in the right panel with scrolling, legal typography (IBM Plex Mono or serif font), the template's header/footer images if they exist.

6. **Step 5 — Signers** — Automatically detect `{{SIGNATURE.ROLE}}`, `{{INITIALS.ROLE}}`, `{{SIGN_DATE.ROLE}}` in the content. For each signature role, create a signer row with: name (prefilled from Step 2 if the role matches), email, required (checkbox), order (number), provider (Select: DocuSign / Clicksign / Autentique). Allow adding additional signers manually.

7. **Step 6 — Review and save** — Show a summary: selected template, filled-in parties, number of variables, number of signers, provider. "Guardar Rascunho" button: call `createContrato.mutate({ titulo, template_id, status: "rascunho", signers, ... })` where the party and variable data go into `observacoes` (serialized JSON) until a dedicated schema exists. "Enviar para Assinatura" button: the same but with `status: "aguardando_assinatura"` + `toast.info("Envio simulado — integração com [provider] não activa")`.

8. **Clean up ContratoFormModal** — Completely remove the `client_type`, `artist_id`, `company_id`, `contractor_contact`, `responsible_person` fields from the Zod schema `contrato-schema.ts` and from the component. Update `Contratos.tsx` to use `ContratoWizard` instead of `ContratoFormModal` for creation. The edit modal may continue to exist in a simplified form (only status, dates, notes) or also use the wizard with hydration.

## Relevant files
- `apps/web/src/modules/contracts/components/ContratoFormModal.tsx`
- `apps/web/src/modules/contracts/pages/Contratos.tsx`
- `apps/web/src/modules/contracts/lib/contrato-schema.ts`
- `apps/web/src/modules/contracts/types/contracts.types.ts`
- `apps/web/src/modules/contracts/hooks/useTemplatesContratos.ts`
- `apps/web/src/modules/contracts/hooks/useContractServiceTypes.ts`
- `apps/web/src/modules/contracts/hooks/useCategoryRegistry.ts`
- `apps/web/src/modules/contracts/hooks/useVariableRegistry.ts`
- `apps/web/src/modules/contracts/hooks/useContratos.ts`
- `apps/web/src/modules/crm/hooks/useClientes.ts`