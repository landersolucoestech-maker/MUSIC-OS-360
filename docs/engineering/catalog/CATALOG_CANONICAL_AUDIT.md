# Music Catalog: canonical audit (discovery and findings inventory)

Scope: the owner's canonical catalog specification (66 sections) compared with the repository at the commit that carries
this file. Method: eight read-only traces, one per cluster, each reading the real entities, migrations, services, DTOs,
controllers, web screens and tests, and reporting `CORRECT`, `PARTIAL`, `BROKEN`, `OBSOLETE`, `DUPLICATED` or `MISSING`
with file and line evidence. "Not found" means a search over `apps` and `packages` returned nothing. No database was
available, so nothing here was proven against PostgreSQL.

Rule used for every cluster: preserve what works, fix gaps, never invent behavior, never simulate an external result.
Status names below are the English technical values; the product labels are in the owner's specification.

## 0. Verdict by cluster

| Cluster | State |
|---|---|
| A. Project and ProjectTrack | CRUD plus a generic workflow. Completion validation, completion automation, readiness, reopen, re-conclusion preview and the transcription pipeline do not exist |
| B. Work, Phonogram, Registry, shares | Registry state machine, immutable snapshots and honest driver stubs are good. Status model, percentage validation, ISRC/ISWC placement and the lyric-change rule deviate |
| C. Release and Distribution | Flat CRUD with a legacy ten-value workflow. No ReleaseTrack, no submission or snapshot model, `Distributed` reachable by a plain status edit |
| D. Assets | A central asset layer exists but only the upload path uses it; no roles, no checksum, no unique current master or cover, weak upload validation |
| E. Contracts | One flat contract row; two real signature providers with good webhooks; no main-contract concept, no versioning engine, no signed-file asset |
| F. Identity and access | No Person or Company entity; Artist duplicates civil data; no artist-scoped visibility; no global search; exclusivity only derived from contracts |
| G. External data and integrations | Finance boundary is respected. External id model, ACRCloud persistence, statement pipeline and granular integration permissions are missing |
| H. Tasks, audit, import, concurrency | Four unrelated task tables, no central module; audit is immutable but has no reason or origin; concurrency token is optional |

## 1. Confirmed correct (keep as is)

- No `release_track_share` and no automatic copy or sum between the three percentage structures.
- Phonogram to Work link is optional in the schema; the participant form already has one accompanying-musician category and leaves the phonographic producer blank when mapping from a Project.
- Registry: independent Work and Phonogram processes, a validated submission state machine, versioned hashed snapshots, partner API and portal automation drivers that fail with an unavailable error instead of faking success, manual export never marks a registration as done.
- Audit table is protected by an immutability trigger and the controller is read-only.
- Signature webhooks: HMAC verification, fail-closed tenant resolution, guarded one-time status update.
- Finance: nothing computes royalties from shares, streams or detections, and no statement creates revenue or payments.
- Statistics snapshots are append-only and idempotent; the last sync is stored apart from the data.
- Soundcharts, Spotify and the internal artist id are never equated by string.
- No operational vestige of the retired hosting provider; only the residue detector and recorded guard output mention it.
- No simulated distribution or signature in the web code (guard tests exist).

## 2. Findings, ranked, with disposition

Disposition: FIX (in scope, non-destructive, unit-provable), SCHEMA (needs a migration; cannot be proven without PostgreSQL here), OWNER (needs an owner decision), APPROVAL (destructive, needs an explicit human approval).

### Critical and high

