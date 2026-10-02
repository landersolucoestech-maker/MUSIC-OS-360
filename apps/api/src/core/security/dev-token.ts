/**
 * core/security/dev-token.ts
 *
 * Single implementation of the local HS256 dev-token check shared by JwtAuthGuard
 * and TokenVerifierService. Callers MUST already have excluded prod-like
 * environments; this helper additionally fails closed when:
 *  - the signing secret is missing, shorter than 32 characters or all-zero (the documented default
 *    ENCRYPTION_KEY, publicly known, would make every token forgeable);
 *  - the token has no numeric `exp` claim (a non-expiring bypass token).
 *
 * This is NOT real authentication: it only exists for local development.
 */
import * as jwt from 'jsonwebtoken';

export const DEV_TOKEN_ISSUER = 'music-os-360-dev';

/** Minimum dev signing secret length (HS256 needs at least 256 bits of key material). */
export const MIN_DEV_SECRET_LENGTH = 32;

export function isInsecureDevSecret(secret: string | undefined | null): boolean {
  return !secret || secret.length < MIN_DEV_SECRET_LENGTH || /^0+$/.test(secret);
}

export function verifyDevToken(token: string, secret: string | undefined | null): Record<string, unknown> | null {
  if (isInsecureDevSecret(secret)) return null;
  try {
    const decoded = jwt.verify(token, secret as string, {
      algorithms: ['HS256'],
      issuer: DEV_TOKEN_ISSUER,
    });
    if (typeof decoded !== 'object' || !decoded) return null;
    if (typeof (decoded as { exp?: unknown }).exp !== 'number') return null;
    return decoded as Record<string, unknown>;
  } catch {
    return null;
  }
}
