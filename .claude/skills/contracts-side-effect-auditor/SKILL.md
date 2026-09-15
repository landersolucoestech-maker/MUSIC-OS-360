---
name: contracts-side-effect-auditor
description: Audits a state-transition operation (cancel, archive, soft-delete, status change) that should be idempotent but may duplicate side effects (events, queue jobs, notifications, billing effects, audit records) on repeat/concurrent/retried calls. Initial focus is Contracts (cancellation, archive, status transitions), generalizable to any similar domain operation. Use whenever a state-transition method's repeat-call or concurrency behavior hasn't been proven, and before trusting an "idempotent" claim with no test backing it.
---

# Contracts & Side-Effect Auditor

## Mandatory trace

```
ENTRY POINT -> SERVICE METHOD -> CURRENT STATE LOOKUP -> STATE TRANSITION -> PERSISTENCE
  -> DOMAIN EVENT -> QUEUE/NOTIFICATION/WEBHOOK/AUDIT -> REPEATED CALL
```

## Invariants

1. Repeating an idempotent operation ends in the same final state as calling it once.
2. Repeating the call must not duplicate a side effect that should only ever happen once per real
   transition (an email sent twice, a job enqueued twice, a billing effect applied twice).
3. Calling an operation on a resource already in its target state (e.g. `softDelete()` on an
   already-deleted resource) must not re-emit the same effects a second time.
4. Calling `cancel()` (or this project's real equivalent) on an already-cancelled resource must not
   enqueue duplicate downstream work.
5. A domain event must represent a REAL state transition that actually occurred, not merely that
   the method was invoked — an event emitted unconditionally at the top of a method, before
   checking whether anything actually changed, is a real bug class here.
6. An infrastructure-level retry (a network retry, a queue redelivery, a client-side double-click
   hitting the API twice) must not become a duplicate real business action.
7. A failure that occurs after persistence but before publishing the resulting event/side-effect
   needs a defined, consistent recovery or idempotency strategy — "it usually doesn't fail there" is
   not a strategy.
8. Concurrent calls to the same logical operation on the same resource must be analyzed explicitly,
   not assumed safe because the sequential case looks fine.

## Method

1. Read the actual current-state lookup: does the method check the resource's current state before
   transitioning, or does it write unconditionally? An unconditional write is the root cause of most
   findings this skill produces.
2. Search for the project's actual idempotency mechanisms and confirm whether this operation uses
   one: early-return-if-already-in-target-state, a conditional/CAS update (`UPDATE ... WHERE status
   = <expected>`), a unique event key, an idempotency-key header/table, a transactional outbox, a
   dedup check before enqueueing. Absence of any of these on a state-changing operation is itself a
   finding, not just "worth checking."
3. Enumerate every effect the operation triggers downstream (events, queue jobs, notifications,
   emails, webhooks, billing effects, audit records) and, for EACH ONE independently, determine
   whether ITS OWN consumer is idempotent — an idempotent trigger calling a non-idempotent consumer
   still produces a duplicate real-world effect.
4. Delegate `backend-reviewer` for the service/persistence layer, `contract-reviewer` if the
   operation is exposed as a public API contract with its own idempotency expectations,
   `distributed-systems-reviewer` for the queue/event/concurrency angle,
   `reliability-observability-reviewer` for whether a partial failure is actually observable
   (logged/alertable) rather than silent, and `database-reviewer` for the transaction boundary.
5. Delegate `adversarial-reviewer` to specifically attempt: calling the operation twice in
   immediate succession, calling it on an already-final-state resource, and simulating a failure
   between persistence and publish.

## Required test cases

First call (baseline) · identical second call (must be a true no-op for any effect that already
happened) · concurrent calls (both arriving before either completes) · call on a resource already
in its final/target state · a simulated failure between persistence and downstream publish, then a
retry · a count of each downstream side effect across the above scenarios (the count itself is the
assertion, not just "no error was thrown").

## PASS / FAIL / BLOCKED

- **PASS**: every downstream effect's duplicate-call and concurrent-call behavior is proven by a
  real test that actually counts the effect (not just checks the HTTP response), and the
  current-state check runs before any write.
- **FAIL**: a duplicate side effect confirmed on repeat or concurrent calls, or an event emitted
  regardless of whether a real transition occurred.
- **BLOCKED**: no way to safely simulate true concurrency or a mid-operation failure in the
  available environment — state this explicitly rather than substituting two sequential calls for a
  concurrency test.

## Output

Per operation: initial state, target state, whether a semantic transition actually occurred on a
repeat call, whether a persistence write occurred, every emitted effect, behavior on second/
concurrent calls, the idempotency mechanism found (or its absence), findings (category B — business
rule, or I — reliability, per `.claude/contracts/finding-record.schema.json`), evidence, and a
verdict.
