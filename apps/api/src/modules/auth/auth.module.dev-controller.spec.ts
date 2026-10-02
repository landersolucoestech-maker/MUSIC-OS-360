import 'reflect-metadata';

/**
 * F1(e): the DevAuthController route must not exist at all in a prod-like NODE_ENV
 * (auth.module evaluates NODE_ENV at import, hence isolateModules).
 */
function controllersFor(nodeEnv: string | undefined): string[] {
  const saved = process.env.NODE_ENV;
  try {
    if (nodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = nodeEnv;
    let names: string[] = [];
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { AuthModule } = require('./auth.module');
      const controllers = Reflect.getMetadata('controllers', AuthModule) as Array<{ name: string }>;
      names = controllers.map((c) => c.name);
    });
    return names;
  } finally {
    if (saved === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = saved;
  }
}

describe('AuthModule DevAuthController registration', () => {
  it.each(['production', 'staging', ' Production ', 'STAGING'])('omits DevAuthController when NODE_ENV=%j', (nodeEnv) => {
    const names = controllersFor(nodeEnv);
    expect(names).toContain('AuthController');
    expect(names).not.toContain('DevAuthController');
  });

  it('control: registers DevAuthController in development (its handler is still opt-in)', () => {
    expect(controllersFor('development')).toContain('DevAuthController');
  });
});
