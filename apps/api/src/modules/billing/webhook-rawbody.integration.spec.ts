/**
 * TEST-03 (auditoria 2026-07-05): o fix do 400 no webhook Stripe (commit b728b133)
 * nao tinha nenhuma cobertura automatizada — nenhum spec referenciava `rawBody`.
 * Uma futura mudanca em main.ts (reordenar middlewares, trocar parser, remover o
 * `verify:` callback) poderia reintroduzir o bug silenciosamente.
 *
 * Este teste reproduz o pipeline real: `express.json({ verify })` (exatamente como
 * configurado em apps/api/src/main.ts) seguido de um handler que chama o SDK real
 * do Stripe (`stripe.webhooks.constructEvent`) contra o `req.rawBody` populado pelo
 * `verify` callback — a mesma cadeia usada por BillingController.webhook().
 */
import * as express from 'express';
import * as request from 'supertest';

// Mesmo padrao de require+fallback de billing.service.ts (CJS/ESM interop do pacote stripe).
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

/** Middleware exato de apps/api/src/main.ts:198-205 — populates req.rawBody via verify. */
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

describe('Stripe webhook rawBody wiring (regressao do fix b728b133)', () => {
  it('com o parser real de main.ts, assinatura Stripe valida e aceita (200)', async () => {
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
    // Parser "ingenuo" sem `verify` — reproduz exatamente o bug do commit b728b133
    // (req.rawBody fica undefined -> constructEvent nunca roda -> 400 sempre).
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
