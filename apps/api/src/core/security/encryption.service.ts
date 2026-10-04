/**
 * core/security/encryption.service.ts
 *
 * AES-256-GCM encryption for sensitive PII fields (email, phone, CPF, etc.).
 * Uses ENCRYPTION_KEY (64-char hex = 256 bits) from env.
 *
 * Format: base64(iv[12] + tag[16] + ciphertext)
 */

import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

const ALGORITHM    = 'aes-256-gcm';
const IV_LENGTH    = 12;
const TAG_LENGTH   = 16;
const PREFIX       = 'enc:v1:';
const LOCAL_ENVIRONMENTS = new Set(['development', 'local', 'test']);

@Injectable()
export class EncryptionService {
  private readonly key: Buffer;

  constructor(@Inject(ConfigService) private readonly config: ConfigService) {
    const configured = this.config.get<string>('ENCRYPTION_KEY');
    if (configured == null || configured === '') {
      // The all-zero key is a publicly known value: it is only acceptable for an explicitly local or test run.
      const env = String(this.config.get<string>('NODE_ENV') ?? process.env.NODE_ENV ?? '').toLowerCase();
      if (!LOCAL_ENVIRONMENTS.has(env)) {
        throw new Error('ENCRYPTION_KEY is required unless NODE_ENV is development, local or test');
      }
    }
    const hexKey = configured || '0000000000000000000000000000000000000000000000000000000000000000';
    if (!/^[0-9a-fA-F]{64}$/.test(hexKey)) {
      throw new Error('ENCRYPTION_KEY must contain exactly 64 hexadecimal characters');
    }
    this.key = Buffer.from(hexKey, 'hex');
  }

  /** Encrypts a string. Returns null if input is null/undefined. */
  encryptNullable(value: string | null | undefined): string | null {
    if (value == null || value === '') return null;
    return this.encrypt(value);
  }

  /** Decrypts a stored string. Returns null if input is null/undefined. */
  decryptNullable(value: string | null | undefined): string | null {
    if (value == null || value === '') return null;
    return this.decrypt(value);
  }

  /**
   * Dual-read for a column that is being moved from plaintext to ciphertext: a value carrying the
   * versioned prefix is decrypted, anything else is legacy plaintext and passes through unchanged.
   * (`decrypt` alone would turn legacy plaintext into '[encrypted]'.)
   */
  decryptOrLegacy(value: string | null | undefined): string | null {
    if (value == null || value === '') return null;
    return value.startsWith(PREFIX) ? this.decrypt(value) : value;
  }

  /** True when the stored value is field-level ciphertext (versioned prefix). */
  isCiphertext(value: unknown): value is string {
    return typeof value === 'string' && value.startsWith(PREFIX);
  }

  encrypt(plaintext: string): string {
    const iv         = crypto.randomBytes(IV_LENGTH);
    const cipher     = crypto.createCipheriv(ALGORITHM, this.key, iv);
    const encrypted  = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag        = cipher.getAuthTag();
    const payload    = Buffer.concat([iv, tag, encrypted]);
    return PREFIX + payload.toString('base64');
  }

  /** Exposes the key bytes for HMAC use inside internal services. */
  getKeyBytes(): Buffer { return this.key; }

  decrypt(ciphertext: string): string {
    try {
      const raw     = ciphertext.startsWith(PREFIX)
        ? ciphertext.slice(PREFIX.length)
        : ciphertext;
      const payload = Buffer.from(raw, 'base64');
      // A payload shorter than iv + tag cannot be a valid value (a truncated tag must never be accepted).
      if (payload.length < IV_LENGTH + TAG_LENGTH) return '[encrypted]';
      const iv      = payload.subarray(0, IV_LENGTH);
      const tag     = payload.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
      const data    = payload.subarray(IV_LENGTH + TAG_LENGTH);
      const decipher = crypto.createDecipheriv(ALGORITHM, this.key, iv, { authTagLength: TAG_LENGTH });
      decipher.setAuthTag(tag);
      return decipher.update(data) + decipher.final('utf8');
    } catch {
      return '[encrypted]';
    }
  }
}
