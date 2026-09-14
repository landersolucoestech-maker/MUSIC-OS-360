import { ContentDetectionsController } from './content-detections.controller';

/**
 * find-6b2b9a7b: ContentDetectionsService.list() has always supported
 * filtering by `artist_id`/`work_id` and sorting by `ascending`, but the
 * controller never forwarded any of them -- a dead capability.
 */
describe('ContentDetectionsController.list — forwards artist_id/work_id/ascending (find-6b2b9a7b)', () => {
  it('forwards artist_id, work_id and ascending to the service', () => {
    const svc = { list: jest.fn() };
    const controller = new ContentDetectionsController(svc as never);

    controller.list({ id: 'tenant-a' }, 'flagged', 'spotify', 'artist-1', 'work-1', 'true', '0', '20');

    expect(svc.list).toHaveBeenCalledWith('tenant-a', {
      status: 'flagged',
      plataforma: 'spotify',
      artist_id: 'artist-1',
      work_id: 'work-1',
      ascending: true,
      offset: 0,
      limit: 20,
    });
  });
});
