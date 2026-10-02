/**
 * Shared pre-flight for the scripts that obtain a token from GET /dev-auth/token
 * (smoke-test, verify-phase8-resilience, verify-phase7d-upload, reports-smoke).
 *
 * The endpoint issues an OWNER token, so a script must never reach for it
 * implicitly: the operator has to declare DEV_AUTH_ENDPOINT_ENABLED=true plus
 * DEV_AUTH_EMAIL / DEV_AUTH_PASSWORD, the target must be a loopback API and the
 * environment must not be production-like. Errors name variables, never values.
 */
import { isProdLike } from '../../src/core/config/runtime-environment';

export class DevAuthConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DevAuthConfigError';
  }
}

type Env = Record<string, string | undefined>;

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

export function assertDevAuthTarget(scriptName: string, apiUrl: string, env: Env = process.env): void {
  const nodeEnv = env['NODE_ENV'];
  if (isProdLike(nodeEnv)) {
    throw new DevAuthConfigError(
      `[${scriptName}] refusing dev-auth: NODE_ENV=${String(nodeEnv).trim()} is production-like. Provide a real token instead.`,
    );
  }
  let url: URL;
  try {
    url = new URL(apiUrl);
  } catch {
    throw new DevAuthConfigError(`[${scriptName}] refusing dev-auth: API_URL is not a valid URL.`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new DevAuthConfigError(`[${scriptName}] refusing dev-auth: API_URL must be http(s).`);
  }
  if (!LOOPBACK_HOSTS.has(url.hostname.toLowerCase())) {
    throw new DevAuthConfigError(
      `[${scriptName}] refusing dev-auth against non-local target host "${url.hostname}". ` +
        'dev-auth is only allowed on a loopback API (localhost, 127.0.0.1, ::1).',
    );
  }
}

export function assertDevAuthFlags(scriptName: string, env: Env = process.env): void {
  const problems: string[] = [];
  const enabled = env['DEV_AUTH_ENDPOINT_ENABLED'];
  if (enabled === undefined || enabled.trim() === '') {
    problems.push('DEV_AUTH_ENDPOINT_ENABLED is missing (must be exactly "true")');
  } else if (enabled !== 'true') {
    problems.push('DEV_AUTH_ENDPOINT_ENABLED is set to an incorrect value (must be exactly "true")');
  }
  if (!(env['DEV_AUTH_EMAIL'] ?? '').trim()) problems.push('DEV_AUTH_EMAIL is missing');
  if (!(env['DEV_AUTH_PASSWORD'] ?? '')) problems.push('DEV_AUTH_PASSWORD is missing');
  if (problems.length > 0) {
    throw new DevAuthConfigError(
      `[${scriptName}] dev-auth is not explicitly configured: ${problems.join('; ')}. ` +
        'Declare the DEV_AUTH_* flags for a local API (see .env.development.example); no bypass is enabled implicitly.',
    );
  }
}

export function assertDevAuthPreconditions(scriptName: string, apiUrl: string, env: Env = process.env): void {
  assertDevAuthTarget(scriptName, apiUrl, env);
  assertDevAuthFlags(scriptName, env);
}
