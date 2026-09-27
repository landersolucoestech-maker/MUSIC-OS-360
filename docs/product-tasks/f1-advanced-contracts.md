# Contracts — Upload, Versioning and Links

## What & Why
Bring the Contracts module up to an operational level: allow attaching the contract's PDF file (via URL), keep a version history (v1, v2, v3...), link contracts to artists and releases visibly, and prepare the architecture for future integration with Autentique (digital signature). Currently the module only records metadata — without the actual file and without version traceability.

## Done looks like
- The contract form gains a **"URL do arquivo"** (File URL) field (PDF) with an "Abrir" (Open) button in the view modal
- The view modal displays a download/open link for the PDF, the current signature status and the version history
- **Version history**: each contract can have N versions; when editing and saving with a document change, a new version entry (v1, v2...) is created with date and author; list of versions in the view modal
- **Explicit links**: when creating/editing a contract, a field to link it to a specific Release (select); in the view, a direct link to the linked release
- On the **Artists → "Visão 360"** (360 View) page, the Contracts tab lists all of the artist's contracts with status, amount and a link to open the contract
- On the **Releases → View** page, a "Contratos" (Contracts) section shows the contracts linked to the release
- Status field value `aguardando_assinatura` (awaiting signature) added (in addition to active/expired/cancelled) — preparation for Autentique
- New KPI on the page: "Aguardando assinatura" (Awaiting signature) with a count badge
- Visual alert on contracts with an expiration date within the next 30 days (`expirando` badge)

## Out of scope
- Real integration with Autentique (real API calls)
- Automatic PDF generation from a template
- Multiple signers / approval workflow
- Real file upload to storage (URL only for now)

## Steps
1. **Expand the data model** — Add `arquivo_url`, `lancamento_id`, `versoes` (array with `{versao, url, criado_em, notas}`), status `aguardando_assinatura` to the types and mockData
2. **Update the contract form** — Fields: file URL, linked release select, version notes (free-text field when saving a new version)
3. **Expanded view modal** — "Arquivo" (File) section: open PDF button; "Histórico de Versões" (Version History) section: list of versions with date and notes; "Lançamento vinculado" (Linked release) section: link to the release
4. **Expiration alert** — Logic that detects contracts with `data_fim` within the next 30 days and displays the `expirando` badge in the list and in the KPI
5. **Reverse integration with Artists and Releases** — In the Contracts tab of the artist's 360 View, display the list of contracts; in a release's tab, show the linked contracts
6. **Autentique architecture** — Add an `autentique_doc_id` field (nullable string) and an "Enviar para assinatura" (Send for signature) button (disabled with the tooltip "em breve — integração Autentique" (coming soon — Autentique integration)) in the view modal

## Relevant files
- `client/src/modules/contracts/pages/Contratos.tsx`
- `client/src/modules/contracts/components/ContratoFormModal.tsx`
- `client/src/modules/contracts/components/ContratoViewModal.tsx`
- `client/src/modules/contracts/hooks/useContratos.ts`
- `client/src/modules/artist/components/ArtistaVisao360Modal.tsx`
- `client/src/modules/releases/components/LancamentoViewModal.tsx`
- `client/src/shared/data/mockData.ts`
