import { HealthController } from './health.controller';

/** The staging deploy gate proves the deployed build by the `build` field of /health/live. */
describe('HealthController.liveness', () => {
  const controller = new HealthController({} as never, {} as never, {} as never, {} as never, {} as never);
  const original = process.env['BUILD_SHA'];
  afterEach(() => {
    if (original === undefined) delete process.env['BUILD_SHA'];
    else process.env['BUILD_SHA'] = original;
  });

  it('reports the deployed build commit', () => {
    process.env['BUILD_SHA'] = '1dfd59547e2ba2a2916d90944e2be8ee702f8c97';
    expect(controller.liveness()).toMatchObject({ status: 'up', build: '1dfd59547e2ba2a2916d90944e2be8ee702f8c97' });
  });

  it('reports null when the platform did not set it (the gate then fails closed)', () => {
    delete process.env['BUILD_SHA'];
    expect(controller.liveness()).toMatchObject({ status: 'up', build: null });
  });
});
