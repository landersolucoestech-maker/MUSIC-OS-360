import { Logger, ServiceUnavailableException } from '@nestjs/common';

const logger = new Logger('IntegrationConfiguration');

/**
 * 503 for an integration whose server-side configuration is missing.
 * The end user gets PT-BR copy naming only the product; the missing
 * environment variables are logged for the operator, never returned.
 */
export function integrationNotConfigured(
  productName: string,
  errorCode: string,
  missingSettings: readonly string[],
): ServiceUnavailableException {
  logger.error(`${errorCode}: missing configuration ${missingSettings.join(', ')}`);
  return new ServiceUnavailableException({
    statusCode: 503,
    error: errorCode,
    message: `A integração com ${productName} não está configurada. Contate o administrador do sistema.`,
  });
}
