/**
 * modules/integrations/soundcharts/soundcharts.errors.ts
 *
 * Typed SoundchartsService errors — they never carry token/client_secret,
 * only the message and (when applicable) the HTTP status.
 */

export class SoundchartsNotConfiguredError extends Error {
  constructor(message = 'SOUNDCHARTS_CLIENT_ID/SOUNDCHARTS_CLIENT_SECRET não configurados') {
    super(message);
    this.name = 'SoundchartsNotConfiguredError';
  }
}

export class SoundchartsApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'SoundchartsApiError';
  }
}

export class SoundchartsNotFoundError extends SoundchartsApiError {
  constructor(message: string, status = 404) {
    super(message, status);
    this.name = 'SoundchartsNotFoundError';
  }
}

export class SoundchartsRateLimitError extends SoundchartsApiError {
  constructor(message: string, status = 429) {
    super(message, status);
    this.name = 'SoundchartsRateLimitError';
  }
}
