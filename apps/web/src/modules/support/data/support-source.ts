/**
 * modules/support/data/support-source.ts
 *
 * Exposure gate for the Support mocks that have no real endpoint yet.
 * - SUPPORT_SYSTEM_SERVICES, SUPPORT_INCIDENTS: no backend implemented →
 *   empty in production.
 *
 * Real tickets use /support-tickets via useTickets in useSupport.ts.
 * The Knowledge Base (categories/articles) uses the real backend via
 * useKnowledgeCategories/useKnowledgeArticles — it no longer reads from this file.
 */
import type {
  SystemService, Incident,
} from "../types";

export const SUPPORT_DATA_IS_MOCK = false as const;

export const SUPPORT_SYSTEM_SERVICES: SystemService[]      = [];
export const SUPPORT_INCIDENTS: Incident[]                 = [];
