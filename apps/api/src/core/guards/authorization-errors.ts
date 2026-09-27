import { ForbiddenException } from '@nestjs/common';

/**
 * End-user copy for authorization denials. The technical detail (route,
 * required permissions/roles, the member's role) is recorded server-side
 * (decision log / Logger) and never echoed in the response.
 */
export const PERMISSION_DENIED_MESSAGE = 'Você não tem permissão para realizar esta ação.';

export function permissionDeniedException(): ForbiddenException {
  return new ForbiddenException({ statusCode: 403, error: 'PERMISSION_DENIED', message: PERMISSION_DENIED_MESSAGE });
}
