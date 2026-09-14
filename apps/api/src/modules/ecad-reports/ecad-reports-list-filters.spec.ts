import { EcadReportsController } from './ecad-reports.controller';

/**
 * find-36852d37: EcadReportsService.list() has always supported filtering by
 * `work_id` and sorting by `ascending`, but the controller never forwarded
 * either -- a dead capability.
 */
describe('EcadReportsController.list — forwards work_id/ascending (find-36852d37)', () => {
  it('forwards work_id and ascending to the service', () => {
    const svc = { list: jest.fn() };
    const controller = new EcadReportsController(svc as never);

    controller.list({ id: 'tenant-a' }, '2026-Q1', 'submitted', 'work-1', 'true', '0', '20');

    expect(svc.list).toHaveBeenCalledWith('tenant-a', {
      periodo: '2026-Q1',
      status: 'submitted',
      work_id: 'work-1',
      ascending: true,
      offset: 0,
      limit: 20,
    });
  });
});
