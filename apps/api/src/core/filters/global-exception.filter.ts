import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { v4 as uuidv4 }     from 'uuid';
import { Sentry }            from '../../instrument';
import { redactUrl }         from '../security/redact';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx       = host.switchToHttp();
    const response  = ctx.getResponse<Response>();
    const request   = ctx.getRequest<Request>();
    // requestId was injected by RequestIdMiddleware; defensive fallback
    const requestId = request.requestId ?? (request.headers['x-request-id'] as string) ?? uuidv4();
    const correlationId =
      request.correlationId ?? (request.headers['x-correlation-id'] as string) ?? requestId;
    const traceId =
      request.traceId ??
      (request.headers['x-trace-id'] as string) ??
      correlationId;

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Erro interno do servidor';
    let error = 'Internal Server Error';

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      // Default: the exception's class name. Some guards (MustChangePasswordGuard,
      // BillingEnforcementGuard, ...) throw `new ForbiddenException({ error: 'CODE', message })`
      // with their own machine code — that code MUST survive all the way to the client,
      // otherwise it becomes just a generic "ForbiddenException" and the frontend cannot tell them apart
      // (e.g. MUST_CHANGE_PASSWORD vs TENANT_SUSPENDED vs any other 403).
      error = exception.name;

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const resp = exceptionResponse as Record<string, unknown>;
        message = (resp['message'] as string | string[]) ?? exception.message;
        error   = (resp['error']   as string)            ?? exception.name;
      }

      // Do not report 4xx to Sentry (client errors, not system errors)
    } else if (exception instanceof Error) {
      const errObj = exception as Error & { type?: string; status?: number };
      // express body-parser → entity.too.large (PayloadTooLargeError) → 413
      if (errObj.type === 'entity.too.large' || errObj.status === 413 || /entity too large|request entity too large/i.test(errObj.message)) {
        statusCode = HttpStatus.PAYLOAD_TOO_LARGE;
        error = 'PayloadTooLargeException';
        message = 'O conteúdo enviado excede o limite permitido (1 MB).';
      } else if (/^CORS:/.test(errObj.message)) {
        statusCode = HttpStatus.FORBIDDEN;
        error = 'CorsException';
        message = 'Origem não autorizada';
      } else {
        this.logger.error(`Unhandled error: ${exception.message}`, exception.stack);
        this.reportToSentry(exception, request, requestId);
      }
    }

    const errorBody = {
      statusCode,
      message,
      error,
      timestamp: new Date().toISOString(),
      path:      request.url,
      requestId,
      correlationId,
      traceId,
    };

    this.logger.error(`${request.method} ${redactUrl(request.url)} → ${statusCode} [${requestId}]`);

    response
      .status(statusCode)
      .header('X-Request-ID', requestId)
      .header('X-Correlation-ID', correlationId)
      .header('X-Trace-ID', traceId)
      .json(errorBody);
  }

  private reportToSentry(exception: Error, request: Request, requestId: string): void {
    try {
      if (!Sentry) return;
      Sentry.withScope(scope => {
        scope.setTag('requestId', requestId);
        if (request.correlationId) scope.setTag('correlationId', request.correlationId);
        if (request.traceId) scope.setTag('traceId', request.traceId);
        scope.setTag('method',    request.method);
        scope.setTag('path',      redactUrl(request.url));

        // find-e0163405: TenantGuard/AuthGuard set request.tenant.id /
        // request.auth.userId -- request.tenantId/request.userId (flat)
        // never existed, so these tags/user context were always empty.
        const tenantId = (request as any).tenant?.id as string | undefined;
        const userId   = (request as any).auth?.userId as string | undefined;
        if (tenantId) scope.setTag('tenantId', tenantId);
        if (userId)   scope.setUser({ id: userId });

        Sentry.captureException(exception);
      });
    } catch {
      // Never let Sentry failures break the HTTP response
    }
  }
}
