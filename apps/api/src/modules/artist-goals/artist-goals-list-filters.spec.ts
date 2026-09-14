import { ArtistGoalsController } from './artist-goals.controller';

/**
 * find-eb8482f6: ArtistGoalsService.list() has always supported filtering by
 * `type` and sorting by `ascending`, but the controller never forwarded
 * either query param -- a dead capability, silently unreachable from any
 * real HTTP caller.
 */
describe('ArtistGoalsController.list — forwards type/ascending (find-eb8482f6)', () => {
  it('forwards type and ascending to the service', () => {
    const svc = { list: jest.fn() };
    const controller = new ArtistGoalsController(svc as never);

    controller.list({ id: 'tenant-a' }, 'artist-1', 'active', 'goal', 'true', '0', '20');

    expect(svc.list).toHaveBeenCalledWith('tenant-a', {
      artist_id: 'artist-1',
      status: 'active',
      type: 'goal',
      ascending: true,
      offset: 0,
      limit: 20,
    });
  });

  it('defaults ascending to false when the query param is absent', () => {
    const svc = { list: jest.fn() };
    const controller = new ArtistGoalsController(svc as never);

    controller.list({ id: 'tenant-a' });

    expect(svc.list).toHaveBeenCalledWith('tenant-a', expect.objectContaining({ ascending: false }));
  });
});
