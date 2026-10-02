---
name: transcribe-audio
description: Transcribes an eligible WAV through the configured transcription capability. Use when audio needs a text transcript for lyrics or notes.
---
# transcribe-audio

## Classification
- kind: operation
- domain: operations
- batch: 18
- approval: none
- mutates: yes
- capability-unavailable: yes

## Purpose
Transcribes an eligible WAV through the configured transcription capability.

## Invocation conditions
- Audio needs a text transcript for lyrics or notes.
- A person asks what the transcript of an audio asset says.

## Required inputs
- The audio asset reference and its language.
- The configured transcription provider, if any.

## Procedure
1. Check whether a transcription provider is configured before anything else.
2. If none is configured, return CAPABILITY_UNAVAILABLE with the expected contract and the manual alternative, and stop.
3. If one is configured, send the audio through the guarded provider path and keep the returned text labeled as machine generated with its provider and time.
4. Never produce text that did not come from the provider.

## Expected outputs
- A machine generated transcript with its label, or a CAPABILITY_UNAVAILABLE result.

## Validation
- The result states the provider check outcome.
- A transcript is always labeled as machine generated.

## Evidence
- The provider check result and the transcript label.

## Failure behavior
- If the provider fails, classify the failure and return it; never substitute invented text.

## Rollback and recovery
- Only the transcript record is created: revert by deleting that record through the guarded service.

## Human approval
- Low-impact derived record: no human approval is needed, and the label keeps it from being mistaken for a human transcript.

## Capability unavailable
- required integration: speech-to-text transcription provider, not configured in this repository
- expected contract: an audio reference and a language in; timestamped text with a confidence value out
- expected input: audio asset reference and language code
- expected output: timestamped transcript labeled as machine generated
- safe fallback: a transcript typed by a person, recorded as human authored
