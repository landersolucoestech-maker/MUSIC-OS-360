# AGENT-CROSS-CONTEXT — Adversarial Cross-Context Contamination Audit

subagent_type: security-reviewer
input_snapshot: HEAD 8c477787c043bdf0ceecf9feafe27a17fc932a3c
tool_uses: 29
duration_ms: 178138
status: COMPLETED
ran_after: AGENT-MC, AGENT-METRICS, AGENT-MARKETING (all sealed, given as input, independently re-verified rather than trusted blindly)

## 13 adversarial questions, all answered with file:line evidence

Q1 Can MusicChat auth affect Metrics? NO -- ArtistsModule imports only [ActivityLogsModule, AIModule], zero oauth_connections references in artists/.
Q2 Can Marketing auth affect Metrics? NO -- same module-graph isolation; zero metrics provider references OAuthConnectionEntity.
Q3 Can disconnecting Instagram in Marketing break Instagram metrics? NO -- InstagramArtistProfileProvider resolves entirely via SoundchartsService keyed on artist.metadata.instagram_url, never touches oauth_connections; own doc comment confirms intentional separation.
Q4 Can connecting Instagram in MusicChat change which profile's metrics show? NOT_APPLICABLE -- MusicChat has no working Instagram connection; ConversationEntity.channel has no FK/join to metrics tables at all.
Q5 Can a Facebook Page ID be confused with an Instagram Business Account ID? NO -- instagram.service.ts:130-138 correctly resolves igData.instagram_business_account?.id as a distinct field, never conflates with pageData.id; no externalAccountId column even exists to store either. (Noted, separately: silently picks pages.data[0] if a user manages multiple Pages -- a real but different quirk.)
Q6 Can a Soundcharts UUID be treated as internalArtistId? NO -- zero source matches for "internalArtistId" repo-wide; artist_id columns are always the internal PK, Soundcharts UUIDs only ever passed as opaque lookup strings.
Q7 Can a Spotify Artist ID select the wrong provider entity? NO -- exact by-platform lookup, 404 returns null-metrics rather than falling back to a different entity.
Q8 Can two tenants collide in cache? YES but benign -- soundcharts.service.ts:260 and market-reference-cache.service.ts:112 build cache keys without tenant_id, but this is Soundcharts' public third-party data (same real-world number for any tenant), not a private-data leak.
Q9 Can one user's Marketing OAuth become another artist's metric source? NO, structurally impossible -- confirmed via module graph: MarketingModule imports IntegrationsModule, ArtistsModule imports neither.
Q10 Can Metrics read an OAuth token intended for publishing? NO -- zero OAuthConnectionEntity/oauth_connections references anywhere under platform-profiles/.
Q11 Can Marketing call an analytics repository, or Metrics call a publishing service? NO -- neither MarketingModule nor ArtistsModule cross-imports the other.
Q12 Can MusicChat call a publishing service? NO -- ConversationsModule imports only [NotificationsModule, WhatsAppModule, AIModule]. (Noted: IntegrationsModule imports ConversationsModule, opposite direction, for WhatsApp-webhook delivery only -- does not grant Conversations access to Integrations.)
Q13 Does Metrics depend on a "connected account" table anywhere? NO -- zero connected/needs_reauth/isConnected/redirect-to-connect matches under platform-profiles/; corroborated by the existing guard test.

## Original bug hypothesis ("Instagram data appears incorrect for some artists")
NOT a proven/located bug -- an honestly-flagged hypothesis for next investigation. Mechanism: instagram-artist-profile.provider.ts's fallback path (lines 86-129) falls back to a Soundcharts UUID resolved from the artist's OTHER platform URLs (Spotify/YouTube/Deezer/SoundCloud) when the artist's own Instagram handle isn't indexed standalone on Soundcharts (a documented, common 404). The registry mismatch check only gates on outright MISMATCH (line 94); an INSUFFICIENT_EVIDENCE result (registry unavailable/no Instagram entry) still proceeds and serves live numbers, just relabeled. Combined with Soundcharts' own documented catalog-fragmentation behavior (one real artist split into multiple internal entities, cited via a real observed case in the same file's doc comment), an artist whose canonical cross-platform UUID maps to a fragmented/different Soundcharts entity than their real Instagram account would show that other entity's follower count with no visible error -- matching the reported symptom. NEXT STEP recommended by the agent: audit raw_payload.primary_identity_status values across artists for INSUFFICIENT_EVIDENCE cases and manually cross-check a sample against real Instagram accounts.

## Classification
- 12/13 questions: CLEAN, real negative proof
- 1/13 (Q8): real finding, LOW severity (public-data-only cache key lacks tenant scoping -- not a privacy/security issue, still worth a hygiene fix eventually)
- Original bug report: HYPOTHESIS_FORMED, NOT_CONFIRMED, real next-step given, no fabricated fix claimed
