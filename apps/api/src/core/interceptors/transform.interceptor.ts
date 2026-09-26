import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import type { Request } from 'express';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ApiResponse<T> {
  data: T;
  meta?: Record<string, unknown>;
  timestamp: string;
}

// Routes that produce raw bodies (text/plain Prometheus, etc.) and must NOT be
// wrapped in the standard {data, timestamp} envelope.
const RAW_BODY_PATHS = new Set<string>(['/metrics']);

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T> | T>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T> | T> {
    const req = context.switchToHttp().getRequest<Request>();
    if (RAW_BODY_PATHS.has(req.path)) {
      return next.handle();
    }

    return next.handle().pipe(
      map((value) => {
        // If the value already has the { data, meta } shape, preserve it
        if (
          value !== null &&
          typeof value === 'object' &&
          'data' in value &&
          !Array.isArray(value)
        ) {
          return {
            ...value,
            timestamp: new Date().toISOString(),
          } as ApiResponse<T>;
        }

        // Otherwise, wrap it in { data }
        return {
          data: value as T,
          timestamp: new Date().toISOString(),
        };
      }),
    );
  }
}
