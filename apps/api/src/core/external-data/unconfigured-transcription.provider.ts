import { AudioTranscriptionPort, TranscribeAudioRequest, TranscribeAudioResult } from './audio-transcription.port';
import { CapabilityUnavailableError } from './capability-unavailable.error';

export class UnconfiguredTranscriptionProvider implements AudioTranscriptionPort {
  async transcribe(_request: TranscribeAudioRequest): Promise<TranscribeAudioResult> {
    throw new CapabilityUnavailableError('audio_transcription');
  }
}
