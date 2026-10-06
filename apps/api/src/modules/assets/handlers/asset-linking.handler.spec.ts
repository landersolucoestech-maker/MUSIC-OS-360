import { AssetLinkingHandler } from './asset-linking.handler';

/** P2-9 — context propagation + fail-closed for the asset-linking handler (via service). */
describe('AssetLinkingHandler — P2-9', () => {
  function build() {
    const assetLinking = { processUpload: jest.fn().mockResolvedValue(undefined) };
    const dbContext = { runInTenantContext: jest.fn((_c: unknown, w: () => unknown) => w()) };
    const handler = new AssetLinkingHandler(assetLinking as any, dbContext as any);
    return { handler, assetLinking, dbContext };
  }

  const payload = { uploadId: 'up1', tenantId: 't1' };

  it('valid tenantId → processes within runInTenantContext', async () => {
    const { handler, assetLinking, dbContext } = build();
    await handler.onAssetUploaded({ tenantId: 't1', payload, correlationId: null } as any);
    expect(dbContext.runInTenantContext).toHaveBeenCalledWith({ tenantId: 't1', orgId: null, role: null }, expect.any(Function));
    expect(assetLinking.processUpload).toHaveBeenCalledWith(payload);
  });

  it('uses tenantId from the payload when the event has no top-level tenantId', async () => {
    const { handler, dbContext } = build();
    await handler.onAssetUploaded({ payload, correlationId: null } as any);
    expect(dbContext.runInTenantContext).toHaveBeenCalledWith({ tenantId: 't1', orgId: null, role: null }, expect.any(Function));
  });

  it('missing tenantId → aborts (fail-closed), service is not called', async () => {
    const { handler, assetLinking, dbContext } = build();
    await handler.onAssetUploaded({ payload: { uploadId: 'up1' }, correlationId: null } as any);
    expect(dbContext.runInTenantContext).not.toHaveBeenCalled();
    expect(assetLinking.processUpload).not.toHaveBeenCalled();
  });

  it('missing DatabaseContextService → aborts (fail-closed), service is not called', async () => {
    const assetLinking = { processUpload: jest.fn().mockResolvedValue(undefined) };
    const handler = new AssetLinkingHandler(assetLinking as any, undefined);

    await handler.onAssetUploaded({ tenantId: 't1', payload, correlationId: null } as any);

    expect(assetLinking.processUpload).not.toHaveBeenCalled();
  });
});

describe('AssetLinkingHandler: wired to the verification, not to the raw upload', () => {
  it('listens to asset.verified and not to asset.uploaded', () => {
    const { EVENT_LISTENER_METADATA } = require('@nestjs/event-emitter/dist/constants');
    const listeners = Reflect.getMetadata(EVENT_LISTENER_METADATA, AssetLinkingHandler.prototype.onAssetUploaded) as Array<{ event: string }>;
    const events = listeners.map((l) => l.event);
    expect(events).toContain('asset.verified');
    expect(events).not.toContain('asset.uploaded');
  });
});
