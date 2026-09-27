// PHASE 10 — simulate NODE_ENV=production boot with realistic real (non-placeholder)
// secret values to confirm env.schema accepts them.
process.env.NODE_ENV = 'production';
process.env.DATABASE_URL = 'postgresql://user:pass@host/db';
process.env.REDIS_QUEUE_URL = 'rediss://default:tok@host:6379';
process.env.SUPABASE_URL = 'https://prj.supabase.co';
process.env.SUPABASE_ANON_KEY = 'eyJanon';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJservice';
process.env.AUTENTIQUE_WEBHOOK_SECRET = 'AAAABBBBCCCCDDDDEEEEFFFFGGGG'; // 28 chars
process.env.RESEND_API_KEY = 're_realdev_prod_key';
process.env.SENTRY_DSN = 'https://realkey@o123.ingest.sentry.io/45678';
process.env.ENCRYPTION_KEY = 'aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899';
process.env.CORS_ORIGINS = 'https://app.musicos360.com';
process.env.APP_URL = 'https://app.musicos360.com';
process.env.R2_PUBLIC_URL = 'https://pub-realhash.r2.dev';

try {
  const { validateEnv } = require('../dist/apps/api/src/core/config/env.schema.js');
  const r = validateEnv(process.env);
  console.log('OK env.schema.validateEnv with simulated REAL prod values');
  console.log('  AUTENTIQUE_WEBHOOK_SECRET present:', !!r.AUTENTIQUE_WEBHOOK_SECRET);
  console.log('  R2_PUBLIC_URL:', r.R2_PUBLIC_URL);
  console.log('  CORS_ORIGINS:', r.CORS_ORIGINS);
  console.log('  APP_URL:', r.APP_URL);
} catch (e) {
  console.error('FAIL:', e.message);
  process.exit(1);
}
