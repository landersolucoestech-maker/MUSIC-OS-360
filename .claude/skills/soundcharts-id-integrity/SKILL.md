---
name: soundcharts-id-integrity
description: Proves internalArtistId, a Soundcharts UUID, a Spotify ID, and every other provider-specific external identifier are never conflated — traced from credentials through the provider client, response normalization, internal resolution, persistence, and every consumer. Use whenever a Soundcharts/platform-profile integration, an artist-identity resolver, or an ID-mapping table changes, and before trusting any code path that compares or assigns across these namespaces. A generalization of external-boundary-mapping's boundary concept to the specific, named identity-collision risk in this codebase's multi-provider artist-ID model.
---

# Soundcharts / Provider ID Integrity

## Absolute invariant

`internalArtistId != Soundcharts UUID != Spotify ID != any other provider-specific external ID`

Textual/structural equality between two IDs from different namespaces NEVER proves they refer to
the same real-world entity. Namespace confusion here is a data-integrity bug even when it happens
to work by coincidence in test data.

## Mandatory trace

```
CREDENTIALS/CONFIG -> PROVIDER CLIENT/SDK -> ENDPOINT -> REQUEST -> RAW RESPONSE
  -> RESPONSE SCHEMA -> PROVIDER UUID/EXTERNAL ID -> NORMALIZATION -> INTERNAL ARTIST RESOLUTION
  -> MAPPING -> PERSISTENCE -> CONSTRAINT -> SERVICE/USE CASE -> CONTROLLER -> DTO
  -> FRONTEND/CONSUMER -> CACHE/JOB/BACKFILL
```

## Scope

Every provider identifier in play — Soundcharts UUID, internal artist ID, and every platform-
specific ID (Spotify, Apple Music, Deezer, YouTube/channel, TikTok, and any other this project
actually integrates — confirm the real list via `external-boundary-mapping`, don't assume).

## Prohibited semantics (each is a finding on sight)

- Comparing IDs across namespaces to infer identity (`artist.id === soundcharts.uuid` or any
  structural equivalent).
- Persisting an external provider ID into a field that is supposed to hold the internal ID.
- Overwriting the internal ID during a sync/backfill operation.
- Using an artist NAME as the sole identity key anywhere in a resolution path (names collide; IDs
  are the only safe key, and even then only within their own namespace).

## Method

1. `external-boundary-mapping` first, to get the real, current list of providers and their ID
   fields as this codebase actually implements them.
2. For each identifier found, record: namespace/origin, producer (where it's first obtained),
   every consumer, its normalization step (if any), its storage column, whether that column has a
   real uniqueness constraint scoped correctly (per-provider, not globally, unless the ID space
   genuinely is global), and the mapping mechanism tying it to the internal artist.
3. Grep specifically for every place two different-namespace identifiers appear in the same
   expression, comparison, or query — this is where a real conflation bug hides, even in code that
   "looks fine" at a glance because a variable is misleadingly named (e.g. a local variable named
   `artistId` that actually holds a provider's external ID — a real naming-only instance of this
   pattern is still worth flagging even with zero functional impact, since it's exactly the kind of
   local that gets mis-used the next time someone edits nearby).
4. Check retry/rate-limit/backoff/timeout behavior on the provider call itself
   (`reliability-observability-reviewer` territory) and, separately, check for: a stale mapping
   after the provider-side record was deleted, a provider ID that changed and left an orphaned old
   mapping, two internal artists pointing at the same external ID, one internal artist with two
   conflicting mappings to the same provider, and a race during import/backfill that could produce
   any of the above.
5. Delegate `integration-reviewer` for the provider-client layer, `backend-reviewer` for
   resolution/persistence, `database-reviewer` for constraints, `contract-reviewer` for the
   DTO/API shape carrying these IDs to the frontend, and `reliability-observability-reviewer` for
   resilience around the provider call.
6. Delegate `adversarial-reviewer` to specifically try to construct a case where two different
   real-world artists end up sharing one internal ID, or one artist ends up with two internal IDs,
   via the mapping/backfill path.

## Severity rules

A wrong external-profile association (artist A's page shows artist B's Spotify data) is HIGH. Any
scenario where this leads to cross-TENANT identity association (not just cross-artist within one
tenant) is CRITICAL — compose with `security-tenancy-auditor` if that's even plausible in this
codebase's model.

## PASS / FAIL / BLOCKED

- **PASS**: every identifier's namespace, storage, and mapping mechanism is documented; no
  prohibited-semantics hit found (or every hit found has a disposition); `adversarial-reviewer`
  could not construct a collision.
- **FAIL**: a confirmed case of one internal artist mapped to two conflicting external IDs, two
  internal artists mapped to the same external ID, or an external ID persisted into an internal-ID
  field.
- **BLOCKED**: provider credentials/sandbox access needed to observe a real response shape are
  unavailable — state this explicitly; do not infer the shape from documentation alone if the
  invariant depends on runtime behavior (e.g. whether the provider ever reuses an ID).

## Output

Per identifier: namespace, producer, consumers, normalization, storage, uniqueness constraint,
mapping mechanism, any suspicious cross-namespace comparison found, findings (category D — external
contract, or E — database/persistence, per `.claude/contracts/finding-record.schema.json`),
evidence, and a verdict.
