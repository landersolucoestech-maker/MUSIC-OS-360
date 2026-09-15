import { Optional,
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  HttpException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import * as jwt from 'jsonwebtoken';
import type * as jwksRsaType from 'jwks-rsa';
import { AUTH_DISABLED, DEV_AUTH } from '../auth-disabled';
import { RbacErrorLogService } from '../rbac/rbac-error-log.service';
import { isProdLike } from '../config/runtime-environment';

// Lazy-loaded via require: sob tsx/esbuild o `import * as` de um módulo CJS que
// exporta função vira namespace não-chamável — mesmo padrão do token-verifier.service.
type JwksRsaFn = (options: jwksRsaType.Options) => jwksRsaType.JwksClient;
let _jwksRsa: JwksRsaFn | null = null;
function getJwksRsa(): JwksRsaFn {
  if (!_jwksRsa) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    _jwksRsa = require('jwks-rsa');
  }
  return _jwksRsa!;
}

export const IS_PUBLIC_KEY = 'isPublic';

export interface JwtAuth {
  userId: string;
  sessionId: string;
  orgId: string | null;
  orgRole: string | null;
  claims: Record<string, unknown>;
}

declare module 'express' {
  interface Request {
    auth?: JwtAuth;
    tenant?: Record<string, unknown>;
    currentMember?: Record<string, unknown>;
  }
}

export interface AuthClaims {
  sub?: string;
  email?: string;
  role?: string;
  aud?: string | string[];
  iss?: string;
  exp?: number;
  iat?: number;
  jti?: string;
  session_id?: string;
  app_metadata?: { org_id?: string; role?: string; [key: string]: unknown };
  user_metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

function normalizeSupabaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, '');
}

@Injectable()
export class JwtAuthGuard implements CanActivate, OnModuleInit {
  private readonly logger = new Logger(JwtAuthGuard.name);
  private jwksClient!: jwksRsaType.JwksClient;
  private issuer!: string;
  private readonly audience = 'authenticated';

  constructor(
    @Optional() private readonly config?: ConfigService,
    @Optional() private readonly reflector?: Reflector,
    @Optional() private readonly errorLog?: RbacErrorLogService,
  ) {}

  /**
   * Thin wrapper that records UNEXPECTED guard failures (non-HttpException) as
   * `guard_error`. Normal 401/403 denials are HttpExceptions and are NOT errors.
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      return await this.runGuard(context);
    } catch (error) {
      if (!(error instanceof HttpException)) {
        const request = context.switchToHttp().getRequest<Request>();
        void this.errorLog?.record({
          errorType: 'guard_error',
          errorSource: 'JwtAuthGuard',
          request,
          error,
        });
      }
      throw error;
    }
  }

  onModuleInit(): void {
    if (AUTH_DISABLED) {
      this.logger.warn('AUTH_DISABLED=true — JWT validation bypassed temporarily');
      return;
    }

    const rawSupabaseUrl =
      this.config?.get<string>('SUPABASE_URL') ??
      process.env['SUPABASE_URL'] ??
      '';
    const supabaseUrl = normalizeSupabaseUrl(rawSupabaseUrl);

    if (!supabaseUrl) {
      throw new Error('SUPABASE_URL is required for JWT validation');
    }

    this.issuer = `${supabaseUrl}/auth/v1`;
    const jwksUri = `${this.issuer}/.well-known/jwks.json`;
    this.logger.log(`JWKS endpoint: ${jwksUri}`);

    this.jwksClient = getJwksRsa()({
      jwksUri,
      cache: true,
      cacheMaxAge: 60 * 60 * 1000,
      rateLimit: true,
    });
  }

  private async runGuard(context: ExecutionContext): Promise<boolean> {
    if (AUTH_DISABLED) {
      const request = context.switchToHttp().getRequest<Request>();
      request.auth = DEV_AUTH;
      return true;
    }

    const isPublic = this.reflector?.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException('Authentication token missing');
    }

    // In non-prod-like envs only, accept dev tokens signed with ENCRYPTION_KEY (HS256).
    // Staging is treated as prod-like here (same as the Supabase ref allowlist in main.ts)
    // since it can hold real user data — the bypass must not be reachable there.
    // Uses the shared isProdLike() (same one TokenVerifierService's dev-token path uses)
    // instead of a hand-rolled comparison -- a prior inline `=== 'production' || === 'staging'`
    // check lacked isProdLike()'s trim()/toLowerCase() normalization, so a NODE_ENV value with
    // different casing/whitespace would have let the HS256 dev-token bypass stay reachable in
    // what should have been treated as a prod-like environment (CODEBASE_MAP Gotcha #9).
    const nodeEnv = this.config?.get<string>('NODE_ENV') ?? 'development';
    if (!isProdLike(nodeEnv)) {
      const devClaims = this.tryVerifyDevToken(token);
      if (devClaims) {
        request.auth = {
          userId:    devClaims.sub as string,
          sessionId: String(devClaims['session_id'] ?? ''),
          orgId:     (devClaims['app_metadata'] as any)?.org_id ?? null,
          orgRole:   (devClaims['app_metadata'] as any)?.role ?? null,
          claims:    devClaims as Record<string, unknown>,
        };
        return true;
      }
    }

    const claims = await this.verifyToken(token);

    if (!claims.sub || typeof claims.sub !== 'string') {
      throw new UnauthorizedException('JWT subject missing');
    }

    request.auth = {
      userId: claims.sub,
      sessionId: String(claims.session_id ?? claims.jti ?? ''),
      orgId: claims.app_metadata?.org_id ?? null,
      orgRole: claims.app_metadata?.role ?? null,
      claims: claims as Record<string, unknown>,
    };

    return true;
  }

  private tryVerifyDevToken(token: string): Record<string, unknown> | null {
    try {
      const secret = this.config?.get<string>('ENCRYPTION_KEY');
      if (!secret) return null;
      const decoded = jwt.verify(token, secret, {
        algorithms: ['HS256'],
        issuer: 'music-os-360-dev',
      });
      if (typeof decoded !== 'object' || !decoded) return null;
      return decoded as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  private verifyToken(token: string): Promise<AuthClaims> {
    return new Promise((resolve, reject) => {
      const getKey: jwt.GetPublicKeyOrSecret = (header, callback) => {
        if (!header.kid) {
          return callback(new Error('JWT kid missing'));
        }
        this.jwksClient.getSigningKey(header.kid, (err, key) => {
          if (err) return callback(err);
          callback(null, key?.getPublicKey());
        });
      };

      jwt.verify(
        token,
        getKey,
        {
          algorithms: ['ES256'],
          issuer: this.issuer,
          audience: this.audience,
        },
        (err, decoded) => {
          if (err) {
            if (err instanceof jwt.TokenExpiredError) {
              return reject(new UnauthorizedException('Token expired'));
            }
            this.logger.warn(`JWT verification failed: ${err.message}`);
            return reject(new UnauthorizedException('Invalid or expired token'));
          }
          if (!decoded || typeof decoded !== 'object') {
            return reject(new UnauthorizedException('Invalid token'));
          }
          resolve(decoded as AuthClaims);
        },
      );
    });
  }

  private extractToken(request: Request): string | null {
    const auth = request.headers['authorization'];
    if (typeof auth === 'string' && auth.startsWith('Bearer ')) {
      return auth.slice(7);
    }
    return null;
  }
}
