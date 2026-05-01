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
  // Dynamic data that changes frequently (transações, vendas, eventos)
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
  ARTISTAS: ["artistas"] as const,
  PROJETOS: ["projetos"] as const,
  CONTRATOS: ["contratos"] as const,
  CLIENTES: ["clientes"] as const,
  CONTATOS: ["contatos"] as const,
  
  // Financial
  TRANSACOES: ["transacoes"] as const,
  VENDAS: ["vendas"] as const,
  NOTAS_FISCAIS: ["notas-fiscais"] as const,
  REGRAS: ["regras"] as const,
  RELATORIOS_ECAD: ["relatorios-ecad"] as const,
  
  // Content
  OBRAS: ["obras"] as const,
  FONOGRAMAS: ["fonogramas"] as const,
  LANCAMENTOS: ["lancamentos"] as const,
  SHARES: ["shares"] as const,
  LICENCAS: ["licencas"] as const,
  TAKEDOWNS: ["takedowns"] as const,
  DETECCOES: ["deteccoes"] as const,
  
  // Marketing
  CAMPANHAS: ["campanhas"] as const,
  BRIEFINGS: ["briefings"] as const,
  TAREFAS_MARKETING: ["tarefas-marketing"] as const,
  METAS_ARTISTAS: ["metas-artistas"] as const,
  CONTEUDOS: ["conteudos"] as const,
  
  // Settings & Admin
  TEMPLATES: ["templates"] as const,
  TEMPLATES_CONTRATOS: ["templates-contratos"] as const,
  USER_SETTINGS: ["user-settings"] as const,
  INVENTARIO: ["inventario"] as const,
  USUARIOS: ["usuarios"] as const,
  
  // Real-time
  NOTIFICATIONS: ["notifications"] as const,
  EVENTOS: ["eventos"] as const,
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
  
  // RH (Recursos Humanos)
  FUNCIONARIOS: ["funcionarios"] as const,
  FOLHA_PAGAMENTO: ["folha-pagamento"] as const,
  FERIAS_AUSENCIAS: ["ferias-ausencias"] as const,
  DOCUMENTOS_FUNCIONARIO: ["documentos-funcionario"] as const,
  
  // Auth & RBAC
  ROLES: ["roles"] as const,
  PERMISSIONS: ["permissions"] as const,
} as const;

// Map query keys to their cache configuration
export const QUERY_CACHE_CONFIG: Record<string, typeof CACHE_TIMES[keyof typeof CACHE_TIMES]> = {
  // Static/Semi-static
  templates: CACHE_TIMES.SEMI_STATIC,
  "templates-contratos": CACHE_TIMES.SEMI_STATIC,
  "user-settings": CACHE_TIMES.SEMI_STATIC,
  regras: CACHE_TIMES.SEMI_STATIC,
  roles: CACHE_TIMES.SEMI_STATIC,
  permissions: CACHE_TIMES.SEMI_STATIC,
  
  // Dynamic
  artistas: CACHE_TIMES.DYNAMIC,
  projetos: CACHE_TIMES.DYNAMIC,
  contratos: CACHE_TIMES.DYNAMIC,
  clientes: CACHE_TIMES.DYNAMIC,
  contatos: CACHE_TIMES.DYNAMIC,
  transacoes: CACHE_TIMES.DYNAMIC,
  vendas: CACHE_TIMES.DYNAMIC,
  "notas-fiscais": CACHE_TIMES.DYNAMIC,
  "relatorios-ecad": CACHE_TIMES.DYNAMIC,
  obras: CACHE_TIMES.DYNAMIC,
  fonogramas: CACHE_TIMES.DYNAMIC,
  lancamentos: CACHE_TIMES.DYNAMIC,
  licencas: CACHE_TIMES.DYNAMIC,
  shares: CACHE_TIMES.DYNAMIC,
  takedowns: CACHE_TIMES.DYNAMIC,
  deteccoes: CACHE_TIMES.DYNAMIC,
  campanhas: CACHE_TIMES.DYNAMIC,
  briefings: CACHE_TIMES.DYNAMIC,
  "tarefas-marketing": CACHE_TIMES.DYNAMIC,
  conteudos: CACHE_TIMES.DYNAMIC,
  inventario: CACHE_TIMES.DYNAMIC,
  usuarios: CACHE_TIMES.DYNAMIC,
  
  leads: CACHE_TIMES.DYNAMIC,
  "lead-interactions": CACHE_TIMES.DYNAMIC,
  funcionarios: CACHE_TIMES.DYNAMIC,
  "folha-pagamento": CACHE_TIMES.DYNAMIC,
  "ferias-ausencias": CACHE_TIMES.DYNAMIC,
  "documentos-funcionario": CACHE_TIMES.DYNAMIC,
  
  // Real-time
  notifications: CACHE_TIMES.REALTIME,
  eventos: CACHE_TIMES.REALTIME,
  metrics: CACHE_TIMES.REALTIME,
  "metas-artistas": CACHE_TIMES.REALTIME,
  
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
        // Retry failed mutations once
        retry: 1,
        retryDelay: 1000,
        
        // Network mode
        networkMode: "offlineFirst",
      },
    },
  });
}