| Id | Finding | Evidence | Disposition |
|---|---|---|---|
| F-01 | A contract can be moved to `signed` by a plain update with no provider evidence, which also emits the signed event | contracts service update path | FIX |
| F-02 | A Release can be set to `distributed` by a plain status edit; Distributed and in-analysis releases remain fully editable | releases service update, release workflow | FIX (guard); SCHEMA for the submission model |
| F-03 | Upload validation trusts the declared type and size; the handler allows script-bearing and plain-text types that presign refuses; rejected objects stay in storage | uploads handler, storage service | FIX |
| F-04 | Integration marked connected when credentials are saved, without any real test; status endpoint hardcodes configured for two providers | integration base service, integrations controller | FIX |
| F-05 | Upstream error body embedded in a thrown error of the society integration (possible secret echo) | abramus service | FIX |
| F-06 | A Phonogram without a Work is reported as a registry validation error, against the rule that the Work relation creates no dependency | registry entity validators | FIX |
| F-07 | Contact attachments and contact contracts are in-memory maps exposed as routes (data lost on restart, not shared across instances, no relation to real contracts) | contact-attachments and contact-contracts services | OWNER (remove or back by real tables) |
| F-08 | Project completion validates nothing and creates no Work, Phonogram, Registry, contract, task or notification; tracks are deleted and re-created on every save with no transaction | projects service | SCHEMA + FIX |
| F-09 | Artist-with-User visibility is not implemented: the artist role sees every artist of the tenant; there is no user to artist link | rbac, guards, artists controller | SCHEMA + OWNER |
| F-10 | No Person or Company entity; Artist carries civil data itself; CPF and CNPJ validation only inside Registry | entities, artist DTO | SCHEMA + APPROVAL (backfill) |

### Medium

| Id | Finding | Disposition |
|---|---|---|
| F-11 | Work and Phonogram status lists do not match the closed lists: no Draft, extra active, inactive, archived and a duplicate in-review value; create DTOs accept a free status; phonogram default is active; no automatic mapping from the Registry state machine | SCHEMA + FIX |
| F-12 | Project status has an extra `review` value shown as a product status; wrong labels in the web view; the form silently demotes an unknown status to planning | FIX (presentation); OWNER (drop internal state) |
| F-13 | Phonogram participation percentages have no server validation; Work participant percentages are unvalidated and duplicate the shares table; one shares row may carry both work and phonogram ids | FIX |
| F-14 | Work carries an ISRC column, DTO field and unique index (belongs to the Phonogram); ISWC is not normalized on create or update and has no uniqueness | APPROVAL (retire column); FIX (ISWC normalization) |
| F-15 | Work participant roles accept more than author and publisher; unknown roles are kept | FIX |
| F-16 | Lyric change does not create a new Work; no previous-Work relation; no transcription-correction exception | SCHEMA + FIX |
| F-17 | No ReleaseTrack; tracklist is free JSON with typed ISRC; Release has a global ISRC; no origin Project reference; no duplicate check | SCHEMA |
| F-18 | Release status enum has ten legacy values instead of the closed list of six | SCHEMA |
| F-19 | No submission, snapshot, rejection reason or ticket model for Distribution | SCHEMA |
| F-20 | Takedown module is a copyright-notice record without a Release link; its statuses do not match | SCHEMA + OWNER |
| F-21 | No MASTER_OFFICIAL or COVER_FINAL roles, no unique current master or cover, release readiness accepts any wav or filename containing master; no checksum or technical audio metadata | SCHEMA |
| F-22 | Permanent public URLs stored in rows; download authorization is tenant and role only, one hour signed URL, no download audit | FIX (download audit, TTL); SCHEMA (asset references) |
| F-23 | No main-contract identity for Work or Phonogram; contract versions are a client-controlled array; templates are not versioned; signed contracts editable in place; no signed-file asset | SCHEMA + FIX (immutability) |
| F-24 | Contracts have one artist, one client, one release column and no link table; type is free text | SCHEMA |
| F-25 | No global search; no artist alias history; specialties not validated against the closed list | FIX (specialties validation); SCHEMA (aliases); new endpoint (search) |
| F-26 | Exclusivity is derived from contracts at read time; no auditable relation with history | SCHEMA |
| F-27 | ACRCloud recognition is a stateless proxy; detections have no Phonogram link or evidence and a status enum that differs from the spec | SCHEMA |
| F-28 | No statement pipeline: no batch, parser, normalized records, currency, territory, original file as an asset | SCHEMA (feature) |
| F-29 | Four unrelated task tables; no sector, project or generic entity reference; no artist visibility; marketing does not generate design or audiovisual tasks | OWNER (design) |
| F-30 | Domain-event notifications have no idempotency key; user id has no foreign key; no artist-to-user resolution | FIX (idempotency); SCHEMA |
| F-31 | Audit has no reason or origin columns; interceptor covers controller mutations only | SCHEMA + FIX |
| F-32 | Concurrency token is optional (last write wins without it); stale-save response lacks opened, current and attempted state; participants and tracks replaced non-atomically | FIX |
| F-33 | Import writes raw inserts, has no origin marking and no id or version roundtrip | SCHEMA + FIX |
| F-34 | No referential-integrity diagnostics and no restore path | FIX (read-only diagnostics) |
| F-35 | Webhook events are globally unique on the external id instead of per provider; Autentique uses one global secret; no out-of-order protection | SCHEMA + FIX |
| F-36 | Integration permissions are role based only; no per-capability permission | FIX |
| F-37 | External identifier table has no link status, origin or history; Soundcharts and Spotify identifiers not persisted as namespaced rows | SCHEMA |

