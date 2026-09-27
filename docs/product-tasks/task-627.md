---
title: Inline signers in the contract form
---
# Inline signers in the contract form

## What & Why
The contract create/edit form needs a signers section directly inside it, without leaving the page or navigating to any wizard. The user fills in the contract data and the signers in the same form, all at once.

## Done looks like
- The contract form (`ContratoFormModal`) has a new "Signatários" (Signers) section at the end, before "Observações" (Notes)
- The user can add signers inline: clicking "Adicionar Signatário" (Add Signer) expands a row with name, email and role select fields (artist, label, witness, etc.)
- Each signer has a remove button; limit of 10 signers
- The signers are saved together with the contract in localStorage when the form is submitted
- The "Assinatura Digital" (Digital Signature) tab in the contract view modal shows the saved signers (read directly from `contrato.signers`) — no redirect button to a wizard, no navigation to another page
- The "Iniciar Processo de Assinatura" (Start Signature Process) button (which redirected to `/contratos/assinatura/novo`) is removed completely
- tsc --noEmit → 0 errors

## Out of scope
- Any signature wizard — the `DocumentWizard` (contracts-v2) is not touched
- Navigation to other pages during the contracts flow
- Real integration with Autentique (remains mock)
- Templates with variables — they are not changed

## Steps
1. **Extend the schema and type** — Add a `signers` field (array of `{ name, email, role }`) to `contratoSchema` and to the `Contrato` type in the mock data, with default `[]`
2. **Signers section in ContratoFormModal** — Add a "Signatários" card to the form. The "Adicionar Signatário" button inserts an inline row with name, email and role select fields. Each row has an × button. The values live in a react-hook-form `useFieldArray`.
3. **Persist in the mock data** — Ensure the signers are saved on submit (create/edit contract) via the existing mapper/hook.
4. **Update the "Assinatura Digital" tab** — Remove the "Iniciar Processo de Assinatura" button and the redirect to the wizard. Show the list of signers from `contrato.signers` directly. If the list is empty, show the message "Adicione signatários no formulário do contrato" (Add signers in the contract form).
5. **tsc validation** — Run `cd client && npx tsc --noEmit` and fix all type errors.

## Relevant files
- `client/src/modules/contracts/components/ContratoFormModal.tsx`
- `client/src/modules/contracts/lib/contrato-schema.ts`
- `client/src/modules/contracts/components/ContratoViewModal.tsx`
- `client/src/modules/contracts-v2/types/index.ts`
- `client/src/shared/data/mockData.ts`