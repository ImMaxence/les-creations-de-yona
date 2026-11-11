import type { SpeechEvent } from './speech.worker';

export type SpeechProgress = Extract<SpeechEvent, { type: 'files' | 'listening' }>;

/** Whisper hears at 16 kHz, in mono. */
const SAMPLE_RATE = 16_000;

/**
 * What was said, written down by the model in a worker of its own: the page stays usable, and
 * ending the worker gives the graphics memory back at once.
 */
export function transcribeLocally(audio: Float32Array, onProgress: (progress: SpeechProgress) => void, signal: AbortSignal): Promise<string> {
  const worker = new Worker(new URL('./speech.worker', import.meta.url), { type: 'module' });
  return new Promise<string>((resolve, reject) => {
    signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
    worker.onerror = (event) => reject(new Error(event.message));
    worker.onmessage = ({ data }: MessageEvent<SpeechEvent>) => {
      if (data.type === 'done') {
        resolve(data.text);
      } else if (data.type === 'error') {
        reject(new Error(data.message));
      } else {
        onProgress(data);
      }
    };
    worker.postMessage({ audio }, [audio.buffer]);
  }).finally(() => worker.terminate());
}

/** The microphone, until stop() is called: the recording, as Whisper wants it. */
export class Recording {
  private readonly chunks: Blob[] = [];

  private constructor(
    private readonly stream: MediaStream,
    private readonly recorder: MediaRecorder,
  ) {
    recorder.ondataavailable = (event) => {
      if (event.data.size) {
        this.chunks.push(event.data);
      }
    };
    recorder.start();
  }

  /** Asks for the microphone; refused, the promise fails with the browser's NotAllowedError. */
  static async start(): Promise<Recording> {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
    return new Recording(stream, new MediaRecorder(stream));
  }

  /** Mono, 16 kHz: the browser resamples while decoding. */
  async stop(): Promise<Float32Array> {
    const stopped = new Promise<void>((resolve) => (this.recorder.onstop = () => resolve()));
    this.recorder.stop();
    await stopped;
    this.release();
    const context = new AudioContext({ sampleRate: SAMPLE_RATE });
    try {
      const decoded = await context.decodeAudioData(await new Blob(this.chunks).arrayBuffer());
      return decoded.getChannelData(0).slice();
    } finally {
      void context.close();
    }
  }

  /** Given up: the microphone is let go, its light goes off. */
  release(): void {
    if (this.recorder.state !== 'inactive') {
      this.recorder.stop();
    }
    this.stream.getTracks().forEach((track) => track.stop());
  }
}
