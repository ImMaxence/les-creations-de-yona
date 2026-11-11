/// <reference lib="webworker" />
import { pipeline } from '@huggingface/transformers';
import { SPEECH_MODEL } from './local-models';
import { setUpTransformers } from './transformers-setup';

export interface SpeechRequest {
  /** Mono, 16 kHz, as Whisper hears. */
  audio: Float32Array;
}

export type SpeechEvent =
  | { type: 'files'; share: number }
  | { type: 'listening' }
  | { type: 'done'; text: string }
  | { type: 'error'; message: string };

const post = (event: SpeechEvent) => postMessage(event);

addEventListener('message', ({ data }: MessageEvent<SpeechRequest>) => {
  transcribe(data).catch((error: unknown) => post({ type: 'error', message: String(error) }));
});

async function transcribe({ audio }: SpeechRequest): Promise<void> {
  setUpTransformers();
  const { repo, revision } = SPEECH_MODEL;
  const recognizer = await pipeline('automatic-speech-recognition', repo, {
    revision,
    device: 'webgpu',
    dtype: { encoder_model: 'q4f16', decoder_model_merged: 'q4f16' },
    progress_callback: (info: { status: string; progress?: number }) => {
      if (info.status === 'progress_total') {
        post({ type: 'files', share: (info.progress ?? 0) / 100 });
      }
    },
  } as never);
  post({ type: 'listening' });
  // In French, by pieces of 30 seconds: a long dictation is heard whole
  const result = (await (recognizer as unknown as (audio: Float32Array, options: object) => Promise<{ text: string } | { text: string }[]>)(audio, {
    language: 'french',
    task: 'transcribe',
    chunk_length_s: 30,
    stride_length_s: 5,
  }));
  const text = (Array.isArray(result) ? result.map((part) => part.text).join(' ') : result.text).trim();
  post({ type: 'done', text });
}
