import { QueryClient } from "@tanstack/react-query";

// Cache time configurations (in milliseconds)
export const CACHE_TIMES = {
  // Static data that rarely changes
  STATIC: {
    staleTime: 30 * 60 * 1000, // 30 minutes
    gcTime: 60 * 60 * 1000, // 1 hour (formerly cacheTime)
  },
  // Semi-static data (catalogo, templates, configurações)
  SEMI_STATIC: {
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  },
  // Dynamic data that changes frequently (transações, comercial, eventos)
  DYNAMIC: {
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  },
  // Real-time data (notifications, metrics)
  REALTIME: {
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
  },
} as const;

// Query key prefixes for organized cache management
export const QUERY_KEYS = {
  // Core entities
  ARTISTS: ["artists"] as const,
  PROJECTS: ["projects"] as const,
  CONTRACTS: ["contracts"] as const,
  CLIENTS: ["clients"] as const,
  CONTACTS: ["contacts"] as const,

  // Financial
  TRANSACTIONS: ["transactions"] as const,
  INVOICES: ["invoices"] as const,
  RULES: ["rules"] as const,
  FINANCIAL_RULES: ["financial-rules"] as const,
  ECAD_REPORTS: ["ecad-reports"] as const,

  // Content
  WORKS: ["works"] as const,
  PHONOGRAMS: ["phonograms"] as const,
  RELEASES: ["releases"] as const,
  SHARES: ["shares"] as const,
  LICENSES: ["licenses"] as const,
  TAKEDOWNS: ["takedowns"] as const,
  CONTENT_DETECTIONS: ["content-detections"] as const,

  // Marketing
  CAMPAIGNS: ["campaigns"] as const,
  BRIEFINGS: ["briefings"] as const,
  MARKETING_TASKS: ["marketing-tasks"] as const,
  ARTIST_GOALS: ["artist-goals"] as const,
  CONTENT: ["content"] as const,

  // Settings & Admin
  TEMPLATES: ["templates"] as const,
  CONTRACT_TEMPLATES: ["contract-templates"] as const,
  USER_SETTINGS: ["user-settings"] as const,
  INVENTORY: ["inventory"] as const,
  USERS: ["users"] as const,

  // Real-time
  NOTIFICATIONS: ["notifications"] as const,
  EVENTS: ["events"] as const,
  METRICS: ["metrics"] as const,
  
  // External integrations
  META_AD_ACCOUNTS: ["meta-ad-accounts"] as const,
  META_CAMPAIGNS: ["meta-campaigns"] as const,
  META_INSIGHTS: ["meta-insights"] as const,
  META_CAMPAIGN_INSIGHTS: ["meta-campaign-insights"] as const,
  SPOTIFY_METRICS: ["spotify-metrics"] as const,
  YOUTUBE_METRICS: ["youtube-metrics"] as const,
  AUTENTIQUE_DOCUMENTS: ["autentique-documents"] as const,
  
  // Leads
  LEADS: ["leads"] as const,
  LEAD_INTERACTIONS: ["lead-interactions"] as const,
  PROPOSALS: ["proposals"] as const,
  PROPOSAL_ITEMS: ["proposal-items"] as const,
  FOLLOWUPS: ["followups"] as const,
  FINANCIAL_CATEGORIES: ["financial-categories"] as const,
  
  // RH (Recursos Humanos)
  EMPLOYEES: ["employees"] as const,
  PAYROLL: ["payroll"] as const,
  LEAVE_REQUESTS: ["leave-requests"] as const,
  EMPLOYEE_DOCUMENTS: ["employee-documents"] as const,
  
  // Auth & RBAC
  ROLES: ["roles"] as const,
  PERMISSIONS: ["permissions"] as const,
} as const;

