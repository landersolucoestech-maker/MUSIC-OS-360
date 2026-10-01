> Historical record. Kept as recorded; not the current contract.

# 03 — Superfície de Acesso a Dados do Frontend (`apps/web`)

Mapeamento read-only de todos os pontos de acesso a dados em `apps/web/**`. Nenhum arquivo foi alterado. Esta etapa **não** extrai endpoints, request/response bodies, permissões, paginação, filtros, erros ou regras de negócio — apenas localiza e classifica os pontos de acesso, conforme escopo do prompt.

## Metodologia

Busca por padrão de texto (`grep`, escopo `apps/web/src/**/*.{ts,tsx}`) para cada categoria pedida:

- `api\.(get|post|put|patch|delete)(<...>)?\(` — chamadas ao wrapper HTTP interno `api`
- `fetch\(` — chamadas diretas a `fetch`
- `axios` — **zero ocorrências** em `apps/web/src` (o projeto não usa axios; todo tráfego HTTP interno passa pelo wrapper `api` em `shared/lib/api-client.ts`, que internamente usa `fetch`)
- `supabase\.(from|rpc|functions)\(` — **zero ocorrências** (o frontend não faz queries diretas ao Supabase; único uso de `@supabase/supabase-js` é `apps/web/src/lib/supabase.ts`, restrito a `supabase.auth.*` para sessão)
- `localStorage`, `sessionStorage` — armazenamento local
- `IndexedDB`/`indexedDB` — **zero ocorrências**
- `mockData|MOCK_MODE|useMockData|isMockMode` — indícios de mock/fallback de dados
- `useQuery|useMutation` (TanStack Query) — hooks de query/mutation
- Nome de arquivo `*.service.ts` — camada de serviço por módulo (wrapper de domínio)
- `import { create } from 'zustand'` — stores em memória no cliente

Cada arquivo recebeu um único "TIPO DE ACESSO" primário, com prioridade: overrides manuais (arquivos-chave já conhecidos: `api-client.ts`, `ws-client.ts`, `stripe.client.ts`, páginas de OAuth) → `zustand` → `API_HTTP` (api.*/fetch) → `*.service.ts` sem chamada HTTP direta detectada → `MOCK` → `STORAGE_LOCAL` → hook de query/mutation isolado → `OUTRO`. Quando um arquivo casa com mais de um padrão, todos os padrões encontrados aparecem na coluna "Referência encontrada", mesmo que só um tenha definido o tipo.

---

## API_HTTP (60 arquivos)

