# Record Label Operational Dashboard

## What & Why
Create an operational view that replaces (or coexists with) the current dashboard, focused on what the record label team needs to see every day: release pipeline, contracts about to expire, artists in onboarding awaiting review, and pending operational tasks. It is the system's "operational homepage".

## Done looks like
- New route `/operacional` (or the current Dashboard is expanded with an "Operacional" (Operational) tab) with a panel layout
- **Release Pipeline section**: next 5 releases sorted by date, with status, artist, checklist of incomplete assets — each item is clickable (opens the release modal)
- **Critical Contracts section**: contracts expiring within 30 days or awaiting signature, with a link to open the contract
- **Pending Onboarding section**: artists with status `onboarding`, with entry date, stage name and a "Revisar" (Review) button (opens the artist edit modal)
- **Catalog — Pending Works section**: works with status `pendente` or `analise` in the catalog, with artist and date
- **Global KPIs at the top**: total active artists, releases this month, active contracts, revenue for the month (from Finance)
- **Inline notifications**: if there are expired contracts, onboarding for more than 7 days without action, or releases with incomplete assets less than 14 days away — a red/yellow alert appears on the corresponding card
- Each section has a "Ver todos" (See all) button that navigates to the respective module

## Out of scope
- Tasks assigned to specific users (an individual task system is future work)
- Real-time streaming metrics
- Exportable reports in this phase
- Push/email notifications

## Steps
1. **Route and layout** — Create the `/operacional` page with MainLayout, a responsive grid of 2 columns on desktop, 1 on mobile; register the route in the app
2. **Global KPIs** — 4 MetricCards at the top consuming data from the existing hooks (useArtistas, useLancamentos, useContratos, useMetrics)
3. **Release Pipeline** — Widget with the next 5 releases by `data_lancamento` ASC, card with name, artist, status badge, asset progress bar and days remaining
4. **Critical Contracts** — Widget filtering contracts with `data_fim` within the next 30 days or `status === "aguardando_assinatura"`; card with name, artist, date and an urgency badge
5. **Pending Onboarding** — Widget filtering artists with `status === "onboarding"`, displaying stage name, genre, registration date and a "Revisar" button
6. **Pending Catalog** — Widget filtering works with `status === "pendente" || "analise"`, showing title, artist, type
7. **Contextual alerts** — Inline notification logic in the widgets (red/yellow border when urgent, alert icon) for expired contracts and releases with incomplete assets

## Relevant files
- `client/src/app/routes/`
- `client/src/shared/hooks/useMetrics.ts`
- `client/src/modules/artist/hooks/useArtistas.ts`
- `client/src/modules/releases/hooks/useLancamentos.ts`
- `client/src/modules/contracts/hooks/useContratos.ts`
- `client/src/modules/catalog/hooks/useObras.ts`
- `client/src/shared/components/MetricCard.tsx`
- `client/src/shared/components/MainLayout.tsx`
