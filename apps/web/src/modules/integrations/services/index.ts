/**
 * integrations/services/index.ts
 *
 * Barrel of all integration orchestration services.
 * These services coordinate multiple adapters + domain events.
 *
 * RULE: modules ALWAYS import from here when they need to orchestrate
 * more than one integration in a single operation.
 */

export { signingService }       from "./signing.service";
export type { SendForSigningInput, SendForSigningResult } from "./signing.service";

export { notificationsService } from "./notifications.service";
export type {
  SendUserInviteInput,
  SendContractExpiryAlertInput,
  SendReleaseStatusInput,
} from "./notifications.service";
