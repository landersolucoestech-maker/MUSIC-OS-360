import { EncryptionService } from './encryption.service';
import { ConfigService } from '@nestjs/config';

const TEST_KEY = '0000000000000000000000000000000000000000000000000000000000000000';

function makeService(key = TEST_KEY): EncryptionService {
  const config = {
    get: jest.fn().mockReturnValue(key),
  } as unknown as ConfigService;
  return new EncryptionService(config);
}

describe('EncryptionService', () => {
  let service: EncryptionService;

  beforeEach(() => {
    service = makeService();
  });

  it('encrypt → decrypt roundtrip returns the original value', () => {
    const plaintext = 'valor-super-secreto';
    const encrypted = service.encrypt(plaintext);
    expect(service.decrypt(encrypted)).toBe(plaintext);
  });

  it('encrypt produces a string with the enc:v1: prefix', () => {
    const encrypted = service.encrypt('teste');
    expect(encrypted.startsWith('enc:v1:')).toBe(true);
  });

  it('two encrypts of the same value produce different ciphertexts (random IV)', () => {
    const plaintext = 'mesmo-valor';
    const a = service.encrypt(plaintext);
    const b = service.encrypt(plaintext);
    expect(a).not.toBe(b);
    expect(service.decrypt(a)).toBe(plaintext);
    expect(service.decrypt(b)).toBe(plaintext);
  });

  it('encryptNullable(null) returns null', () => {
    expect(service.encryptNullable(null)).toBeNull();
  });

  it('encryptNullable(undefined) returns null', () => {
    expect(service.encryptNullable(undefined)).toBeNull();
  });

  it('encryptNullable("") returns null', () => {
    expect(service.encryptNullable('')).toBeNull();
  });

  it('decryptNullable(null) returns null', () => {
    expect(service.decryptNullable(null)).toBeNull();
  });

  it('decryptNullable(undefined) returns null', () => {
    expect(service.decryptNullable(undefined)).toBeNull();
  });

  it('encryptNullable + decryptNullable roundtrip returns the original value', () => {
    const plaintext = 'email@empresa.com';
    const encrypted = service.encryptNullable(plaintext);
    expect(encrypted).not.toBeNull();
    expect(service.decryptNullable(encrypted!)).toBe(plaintext);
  });

  it('decrypt of invalid ciphertext returns [encrypted] instead of throwing', () => {
    expect(service.decrypt('not-valid-base64!!!')).toBe('[encrypted]');
  });
});
