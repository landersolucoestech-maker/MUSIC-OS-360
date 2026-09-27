/**
 * create-app.ts
 *
 * Shared Nest application setup — extracted from main.ts's bootstrap() so
 * app creation (middleware, pipes, filters, interceptors, CORS, and env
 * validation) has a single source of truth, testable independently of
 * actually starting the HTTP listener.
 *
 * Does NOT call app.listen() — that's the caller's (main.ts's) job.
 */

import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger, RequestMethod, INestApplication, LogLevel } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
// `import =` for CJS interop: compression does not expose `.default`, so the default
// import breaks at runtime under ts-node (esModuleInterop off). Works under tsx and ts-node.
import compression = require('compression');
import * as express from 'express';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './core/filters/global-exception.filter';
import { validationExceptionFactory } from './core/pipes/validation-messages';
import { TransformInterceptor } from './core/interceptors/transform.interceptor';
import { LoggingInterceptor } from './core/interceptors/logging.interceptor';
import { collectSupabaseEnvErrors } from './core/config/env.schema';
import { isProdLike } from './core/config/runtime-environment';

/** Same fail-closed checks main.ts's bootstrap() always ran before creating
 * the app — kept separate so it stays testable on its own. */
export function assertApiRuntimeEnv(logger: Logger): void {
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  const prodLike = isProdLike(nodeEnv);
  const errors = collectSupabaseEnvErrors(process.env as Record<string, string | undefined>, nodeEnv);

  if (prodLike) {
    for (const flag of ['USE_MOCK', 'MOCK_MODE', 'AUTH_DISABLED'] as const) {
      if (process.env[flag] === 'true') {
        errors.push(`${flag}=true e proibido em NODE_ENV=${nodeEnv}`);
      }
    }
  }

  if (errors.length > 0) {
    const message = `FATAL: ambiente Supabase invalido:\n${errors.map((err) => `  - ${err}`).join('\n')}`;
    logger.error(message);
    throw new Error(message);
  }
}

export async function createApp(): Promise<INestApplication> {
  const logger = new Logger('Bootstrap');
  assertApiRuntimeEnv(logger);

  const nodeEnv = process.env.NODE_ENV ?? 'development';
  if (isProdLike(nodeEnv)) {
    if (process.env.AUTH_DISABLED === 'true') {
      throw new Error(`FATAL: AUTH_DISABLED=true is forbidden in ${nodeEnv}.`);
    }
    if (process.env.MOCK_MODE === 'true' || process.env.VITE_MOCK_MODE === 'true') {
      throw new Error(`FATAL: MOCK_MODE=true is forbidden in ${nodeEnv}.`);
    }
  }

  const nestOptions = {
    bufferLogs: true,
    logger: ['error', 'warn', 'log', 'debug'] as LogLevel[],
    rawBody: true,
  };

  const app = await NestFactory.create(AppModule, nestOptions);

  // ── Security ─────────────────────────────────────────────────────────────────
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          scriptSrc: ["'self'"],
          frameAncestors: ["'none'"],
          upgradeInsecureRequests: isProdLike(process.env['NODE_ENV']) ? [] : null,
        },
      },
      // HSTS: 1 year, include subdomains — only in production (HTTPS required)
      hsts: isProdLike(process.env['NODE_ENV'])
        ? { maxAge: 31_536_000, includeSubDomains: true, preload: true }
        : false,
      crossOriginEmbedderPolicy: false,
      // Prevent MIME-type sniffing
      noSniff: true,
      // Block clickjacking
      frameguard: { action: 'deny' },
      // Disable XSS filter (modern browsers don't support it; CSP is better)
      xssFilter: false,
    }),
  );

  app.use(compression());

  // ── Body limits (1MB) — PayloadTooLargeError → 413 via GlobalExceptionFilter ──
  // This parser runs BEFORE Nest's internal rawBody-aware parser and consumes the
  // stream, so it must populate req.rawBody itself or Stripe webhook signature
  // verification (billing.controller → req.rawBody) receives undefined → 400.
  app.use(
    express.json({
      limit: '1mb',
      verify: (req, _res, buf) => {
        (req as typeof req & { rawBody?: Buffer }).rawBody = buf;
      },
    }),
  );
  app.use(express.urlencoded({ limit: '1mb', extended: true }));

  // ── CORS ─────────────────────────────────────────────────────────────────────
  const prodLikeCors = isProdLike(process.env['NODE_ENV']);
  const allowedOrigins = (
    process.env['CORS_ORIGINS'] ?? (prodLikeCors ? '' : 'http://localhost:5000')
  ).split(',').map((origin) => origin.trim()).filter(Boolean);

  const isDevEnv = !prodLikeCors;

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      // In dev, accept any localhost port
      if (isDevEnv) {
        if (/^https?:\/\/localhost(:\d+)?$/.test(origin)) {
          return callback(null, true);
        }
      }
      // Silent reject: no Access-Control-Allow-Origin header is set, browser blocks.
      // Avoids leaking 500 + server headers to attackers.
      callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Tenant-ID',
      'X-Request-ID',
      'X-Correlation-ID',
      'X-Trace-ID',
      'traceparent',
      'X-Idempotency-Key',
    ],
    exposedHeaders: [
      'X-Request-ID',
      'X-Correlation-ID',
      'X-Trace-ID',
      'X-Idempotency-Replayed',
    ],
  });

  // ── Global prefix ────────────────────────────────────────────────────────────
  app.setGlobalPrefix('api/v1', {
    exclude: [
      { path: 'metrics', method: RequestMethod.GET },
      { path: 'admin/queues', method: RequestMethod.ALL },
      { path: 'admin/queues/(.*)', method: RequestMethod.ALL },
    ],
  });

  // ── Pipes, Filters, Interceptors ─────────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      // Default class-validator messages are English/technical; the factory
      // returns PT-BR end-user copy and logs the technical detail.
      exceptionFactory: validationExceptionFactory,
    }),
  );
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(
    new LoggingInterceptor(),
    new TransformInterceptor(),
  );

  // ── Swagger (dev/test apenas) ────────────────────────────────────────────────
  if (!isProdLike(process.env['NODE_ENV'])) {
    try {
      const config = new DocumentBuilder()
        .setTitle('MUSIC OS 360° API')
        .setDescription('Enterprise Music Management SaaS — API REST')
        .setVersion('1.0')
        .addBearerAuth(
          { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
          'JWT',
        )
        .addServer(`http://localhost:${process.env['PORT'] ?? 3001}`, 'Development')
        .build();

      const document = SwaggerModule.createDocument(app, config);
      SwaggerModule.setup('docs', app, document, {
        swaggerOptions: { persistAuthorization: true },
      });
    } catch (err) {
      logger.warn(`Swagger desativado neste boot: ${String(err)}`);
    }
  }

  return app;
}