### Owner decisions required

1. Spreadsheet format: the repository contract is XLSX only (`verify:xlsx-only`); the specification asks for CSV and XLSX equivalence. No CSV was added.
2. Whether the internal `review` project state is dropped or only hidden from the product.
3. Whether platform-level Soundcharts and ACRCloud credentials are intended or must become tenant-owned.
4. Central Tasks design (extend the operational task table or build a new module) and the migration of the four task tables.
5. Whether the in-memory contact attachment and contact contract routes are removed or backed by real tables.
6. Takedown module: re-model as a Release ticket flow or keep as a separate copyright-notice record.
7. Whether project types beyond Single, EP and Album (video, tour, podcast, other) remain accepted by the API.

### Destructive or approval-gated work (never self-granted)

Retiring the Work ISRC column, backfilling Person and Company from artist and client data, remapping persisted status
values, replacing the Release tracklist JSON, and removing the contact stubs.

## 3. What can and cannot be proven in this environment

PostgreSQL is not available. Code-level fixes are proven with unit and contract tests. Every migration written for the
SCHEMA items would be unproven against a real database; the database proof stays deferred and each such item is recorded
as such, never as done.

## 4. Resolved in this slice

Each row is one atomic commit on `dev`, with tests that fail when the fix is removed.

| Commit | Cluster | What changed |
|---|---|---|
| `b97f79ae` | Contracts | A partial update no longer writes create-time defaults over stored values (a notes-only or status-only update used to erase documents, versions and exclusivity: F-38). Once a contract is signed or later, the document, signers, template and versions it attests cannot change through an ordinary update. The signed event states whether the signature was registered manually |
| `a52b7a74` | Releases | After distributed, released or archived, the distribution data cannot be edited here; a change toward the distributor is requested from the distributor |
| `7076f82e` | Uploads | The confirm step verifies the stored object: real size and file signature against the declared type, deletes a rejected object, rejects a missing object, uses one allow-list shared with presign |
| `86bed3a1` | Integrations | A saved credential is not a tested connection: probe support, honest status fields, Abramus verified by a real login, provider error bodies redacted, tenant-aware general status |
| `e6ae87a3` | Registry | A Phonogram without a Work is valid for registry validation |
| `f139df9c` | Catalog | ISWC validated and canonicalized on every write; participant percentages validated on every write |
| `3d2793da` | Projects | The four product statuses are the closed list; the internal review state is no longer leaked, demoted or left out of the dashboard |
| `3091a13e` | Artists | Specialties are the closed list |
| `25aac677` | Notifications | A repeated delivery of the same event creates one notification |

## 5. Corrections to the first inventory

These were found while implementing and replace the wording of the table in section 2.