| ARQUIVO | REFERÊNCIA ENCONTRADA (padrão que casou) |
|---|---|
| `apps/web/src/app/providers/AuthContext.tsx` | api.get/post/put/patch/delete(; useQuery/useMutation |
| `apps/web/src/app/providers/BillingContext.tsx` | api.get/post/put/patch/delete( |
| `apps/web/src/app/providers/TenantContext.tsx` | api.get/post/put/patch/delete(; localStorage |
| `apps/web/src/modules/accounting/services/financial-categories.service.ts` | api.get/post/put/patch/delete(; *.service.ts (nome de arquivo) |
| `apps/web/src/modules/admin/pages/AdminAudit.tsx` | fetch(; useQuery/useMutation |
| `apps/web/src/modules/admin/pages/AdminSupport.tsx` | fetch(; useQuery/useMutation |
| `apps/web/src/modules/admin/pages/Auditoria.tsx` | fetch( |
| `apps/web/src/modules/admin/services/admin-audit.service.ts` | api.get/post/put/patch/delete(; *.service.ts (nome de arquivo) |
| `apps/web/src/modules/admin/services/admin-billing.service.ts` | api.get/post/put/patch/delete(; *.service.ts (nome de arquivo) |
| `apps/web/src/modules/admin/services/admin-plans.service.ts` | api.get/post/put/patch/delete(; *.service.ts (nome de arquivo) |
| `apps/web/src/modules/admin/services/admin-support.service.ts` | api.get/post/put/patch/delete(; *.service.ts (nome de arquivo) |
| `apps/web/src/modules/admin/services/admin-tenants.service.ts` | api.get/post/put/patch/delete(; *.service.ts (nome de arquivo) |
| `apps/web/src/modules/artist/hooks/useArtistPlatformProfiles.ts` | api.get/post/put/patch/delete(; useQuery/useMutation |
| `apps/web/src/modules/audiovisual/services/audiovisual.service.ts` | api.get/post/put/patch/delete(; *.service.ts (nome de arquivo) |
| `apps/web/src/modules/auth/pages/Onboarding.tsx` | api.get/post/put/patch/delete( |
| `apps/web/src/modules/contracts/services/semantic-parser.service.ts` | fetch(; *.service.ts (nome de arquivo) |
| `apps/web/src/modules/crm-relationships/services/clients.service.ts` | api.get/post/put/patch/delete(; *.service.ts (nome de arquivo) |
| `apps/web/src/modules/dashboard/hooks/useActivityHistory.ts` | api.get/post/put/patch/delete(; useQuery/useMutation |
| `apps/web/src/modules/dashboard/hooks/useOperationalDashboard.ts` | api.get/post/put/patch/delete(; useQuery/useMutation |
| `apps/web/src/modules/integrations/hooks/useAbramus.ts` | api.get/post/put/patch/delete(; sessionStorage; useQuery/useMutation |
| `apps/web/src/modules/integrations/hooks/useACRCloud.ts` | fetch(; useQuery/useMutation |
| `apps/web/src/modules/integrations/hooks/useAppleMusic.ts` | api.get/post/put/patch/delete(; useQuery/useMutation |
| `apps/web/src/modules/integrations/hooks/useDeezer.ts` | api.get/post/put/patch/delete(; sessionStorage; useQuery/useMutation |
| `apps/web/src/modules/integrations/hooks/useGoogleAds.ts` | api.get/post/put/patch/delete(; useQuery/useMutation |
| `apps/web/src/modules/integrations/hooks/useInstagram.ts` | api.get/post/put/patch/delete(; useQuery/useMutation |
| `apps/web/src/modules/integrations/hooks/useMarketingOAuth.ts` | api.get/post/put/patch/delete( |
| `apps/web/src/modules/integrations/hooks/useSoundCloud.ts` | api.get/post/put/patch/delete(; useQuery/useMutation |
| `apps/web/src/modules/integrations/hooks/useSpotify.ts` | api.get/post/put/patch/delete(; useQuery/useMutation |
| `apps/web/src/modules/integrations/hooks/useStripe.ts` | api.get/post/put/patch/delete(; useQuery/useMutation |
| `apps/web/src/modules/integrations/hooks/useTikTok.ts` | api.get/post/put/patch/delete(; useQuery/useMutation |
| `apps/web/src/modules/integrations/hooks/useTikTokAds.ts` | api.get/post/put/patch/delete(; useQuery/useMutation |
| `apps/web/src/modules/integrations/hooks/useYouTube.ts` | api.get/post/put/patch/delete(; useQuery/useMutation |
| `apps/web/src/modules/leads/services/leads.service.ts` | api.get/post/put/patch/delete(; *.service.ts (nome de arquivo) |
| `apps/web/src/modules/marketing/ai/providers/providerRouter.ts` | api.get/post/put/patch/delete( |
| `apps/web/src/modules/marketing/components/campaign-builder/useIbgeLocations.ts` | fetch( |
| `apps/web/src/modules/marketing/hooks/useCentralAnaliticaMarketing.ts` | fetch( |
| `apps/web/src/modules/marketing/hooks/useMarketingAssets.ts` | api.get/post/put/patch/delete(; useQuery/useMutation |
| `apps/web/src/modules/marketing/hooks/useMetas.ts` | api.get/post/put/patch/delete(; useQuery/useMutation |
| `apps/web/src/modules/marketing/services/marketing.service.ts` | api.get/post/put/patch/delete(; *.service.ts (nome de arquivo) |
| `apps/web/src/modules/musicchat/services/conversations.service.ts` | api.get/post/put/patch/delete(; *.service.ts (nome de arquivo) |
| `apps/web/src/modules/musicchat/services/musicchat-automation.service.ts` | api.get/post/put/patch/delete(; *.service.ts (nome de arquivo) |
| `apps/web/src/modules/reports/services/reports-api.ts` | api.get/post/put/patch/delete(; fetch( |
| `apps/web/src/modules/settings/hooks/useAuditTrail.ts` | api.get/post/put/patch/delete(; useQuery/useMutation |
| `apps/web/src/modules/settings/hooks/useCompanySettings.ts` | api.get/post/put/patch/delete(; useQuery/useMutation |
| `apps/web/src/modules/settings/hooks/useRoles.ts` | api.get/post/put/patch/delete(; useQuery/useMutation |
| `apps/web/src/modules/settings/hooks/useUsuarios.ts` | api.get/post/put/patch/delete(; useQuery/useMutation |
| `apps/web/src/modules/settings/pages/AuditTrail.tsx` | fetch( |
| `apps/web/src/modules/settings/pages/Configuracoes.tsx` | fetch(; localStorage; sessionStorage; useQuery/useMutation |
| `apps/web/src/modules/settings/services/billing-invoices.service.ts` | api.get/post/put/patch/delete(; *.service.ts (nome de arquivo) |
| `apps/web/src/modules/settings/services/billing-plans.service.ts` | api.get/post/put/patch/delete(; *.service.ts (nome de arquivo) |
| `apps/web/src/modules/settings/services/company-logo.service.ts` | api.get/post/put/patch/delete(; fetch(; *.service.ts (nome de arquivo) |
| `apps/web/src/modules/support/hooks/useSupport.ts` | api.get/post/put/patch/delete(; localStorage; useQuery/useMutation |
| `apps/web/src/modules/workspace/hooks/useWorkspace.ts` | api.get/post/put/patch/delete(; useQuery/useMutation |
| `apps/web/src/shared/components/ChatAttachment.tsx` | fetch( |
| `apps/web/src/shared/components/MainLayout.tsx` | api.get/post/put/patch/delete(; useQuery/useMutation |
| `apps/web/src/shared/hooks/useAI.ts` | fetch(; useQuery/useMutation |
| `apps/web/src/shared/hooks/useUploadToR2.ts` | api.get/post/put/patch/delete(; fetch( |
| `apps/web/src/shared/lib/api-client.test.ts` | api.get/post/put/patch/delete( |
| `apps/web/src/shared/lib/masks.ts` | fetch( |
| `apps/web/src/shared/lib/storage.ts` | api.get/post/put/patch/delete( |

## SUPABASE_DIRECT (1 arquivo)

| ARQUIVO | REFERÊNCIA ENCONTRADA (padrão que casou) | OBSERVAÇÃO |
|---|---|---|
| `apps/web/src/lib/supabase.ts` | `createClient(@supabase/supabase-js)` | Cliente Supabase criado só para autenticação (`persistSession`, `autoRefreshToken`, `storage: window.localStorage`). Nenhuma ocorrência de `supabase.from/rpc/functions` em todo `apps/web/src` — não há acesso direto a dados via Supabase, apenas gestão de sessão. Consumido por `AuthContext.tsx`, `useUserSettings.ts` e `ws-client.ts` (para obter o token da sessão). |

## STORAGE_LOCAL (36 arquivos)

| ARQUIVO | REFERÊNCIA ENCONTRADA (padrão que casou) |
|---|---|
| `apps/web/src/lib/supabase.ts` | localStorage |
| `apps/web/src/modules/accounting/components/transacao-form/hooks/useRuleOverrides.ts` | localStorage |
| `apps/web/src/modules/accounting/hooks/useFinancialCategoryRulesStore.ts` | localStorage |
| `apps/web/src/modules/admin/components/knowledge/KnowledgeBaseManager.tsx` | localStorage |
| `apps/web/src/modules/admin/pages/AdminKnowledge.tsx` | localStorage |
| `apps/web/src/modules/auth/pages/Register.tsx` | localStorage; useQuery/useMutation |
| `apps/web/src/modules/contracts/hooks/useDocuments.ts` | localStorage; useQuery/useMutation |
| `apps/web/src/modules/contracts/hooks/useVariableRegistry.ts` | localStorage |
| `apps/web/src/modules/integrations/components/DeezerConfigDialog.tsx` | sessionStorage |
| `apps/web/src/modules/integrations/components/SpotifyConfigDialog.tsx` | localStorage |
| `apps/web/src/modules/integrations/components/YouTubeConfigDialog.tsx` | localStorage |
| `apps/web/src/modules/integrations/hooks/useChat.ts` | localStorage; useQuery/useMutation |
| `apps/web/src/modules/integrations/hooks/useClicksign.ts` | sessionStorage; useQuery/useMutation |
| `apps/web/src/modules/integrations/hooks/useNfe.ts` | localStorage; sessionStorage; useQuery/useMutation |
| `apps/web/src/modules/integrations/hooks/useSigningProviders.ts` | sessionStorage; useQuery/useMutation |
| `apps/web/src/modules/integrations/pages/oauth-token-boundary.test.ts` | sessionStorage |
| `apps/web/src/modules/monitoring/rights/services/catalog-lookup.ts` | localStorage |
| `apps/web/src/modules/releases/services/distribution-platforms.ts` | localStorage |
| `apps/web/src/modules/settings/components/LogoUploader.tsx` | localStorage |
| `apps/web/src/modules/settings/hooks/useUserSettings.ts` | localStorage |
| `apps/web/src/modules/settings/pages/Perfil.tsx` | localStorage |
| `apps/web/src/modules/settings/services/settings.service.test.ts` | localStorage |
| `apps/web/src/shared/constants/index.ts` | localStorage |
| `apps/web/src/shared/governance/permissions.ts` | localStorage |
| `apps/web/src/shared/integrations/contracts/chat.contract.ts` | localStorage |
| `apps/web/src/shared/integrations/contracts/music-monitoring.contract.ts` | localStorage |
| `apps/web/src/shared/integrations/contracts/rights.contract.ts` | localStorage |
| `apps/web/src/shared/integrations/registry.ts` | localStorage |
| `apps/web/src/shared/integrations/types.ts` | localStorage |
| `apps/web/src/shared/lib/local-store.ts` | localStorage |
| `apps/web/src/shared/lib/migrations.ts` | localStorage; sessionStorage |
| `apps/web/src/shared/lib/safe-storage.ts` | localStorage; sessionStorage |
| `apps/web/src/shared/lib/tenant-isolation.ts` | localStorage |
| `apps/web/src/shared/types/database.ts` | localStorage |
| `apps/web/src/test/safe-storage.test.ts` | sessionStorage |
| `apps/web/src/test/tenant-labels.test.ts` | localStorage |

## MOCK (5 arquivos)

| ARQUIVO | REFERÊNCIA ENCONTRADA (padrão que casou) |
|---|---|
| `apps/web/src/modules/integrations/services/contrato.mapper.ts` | mockData/MOCK_MODE |
| `apps/web/src/modules/integrations/services/transacao.mapper.ts` | mockData/MOCK_MODE |
| `apps/web/src/modules/integrations/webhooks/stripe.webhook.ts` | mockData/MOCK_MODE |
| `apps/web/src/shared/governance/naming.ts` | localStorage; mockData/MOCK_MODE |
| `apps/web/src/shared/lib/env.ts` | mockData/MOCK_MODE |

## MEMORY (20 arquivos)

Todos via `import { create } from 'zustand'` (stores em memória no cliente, por módulo):

| ARQUIVO |
|---|
| `apps/web/src/modules/accounting/hooks/accounting.store.ts` |
| `apps/web/src/modules/artist/hooks/artist.store.ts` |
| `apps/web/src/modules/catalog/hooks/catalog.store.ts` |
| `apps/web/src/modules/contracts/hooks/contracts.store.ts` |
| `apps/web/src/modules/crm-relationships/store/contact-agenda.store.ts` |
| `apps/web/src/modules/crm-relationships/store/contact-filters.store.ts` |
| `apps/web/src/modules/crm-relationships/store/contact-panel.store.ts` |
| `apps/web/src/modules/crm-relationships/store/contact-tags.store.ts` |
| `apps/web/src/modules/events/hooks/events.store.ts` |
| `apps/web/src/modules/inventory/hooks/inventory.store.ts` |
| `apps/web/src/modules/leads/store/lead-filters.store.ts` |
| `apps/web/src/modules/leads/store/lead-interactions.store.ts` |
| `apps/web/src/modules/leads/store/lead-modal.store.ts` |
| `apps/web/src/modules/leads/store/lead-uploads.store.ts` |
| `apps/web/src/modules/licensing/hooks/licensing.store.ts` |
| `apps/web/src/modules/monitoring/hooks/monitoring.store.ts` |
| `apps/web/src/modules/projects/hooks/projects.store.ts` |
| `apps/web/src/modules/releases/hooks/releases.store.ts` |
| `apps/web/src/modules/rh/hooks/rh.store.ts` |
| `apps/web/src/modules/settings/hooks/settings.store.ts` |

## EXTERNAL_SERVICE (3 arquivos)

| ARQUIVO | REFERÊNCIA ENCONTRADA (padrão que casou) | OBSERVAÇÃO |
|---|---|---|
| `apps/web/src/modules/integrations/components/MarketingOAuthDialog.tsx` | fetch(; sessionStorage | Fluxo de OAuth de marketing (Meta/Google Ads etc.) |
| `apps/web/src/modules/integrations/pages/OAuthCallbackPage.tsx` | fetch(; sessionStorage | Callback de OAuth genérico |
| `apps/web/src/modules/integrations/pages/OAuthPopupPage.tsx` | fetch(; localStorage | Contém URLs de terceiros hard-coded (`facebook.com/v18.0/dialog/oauth`, `accounts.google.com/o/oauth2/v2/auth`, `account-d.docusign.com`, portais de distribuidoras como `distrokid.com`, `app.onerpm.com`, `app.symphonicms.com`, `soundon.global`, `app.musicpro.com.br`, `somvibe.com.br`) — o navegador navega diretamente para esses domínios, fora do backend. |

## WRAPPER (55 arquivos)

Camada de orquestração (hooks de query/mutation que não chamam `api.*`/`fetch` diretamente — presumivelmente delegam a um `*.service.ts` — e os próprios arquivos `*.service.ts` para os quais não foi encontrada chamada HTTP direta pelo grep) mais os dois clients de transporte da aplicação (`api-client.ts`, `ws-client.ts`) e `stripe.client.ts` (nomeado como client externo, mas na prática chama o backend):

| ARQUIVO | REFERÊNCIA ENCONTRADA (padrão que casou) |
|---|---|
| `apps/web/src/modules/accounting/pages/TransacaoRules.tsx` | useQuery/useMutation |
| `apps/web/src/modules/accounting/services/accounting.service.ts` | *.service.ts (nome de arquivo) |
| `apps/web/src/modules/admin/pages/AdminClients.tsx` | useQuery/useMutation |
| `apps/web/src/modules/admin/pages/AdminDashboard.tsx` | useQuery/useMutation |
| `apps/web/src/modules/admin/pages/AdminSubscriptions.tsx` | useQuery/useMutation |
| `apps/web/src/modules/artist/components/ArtistaEvolucaoSection.tsx` | useQuery/useMutation |
| `apps/web/src/modules/artist/components/ArtistaPlatformMetrics.tsx` | useQuery/useMutation |
| `apps/web/src/modules/artist/hooks/useArtistasAssinados.ts` | useQuery/useMutation |
| `apps/web/src/modules/artist/services/artista.service.ts` | *.service.ts (nome de arquivo) |
| `apps/web/src/modules/audiovisual/hooks/useAudiovisual.ts` | useQuery/useMutation |
| `apps/web/src/modules/auth/services/activation-plans.service.ts` | *.service.ts (nome de arquivo) |
| `apps/web/src/modules/catalog/services/catalog.service.ts` | *.service.ts (nome de arquivo) |
| `apps/web/src/modules/contracts/hooks/useContractServiceTypes.ts` | useQuery/useMutation |
| `apps/web/src/modules/contracts/services/contracts.service.ts` | *.service.ts (nome de arquivo) |
| `apps/web/src/modules/crm-relationships/services/contacts.service.ts` | *.service.ts (nome de arquivo) |
| `apps/web/src/modules/events/components/SchedulerFormModal.tsx` | useQuery/useMutation |
| `apps/web/src/modules/events/services/events.service.ts` | *.service.ts (nome de arquivo) |
| `apps/web/src/modules/integrations/clients/stripe.client.ts` | api.get/post( — chama o backend (`/billing/checkout`, `/billing/portal`, `/billing/subscription`), não a Stripe diretamente |
| `apps/web/src/modules/integrations/hooks/useAutentique.ts` | useQuery/useMutation |
| `apps/web/src/modules/integrations/hooks/useEcad.ts` | useQuery/useMutation |
| `apps/web/src/modules/integrations/hooks/useR2.ts` | useQuery/useMutation |
| `apps/web/src/modules/integrations/hooks/useResend.ts` | useQuery/useMutation |
| `apps/web/src/modules/integrations/hooks/useUbc.ts` | useQuery/useMutation |
| `apps/web/src/modules/integrations/services/notifications.service.ts` | *.service.ts (nome de arquivo) |
| `apps/web/src/modules/integrations/services/signing.service.ts` | *.service.ts (nome de arquivo) |
| `apps/web/src/modules/inventory/services/inventory.service.ts` | *.service.ts (nome de arquivo) |
| `apps/web/src/modules/licensing/services/licensing.service.ts` | *.service.ts (nome de arquivo) |
| `apps/web/src/modules/marketing/campaigns/domain/financial-report.service.ts` | *.service.ts (nome de arquivo) |
| `apps/web/src/modules/marketing/hooks/useMarketingAI.ts` | useQuery/useMutation |
| `apps/web/src/modules/marketing/hooks/useMarketingAnalytics.ts` | useQuery/useMutation |
| `apps/web/src/modules/marketing/hooks/useMarketingAutomations.ts` | useQuery/useMutation |
| `apps/web/src/modules/marketing/hooks/useMarketingCampaigns.ts` | useQuery/useMutation |
| `apps/web/src/modules/marketing/hooks/useMarketingDashboard.ts` | useQuery/useMutation |
| `apps/web/src/modules/marketing/hooks/useMarketingDeliverables.ts` | useQuery/useMutation |
| `apps/web/src/modules/marketing/hooks/useMarketingResource.ts` | useQuery/useMutation |
| `apps/web/src/modules/marketing/services/marketing-automation.service.ts` | *.service.ts (nome de arquivo) |
| `apps/web/src/modules/monitoring/services/monitoring.service.ts` | *.service.ts (nome de arquivo) |
| `apps/web/src/modules/musicchat/hooks/useMusicChatAutomationSettings.ts` | useQuery/useMutation |
| `apps/web/src/modules/musicchat/hooks/useMusicChatTriageRules.ts` | useQuery/useMutation |
| `apps/web/src/modules/projects/services/projects.service.ts` | *.service.ts (nome de arquivo) |
| `apps/web/src/modules/releases/services/releases.service.ts` | *.service.ts (nome de arquivo) |
| `apps/web/src/modules/reports/hooks/useReports.ts` | useQuery/useMutation |
| `apps/web/src/modules/rh/services/rh.service.ts` | *.service.ts (nome de arquivo) |
| `apps/web/src/modules/settings/pages/Billing.tsx` | useQuery/useMutation |
| `apps/web/src/modules/settings/services/settings.service.ts` | localStorage; *.service.ts (nome de arquivo) |
| `apps/web/src/shared/hooks/useAudit.ts` | useQuery/useMutation |
| `apps/web/src/shared/hooks/useDataQuery.ts` | useQuery/useMutation |
| `apps/web/src/shared/hooks/useEntityDetail.ts` | useQuery/useMutation |
| `apps/web/src/shared/hooks/usePlanFeatures.ts` | useQuery/useMutation |
| `apps/web/src/shared/hooks/useRealtimeSync.ts` | useQuery/useMutation |
| `apps/web/src/shared/hooks/useWorkflowTransition.ts` | useQuery/useMutation |
| `apps/web/src/shared/infrastructure/RealtimeLayer.tsx` | useQuery/useMutation |
| `apps/web/src/shared/lib/api-client.ts` | fetch( — wrapper HTTP central usado por praticamente todos os `*.service.ts` e hooks `API_HTTP` acima |
| `apps/web/src/shared/lib/ws-client.ts` | socket.io-client — WebSocket persistente para a API NestJS |
| `apps/web/src/test/ArtistaEvolucaoSection.test.tsx` | useQuery/useMutation |

## OUTRO (0 arquivos)

Nenhum arquivo do universo pesquisado ficou sem classificação em uma das categorias acima.

---

## Totais

```text
TOTAL_FILES_WITH_DATA_ACCESS: 180

API_HTTP_FILES: 60

SUPABASE_DIRECT_FILES: 1

STORAGE_LOCAL_FILES: 36

MOCK_FILES: 5

MEMORY_FILES: 20

EXTERNAL_SERVICE_FILES: 3

WRAPPER_FILES: 55

OTHER_FILES: 0
```

(`axios`, `supabase.from/rpc/functions` e `IndexedDB` retornaram zero ocorrências em `apps/web/src` — registrado como fato, não como categoria com arquivos.)

## Lista única de todos os arquivos encontrados (180)

`apps/web/src/app/providers/AuthContext.tsx`, `apps/web/src/app/providers/BillingContext.tsx`, `apps/web/src/app/providers/TenantContext.tsx`, `apps/web/src/lib/supabase.ts`, `apps/web/src/modules/accounting/components/transacao-form/hooks/useRuleOverrides.ts`, `apps/web/src/modules/accounting/hooks/accounting.store.ts`, `apps/web/src/modules/accounting/hooks/useFinancialCategoryRulesStore.ts`, `apps/web/src/modules/accounting/pages/TransacaoRules.tsx`, `apps/web/src/modules/accounting/services/accounting.service.ts`, `apps/web/src/modules/accounting/services/financial-categories.service.ts`, `apps/web/src/modules/admin/components/knowledge/KnowledgeBaseManager.tsx`, `apps/web/src/modules/admin/pages/AdminAudit.tsx`, `apps/web/src/modules/admin/pages/AdminClients.tsx`, `apps/web/src/modules/admin/pages/AdminDashboard.tsx`, `apps/web/src/modules/admin/pages/AdminKnowledge.tsx`, `apps/web/src/modules/admin/pages/AdminSubscriptions.tsx`, `apps/web/src/modules/admin/pages/AdminSupport.tsx`, `apps/web/src/modules/admin/pages/Auditoria.tsx`, `apps/web/src/modules/admin/services/admin-audit.service.ts`, `apps/web/src/modules/admin/services/admin-billing.service.ts`, `apps/web/src/modules/admin/services/admin-plans.service.ts`, `apps/web/src/modules/admin/services/admin-support.service.ts`, `apps/web/src/modules/admin/services/admin-tenants.service.ts`, `apps/web/src/modules/artist/components/ArtistaEvolucaoSection.tsx`, `apps/web/src/modules/artist/components/ArtistaPlatformMetrics.tsx`, `apps/web/src/modules/artist/hooks/artist.store.ts`, `apps/web/src/modules/artist/hooks/useArtistasAssinados.ts`, `apps/web/src/modules/artist/hooks/useArtistPlatformProfiles.ts`, `apps/web/src/modules/artist/services/artista.service.ts`, `apps/web/src/modules/audiovisual/hooks/useAudiovisual.ts`, `apps/web/src/modules/audiovisual/services/audiovisual.service.ts`, `apps/web/src/modules/auth/pages/Onboarding.tsx`, `apps/web/src/modules/auth/pages/Register.tsx`, `apps/web/src/modules/auth/services/activation-plans.service.ts`, `apps/web/src/modules/catalog/hooks/catalog.store.ts`, `apps/web/src/modules/catalog/services/catalog.service.ts`, `apps/web/src/modules/contracts/hooks/contracts.store.ts`, `apps/web/src/modules/contracts/hooks/useContractServiceTypes.ts`, `apps/web/src/modules/contracts/hooks/useDocuments.ts`, `apps/web/src/modules/contracts/hooks/useVariableRegistry.ts`, `apps/web/src/modules/contracts/services/contracts.service.ts`, `apps/web/src/modules/contracts/services/semantic-parser.service.ts`, `apps/web/src/modules/crm-relationships/services/clients.service.ts`, `apps/web/src/modules/crm-relationships/services/contacts.service.ts`, `apps/web/src/modules/crm-relationships/store/contact-agenda.store.ts`, `apps/web/src/modules/crm-relationships/store/contact-filters.store.ts`, `apps/web/src/modules/crm-relationships/store/contact-panel.store.ts`, `apps/web/src/modules/crm-relationships/store/contact-tags.store.ts`, `apps/web/src/modules/dashboard/hooks/useActivityHistory.ts`, `apps/web/src/modules/dashboard/hooks/useOperationalDashboard.ts`, `apps/web/src/modules/events/components/SchedulerFormModal.tsx`, `apps/web/src/modules/events/hooks/events.store.ts`, `apps/web/src/modules/events/services/events.service.ts`, `apps/web/src/modules/integrations/clients/stripe.client.ts`, `apps/web/src/modules/integrations/components/DeezerConfigDialog.tsx`, `apps/web/src/modules/integrations/components/MarketingOAuthDialog.tsx`, `apps/web/src/modules/integrations/components/SpotifyConfigDialog.tsx`, `apps/web/src/modules/integrations/components/YouTubeConfigDialog.tsx`, `apps/web/src/modules/integrations/hooks/useAbramus.ts`, `apps/web/src/modules/integrations/hooks/useACRCloud.ts`, `apps/web/src/modules/integrations/hooks/useAppleMusic.ts`, `apps/web/src/modules/integrations/hooks/useAutentique.ts`, `apps/web/src/modules/integrations/hooks/useChat.ts`, `apps/web/src/modules/integrations/hooks/useClicksign.ts`, `apps/web/src/modules/integrations/hooks/useDeezer.ts`, `apps/web/src/modules/integrations/hooks/useEcad.ts`, `apps/web/src/modules/integrations/hooks/useGoogleAds.ts`, `apps/web/src/modules/integrations/hooks/useInstagram.ts`, `apps/web/src/modules/integrations/hooks/useMarketingOAuth.ts`, `apps/web/src/modules/integrations/hooks/useNfe.ts`, `apps/web/src/modules/integrations/hooks/useR2.ts`, `apps/web/src/modules/integrations/hooks/useResend.ts`, `apps/web/src/modules/integrations/hooks/useSigningProviders.ts`, `apps/web/src/modules/integrations/hooks/useSoundCloud.ts`, `apps/web/src/modules/integrations/hooks/useSpotify.ts`, `apps/web/src/modules/integrations/hooks/useStripe.ts`, `apps/web/src/modules/integrations/hooks/useTikTok.ts`, `apps/web/src/modules/integrations/hooks/useTikTokAds.ts`, `apps/web/src/modules/integrations/hooks/useUbc.ts`, `apps/web/src/modules/integrations/hooks/useYouTube.ts`, `apps/web/src/modules/integrations/pages/OAuthCallbackPage.tsx`, `apps/web/src/modules/integrations/pages/oauth-token-boundary.test.ts`, `apps/web/src/modules/integrations/pages/OAuthPopupPage.tsx`, `apps/web/src/modules/integrations/services/contrato.mapper.ts`, `apps/web/src/modules/integrations/services/notifications.service.ts`, `apps/web/src/modules/integrations/services/signing.service.ts`, `apps/web/src/modules/integrations/services/transacao.mapper.ts`, `apps/web/src/modules/integrations/webhooks/stripe.webhook.ts`, `apps/web/src/modules/inventory/hooks/inventory.store.ts`, `apps/web/src/modules/inventory/services/inventory.service.ts`, `apps/web/src/modules/leads/services/leads.service.ts`, `apps/web/src/modules/leads/store/lead-filters.store.ts`, `apps/web/src/modules/leads/store/lead-interactions.store.ts`, `apps/web/src/modules/leads/store/lead-modal.store.ts`, `apps/web/src/modules/leads/store/lead-uploads.store.ts`, `apps/web/src/modules/licensing/hooks/licensing.store.ts`, `apps/web/src/modules/licensing/services/licensing.service.ts`, `apps/web/src/modules/marketing/ai/providers/providerRouter.ts`, `apps/web/src/modules/marketing/campaigns/domain/financial-report.service.ts`, `apps/web/src/modules/marketing/components/campaign-builder/useIbgeLocations.ts`, `apps/web/src/modules/marketing/hooks/useCentralAnaliticaMarketing.ts`, `apps/web/src/modules/marketing/hooks/useMarketingAI.ts`, `apps/web/src/modules/marketing/hooks/useMarketingAnalytics.ts`, `apps/web/src/modules/marketing/hooks/useMarketingAssets.ts`, `apps/web/src/modules/marketing/hooks/useMarketingAutomations.ts`, `apps/web/src/modules/marketing/hooks/useMarketingCampaigns.ts`, `apps/web/src/modules/marketing/hooks/useMarketingDashboard.ts`, `apps/web/src/modules/marketing/hooks/useMarketingDeliverables.ts`, `apps/web/src/modules/marketing/hooks/useMarketingResource.ts`, `apps/web/src/modules/marketing/hooks/useMetas.ts`, `apps/web/src/modules/marketing/services/marketing-automation.service.ts`, `apps/web/src/modules/marketing/services/marketing.service.ts`, `apps/web/src/modules/monitoring/hooks/monitoring.store.ts`, `apps/web/src/modules/monitoring/rights/services/catalog-lookup.ts`, `apps/web/src/modules/monitoring/services/monitoring.service.ts`, `apps/web/src/modules/musicchat/hooks/useMusicChatAutomationSettings.ts`, `apps/web/src/modules/musicchat/hooks/useMusicChatTriageRules.ts`, `apps/web/src/modules/musicchat/services/conversations.service.ts`, `apps/web/src/modules/musicchat/services/musicchat-automation.service.ts`, `apps/web/src/modules/projects/hooks/projects.store.ts`, `apps/web/src/modules/projects/services/projects.service.ts`, `apps/web/src/modules/releases/hooks/releases.store.ts`, `apps/web/src/modules/releases/services/distribution-platforms.ts`, `apps/web/src/modules/releases/services/releases.service.ts`, `apps/web/src/modules/reports/hooks/useReports.ts`, `apps/web/src/modules/reports/services/reports-api.ts`, `apps/web/src/modules/rh/hooks/rh.store.ts`, `apps/web/src/modules/rh/services/rh.service.ts`, `apps/web/src/modules/settings/components/LogoUploader.tsx`, `apps/web/src/modules/settings/hooks/settings.store.ts`, `apps/web/src/modules/settings/hooks/useAuditTrail.ts`, `apps/web/src/modules/settings/hooks/useCompanySettings.ts`, `apps/web/src/modules/settings/hooks/useRoles.ts`, `apps/web/src/modules/settings/hooks/useUsuarios.ts`, `apps/web/src/modules/settings/hooks/useUserSettings.ts`, `apps/web/src/modules/settings/pages/AuditTrail.tsx`, `apps/web/src/modules/settings/pages/Billing.tsx`, `apps/web/src/modules/settings/pages/Configuracoes.tsx`, `apps/web/src/modules/settings/pages/Perfil.tsx`, `apps/web/src/modules/settings/services/billing-invoices.service.ts`, `apps/web/src/modules/settings/services/billing-plans.service.ts`, `apps/web/src/modules/settings/services/company-logo.service.ts`, `apps/web/src/modules/settings/services/settings.service.test.ts`, `apps/web/src/modules/settings/services/settings.service.ts`, `apps/web/src/modules/support/hooks/useSupport.ts`, `apps/web/src/modules/workspace/hooks/useWorkspace.ts`, `apps/web/src/shared/components/ChatAttachment.tsx`, `apps/web/src/shared/components/MainLayout.tsx`, `apps/web/src/shared/constants/index.ts`, `apps/web/src/shared/governance/naming.ts`, `apps/web/src/shared/governance/permissions.ts`, `apps/web/src/shared/hooks/useAI.ts`, `apps/web/src/shared/hooks/useAudit.ts`, `apps/web/src/shared/hooks/useDataQuery.ts`, `apps/web/src/shared/hooks/useEntityDetail.ts`, `apps/web/src/shared/hooks/usePlanFeatures.ts`, `apps/web/src/shared/hooks/useRealtimeSync.ts`, `apps/web/src/shared/hooks/useUploadToR2.ts`, `apps/web/src/shared/hooks/useWorkflowTransition.ts`, `apps/web/src/shared/infrastructure/RealtimeLayer.tsx`, `apps/web/src/shared/integrations/contracts/chat.contract.ts`, `apps/web/src/shared/integrations/contracts/music-monitoring.contract.ts`, `apps/web/src/shared/integrations/contracts/rights.contract.ts`, `apps/web/src/shared/integrations/registry.ts`, `apps/web/src/shared/integrations/types.ts`, `apps/web/src/shared/lib/api-client.test.ts`, `apps/web/src/shared/lib/api-client.ts`, `apps/web/src/shared/lib/env.ts`, `apps/web/src/shared/lib/local-store.ts`, `apps/web/src/shared/lib/masks.ts`, `apps/web/src/shared/lib/migrations.ts`, `apps/web/src/shared/lib/safe-storage.ts`, `apps/web/src/shared/lib/storage.ts`, `apps/web/src/shared/lib/tenant-isolation.ts`, `apps/web/src/shared/lib/ws-client.ts`, `apps/web/src/shared/types/database.ts`, `apps/web/src/test/ArtistaEvolucaoSection.test.tsx`, `apps/web/src/test/safe-storage.test.ts`, `apps/web/src/test/tenant-labels.test.ts`

## Cobertura

Busca por padrão de texto em `apps/web/src/**/*.{ts,tsx}` (não cobre `apps/web/public`, `apps/web/scripts` nem `node_modules`, que não fazem parte do código-fonte da aplicação). Arquivos de teste (`*.test.ts(x)`, `*.spec.ts`) foram incluídos na busca porque também casaram com os padrões pedidos — não foram filtrados, conforme o escopo do prompt não pedir exclusão. Nenhum conteúdo de endpoint, body, response, permissão, paginação, filtro, erro ou regra de negócio foi extraído nesta etapa.
