import { UploadEventsHandler } from './upload-events.handler';

/** P2-9 — context propagation + fail-closed for the asset-uploaded handler. */
describe('UploadEventsHandler — P2-9', () => {
  function build() {
    const uploadRepo = {
      findOne: jest.fn().mockResolvedValue({ size_bytes: 1024, mime_type: 'audio/mpeg', r2_key: 'tenants/t1/audio/up1/song.mp3' }),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    const ds = { getRepository: jest.fn(() => uploadRepo) };
    const dbContext = {
      runInTenantContext: jest.fn((_c: unknown, w: (m: unknown) => unknown) => w(undefined)),
    };
    const storage = {
      inspectObject: jest.fn().mockResolvedValue({ size: 1024, head: Buffer.from('ID3\u0000\u0000\u0000\u0000') }),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    const handler = new UploadEventsHandler(ds as any, dbContext as any, storage as any);
    return { handler, uploadRepo, dbContext, storage };
  }

  const basePayload = {
    uploadId: 'up1',
    tenantId: 't1',
    entityType: 'artist',
    entityId: 'a1',
    fileName: 'song.mp3',
    mimeType: 'audio/mpeg',
    uploadedBy: 'u1',
  };

  it('valid tenantId → runs inside runInTenantContext and leaves the upload ready', async () => {
    const { handler, uploadRepo, dbContext } = build();
    await handler.onAssetUploaded({ payload: basePayload, correlationId: null } as any);
    expect(dbContext.runInTenantContext).toHaveBeenCalledWith(
      { tenantId: 't1', orgId: null, role: null },
      expect.any(Function),
    );
    expect(uploadRepo.update).toHaveBeenCalledWith(
      { id: 'up1', tenant_id: 't1' },
      { status: 'ready' },
    );
  });

  it('absent tenantId → rejects fail-closed and does not touch the database', async () => {
    const { handler, uploadRepo, dbContext } = build();
    await expect(
      handler.onAssetUploaded({
        payload: { ...basePayload, tenantId: undefined },
        correlationId: null,
      } as any),
    ).rejects.toThrow('UploadEventsHandler received an event without tenant: upload=up1');
    expect(dbContext.runInTenantContext).not.toHaveBeenCalled();
    expect(uploadRepo.findOne).not.toHaveBeenCalled();
    expect(uploadRepo.update).not.toHaveBeenCalled();
  });
});


describe('UploadEventsHandler: the stored object decides, not the declared type', () => {
  const R2_KEY = 'tenants/t1/audio/up1/song.mp3';
  const payload = (overrides: Record<string, unknown> = {}) => ({
    uploadId: 'up1', tenantId: 't1', entityType: 'artist', entityId: 'a1', fileName: 'song.mp3', mimeType: 'audio/mpeg', uploadedBy: 'u1', ...overrides,
  });

  function build(record: Record<string, unknown> = {}, inspect: unknown = { size: 1024, head: Buffer.from('ID3\u0000\u0000\u0000\u0000') }) {
    const uploadRepo = {
      findOne: jest.fn().mockResolvedValue({ size_bytes: 1024, mime_type: 'audio/mpeg', r2_key: R2_KEY, ...record }),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    const ds = { getRepository: jest.fn(() => uploadRepo) };
    const dbContext = { runInTenantContext: jest.fn((_c: unknown, w: (m: unknown) => unknown) => w(undefined)) };
    const storage = {
      inspectObject: typeof inspect === 'function' ? jest.fn(inspect as () => Promise<unknown>) : jest.fn().mockResolvedValue(inspect),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    const handler = new UploadEventsHandler(ds as any, dbContext as any, storage as any);
    return { handler, uploadRepo, storage };
  }

  const markedReady = (repo: { update: jest.Mock }) => repo.update.mock.calls.some((c) => c[1]?.status === 'ready');
  const rejection = (repo: { update: jest.Mock }) => repo.update.mock.calls.find((c) => c[1]?.status === 'error')?.[1]?.metadata?.rejectionReason as string | undefined;

  it('marks the upload ready only after the real size and signature match, and keeps the object', async () => {
    const { handler, uploadRepo, storage } = build();
    await handler.onAssetUploaded({ payload: payload(), correlationId: null } as any);
    expect(storage.inspectObject).toHaveBeenCalledWith(R2_KEY);
    expect(markedReady(uploadRepo)).toBe(true);
    expect(storage.delete).not.toHaveBeenCalled();
  });

  it('rejects a file whose bytes are not the declared type, and deletes the stored object', async () => {
    const { handler, uploadRepo, storage } = build({}, { size: 1024, head: Buffer.from('<html><script>alert(1)</script></html>') });
    await handler.onAssetUploaded({ payload: payload(), correlationId: null } as any);
    expect(markedReady(uploadRepo)).toBe(false);
    expect(rejection(uploadRepo)).toContain('Conteúdo do arquivo não corresponde');
    expect(storage.delete).toHaveBeenCalledWith(R2_KEY);
  });

  it('rejects when the real size differs from the declared size, and deletes the object', async () => {
    const { handler, uploadRepo, storage } = build({}, { size: 9999, head: Buffer.from('ID3\u0000\u0000\u0000\u0000') });
    await handler.onAssetUploaded({ payload: payload(), correlationId: null } as any);
    expect(markedReady(uploadRepo)).toBe(false);
    expect(rejection(uploadRepo)).toContain('Tamanho real 9999 diverge do declarado 1024');
    expect(storage.delete).toHaveBeenCalledWith(R2_KEY);
  });

  it('rejects an empty stored object', async () => {
    const { handler, uploadRepo } = build({}, { size: 1024, head: Buffer.alloc(0) });
    await handler.onAssetUploaded({ payload: payload(), correlationId: null } as any);
    expect(markedReady(uploadRepo)).toBe(false);
    expect(rejection(uploadRepo)).toContain('Conteúdo do arquivo não corresponde');
  });

  it.each(['image/svg+xml', 'text/plain', 'application/x-msdownload'])('does not accept %s and deletes the object', async (mimeType) => {
    const { handler, uploadRepo, storage } = build({ mime_type: mimeType });
    await handler.onAssetUploaded({ payload: payload({ mimeType }), correlationId: null } as any);
    expect(markedReady(uploadRepo)).toBe(false);
    expect(rejection(uploadRepo)).toContain('MIME não permitido');
    expect(storage.delete).toHaveBeenCalledWith(R2_KEY);
    expect(storage.inspectObject).not.toHaveBeenCalled();
  });

  it('accepts the Word types the presign step accepts, with a real container signature', async () => {
    const docx = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    const { handler, uploadRepo } = build({ mime_type: docx }, { size: 1024, head: Buffer.from([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0]) });
    await handler.onAssetUploaded({ payload: payload({ mimeType: docx, fileName: 'a.docx' }), correlationId: null } as any);
    expect(markedReady(uploadRepo)).toBe(true);
  });

  it('rejects an event whose MIME differs from the stored record, and deletes the object', async () => {
    const { handler, uploadRepo, storage } = build({ mime_type: 'audio/wav' });
    await handler.onAssetUploaded({ payload: payload(), correlationId: null } as any);
    expect(markedReady(uploadRepo)).toBe(false);
    expect(storage.delete).toHaveBeenCalledWith(R2_KEY);
  });

  it('rejects an upload whose object is missing from storage (no ghost asset) without trying to delete it', async () => {
    const missing = Object.assign(new Error('NotFound'), { name: 'NotFound', $metadata: { httpStatusCode: 404 } });
    const { handler, uploadRepo, storage } = build({}, () => Promise.reject(missing));
    await handler.onAssetUploaded({ payload: payload(), correlationId: null } as any);
    expect(markedReady(uploadRepo)).toBe(false);
    expect(rejection(uploadRepo)).toBe('Arquivo não encontrado no armazenamento');
    expect(storage.delete).not.toHaveBeenCalled();
  });

  it('a storage outage is rethrown and the upload is neither ready nor rejected', async () => {
    const outage = Object.assign(new Error('socket hang up'), { $metadata: { httpStatusCode: 503 } });
    const { handler, uploadRepo } = build({}, () => Promise.reject(outage));
    await expect(handler.onAssetUploaded({ payload: payload(), correlationId: null } as any)).rejects.toThrow('socket hang up');
    expect(markedReady(uploadRepo)).toBe(false);
    expect(rejection(uploadRepo)).toBeUndefined();
  });

  it('a failed delete of a rejected object is logged and does not hide the rejection', async () => {
    const { handler, uploadRepo, storage } = build({}, { size: 1024, head: Buffer.from('not audio at all') });
    storage.delete.mockRejectedValue(new Error('delete failed'));
    await expect(handler.onAssetUploaded({ payload: payload(), correlationId: null } as any)).resolves.toBeUndefined();
    expect(rejection(uploadRepo)).toContain('Conteúdo do arquivo não corresponde');
  });

  it('without a storage service the content cannot be verified and the upload is never marked ready', async () => {
    const uploadRepo = {
      findOne: jest.fn().mockResolvedValue({ size_bytes: 1024, mime_type: 'audio/mpeg', r2_key: R2_KEY }),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    const handler = new UploadEventsHandler({ getRepository: () => uploadRepo } as any, { runInTenantContext: (_c: unknown, w: (m: unknown) => unknown) => w(undefined) } as any);
    await expect(handler.onAssetUploaded({ payload: payload(), correlationId: null } as any)).rejects.toThrow('cannot verify the stored object');
    expect(markedReady(uploadRepo)).toBe(false);
  });
});
