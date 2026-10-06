import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { StorageService } from './storage.service';

// Mock the presigner so key-generation paths don't need real AWS signing.
jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn(async () => 'https://signed.example/url'),
}));

describe('StorageService', () => {
  const BUCKET = 'test-bucket';
  const PUBLIC = 'https://cdn.example';

  function configured(send = jest.fn(async () => ({}))) {
    const client = { send } as unknown as ConstructorParameters<typeof StorageService>[0];
    return new StorageService(client, BUCKET, PUBLIC);
  }
  function unconfigured() {
    return new StorageService(null, BUCKET, null);
  }

  describe('isConfigured / fail-closed', () => {
    it('reports unconfigured when client is null', () => {
      expect(unconfigured().isConfigured()).toBe(false);
    });
    it('throws R2_NOT_CONFIGURED on upload when not configured', async () => {
      await expect(unconfigured().upload({ key: 'k', body: 'x' })).rejects.toBeInstanceOf(ServiceUnavailableException);
    });
    it('throws R2_NOT_CONFIGURED on presigned download when not configured', async () => {
      await expect(unconfigured().getPresignedUrl({ key: 'k' })).rejects.toBeInstanceOf(ServiceUnavailableException);
    });
    it('carries the machine code in `error` and user copy without configuration internals', async () => {
      const err = await unconfigured().upload({ key: 'k', body: 'x' }).catch((e: ServiceUnavailableException) => e);
      const body = (err as ServiceUnavailableException).getResponse() as { error: string; message: string };
      expect(body.error).toBe('R2_NOT_CONFIGURED');
      expect(body.message).not.toMatch(/R2_ACCOUNT_ID|R2_ACCESS_KEY|R2_SECRET_KEY|R2_/);
    });
  });

  describe('createPresignedUpload — validation', () => {
    it('rejects a disallowed MIME type', async () => {
      await expect(
        configured().createPresignedUpload({ tenantId: 't1', userId: 'u1', category: 'images', fileName: 'a.png', mimeType: 'application/x-msdownload', sizeBytes: 10 }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects extension/MIME mismatch (anti MIME-spoof)', async () => {
      await expect(
        configured().createPresignedUpload({ tenantId: 't1', userId: 'u1', category: 'documents', fileName: 'malware.exe', mimeType: 'application/pdf', sizeBytes: 10 }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects files over the category size limit', async () => {
      await expect(
        configured().createPresignedUpload({ tenantId: 't1', userId: 'u1', category: 'images', fileName: 'big.png', mimeType: 'image/png', sizeBytes: 11 * 1024 * 1024 }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a file without extension', async () => {
      await expect(
        configured().createPresignedUpload({ tenantId: 't1', userId: 'u1', category: 'documents', fileName: 'noext', mimeType: 'application/pdf', sizeBytes: 10 }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('createPresignedUpload — key generation & tenant prefix', () => {
    it('namespaces the object key under tenants/<tenantId>/<category>/ and sanitizes the filename', async () => {
      const res = await configured().createPresignedUpload({
        tenantId: 'tenant-A', userId: 'u1', category: 'documents', fileName: 'My Report (final).pdf', mimeType: 'application/pdf', sizeBytes: 100,
      });
      expect(res.key.startsWith('tenants/tenant-A/documents/')).toBe(true);
      expect(res.key.endsWith('/My_Report__final_.pdf')).toBe(true);
      expect(res.key).not.toContain(' ');
      expect(res.publicUrl).toBe(`${PUBLIC}/${res.key}`);
      expect(res.presignedUrl).toBe('https://signed.example/url');
    });

    it('keeps a different tenant on a separate key prefix (isolation)', async () => {
      const a = await configured().createPresignedUpload({ tenantId: 'A', userId: 'u', category: 'images', fileName: 'x.png', mimeType: 'image/png', sizeBytes: 10 });
      const b = await configured().createPresignedUpload({ tenantId: 'B', userId: 'u', category: 'images', fileName: 'x.png', mimeType: 'image/png', sizeBytes: 10 });
      expect(a.key.startsWith('tenants/A/')).toBe(true);
      expect(b.key.startsWith('tenants/B/')).toBe(true);
      expect(a.key).not.toEqual(b.key);
    });
  });

  describe('upload / delete commands', () => {
    it('sends a PutObject and returns the public URL', async () => {
      const send = jest.fn(async () => ({}));
      const url = await configured(send).upload({ key: 'tenants/A/documents/x.pdf', body: 'data', contentType: 'application/pdf' });
      expect(send).toHaveBeenCalledTimes(1);
      expect(url).toBe(`${PUBLIC}/tenants/A/documents/x.pdf`);
    });

    it('sends a DeleteObject for the given key', async () => {
      const send = jest.fn(async () => ({}));
      await configured(send).delete('tenants/A/documents/x.pdf');
      expect(send).toHaveBeenCalledTimes(1);
    });
  });

  describe('inspectObject: the real size and the first bytes, without downloading the file', () => {
    const body = (bytes: number[]) => ({ Body: (async function* () { yield Uint8Array.from(bytes); })() });

    it('reads the size from HEAD and only the leading range from GET', async () => {
      const send = jest.fn()
        .mockResolvedValueOnce({ ContentLength: 5000 })
        .mockResolvedValueOnce(body([0x25, 0x50, 0x44, 0x46]));
      const result = await configured(send).inspectObject('tenants/A/documents/x.pdf', 1024);
      expect(result.size).toBe(5000);
      expect(result.head.equals(Buffer.from([0x25, 0x50, 0x44, 0x46]))).toBe(true);
      const get = send.mock.calls[1][0] as { input: { Key: string; Range: string } };
      expect(get.input.Key).toBe('tenants/A/documents/x.pdf');
      expect(get.input.Range).toBe('bytes=0-1023');
    });

    it('never asks for more bytes than the object has', async () => {
      const send = jest.fn().mockResolvedValueOnce({ ContentLength: 10 }).mockResolvedValueOnce(body([1, 2]));
      await configured(send).inspectObject('k', 1024);
      expect((send.mock.calls[1][0] as { input: { Range: string } }).input.Range).toBe('bytes=0-9');
    });

    it('an empty object has size 0, no head and no GET', async () => {
      const send = jest.fn().mockResolvedValueOnce({ ContentLength: 0 });
      const result = await configured(send).inspectObject('k');
      expect(result).toEqual({ size: 0, head: Buffer.alloc(0) });
      expect(send).toHaveBeenCalledTimes(1);
    });

    it('a missing object rejects instead of looking empty', async () => {
      const send = jest.fn().mockRejectedValueOnce(Object.assign(new Error('NotFound'), { name: 'NotFound' }));
      await expect(configured(send).inspectObject('k')).rejects.toThrow('NotFound');
    });
  });
});
