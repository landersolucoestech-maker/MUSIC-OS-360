---
name: stripe-webhook-auditor
description: Traces a Stripe webhook end to end — signature auth, dedup, tenant/customer resolution, the billing status-transition/dunning-clock state machine, and persistence — proving idempotency and correct-under-concurrency behavior with real duplicate/replay/out-of-order/concurrent tests. Use whenever a Stripe event handler, the billing status state machine, or the dunning/grace/suspension timeline changes, and before trusting any "webhooks are idempotent" claim that isn't backed by a real duplicate-delivery test.
---

# Stripe Webhook Auditor

## When to trigger

- A Stripe event handler is added or its logic changes.
- The billing status state machine (active/grace/read-only/suspended, or this project's real
  equivalent — confirm the actual states, don't assume this set) changes.
- The dunning-clock/grace-period/suspension timeline changes.
- Before closing any finding claiming webhook processing is idempotent or replay-safe.

## When NOT to trigger

- A Stripe API *call* the app makes outward (checkout session creation, portal session creation)
  with no webhook/event-driven side effect — that's ordinary `integration-reviewer` scope, not this
  skill's state-machine focus.

## Mandatory trace

```
STRIPE EVENT -> WEBHOOK SIGNATURE AUTHENTICATION -> RAW BODY / PARSING -> EVENT DEDUPLICATION
  -> EVENT TYPE PARSER -> CUSTOMER/ACCOUNT/TENANT RESOLUTION -> DOMAIN STATUS TRANSITION
  -> BILLING SERVICE -> PERSISTENCE -> DUNNING CLOCK -> GRACE PERIOD -> SUSPENSION -> RESTORATION
  -> API -> UI/USER-VISIBLE STATE
```

Map this project's REAL external contract first (`external-boundary-mapping`) — Stripe's actual
event names, statuses, and object shapes — before treating any internal field as their equivalent;
a provider status string copied verbatim into internal domain logic is itself a finding.

## Invariants

1. An invalid webhook signature produces no mutation, ever.
2. The same Stripe event (`event.id`) cannot produce its effect twice.
3. A duplicate webhook delivery with no real semantic status transition must not restart the
   dunning clock — the clock's anchor (e.g. `firstFailureAt` or this project's real equivalent)
   must represent the first failure of the *active* sequence, not the most recent delivery.
4. An out-of-order event must not silently regress a newer domain state to an older one.
5. Recovery (a successful payment) must never leave an account suspended while the underlying
   subscription is genuinely active.
6. Suspension cannot occur before the defined grace period has actually elapsed.
7. A Stripe customer/account must map to exactly one internal tenant/entity — an ambiguous mapping
   is a cross-tenant risk, not just a data-quality issue (compose with `security-tenancy-auditor`
   if a mapping ambiguity is found).
8. Replay of an already-fully-processed event is safe (a true no-op, not an error, not a
   re-application of the effect).
9. Every side effect this chain triggers (persistence write, dunning-clock mutation, notification
   dispatch) is idempotent on its own, not idempotent only because the outer handler happens not to
   be called twice.
10. Concurrent processing of two events for the same customer/subscription must preserve every
    invariant above — a correct sequential-only implementation is not sufficient
    (`distributed-systems-reviewer` territory: locking/ordering/CAS).
11. A failure partway through processing (persisted but not yet published/notified, or vice versa)
    cannot leave the event marked definitively complete before every required effect has actually
    landed.
12. Explicitly distinguish, for every event type in scope: received, signature-authenticated,
    accepted (passed dedup), processed (handler ran), and semantic-transition-occurred (domain
    state actually changed) — a status that conflates two of these is a finding.

## Method

1. `external-boundary-mapping` for the real Stripe contract in this codebase: which events are
   handled, what fields are actually read, where the webhook secret is sourced from.
2. Read the actual signature-verification code and confirm it runs on the raw, unparsed body
   (Stripe signatures are computed over exact bytes — a re-serialized JSON body will fail
   verification inconsistently, masking real signature failures as parse errors or vice versa).
3. Read the actual dedup mechanism (an `event.id` uniqueness constraint, an idempotency table, or
   equivalent) and confirm it's checked *before* any side effect, inside the same transaction/lock
   scope as the side effect where the project's real concurrency model requires that.
4. Trace the status-transition/dunning-clock logic against Invariants 3-6 specifically — this is
   almost always where the real bugs live, not in signature verification.
5. Delegate `database-reviewer` for the persistence/locking layer, `backend-reviewer` for the
   handler/service chain, `security-reviewer` for signature/auth, `integration-reviewer` for the
   Stripe contract fidelity, `distributed-systems-reviewer` for concurrency, and
   `reliability-observability-reviewer` for what actually gets logged when a step fails partway.
6. Delegate `adversarial-reviewer` to specifically try to break Invariants 3, 4, 6, and 10 — these
   are the ones a naive sequential-happy-path implementation gets wrong.

## Required test cases (search for existing coverage first; each gap is a finding)

Duplicate event · replay · invalid signature · unknown customer · unknown tenant · out-of-order
event delivery · repeated payment failure (clock must not restart) · failure followed by recovery ·
failure -> grace -> suspension (full timeline) · recovery after suspension · concurrent delivery for
the same customer/subscription · partial processing failure (crash/error mid-handler) · an
irrelevant/unhandled event type (must be a safe no-op, not an error) · same-state redelivery with no
semantic transition.

## PASS / FAIL / BLOCKED

- **PASS**: every invariant above has a real executed test (not a mock that removes the boundary
  being tested — `.claude/rules/testing.md`), recorded as fresh evidence, and `adversarial-reviewer`
  found no way past Invariants 3/4/6/10 specifically.
- **FAIL**: signature bypass, cross-tenant/customer mapping error, a dunning-clock reset on
  duplicate delivery, or an incorrect suspend/recover transition — each of these is HIGH or CRITICAL
  depending on blast radius, never negotiated down because "it's just billing."
- **BLOCKED**: no way to safely generate real duplicate/out-of-order/concurrent Stripe test events
  in the available environment. State this explicitly; do not substitute a narrower test and call it
  equivalent coverage.

## Output

Per event type: handler, dedup mechanism, tenant/customer mapping, source state, target state,
whether a semantic transition actually occurred, dunning-clock mutation (if any), side effects,
persistence behavior, retry/concurrency protection, test coverage (existing vs. missing), findings
(category G for auth findings, E for persistence, I for reliability — pick the one that actually
fits per `.claude/contracts/finding-record.schema.json`), evidence, and a verdict.
