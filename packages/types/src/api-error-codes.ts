/**
 * Single source of truth for the stable machine error codes that cross the
 * network (HTTP `error` field, `*_error_code` DTO fields, event `errorCode`).
 *
 * Producers (API) must emit only codes listed here; the web client maps each
 * code to the PT-BR default copy below. Raw provider/database/runtime text is
 * NEVER part of this contract: it stays in logs and internal columns.
 */
export const API_ERROR_CODE_COPY_PT_BR = {
  VALIDATION_FAILED: "Os dados enviados são inválidos. Revise os campos e tente novamente.",
  MUST_CHANGE_PASSWORD: "Troca de senha obrigatória antes de continuar.",
  TENANT_SUSPENDED: "O workspace está suspenso. Entre em contato com o suporte.",
  TENANT_READ_ONLY: "O workspace está em modo somente leitura.",
  PERMISSION_DENIED: "Você não tem permissão para realizar esta ação.",
  PLAN_LIMIT_REACHED: "O limite do seu plano foi atingido.",
  R2_NOT_CONFIGURED: "O envio de arquivos não está disponível no momento.",
  INVITE_CREATE_FAILED: "Não foi possível criar o convite. Tente novamente.",
  INVITE_METADATA_FAILED: "Não foi possível criar o convite. Tente novamente.",
  INVITE_RESEND_FAILED: "Não foi possível reenviar o convite. Tente novamente.",
  SESSION_UPDATE_FAILED: "Não foi possível atualizar a sessão. Tente novamente.",
  ROLE_UNKNOWN: "Papel desconhecido. Não é possível atribuí-lo.",
  SYNC_QUEUE_UNAVAILABLE: "A sincronização está indisponível no momento. Tente novamente.",
  PROFILE_NOT_FOUND: "Perfil não encontrado.",
  INVALID_XLSX_WORKBOOK: "A planilha enviada é inválida.",
  SINGLE_SHEET_REQUIRED: "A planilha deve conter uma única aba.",
  UNSUPPORTED_IMPORT_FORMAT: "Formato de importação não suportado.",
  UNSUPPORTED_EXPORT_FORMAT: "Formato de exportação não suportado.",
  INVALID_IMPORT_SIZE: "O arquivo de importação excede o tamanho permitido.",
  INVALID_IMPORT_ENCODING: "A codificação do arquivo de importação é inválida.",
  IMPORT_PARSER_BUSY: "A importação está ocupada. Tente novamente em instantes.",
  REPORT_ENTITY_NOT_AVAILABLE: "Este relatório não está disponível.",
  REPORT_CONTRACT_REQUIRED: "Selecione um contrato para gerar este relatório.",
  REPORT_EXPORT_TOO_LARGE: "O relatório é grande demais para exportar. Refine os filtros.",
  // Failure classes exposed instead of raw provider/database text.
  SYNC_FAILED: "Não foi possível sincronizar. Verifique o link do perfil e tente novamente.",
  PROVIDER_UNAUTHORIZED: "A integração não está autorizada. Reconecte a conta e tente novamente.",
  PROVIDER_RATE_LIMITED: "A integração atingiu o limite de uso. Tente novamente mais tarde.",
  PROVIDER_NOT_CONFIGURED: "A integração não está configurada.",
  CAPABILITY_UNAVAILABLE: "Este recurso depende de um provedor externo que ainda não está disponível.",
  IDENTITY_MISMATCH: "O perfil encontrado não corresponde ao artista. Verifique o link.",
  SOURCE_ACCOUNT_NOT_INDEXED: "A conta ainda não está disponível na fonte de dados.",
  PUBLICATION_FAILED: "Não foi possível publicar o conteúdo. Tente novamente.",
  SKILL_RUN_FAILED: "A execução da skill falhou. Tente novamente.",
  WORKFLOW_EXECUTION_FAILED: "A execução do fluxo falhou. Tente novamente.",
  INTEGRATION_CALL_FAILED: "A chamada à integração falhou. Tente novamente.",
  PROVIDER_NOT_CONNECTED: "A integração não está conectada. Conecte a conta e tente novamente.",
  PROVIDER_RESOURCE_NOT_FOUND: "O recurso não foi encontrado na integração.",
  DATABASE_UNAVAILABLE: "O serviço está temporariamente indisponível. Tente novamente em instantes.",
  DELIVERY_FAILED: "Não foi possível entregar a mensagem. Tente novamente.",
  SIGNATURE_PROVIDER_FAILED: "O provedor de assinatura não respondeu. Tente novamente.",
} as const;

export type ApiErrorCode = keyof typeof API_ERROR_CODE_COPY_PT_BR;

/** Runtime list of every stable code (derived from the copy table: one list). */
export const API_ERROR_CODES = Object.keys(API_ERROR_CODE_COPY_PT_BR) as ApiErrorCode[];

export function isApiErrorCode(value: unknown): value is ApiErrorCode {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(API_ERROR_CODE_COPY_PT_BR, value);
}

/**
 * Classifies raw failure text (provider/HTTP/database/network) into a stable
 * code. The raw text itself must never be serialized to clients.
 */
export function classifyFailureCode(raw: unknown, fallback: ApiErrorCode = "SYNC_FAILED"): ApiErrorCode {
  if (typeof raw !== "string" || raw.trim() === "") return fallback;
  const token = raw.match(/\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b/g)?.find(isApiErrorCode);
  if (token) return token;
  if (/\b(?:401|403)\b|unauthori[sz]ed|forbidden|invalid[_ ](?:token|credentials)/i.test(raw)) return "PROVIDER_UNAUTHORIZED";
  if (/\b429\b|rate.?limit|too many requests|quota/i.test(raw)) return "PROVIDER_RATE_LIMITED";
  // Capability seams (distributor/society/transcription/payout) have no provider at all:
  // a missing registration or an unconfigured capability port is CAPABILITY_UNAVAILABLE.
  // A plain "not configured" (credentials missing for an existing integration) keeps
  // mapping to PROVIDER_NOT_CONFIGURED.
  if (/not registered/i.test(raw)) return "CAPABILITY_UNAVAILABLE";
  if (/(?:distributor|society|transcription|payout|external data)[^.\n]*not[_ ]configured/i.test(raw)) return "CAPABILITY_UNAVAILABLE";
  if (/not[_ ]configured/i.test(raw)) return "PROVIDER_NOT_CONFIGURED";
  return fallback;
}
