import { createHash } from 'crypto';

/**
 * Identity of a delivered domain event for notification purposes. The same emitted event delivered twice
 * (a retry, a duplicate delivery) carries the same tenant, user, type, aggregate and emission time, so it
 * maps to the same id; a genuinely new occurrence has a different emission time and gets a different id.
 */
export function deterministicNotificationId(parts: ReadonlyArray<string | null | undefined>): string {
  const digest = createHash('sha256').update(parts.map((p) => p ?? '').join('\u0000')).digest();
  // RFC 4122 layout: version 5, variant 10xx.
  digest[6] = (digest[6] & 0x0f) | 0x50;
  digest[8] = (digest[8] & 0x3f) | 0x80;
  const hex = digest.subarray(0, 16).toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}
