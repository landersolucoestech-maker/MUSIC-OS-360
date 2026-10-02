/**
 * governance/integration-capability.registry.ts
 *
 * TECHNICAL CAPABILITY — the only part of governance that remains in code, and
 * deliberately so: a technical implementation IS code. An admin cannot "switch on" an
 * adapter that does not exist, so this is not editable from a panel.
 *
 * What IS editable by the admin lives in the database (platform_integrations):
 * publication and VIEW/USE audience. The error this file fixes is the opposite —
 * previously a .ts catalog decided WHO SEES what, which is governance and required
 * a deploy to change.
 *
 * Golden rule of the resolver: publishing never creates capability. A provider
 * published without an adapter stays NOT_IMPLEMENTED and USE is never granted.
 */

export enum IntegrationTechnicalCapability {
  /** A real adapter exists and is wired to the module. */
  IMPLEMENTED     = 'implemented',
  /** No adapter exists in the backend — no credential resolves this. */
  NOT_IMPLEMENTED = 'not_implemented',
}

/**
 * Each entry points to the evidence in code. When adding a provider,
 * cite the real adapter — if there is no file to cite, it is NOT_IMPLEMENTED.
 */
const CAPABILITY: Record<string, { capability: IntegrationTechnicalCapability; evidence: string }> = {
  autentique:    { capability: IntegrationTechnicalCapability.IMPLEMENTED,     evidence: 'integrations/autentique/autentique.service.ts' },
  docusign:      { capability: IntegrationTechnicalCapability.IMPLEMENTED,     evidence: 'integrations/docusign/docusign.service.ts' },
  clicksign:     { capability: IntegrationTechnicalCapability.NOT_IMPLEMENTED, evidence: 'sem adapter em apps/api/src; useClicksign é stub desligado' },
  abramus:       { capability: IntegrationTechnicalCapability.IMPLEMENTED,     evidence: 'integrations/abramus/abramus.service.ts' },
  ubc:           { capability: IntegrationTechnicalCapability.NOT_IMPLEMENTED, evidence: 'sem adapter em apps/api/src; useUbc lança UBC_UNAVAILABLE' },
  ecad:          { capability: IntegrationTechnicalCapability.NOT_IMPLEMENTED, evidence: 'sem adapter em apps/api/src' },
  nfe:           { capability: IntegrationTechnicalCapability.NOT_IMPLEMENTED, evidence: 'sem adapter em apps/api/src' },
  acrcloud:      { capability: IntegrationTechnicalCapability.IMPLEMENTED,     evidence: 'integrations/acrcloud/acrcloud.service.ts' },
  soundcharts:   { capability: IntegrationTechnicalCapability.IMPLEMENTED,     evidence: 'integrations/soundcharts/soundcharts.service.ts' },
  google_ads:    { capability: IntegrationTechnicalCapability.IMPLEMENTED,     evidence: 'integrations/google-ads/google-ads.service.ts' },
  meta_business: { capability: IntegrationTechnicalCapability.IMPLEMENTED,     evidence: 'integrations.controller.ts — OAuth Meta (META_APP_ID/SECRET)' },
  // stripe covers SUBSCRIPTION BILLING only (modules/billing). It does NOT imply payout execution:
  // that is the separate `payout` key below.
  stripe:        { capability: IntegrationTechnicalCapability.IMPLEMENTED,     evidence: 'modules/billing — Stripe SDK + webhook (assinaturas; não executa payout)' },
  distributor:   { capability: IntegrationTechnicalCapability.NOT_IMPLEMENTED, evidence: 'core/external-data: porta ExternalDataExchangeProvider sem provider real; só UnconfiguredDistributorProvider (CAPABILITY_UNAVAILABLE)' },
  audio_transcription: { capability: IntegrationTechnicalCapability.NOT_IMPLEMENTED, evidence: 'core/external-data/audio-transcription.port.ts sem provider; só UnconfiguredTranscriptionProvider (CAPABILITY_UNAVAILABLE)' },
  payout:        { capability: IntegrationTechnicalCapability.NOT_IMPLEMENTED, evidence: 'core/external-data/payout.port.ts sem provider; só UnconfiguredPayoutProvider (CAPABILITY_UNAVAILABLE)' },
  resend:        { capability: IntegrationTechnicalCapability.IMPLEMENTED,     evidence: 'core/mail/mail.service.ts (RESEND_API_KEY)' },
  whatsapp:      { capability: IntegrationTechnicalCapability.IMPLEMENTED,     evidence: 'integrations/whatsapp/whatsapp-cloud.provider.ts' },
};

/** Fail-closed: an unknown provider is never treated as implemented. */
export function technicalCapabilityOf(providerKey: string): IntegrationTechnicalCapability {
  return CAPABILITY[providerKey]?.capability ?? IntegrationTechnicalCapability.NOT_IMPLEMENTED;
}

export function capabilityEvidenceOf(providerKey: string): string | null {
  return CAPABILITY[providerKey]?.evidence ?? null;
}
