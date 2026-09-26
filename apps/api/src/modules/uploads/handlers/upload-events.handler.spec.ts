import { UploadEventsHandler } from './upload-events.handler';

/** P2-9 — context propagation + fail-closed for the asset-uploaded handler. */
describe('UploadEventsHandler — P2-9', () => {
  function build() {
    const uploadRepo = {
      findOne: jest.fn().mockResolvedValue({ size_bytes: 1024, mime_type: 'audio/mpeg' }),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    const ds = { getRepository: jest.fn(() => uploadRepo) };
    const dbContext = {
      runInTenantContext: jest.fn((_c: unknown, w: (m: unknown) => unknown) => w(undefined)),
    };
    const handler = new UploadEventsHandler(ds as any, dbContext as any);
    return { handler, uploadRepo, dbContext };
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
    ).rejects.toThrow('UploadEventsHandler recebeu evento sem tenant: upload=up1');
    expect(dbContext.runInTenantContext).not.toHaveBeenCalled();
    expect(uploadRepo.findOne).not.toHaveBeenCalled();
    expect(uploadRepo.update).not.toHaveBeenCalled();
  });
});
