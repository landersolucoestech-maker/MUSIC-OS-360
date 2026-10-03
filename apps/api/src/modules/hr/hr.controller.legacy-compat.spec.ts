import 'reflect-metadata';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { RouteParamtypes } from '@nestjs/common/enums/route-paramtypes.enum';
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

  // The positional calls above cannot see which HTTP query key feeds which argument: bind it to the route metadata.
  describe('route-args metadata (HTTP query key -> handler argument)', () => {
    const queryKeysByIndex = (): Record<number, string | undefined> => {
      const meta = Reflect.getMetadata(ROUTE_ARGS_METADATA, HrController, 'listPayroll') as Record<
        string,
        { index: number; data?: string }
      >;
      const result: Record<number, string | undefined> = {};
      for (const [key, value] of Object.entries(meta)) {
        if (Number(key.split(':')[0]) === RouteParamtypes.QUERY) result[value.index] = value.data;
      }
      return result;
    };

    it('binds the canonical reference_month key to argument 2 and the legacy competencia key to argument 3', () => {
      const keys = queryKeysByIndex();
      expect(keys[2]).toBe('reference_month');
      expect(keys[3]).toBe('competencia');
    });

    it('binds the remaining filters to their own distinct query keys', () => {
      const keys = queryKeysByIndex();
      expect(Object.values(keys).sort()).toEqual(
        ['competencia', 'employee_id', 'limit', 'offset', 'reference_month', 'status'].sort(),
      );
    });
  });
});
