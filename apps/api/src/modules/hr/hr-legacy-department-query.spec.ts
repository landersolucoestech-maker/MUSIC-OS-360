import 'reflect-metadata';
import { HrController } from './hr.controller';

describe('HrController listEmployees deprecated `setor` query alias (CZ-030)', () => {
  const make = () => {
    const svc = { listEmployees: jest.fn(async () => ({ data: [], total: 0 })) };
    return { svc, controller: new HrController(svc as never) };
  };

  it('uses the legacy alias when the canonical `department` is absent', () => {
    const { svc, controller } = make();
    controller.listEmployees({ id: 't1' }, undefined, undefined, 'Producao');
    expect(svc.listEmployees).toHaveBeenCalledWith('t1', expect.objectContaining({ department: 'Producao' }));
  });

  it('the canonical `department` wins over the alias', () => {
    const { svc, controller } = make();
    controller.listEmployees({ id: 't1' }, undefined, 'Production', 'Producao');
    expect(svc.listEmployees).toHaveBeenCalledWith('t1', expect.objectContaining({ department: 'Production' }));
  });

  it('declares `setor` as a query param on the route', () => {
    const params = Reflect.getMetadata('__routeArguments__', HrController, 'listEmployees') as Record<string, { data?: string }>;
    expect(Object.values(params).map((p) => p.data)).toEqual(expect.arrayContaining(['department', 'setor']));
  });
});
