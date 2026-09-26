import { Injectable } from '@nestjs/common';
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
    // Real distributor/society providers do not exist yet; the
    // "unconfigured" providers registered outside prod/staging explicitly FAIL on
    // every operation — they never fabricate submissions.
    const nodeEnv = process.env.NODE_ENV ?? 'development';
    const isProdLike = nodeEnv === 'production' || nodeEnv === 'staging';
    if (!isProdLike) {
      this.register(new UnconfiguredDistributorProvider());
      this.register(new UnconfiguredSocietyProvider());
    }
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
      throw new Error(`Distributor provider not registered: ${providerId}`);
    }
    return provider as ExternalDataExchangeProvider<DistributorSubmissionPayload>;
  }

  getSociety(providerId: string): ExternalDataExchangeProvider<SocietyDataSubmissionPayload> {
    const provider = this.providers.get(providerId);
    if (!provider || provider.metadata.kind !== 'society') {
      throw new Error(`Society provider not registered: ${providerId}`);
    }
    return provider as ExternalDataExchangeProvider<SocietyDataSubmissionPayload>;
  }

  get(providerId: string): AnyProvider {
    const provider = this.providers.get(providerId);
    if (!provider) throw new Error(`External data provider not registered: ${providerId}`);
    return provider;
  }
}