- F-01: the manual signed registration is not a hidden status edit. It is the designed registration action, restricted to administrators and managers, guarded by an attached document and recorded by the transition event. What was missing was immutability after signature and the origin of the signature in the event. Whether the manual action must require an uploaded signed file with a hash is an owner decision and needs the asset layer.
- F-02: the distributed transition is the designed manual confirmation (from scheduled, administrators and managers). What is missing is a record of what was confirmed; that belongs to the submission model (schema). The editable-after-distribution defect was real and is fixed.
- F-13: the exact total of 100% is checked at registry validation by design, because a Work created from a Project legitimately has no formal percentages yet. At write time the invariant is: valid numbers, bounded decimals, running total never above 100%.
- Shares carrying both a work and a phonogram: existing contract tests treat the pair as valid and the split-sum code filters by both. It is a modeling decision for the owner, not a defect proven here.
- The contract signed handler creates a scheduled revenue transaction when a signed contract has a fixed value. That is the company's own finance, not an external royalty, so it is not changed; whether a scheduled forecast counts as a real financial movement is an owner decision.

## 6. Cross-layer impact of the fixes

| Fix | Producers checked | Consumers checked | Result |
|---|---|---|---|
| Contract partial update | the contracts controller is the only caller of the service update; the provider signature path writes through its own guarded statement | the web form always posts the whole contract, so explicit values are still written; no other module depended on the defaults being written | no consumer relied on the old behavior |
| Contract immutability | web edit after signature posts the stored values, which are accepted | the signed event consumers (activity log, notification, revenue forecast, artist status) ignore the new optional origin field | compatible |
| Release freeze | workflow transitions are unchanged; metadata written by automations goes through direct statements | the web form resends stored values, accepted; release date compared by day | compatible |
| Upload verification | presign and confirm controllers unchanged; storage service gained one read method | no web or API flow depended on the types that were removed from the handler list (vector images and plain text were never issued by presign; Word documents were issued by presign and rejected by the handler, now accepted) | compatible, one latent defect removed |
| Integration status | all providers share the base; the web gates actions on the connected flag, which is unchanged for providers without a probe | the status shape gained fields only; one test that pinned the exact shape was updated to a closed list of non-secret keys | compatible |
| Registry rule removal | DTO, form and payload builder already treat the Work link as optional | the web shows an informational badge for a missing Work and blocks nothing | compatible |
| ISWC and percentages | the web form sends decimal strings; the report import writes participants by raw insert and is not covered by this write-time check | web displays the stored ISWC as saved, now in canonical form like the ISRC | import path remains a gap (F-33) |
| Project status | the API workflow and enum are unchanged | list badges, filters and dashboard now agree on four product labels; the internal state is kept on save | compatible |
| Specialties | the web offers exactly the five allowed values | other API clients sending free text now get a 400 naming the allowed list | intended |
| Notification ids | only the domain-event handler changed | other handlers that create notifications are unchanged and still not idempotent | partial, recorded below |

## 7. Not done in this slice, and why

- Integrity diagnostics (F-34): read-only SQL that cannot be proven without PostgreSQL; shipping an unverified query risks false negatives.
- Per-provider connection probes beyond Abramus (F-04, remainder): each needs a real authenticated call that cannot be exercised here.
- Notification idempotency for the other handlers that create notifications directly.
- Everything marked SCHEMA, OWNER or APPROVAL in section 2: Person and Company, artist visibility, ReleaseTrack, submission and snapshot model, asset roles and unique current master and cover, main contracts and contract versioning, central tasks, audit reason and origin, import through the domain layer, statements pipeline and the external identifier model.

## 8. Technical closure of the catalog block: review-driven fixes, proofs and residuals

### 8.1 Independent adversarial reviews

Seven read-only adversarial reviews were run on successive states of the block. Reviews 1 to 5 returned FAIL; every finding that was reachable through code the block changed was fixed and the block was reviewed again. Review 6 (the whole range up to `7c7faaa4`) returned PASS with no critical, high or medium finding and five low findings; one of them (a missing body length) was a real regression and was fixed in `ed107fab`, and review 7 (that delta only) returned PASS. A review verdict is evidence only for the state it reviewed; the final code state is `ed107fab` and the commits after it change documentation and mission state only.

### 8.2 Findings and what happened to each