// Map query keys to their cache configuration
export const QUERY_CACHE_CONFIG: Record<string, typeof CACHE_TIMES[keyof typeof CACHE_TIMES]> = {
  // Static/Semi-static
  templates: CACHE_TIMES.SEMI_STATIC,
  "contract-templates": CACHE_TIMES.SEMI_STATIC,
  "user-settings": CACHE_TIMES.SEMI_STATIC,
  rules: CACHE_TIMES.SEMI_STATIC,
  roles: CACHE_TIMES.SEMI_STATIC,
  permissions: CACHE_TIMES.SEMI_STATIC,

  // Dynamic
  artists: CACHE_TIMES.DYNAMIC,
  projects: CACHE_TIMES.DYNAMIC,
  contracts: CACHE_TIMES.DYNAMIC,
  clients: CACHE_TIMES.DYNAMIC,
  contacts: CACHE_TIMES.DYNAMIC,
  transactions: CACHE_TIMES.DYNAMIC,
  invoices: CACHE_TIMES.DYNAMIC,
  "ecad-reports": CACHE_TIMES.DYNAMIC,
  works: CACHE_TIMES.DYNAMIC,
  phonograms: CACHE_TIMES.DYNAMIC,
  releases: CACHE_TIMES.DYNAMIC,
  licenses: CACHE_TIMES.DYNAMIC,
  shares: CACHE_TIMES.DYNAMIC,
  takedowns: CACHE_TIMES.DYNAMIC,
  "content-detections": CACHE_TIMES.DYNAMIC,
  campaigns: CACHE_TIMES.DYNAMIC,
  briefings: CACHE_TIMES.DYNAMIC,
  "marketing-tasks": CACHE_TIMES.DYNAMIC,
  content: CACHE_TIMES.DYNAMIC,
  inventory: CACHE_TIMES.DYNAMIC,
  users: CACHE_TIMES.DYNAMIC,

  leads: CACHE_TIMES.DYNAMIC,
  "lead-interactions": CACHE_TIMES.DYNAMIC,
  proposals: CACHE_TIMES.DYNAMIC,
  "proposal-items": CACHE_TIMES.DYNAMIC,
  followups: CACHE_TIMES.DYNAMIC,
  "financial-categories": CACHE_TIMES.DYNAMIC,
  employees: CACHE_TIMES.DYNAMIC,
  payroll: CACHE_TIMES.DYNAMIC,
  "leave-requests": CACHE_TIMES.DYNAMIC,
  "employee-documents": CACHE_TIMES.DYNAMIC,

  // Real-time
  notifications: CACHE_TIMES.REALTIME,
  events: CACHE_TIMES.REALTIME,
  metrics: CACHE_TIMES.REALTIME,
  "artist-goals": CACHE_TIMES.REALTIME,
  
  // External integrations (cached longer - API rate limits)
  "meta-ad-accounts": CACHE_TIMES.SEMI_STATIC,
  "meta-campaigns": CACHE_TIMES.SEMI_STATIC,
  "meta-insights": CACHE_TIMES.SEMI_STATIC,
  "meta-campaign-insights": CACHE_TIMES.SEMI_STATIC,
  "spotify-metrics": CACHE_TIMES.SEMI_STATIC,
  "youtube-metrics": CACHE_TIMES.SEMI_STATIC,
  "autentique-documents": CACHE_TIMES.SEMI_STATIC,
};

// Helper to get cache config for a query key
export function getCacheConfig(queryKey: string[]): typeof CACHE_TIMES[keyof typeof CACHE_TIMES] {
  const primaryKey = queryKey[0];
  return QUERY_CACHE_CONFIG[primaryKey] || CACHE_TIMES.DYNAMIC;
}

// Create optimized QueryClient with global defaults
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Default to DYNAMIC cache settings
        staleTime: CACHE_TIMES.DYNAMIC.staleTime,
        gcTime: CACHE_TIMES.DYNAMIC.gcTime,
        
        // Retry configuration
        retry: 2,
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
        
        // Refetch behavior
        refetchOnWindowFocus: false, // Avoid unnecessary refetches
        refetchOnReconnect: true,
        refetchOnMount: true,
        
        // Network mode
        networkMode: "offlineFirst",
      },
      mutations: {
        // POST/PATCH/DELETE não são seguras para retry automático: se a
        // requisição chegou ao servidor mas a resposta se perdeu (timeout,
        // rede caiu), reenviar duplica a escrita (artista duplicado,
        // transação duplicada, etc.) sem nenhum aviso ao usuário — a UI já
        // seguiu em frente (toast/fechou modal) antes do retry silencioso
        // acontecer em background. Falhas de mutation já viram toast.error
        // (ver useDataQuery); o usuário pode tentar de novo manualmente.
        retry: 0,

        // Network mode
        networkMode: "offlineFirst",
      },
    },
  });
}
