import 'reflect-metadata';
import { HrController } from './hr.controller';

// The deprecated `competencia` query parameter is still read and forwarded as the canonical reference_month.
describe('HrController payroll list legacy query (legacy in, canonical out)', () => {
  const make = () => {
    const svc = { listPayroll: jest.fn(async () => ({ data: [] })) };
    return { svc, controller: new HrController(svc as never) };
  };

  it.each([['competencia', '2025-03']])('forwards deprecated %s as reference_month', async (_legacy, value) => {
    const { svc, controller } = make();
    await controller.listPayroll({ id: 't1' }, undefined, undefined, value);
    expect(svc.listPayroll).toHaveBeenCalledWith('t1', expect.objectContaining({ reference_month: value }));
  });

  it('the canonical reference_month wins over the deprecated parameter', async () => {
    const { svc, controller } = make();
    await controller.listPayroll({ id: 't1' }, undefined, '2025-04', '2025-03');
    expect(svc.listPayroll).toHaveBeenCalledWith('t1', expect.objectContaining({ reference_month: '2025-04' }));
  });
});