| Finding | Severity | Fix | Commit |
|---|---|---|---|
| The Abramus endpoint is tenant-supplied and probed (outbound request oracle) | high | https only, no credentials, standard port, no private or metadata address, checked as a literal and after resolution, re-checked whenever a stored endpoint is used | `b63f79dd` |
| A validated host could answer with a redirect to an unchecked address | high | Abramus calls never follow redirects and fail on a 3xx answer | `04630ec3` |
| DNS rebinding: the name was resolved once for the check and again by fetch | medium | the request goes through an https request whose lookup refuses private answers at connect time and returns the connected address | `2237b14f` |
| One shared circuit breaker let one tenant cut Abramus off for all tenants | medium | one breaker per endpoint host, bounded, least recently used eviction | `3d932cfa`, `1bbe9daf` |
| Unresolvable tenant host answered 500; a public IPv6 literal was resolved as a name | medium | both follow the 400 path; literals are judged by the address classifier, names by the resolver, with a lookup timeout | `1bbe9daf`, `737b3950` |
| Frozen release: placeholder track with instrumental, explicit or alternate-version set counted as unchanged; several placeholders accepted | medium | the flags must be at their form defaults (the real default `no` stays accepted); at most one placeholder | `04630ec3`, `3d932cfa` |
| Frozen release: delivered assets and delivery date could still change through the merged assets and schedule objects | medium | master audio, cover, lyrics, credits and the distributor delivery date are frozen; blank, unchanged and trimmed-equal values and the production and marketing keys stay editable | `737b3950` |
| That freeze rejected an untouched edit when the cover lived only in the cover column | medium | the stored value falls back to the column, as the form does | `032068b1` |
| Percentage with a comma passed validation and failed at the database | medium | only dot decimals are valid, a comma is a 400 | `ce0ffa64` |
| Whitespace-only ISWC was stored as spaces | low | stored as null, the single representation of absent | `8ba2166a`, `032068b1` |
| IPv6 and IPv4 address classes missing from the tenant-URL guard (local-use NAT64, IPv4-compatible, SIIT, Teredo, documentation, site-local, uncompressed forms, trailing dot hosts) | low | the classifier parses every textual form and treats an unparseable address as private | `8ba2166a`, `3d932cfa`, `737b3950` |
| Pinned request had only an idle timeout, accepted any status code and sent its body chunked | low | total deadline, status range check, size cap, Content-Length from the body byte length | `3d932cfa`, `ed107fab` |
| A failing restore or a store that cannot record the failure masked the validation failure | low | the caller still gets the validation failure; the state records that the restore failed | `1bbe9daf`, `737b3950` |
| An empty signer list on a signed contract stored without signers counted as a change; dates compared as empty objects | low | an empty list or object is the same absence as null; dates compare by instant | `032068b1` |

### 8.3 Proofs and gates (measured on `ed107fab`)

| Check | Command | Result |
|---|---|---|
| Mutation proof | `node scripts/naming/compat-prove-sandbox.mjs` (artist and contracts pairs re-proven against the current files) | proof file written, 275 pairs, boundaries without behavioral proof: 0 |
| Wiring proof | `node scripts/naming/compat-wiring-proof.mjs --prove --shards 3` | 516 sites, 506 killed, 10 survived (unchanged from the committed baseline, documented exemptions), unproven call sites: 0 |
| Naming aggregate | `pnpm naming:check` | exit 0, 212 gate tests, 0 failed, boundary 0, wiring 0, historical records 0 misclassified, destructive dossier 0 problems |
| API suite | `npx jest` in `apps/api` | 563 suites passed (1 skipped), 9,516 tests passed, 17 skipped, 0 failed |
| Web suite | `pnpm test:run` in `apps/web` | 389 files, 3,207 tests, 0 failed |
| Typecheck | `pnpm typecheck` | exit 0 |
| Lint | `pnpm lint` | exit 0, 0 errors, 2,066 warnings |
| Build | `pnpm build` after removing the stale ignored build info file | exit 0, `apps/api/dist/main.js` emitted |

