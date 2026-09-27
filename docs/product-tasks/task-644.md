---
title: Billing tab in Settings
---
# Billing Tab in Settings

## What & Why
The Settings page has no Billing tab. A "Billing" tab needs to be added with information about the current plan, seat usage, invoice history (mock) and a plan upgrade CTA — consuming the data already available in `TenantContext` (`tenant.plan`, `tenant.billing`).

## Done looks like
- New "Billing" tab visible in the tab bar at `/configuracoes`, after the "Integrações" (Integrations) tab
- Current plan card with: plan name (Starter / Professional / Enterprise), status ("Ativo" / "Trial" / "Suspenso" — Active / Trial / Suspended), next renewal date and a colored status badge
- Seat meter: X of Y used, visual progress bar
- Invoice history table with columns "Fatura", "Data", "Valor", "Status" (Invoice, Date, Amount, Status) and a "Baixar" (Download) button (mock with 4–6 realistic entries)
- Payment method card (mock: card ending in 4242, Visa brand)
- Plan comparison section with a "Fazer Upgrade" (Upgrade) button (visual only — fires an informational toast)
- Enterprise layout consistent with the other tabs: cards with `CardHeader`/`CardContent`, `space-y-6` spacing

## Out of scope
- Real integration with Stripe or any payment gateway
- Real generation or download of invoice PDFs
- Real change of plan or payment method

## Steps
1. **Add the "billing" TabsTrigger** — Insert the trigger with the `CreditCard` icon from lucide-react into the `TabsList` of `Configuracoes.tsx`, after the "integracoes" trigger
2. **Build the "billing" TabsContent** — Implement the tab content with 4 cards: (a) Current Plan + status + renewal, (b) Seat Usage with a progress bar, (c) Invoice History (table with mock data), (d) mock Payment Method
3. **Add the plan upgrade section** — Comparison table of the 3 plans (Starter/Professional/Enterprise) highlighting the current plan and a "Fazer Upgrade" button that fires `toast.info`
4. **Consume TenantContext data** — Use `useTenant()` to read `tenant.plan`, `tenant.billing.status`, `tenant.billing.seats`, `tenant.billing.seatsUsed`, `tenant.billing.currentPeriodEnd` and reflect real values in the UI

## Relevant files
- `client/src/modules/settings/pages/Configuracoes.tsx:640-690`
- `client/src/app/providers/TenantContext.tsx:82-151`