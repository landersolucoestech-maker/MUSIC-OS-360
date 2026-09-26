/**
 * core/interceptors/logging.interceptor.ts
 *
 * Structured HTTP logging interceptor.
 * Emits JSON per request with: requestId, correlationId, method, url, statusCode,
 * latency_ms, tenantId, userId.
 * The requestId is propagated by RequestIdMiddleware (X-Request-ID).
 */

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import { redactUrl } from '../security/redact';

const SERVICE_META = {
  service: 'music-os-api',
  env:     process.env['NODE_ENV'] ?? 'development',
  version: process.env['npm_package_version'] ?? '1.0.0',
};

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const httpCtx  = context.switchToHttp();
    const request  = httpCtx.getRequest<Request>();
    const response = httpCtx.getResponse<Response>();
    const startMs  = Date.now();

    const { method } = request;
    // find-936c6f8d: OAuth code/state, hub.verify_token etc. never reach logs.
    const url = redactUrl(request.url);
    const req       = request as unknown as Record<string, unknown>;
    const requestId = req['requestId'] as string | undefined;
    const correlationId = req['correlationId'] as string | undefined;
    const traceId = req['traceId'] as string | undefined;
    const tenantId =
      (req['tenantId'] as string | undefined) ??
      ((req['tenant'] as Record<string, unknown> | undefined)?.['id'] as string | undefined) ??
      ((req['currentMember'] as Record<string, unknown> | undefined)?.['tenant_id'] as string | undefined);
    const userId =
      (req['userId'] as string | undefined) ??
      ((req['auth'] as Record<string, unknown> | undefined)?.['userId'] as string | undefined);

    return next.handle().pipe(
      tap({
        next: () => {
          const ms         = Date.now() - startMs;
          const statusCode = response.statusCode;

          const logLine = JSON.stringify({
            ts:         new Date().toISOString(),
            level:      statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info',
            type:       'http',
            ...SERVICE_META,
            requestId:     requestId ?? 'n/a',
            correlationId: correlationId ?? requestId ?? 'n/a',
            traceId: traceId ?? correlationId ?? requestId ?? 'n/a',
            method,
            url,
            statusCode,
            latency_ms: ms,
            ...(tenantId && { tenantId }),
            ...(userId   && { userId }),
          });

          if (statusCode >= 500) {
            this.logger.error(logLine);
          } else if (statusCode >= 400) {
            this.logger.warn(logLine);
          } else {
            this.logger.log(logLine);
          }
        },

        error: (err: unknown) => {
          const ms = Date.now() - startMs;
          const statusCode =
            err && typeof err === 'object' && 'status' in err
              ? (err as { status: number }).status
              : 500;

          const logLine = JSON.stringify({
            ts:         new Date().toISOString(),
            level:      statusCode >= 500 ? 'error' : 'warn',
            type:       'http',
            ...SERVICE_META,
            requestId:     requestId ?? 'n/a',
            correlationId: correlationId ?? requestId ?? 'n/a',
            traceId: traceId ?? correlationId ?? requestId ?? 'n/a',
            method,
            url,
            statusCode,
            latency_ms: ms,
            ...(tenantId && { tenantId }),
            ...(userId   && { userId }),
            error:      err instanceof Error ? err.message : String(err),
            ...(err instanceof Error && err.stack && { stack: err.stack.split('\n').slice(0, 4).join('\n') }),
          });

          if (statusCode >= 500) {
            this.logger.error(logLine);
          } else {
            this.logger.warn(logLine);
          }
        },
      }),
    );
  }
}
