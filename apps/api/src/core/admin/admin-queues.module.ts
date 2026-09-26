/**
 * core/admin/admin-queues.module.ts
 *
 * Mounts @bull-board/nestjs dashboard at /admin/queues for the 4 known queues.
 * Protected by HTTP basic-auth middleware (ADMIN_QUEUES_USER/PASS) since the
 * bull-board middleware mounts BEFORE the Nest JWT guard pipeline.
 *
 * Production policy:
 *   - ADMIN_QUEUES_USER + ADMIN_QUEUES_PASS must be set; otherwise dashboard is disabled.
 *   - In dev defaults to admin/admin (logged warning).
 */

import { DynamicModule, Module, MiddlewareConsumer, NestModule, Logger } from '@nestjs/common';
import { BullBoardModule } from '@bull-board/nestjs';
import { ExpressAdapter } from '@bull-board/express';
import { BullAdapter } from '@bull-board/api/bullAdapter';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { isProdLike } from '../config/runtime-environment';
import { QUEUE_NAMES } from '../../queues/queue.constants';
import { bullMqAvailable } from '../../queues/queue.module';
import type { Request, Response, NextFunction } from 'express';

const BULL_BOARD_PATH = '/admin/queues';

function basicAuthMiddleware(user: string, pass: string) {
  const expected = 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64');
  return (req: Request, res: Response, next: NextFunction) => {
    const got = req.headers['authorization'];
    if (got !== expected) {
      res.setHeader('WWW-Authenticate', 'Basic realm="MUSIC OS 360 Queues"');
      res.status(401).send('Authentication required');
      return;
    }
    next();
  };
}

@Module({})
export class AdminQueuesModule implements NestModule {
  private static readonly logger = new Logger('AdminQueuesModule');

  static async register(): Promise<DynamicModule> {
    const prodLike = isProdLike(process.env['NODE_ENV']);
    const user = process.env['ADMIN_QUEUES_USER'] ?? 'admin';
    const pass = process.env['ADMIN_QUEUES_PASS'] ?? (prodLike ? '' : 'admin');
    const enabled = !!(user && pass);

    if (prodLike && (!process.env['ADMIN_QUEUES_USER'] || !process.env['ADMIN_QUEUES_PASS'])) {
      AdminQueuesModule.logger.warn('AdminQueuesModule: ADMIN_QUEUES_USER/PASS missing in prod-like environment - dashboard disabled');
      return { module: AdminQueuesModule };
    }

    if (!enabled) {
      return { module: AdminQueuesModule };
    }

    // Bull Board only exists when the queues exist: if QueueModule fell back to
    // no-op (Redis missing/unreachable in dev), mounting the board would break
    // bootstrap with "Nest could not find BullQueue_<name>".
    if (!(await bullMqAvailable())) {
      AdminQueuesModule.logger.warn('AdminQueuesModule: BullMQ em modo no-op — dashboard de filas desativado');
      return { module: AdminQueuesModule };
    }

    return {
      module: AdminQueuesModule,
      imports: [
        BullBoardModule.forRoot({
          route: BULL_BOARD_PATH,
          adapter: ExpressAdapter,
        }),
        // Register each queue. BullMQAdapter for BullMQ queues.
        BullBoardModule.forFeature(
          ...[
            QUEUE_NAMES.EMAILS,
            QUEUE_NAMES.NOTIFICATIONS,
            QUEUE_NAMES.AI_JOBS,
            QUEUE_NAMES.STREAMING_SYNC,
          ].map((name) => ({ name, adapter: BullMQAdapter })),
        ),
      ],
    };
  }

  configure(consumer: MiddlewareConsumer): void {
    const prodLike = isProdLike(process.env['NODE_ENV']);
    const user = process.env['ADMIN_QUEUES_USER'] ?? 'admin';
    const pass = process.env['ADMIN_QUEUES_PASS'] ?? (prodLike ? '' : 'admin');
    if (!user || !pass) return;
    consumer.apply(basicAuthMiddleware(user, pass)).forRoutes(BULL_BOARD_PATH, `${BULL_BOARD_PATH}/(.*)`);
  }
}
