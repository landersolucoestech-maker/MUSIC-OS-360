# LANDER 360

## Overview
LANDER 360 is a comprehensive music management system designed to centralize and streamline operations for the music industry. It provides a 360-degree view of an artist's career and business, managing artists, contracts, finances, marketing campaigns, and licensing. The platform aims to be a central hub for music professionals, offering a complete suite of tools to manage various aspects of music business operations, including music catalog, financial, contract, CRM, marketing, and operational tools.

## User Preferences
No explicit user preferences were provided in the original `replit.md` file.

## System Architecture

### Core System
LANDER 360 is a single-page application (SPA) with a modern, responsive UI, leveraging Shadcn UI components and Tailwind CSS. **Modo standalone**: o app opera 100% no navegador, sem backend. Toda a persistência usa um mock layer (`client/src/data/mockData.ts` → `MOCK_DATA` + `saveMockData`/`resetMockData`) com snapshot serializado em `localStorage` (chave `lander_mock_data`).

### Technical Implementation
The frontend is built with React and TypeScript, using Vite for development and TanStack Query for data fetching. **Sem backend**: não há Express, Supabase, Edge Functions nem banco real. Todos os hooks de domínio (`client/src/hooks/use*.ts`) leem e escrevem em `MOCK_DATA` através de `useSupabaseQuery` (nome legado preservado para evitar diff massivo) e helpers locais. Autenticação fixa em `MOCK_USER` (admin) via `AuthContext`. Multi-tenancy preservada com `MOCK_ORG_ID` constante e filtro `org_id` mantido em todos os hooks para manter o modelo de dados.

### Feature Specifications
- **Music Catalog Management**: Manages musical works, phonograms, releases, shares, and licenses, including unified search across system and ABRAMUS databases.
- **Financial Management**: Tracks transactions, sales, and invoices with detailed accounting, closures, and P&L statements.
- **Contract Management**: Facilitates creation, management, and templating of contracts.
- **Artist & Client Relationship Management (CRM)**: Manages artists, clients, and contacts, with public signup flows for artists.
- **Marketing & Campaign Management**: Plans and executes marketing campaigns, briefings, marketing tasks, and artist goals.
- **Operational Tools**: Includes event management, inventory, usage detection, takedowns, rules, and ECAD reports.
- **User & Access Management**: Manages user profiles, settings, roles, and company settings.
- **Human Resources (RH)**: Manages employees, payroll, leave, and employee documents.
- **Leads (Multi-Service CRM)**: A comprehensive CRM for capturing leads across various label services, featuring a multi-section form, Kanban board, and integrations for lead capture.
- **Auditoria de Dados**: Página `/auditoria` (apenas owner/admin) que escaneia os principais módulos da organização logada e lista registros com campos obrigatórios ou recomendados faltando, com filtros por módulo/severidade/busca e botão "Corrigir" que leva direto à tela de edição. As regras vivem em `client/src/lib/audit/rules.ts`; o runner em `client/src/lib/audit/runner.ts` lê via `MOCK_DATA`.

### Security Architecture
- Sem backend: não existe RLS nem RBAC reais neste modo standalone. O usuário mockado (`MOCK_USER`) é sempre tratado como administrador. As estruturas de roles/permissões continuam no código para quando um backend for plugado, mas nesta build são bypass.

### Multi-tenancy
The system supports multi-tenancy using an `org_id` column in most business tables, linked to `organizations` and `org_members`, ensuring data isolation. No modo standalone existe apenas uma organização (`MOCK_ORG_ID`).

## External Dependencies / Integrações

Todas as integrações externas estão **desativadas** neste modo standalone. Os hooks correspondentes lançam `DisabledIntegrationError` (`client/src/lib/disabled-integration.ts`, status 503, code `integration_disabled`) com a mensagem "Integração desativada — backend não configurado".

Integrações afetadas (stubadas no frontend, sem chamadas externas):

- Spotify API (`useSpotify`)
- YouTube API (`useYouTube`)
- Apple Music API (`useAppleMusic`)
- Deezer API (`useDeezer`)
- SoundCloud (`useSoundCloud`)
- ABRAMUS Portal (`useAbramus`)
- Autentique (`useAutentique`)
- Resend / e-mail transacional (`useResend`)
- Meta Ads (`useMetaAds`)
- IA Criativa / OpenAI (`useMarketingAI`)
- Storage de arquivos (`useStorage`)

Para reativar qualquer integração, será necessário plugar um backend real nos respectivos hooks.

### Bibliotecas
- **xlsx**: geração de planilhas Excel.
- **Sonner**: toasts.
- **TanStack Query**: data fetching/cache (com fetchers locais sobre `MOCK_DATA`).
- **shadcn UI / Radix / Tailwind**: UI.
