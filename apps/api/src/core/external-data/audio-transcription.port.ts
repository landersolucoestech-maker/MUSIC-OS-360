/**
 * Port for audio transcription. The domain defines this contract; a provider adapter must be
 * written against it. No provider exists today: only UnconfiguredTranscriptionProvider.
 */
export const AUDIO_TRANSCRIPTION_PORT = Symbol('AUDIO_TRANSCRIPTION_PORT');

export interface TranscribeAudioRequest {
  tenantId: string;
  assetId: string;
  /** Same key must yield the same job; never starts a second paid job. */
  idempotencyKey: string;
}

export type TranscriptionStatus = 'queued' | 'processing' | 'completed' | 'failed';

export interface TranscribeAudioResult {
  assetId: string;
  jobId: string;
  status: TranscriptionStatus;
  language: string | null;
  text: string | null;
  segments: Array<{ startMs: number; endMs: number; text: string }>;
  completedAt: string | null;
}

export interface AudioTranscriptionPort {
  transcribe(request: TranscribeAudioRequest): Promise<TranscribeAudioResult>;
}
