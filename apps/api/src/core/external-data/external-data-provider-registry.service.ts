import { Injectable } from '@nestjs/common';
import { CapabilityUnavailableError } from './capability-unavailable.error';
import { UnconfiguredDistributorProvider } from './unconfigured-distributor.provider';
import { UnconfiguredSocietyProvider } from './unconfigured-society.provider';
import {
  DistributorSubmissionPayload,
  ExternalDataExchangeKind,
  ExternalDataExchangeProvider,
  ExternalDataProviderMetadata,
  SocietyDataSubmissionPayload,
} from './external-data.types';

type AnyProvider =
  | ExternalDataExchangeProvider<DistributorSubmissionPayload>
  | ExternalDataExchangeProvider<SocietyDataSubmissionPayload>;

@Injectable()
export class ExternalDataProviderRegistry {
  private readonly providers = new Map<string, AnyProvider>();

  constructor() {
    // No real distributor/society provider exists yet. The "unconfigured" providers are
    // registered in EVERY environment so prod/staging fail closed exactly like dev: each
    // operation throws CapabilityUnavailableError and never fabricates a submission.
    this.register(new UnconfiguredDistributorProvider());
    this.register(new UnconfiguredSocietyProvider());
  }

  register(provider: AnyProvider): void {
    this.providers.set(provider.metadata.providerId, provider);
  }

  list(kind?: ExternalDataExchangeKind): ExternalDataProviderMetadata[] {
    return Array.from(this.providers.values())
      .map((provider) => provider.metadata)
      .filter((metadata) => !kind || metadata.kind === kind);
  }

  getDistributor(providerId: string): ExternalDataExchangeProvider<DistributorSubmissionPayload> {
    const provider = this.providers.get(providerId);
    if (!provider || provider.metadata.kind !== 'distributor') {
      throw new CapabilityUnavailableError('distributor_submission');
    }
    return provider as ExternalDataExchangeProvider<DistributorSubmissionPayload>;
  }

  getSociety(providerId: string): ExternalDataExchangeProvider<SocietyDataSubmissionPayload> {
    const provider = this.providers.get(providerId);
    if (!provider || provider.metadata.kind !== 'society') {
      throw new CapabilityUnavailableError('society_submission');
    }
    return provider as ExternalDataExchangeProvider<SocietyDataSubmissionPayload>;
  }

  get(providerId: string): AnyProvider {
    const provider = this.providers.get(providerId);
    if (!provider) throw new CapabilityUnavailableError('distributor_status');
    return provider;
  }
}
