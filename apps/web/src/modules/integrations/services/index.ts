/**
 * integrations/services/index.ts
 *
 * Barrel de todos os serviços de orquestração de integrações.
 * Estes serviços coordenam múltiplos adapters + domain events.
 *
 * REGRA: módulos importam SEMPRE daqui quando precisam de orquestrar
 * mais do que uma integração numa única operação.
 */

export { signingService }       from "./signing.service";
export type { SendForSigningInput, SendForSigningResult } from "./signing.service";

export { notificationsService } from "./notifications.service";
export type {
  SendUserInviteInput,
  SendContratoExpiryAlertInput,
  SendReleaseStatusInput,
} from "./notifications.service";
