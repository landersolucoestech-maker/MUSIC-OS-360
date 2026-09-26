/**
 * core/middleware/request-id.middleware.ts
 *
 * Request correlation middleware.
 * Reads X-Request-ID from the incoming header or generates a new UUID.
 * Propagates the requestId in the response header and on the request object
 * so interceptors and filters can include it in the logs.
 */

import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

// Extension of the Express Request to carry the requestId
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const incoming = req.headers['x-request-id'];
    const requestId =
      typeof incoming === 'string' &&
      /^[A-Za-z0-9._:-]{1,128}$/.test(incoming.trim())
        ? incoming.trim()
        : uuidv4();

    req.requestId = requestId;
    res.setHeader('X-Request-ID', requestId);

    next();
  }
}
