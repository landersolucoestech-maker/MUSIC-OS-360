# AGENT-MC — MusicChat Provider Integration Audit

subagent_type: integration-reviewer
input_snapshot: HEAD 8c477787c043bdf0ceecf9feafe27a17fc932a3c
tool_uses: 35
duration_ms: 311900
status: COMPLETED

## MAJOR FINDING: sovereign contract premise contradicted by actual code
Contract stated LOGIN_REQUIRED=TRUE for all 4 MusicChat channels (a real connect/authorize flow). Actual code has NO connection/authorization mechanism for Facebook, Instagram, TikTok, or Website -- only WhatsApp has real integration. This is self-documented in-repo: SupportCenterView.tsx:491-499 has an explicit comment stating "Facebook/Instagram/TikTok/Website: isMarketingConnected() reflects only the marketing integration (posts/ads) via OAuth -- there is no real messaging/DM webhook for any of these channels" and conversations.service.ts:274-288 has a comment: "Channels without a real provider (email/telegram/instagram/facebook/tiktok/sms/custom) stay 'internal_only' honestly."

## MUSICCHAT_PROVIDER_MATRIX (4/4 channels)
Owning module: apps/api/src/modules/conversations/ (generic, channel-agnostic CRUD+delivery) + musicchat-automation.controller.ts (triage). No per-channel module exists.

1. Facebook -- ConversationChannel enum value only (conversations.dto.ts:15), frontend hardcoded {connected:false} static entry (SupportCenterView.tsx:501), no onClick/connect action. No token storage. dispatchOutbound() falls through to internal_only (conversations.service.ts:286-288) -- no external send. No inbound webhook anywhere.
2. Instagram -- same pattern (conversations.dto.ts:14, SupportCenterView.tsx:502). Confirmed genuinely separate from 2 OTHER Instagram services (marketing OAuth in integrations/instagram/instagram.service.ts, and analytics in platform-profiles/providers/instagram-artist-profile.provider.ts) -- MusicChat's ConversationsModule imports neither (module import list confirmed: only NotificationsModule, WhatsAppModule, AIModule).
3. TikTok -- same pattern (conversations.dto.ts:16, SupportCenterView.tsx:503). Genuinely separate from real TikTok OAuth in integrations/tiktok/tiktok.service.ts and the analytics provider. Not imported by MusicChat.
4. Website -- not even OAuth-shaped: backend ConversationChannel enum has NO 'site'/'website' value at all (closest is generic CUSTOM). No session, API key, widget token, or domain-authorization record of any kind exists. Explicit code comment confirms: "there is no chat widget/embed nor a public visitor-session endpoint... 'site' channel today only exists for a static contact form."

## Only real channel: WhatsApp (not one of the 4 named in the contract, confirmed as the sole working implementation)
WhatsAppCloudProvider.sendTextMessage is the only branch dispatchOutbound() actually calls externally (conversations.service.ts:286, gated on channel==='whatsapp'). Real signature-verified webhook exists (whatsapp-webhook.controller.ts). No equivalent exists for any of the 4 contract channels.

## Classification
FINDING, category D (functional gap), NOT reconciled by the agent as instructed. Recommends product/eng decision: is MusicChat's real current scope WhatsApp-only (with Facebook/Instagram/TikTok/Website as unbuilt UI mockups), and is that an accepted, known state, or a genuine missing-feature gap that needs building? This is NOT a security/contamination finding -- it's a scope/completeness finding requiring the exact same NEEDS_PRODUCT_DECISION treatment as this session's other open items.

## Corroborating pre-existing internal doc
docs/backend-v2/field-traceability/modules/musicchat.md reportedly corroborates this same gap (agent cited it but did not quote its content).
