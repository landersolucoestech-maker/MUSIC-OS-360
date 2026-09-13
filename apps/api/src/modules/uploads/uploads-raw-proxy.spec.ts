import { NotFoundException } from '@nestjs/common';
import { UploadsController } from './uploads.controller';

/**
 * find (Phase D / static-export trace): before this endpoint existed, the
 * only way to read an uploaded asset's bytes from the browser was the R2
 * public/signed URL directly -- a separate origin with no CORS policy this
 * repository controls, so an <img> loaded from it could not be safely read
 * into a <canvas> for the creative editor's static-image export. This
 * endpoint streams the same bytes through the API's own origin (which
 * already has an explicit, code-controlled CORS policy -- create-app.ts),
 * scoped to the requesting tenant, so the frontend's static export can
 * fetch() it with auth and decode a canvas-safe blob: URL.
 */
describe('UploadsController.raw — same-origin proxy for canvas-safe media reads', () => {
  const TENANT = { id: 'tenant-a' };

  function buildController(row: Record<string, unknown> | null) {
    const qb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(row),
    };
    const repo = { createQueryBuilder: jest.fn(() => qb) };
    const ds = { getRepository: jest.fn().mockReturnValue(repo) };
    const storage = {
      getObject: jest.fn().mockResolvedValue({
        body: { pipe: jest.fn() },
        contentType: 'image/png',
        contentLength: 1234,
      }),
    };
    const events = { emitTyped: jest.fn() };
    const planLimit = { enforce: jest.fn() };
    const controller = new UploadsController(ds as never, storage as never, events as never, planLimit as never);
    return { controller, storage };
  }

  function buildRes() {
    return { setHeader: jest.fn(), pipe: jest.fn() };
  }

  it('streams the object body with its content-type, scoped to the requesting tenant', async () => {
    const { controller, storage } = buildController({ id: '1', r2_key: 'k1', mime_type: 'image/png' });
    const res = buildRes();

    await controller.raw(TENANT, 'file-1', res as never);

    expect(storage.getObject).toHaveBeenCalledWith('k1');
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'image/png');
  });

  it('404s when the upload row is not found for this tenant -- never leaks another tenant\'s object', async () => {
    const { controller } = buildController(null);
    const res = buildRes();

    await expect(controller.raw(TENANT, 'missing', res as never)).rejects.toBeInstanceOf(NotFoundException);
  });
});
