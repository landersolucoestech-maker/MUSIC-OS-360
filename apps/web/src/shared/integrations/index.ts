/**
 * shared/integrations/index.ts
 *
 * Main barrel of the MUSIC OS 360 integrations system.
 *
 * Structure:
 *   types.ts    — IntegrationId, IntegrationCategory, IntegrationStatus, etc.
 *   registry.ts — central metadata of every integration
 *   contracts/  — IXxxProvider interfaces per category
 *
 * RULE: domain code imports from "@/modules/<domain>/adapters/<x>.adapter"
 * and NOT directly from "@/shared/integrations".
 * This barrel is for internal infrastructure and Settings use.
 */

export type {
  IntegrationId,
  IntegrationCategory,
  IntegrationStatus,
  IntegrationMeta,
  IntegrationCredentials,
  IntegrationHealthCheck,
  IntegrationRuntimeStatus,
} from "./types";

export {
  INTEGRATION_REGISTRY,
  getIntegration,
  getIntegrationsByCategory,
  getAllIntegrations,
  getAllCategories,
  credentialsStorageKey,
} from "./registry";

export {
  INTEGRATION_LOGOS,
  getIntegrationLogo,
  type IntegrationLogoId,
  type IntegrationLogoMeta,
} from "./logos";
export { IntegrationLogo } from "./IntegrationLogo";
export { IntegrationDialogHeader } from "./IntegrationDialogHeader";

export * from "./contracts";