Every fix above was mutation checked by hand: the mutant fails its covering spec. The closed-specialties rejection message is a plain string literal covered by a spec that fails when the message changes; its Portuguese sentence is exempted in the canonical map with the same reason as the other user-facing validation messages. The connect-time lookup, the redirect refusal, the per-host breaker and the body length are covered by specs that make no network call; they do not prove behavior against a real provider.

### 8.4 Residuals that remain

| Id | Severity | Description | Why it stays |
|---|---|---|---|
| RES-1 | medium, out of block | The spreadsheet import writes artists, works and phonograms by raw insert and bypasses the closed specialties list, the ISWC check and the percentage checks | pre-existing and outside this block: it needs the import to go through the domain layer (F-33, owner item) |
| RES-2 | low | Saving credentials is not atomic: overlapping configure calls can restore credentials that were never verified or overwrite a verified connection, and a crash between the write and the restore leaves them stored; a first failed configuration leaves the tenant-chosen credentials in error status; the failure count is not restored; a restore failure is stored in the state but not logged | a lock or transaction cannot be proven without PostgreSQL |
| RES-3 | low | Two different events of one type on one aggregate in the same millisecond collapse into one notification | the id is deterministic by design; widening it needs an event sequence number (schema) |
| RES-4 | low | A frozen release with no stored tracklist accepts one placeholder that carries only an id and a language | it carries no content and nothing was delivered; recorded decision |
| RES-5 | low | Other metadata keys (territory, pricing, time zone, copyright years, secondary genre, own UPC, various artists), the production and marketing keys of assets and schedule, and removal stay editable on a frozen release; filling a frozen key for the first time is rejected (pinned by a test) | which fields are distribution data is a product decision; the frozen keys are the ones the distributor holds |
| RES-6 | low | Line endings are not normalised in the frozen text keys, so a value stored with CRLF through the API or import and re-posted by the browser with LF is a false conflict | needs non-form data; recorded |
| RES-7 | low | The signature lock and the release freeze read the status before the write and the expected update time is optional, so a patch racing a transition can win; a signed contract stored with a null file URL and re-posted as an empty string, or with legacy signer field shapes, is a false conflict | needs a guarded update that includes the status; not provable without a database |
| RES-8 | low | The verified-upload event is emitted after the commit with no outbox, and a transient storage error while inspecting the object leaves the upload confirmed and unlinked until the client confirms again | needs a durable outbox and retry (schema, worker) |
| RES-9 | low | The presigned upload URL stays valid after verification, so an object can be overwritten after it turned ready | pre-existing storage design, outside this block |
| RES-10 | low | The pinned request ignores an abort signal and header instances, strips no caller transfer-encoding header, supports string bodies only and reuses keep-alive sockets without a new lookup | no caller needs them; a reused socket points at an address that was validated |
| RES-11 | low | A transient resolver failure on a stored endpoint is reported with the same 400 code as a rejected address; address classes such as ORCHID and operator-specific translation prefixes are not listed | acceptable classification; the connect-time lookup is the real guard |
| RES-12 | low | A tenant admin trying more than 100 distinct hosts evicts the breaker of the shared Abramus host and resets its open state | bounded memory was chosen; harmless reset |
| RES-13 | low | The percentage cap sums producers, performers and session musicians of a phonogram into one 100% | product question |
| RES-14 | low | The project form shows two identical in-progress options while a project is in the internal review state | deliberate, it preserves the state on save; dropping the state is an owner decision |
| RES-15 | low | An asset-uploaded notification reads as sent before the upload is verified | wording in another module |
| RES-16 | low, pre-block | The distributor field of the freeze (added in `a52b7a74`) rejects an untouched edit of a distributed release stored with no distributor, because the form defaults it | not part of this block; recorded for the owner |

The earlier residuals F2 (DNS rebinding), the local-use NAT64 prefix, the whitespace ISWC and the placeholder flags are no longer open: they are fixed and listed in 8.2. The distributed-release placeholder language is RES-4.
