import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { MustChangePasswordGuard } from './must-change-password.guard';

function context(url: string, appMetadata: Record<string, unknown> | undefined): ExecutionContext {
  const request = {
    method: 'GET',
    originalUrl: url,
    url,
    auth: appMetadata !== undefined ? { claims: { app_metadata: appMetadata } } : undefined,
  };
  return {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: jest.fn().mockReturnValue({
      getRequest: jest.fn().mockReturnValue(request),
    }),
  } as unknown as ExecutionContext;
}

function setup(reflectorOverrides: { isPublic?: boolean; isAuthBootstrap?: boolean } = {}) {
  const reflector = {
    getAllAndOverride: jest.fn()
      .mockReturnValueOnce(reflectorOverrides.isPublic ?? false)
      .mockReturnValueOnce(reflectorOverrides.isAuthBootstrap ?? false),
  } as unknown as Reflector;
  return new MustChangePasswordGuard(reflector);
}

describe('MustChangePasswordGuard', () => {
  it('blocks a common route when must_change_password=true', () => {
    const guard = setup();
    expect(() => guard.canActivate(context('/api/v1/artists', { must_change_password: true }))).toThrow(ForbiddenException);
  });

  it('allows the allowlisted route (/auth/context) even with must_change_password=true', () => {
    const guard = setup();
    expect(guard.canActivate(context('/api/v1/auth/context', { must_change_password: true }))).toBe(true);
  });

  it('allows /auth/change-required-password even with the flag true (the only way out of this state)', () => {
    const guard = setup();
    expect(guard.canActivate(context('/api/v1/auth/change-required-password', { must_change_password: true }))).toBe(true);
  });

  it('allows a common route when must_change_password is false or absent', () => {
    const guard = setup();
    expect(guard.canActivate(context('/api/v1/artists', {}))).toBe(true);
    expect(guard.canActivate(context('/api/v1/artists', undefined))).toBe(true);
  });

  it('@Public() route ignores the check even with must_change_password=true', () => {
    const guard = setup({ isPublic: true });
    expect(guard.canActivate(context('/api/v1/artists', { must_change_password: true }))).toBe(true);
  });

  it('@AuthBootstrap() route ignores the check even with must_change_password=true', () => {
    const guard = setup({ isPublic: false, isAuthBootstrap: true });
    expect(guard.canActivate(context('/api/v1/artists', { must_change_password: true }))).toBe(true);
  });
});
