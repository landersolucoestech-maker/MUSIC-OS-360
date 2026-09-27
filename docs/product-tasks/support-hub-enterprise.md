# Enterprise Support Hub Module

## What & Why
Create a complete enterprise support module — **Support Hub** — fully integrated into the MUSIC OS 360 ecosystem. The module centralizes tickets, live chat, knowledge base, system status and requests in a single premium hub, following the existing visual identity (blue `#3B82F6`, dark mode, glassmorphism, Plus Jakarta Sans typography).

## Done looks like
- `/support` route with a main dashboard: "Como podemos ajudar hoje?" (How can we help today?), KPIs (open/resolved tickets, average SLA, response time, system status)
- Routes `/support/tickets`, `/support/tickets/:id`, `/support/chat`, `/support/knowledge`, `/support/status`, `/support/requests` working with lazy loading
- Sidebar with a "Support Hub" group containing: "Dashboard" → "Tickets" → "Chat ao Vivo" → "Base de Conhecimento" → "Status do Sistema" → "Solicitações" (Dashboard → Tickets → Live Chat → Knowledge Base → System Status → Requests)
- Enterprise ticket system: create, edit, reply, history timeline, priority (low/medium/high/critical), status (open/in_progress/waiting_customer/resolved/closed), SLA deadline, assignee, category; fullscreen side drawer inspired by Linear/Intercom
- Status badges with soft colors (red, yellow, blue, green) and priority badges with a discreet glow
- Live chat with a typing indicator, message history, file upload, emojis — Intercom/Discord-style visuals but with the MUSIC OS 360 identity
- Knowledge base with articles, categories ("Financeiro", "Analytics", "Distribuição", "Contratos", "Artistas", "Projetos", "Usuários", "Permissões", "Integrações" — Finance, Analytics, Distribution, Contracts, Artists, Projects, Users, Permissions, Integrations), command-menu-style quick search and markdown support
- Status page with operational/degraded/maintenance/offline indicators for API, authentication, uploads, realtime, analytics, finance, processing and database — Vercel/Stripe Status-style visuals
- Multi-tenant isolation: all tickets, messages, articles and chats load/save with `tenant_id`
- Enterprise visuals: `rounded-2xl`, `backdrop-blur`, `border-white/10`, dark gradients, subtle blue glow, loading skeletons, empty states, smooth animations, responsive (desktop/tablet/mobile)
- The whole module uses mock data + localStorage with the `musicos360_` pattern — no backend required

## Out of scope
- Real backend with a Postgres database (the tables described in the prompt serve as a type reference)
- Real WebSocket (simulate realtime with polling/local state)
- Real file upload to external storage
- Integration with external tools (Zendesk, Intercom, etc.)
- AI/automated replies

## Steps
1. **Module structure** — Create `client/src/modules/support/` with the subfolders `pages/`, `components/`, `hooks/`, `types/`, `data/`; define centralized TypeScript interfaces (Ticket, Message, KnowledgeArticle, SystemStatus, ChatMessage, SupportCategory) with status and priority enums
2. **Routes and sidebar** — Register the 6 routes in `support.routes.tsx`, import them in `App.tsx`, and add the "Support Hub" group with its 6 items to `AppSidebar.tsx` using lucide-react icons
3. **`/support` dashboard** — Main page with a "Como podemos ajudar hoje?" hero, 6 KPI cards, an activity feed and a ticket trend chart; integrate mock data with localStorage
4. **Ticket system `/support/tickets` and `/support/tickets/:id`** — Listing with filters (status, priority, category), search and infinite scroll; fullscreen detail drawer with a history timeline, reply form, priority/SLA/assignee fields and premium badges
5. **Live chat `/support/chat`** — Two-pane layout (chat list + message panel), simulated typing indicator, history persisted in localStorage, support for emojis and simulated upload
6. **Knowledge base `/support/knowledge`** — Category grid, article listing with command-menu search, article view with rendered markdown; mock articles covering the 9 domain categories
7. **System status `/support/status`** — Service cards with colored indicators, simulated incident history and visual uptime; design inspired by Vercel/Stripe Status
8. **Visual polish** — Apply glassmorphism (`backdrop-blur`, `bg-white/5`, `border-white/10`), a subtle blue glow on critical cards, skeletons on all loads, illustrated empty states, entrance animations (smooth fade/slide), ensure full responsiveness

## Relevant files
- `client/src/App.tsx`
- `client/src/shared/components/layout/AppSidebar.tsx`
- `client/src/app/routes/`
- `client/src/shared/data/mockData.ts`
- `client/src/shared/components/MainLayout.tsx`
- `client/src/index.css`
- `tailwind.config.ts`
