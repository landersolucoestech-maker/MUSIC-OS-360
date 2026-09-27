# Header/Footer Upload in the Template Editors

## What & Why
Add header and footer image upload to the contract template creation and editing editor. Nothing else.

## Done looks like
- In the creation editor (ContractImportWorkspace) there is a "Cabeçalho / Rodapé" (Header / Footer) section in the right side panel, below the variables
- In the editing editor (TemplateEditModal) the same section appears in the same location
- The user can upload one PNG/JPG/WEBP image for the header and another for the footer
- After upload, a thumbnail (preview) of the image appears with a remove button (X)
- The images are converted to base64 and stored in the save payload as `header_image` and `footer_image`
- When a template is reopened for editing, the saved images are loaded and shown in the preview

## Out of scope
- A4 styling in the editor
- Contextual topbar with multiple panels
- Any other visual change to the editor

## Steps
1. **Add an upload section to the ContractImportWorkspace right panel** — Add `headerImage` and `footerImage` state (base64 string | null). Below the custom variable creator, add two upload fields with preview and a remove button. Include `header_image` and `footer_image` in the `handleSave` payload.

2. **Replicate in TemplateEditModal** — Same upload with the same state. In the `useEffect` that fills in the form, read `header_image` and `footer_image` from the template and prefill them. Include them in the `handleSave` payload.

## Relevant files
- `apps/web/src/modules/contracts/components/ContractImportWorkspace.tsx`
- `apps/web/src/modules/contracts/components/TemplateEditModal.tsx`
