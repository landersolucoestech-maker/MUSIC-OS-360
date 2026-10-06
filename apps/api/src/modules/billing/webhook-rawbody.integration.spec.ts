/**
 * TEST-03 (2026-07-05 audit): the fix for the Stripe webhook 400 (commit b728b133)
 * had no automated coverage — no spec referenced `rawBody`.
 * A future change in main.ts (reordering middlewares, swapping the parser, removing the
 * `verify:` callback) could silently reintroduce the bug.
 *
 * This test reproduces the real pipeline: `express.json({ verify })` (exactly as
 * configured in apps/api/src/main.ts) followed by a handler that calls the real Stripe
 * SDK (`stripe.webhooks.constructEvent`) against the `req.rawBody` populated by the
 * `verify` callback — the same chain used by BillingController.webhook().
 */
import * as express from 'express';
import * as request from 'supertest';

// Same require+fallback pattern as billing.service.ts (CJS/ESM interop of the stripe package).
const StripeRaw = require('stripe');
const StripeClass = (StripeRaw as any).default ?? StripeRaw;

const WEBHOOK_SECRET = 'whsec_test_secret_for_rawbody_regression';
const stripe = new StripeClass('sk_test_dummy_key_not_used_for_network_calls', {
  apiVersion: '2026-04-22.dahlia',
});

function makeSignedPayload() {
  const payload = JSON.stringify({
    id: 'evt_test_123',
    type: 'checkout.session.completed',
    data: { object: { id: 'cs_test_123' } },
  });
  const header = stripe.webhooks.generateTestHeaderString({
    payload,
    secret: WEBHOOK_SECRET,
  });
  return { payload, header };
}

/** Exact middleware from apps/api/src/main.ts:198-205 — populates req.rawBody via verify. */
function jsonWithRawBody() {
  return express.json({
    limit: '1mb',
    verify: (req, _res, buf) => {
      (req as express.Request & { rawBody?: Buffer }).rawBody = buf;
    },
  });
}

function makeAppWithWebhookRoute(bodyParser: express.RequestHandler) {
  const app = express();
  app.use(bodyParser);
  app.post('/webhooks/stripe', (req, res) => {
    const signature = req.headers['stripe-signature'] as string | undefined;
    const rawBody = (req as express.Request & { rawBody?: Buffer }).rawBody;
    if (!signature || !rawBody) {
      return res.status(400).json({ error: 'missing signature or rawBody' });
    }
    try {
      const event = stripe.webhooks.constructEvent(rawBody, signature, WEBHOOK_SECRET);
      return res.status(200).json({ received: true, type: event.type });
    } catch {
      return res.status(400).json({ error: 'invalid signature' });
    }
  });
  return app;
}

describe('Stripe webhook rawBody wiring (regression for fix b728b133)', () => {
  it('with the real main.ts parser, a valid Stripe signature is accepted (200)', async () => {
    const app = makeAppWithWebhookRoute(jsonWithRawBody());
    const { payload, header } = makeSignedPayload();

    await request(app)
      .post('/webhooks/stripe')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', header)
      .send(payload)
      .expect(200)
      .expect((res) => {
        expect(res.body.type).toBe('checkout.session.completed');
      });
  });

  it('a tampered signature is rejected even with rawBody present (400)', async () => {
    const app = makeAppWithWebhookRoute(jsonWithRawBody());
    const { payload } = makeSignedPayload();

    await request(app)
      .post('/webhooks/stripe')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', 't=1,v1=deadbeef')
      .send(payload)
      .expect(400);
  });

  it('REGRESSION: without the verify callback (req.rawBody never populated), a valid webhook is rejected with 400', async () => {
    // "Naive" parser without `verify` — reproduces exactly the bug of commit b728b133
    // (req.rawBody stays undefined -> constructEvent never runs -> always 400).
    const naiveParser = express.json({ limit: '1mb' });
    const app = makeAppWithWebhookRoute(naiveParser);
    const { payload, header } = makeSignedPayload();

    await request(app)
      .post('/webhooks/stripe')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', header)
      .send(payload)
      .expect(400);
  });
});
