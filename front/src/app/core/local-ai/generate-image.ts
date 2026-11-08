import { TOKEN_PIXELS } from './flux';
import type { ImageStage, ImageStageEvent } from './image.worker';
import { AiStage, formatDuration } from './local-ai-format';
import { IMAGE_MODEL } from './local-models';

const LONG_SIDE = 1024;
const SHORT_SIDE = 768;

/** A worded request gives a dish; these words give a photograph of it. */
const STYLE = 'Professional food photography, natural light, appetizing, sharp focus, no text';

/** Shares of the whole for the three stages: the denoising takes most of the time. */
const ENCODED = 0.15;
const DENOISED = 0.92;

/** Reading the description, loading the model, drawing, finishing. */
export interface ImageProgress {
  stage: 0 | 1 | 2 | 3;
  share: number;
  step?: number;
  steps?: number;
  /** Measured on the steps done: unknown during the first one. */
  secondsPerStep?: number;
}

/** What is being done, in words: shown as a list. */
export function imageStages(progress: ImageProgress, width: number, height: number): AiStage[] {
  const state = (stage: number): AiStage['state'] => (stage < progress.stage ? 'done' : stage === progress.stage ? 'running' : 'waiting');
  const { step, steps, secondsPerStep } = progress;
  let drawing = 'La partie la plus longue, en 4 étapes';
  if (progress.stage === 2 && step !== undefined && steps !== undefined) {
    const left = secondsPerStep === undefined ? 'temps restant calculé après cette étape' : `environ ${formatDuration((steps - step) * secondsPerStep)} restantes`;
    drawing = `Étape ${step + 1} sur ${steps} : ${left}`;
  }
  return [
    { label: 'Lecture de la description', detail: `${IMAGE_MODEL.companion} traduit votre texte pour le modèle d’image`, state: state(0) },
    { label: 'Chargement du modèle d’image', detail: `${IMAGE_MODEL.name} s’installe dans la carte graphique`, state: state(1) },
    { label: 'Dessin de l’image', detail: drawing, state: state(2) },
    { label: 'Finition', detail: `Reconstruction des pixels, ${width} × ${height}`, state: state(3) },
  ];
}

export function imageSize(portrait: boolean): { width: number; height: number } {
  return portrait ? { width: SHORT_SIDE, height: LONG_SIDE } : { width: LONG_SIDE, height: SHORT_SIDE };
}

/**
 * The three networks of the model, each in a worker of its own, ended before the next one starts:
 * ONNX Runtime gives the graphics memory back only then, and the three together would not fit in 16 GB.
 */
export async function generateImage(
  description: string,
  portrait: boolean,
  onProgress: (progress: ImageProgress) => void,
  signal: AbortSignal,
): Promise<Blob> {
  const { width, height } = imageSize(portrait);
  const rows = height / TOKEN_PIXELS;
  const columns = width / TOKEN_PIXELS;

  onProgress({ stage: 0, share: 0 });
  const encoded = await runStage({ stage: 'encode', prompt: `${description}. ${STYLE}` }, 'encoded', signal);

  onProgress({ stage: 1, share: ENCODED });
  let firstStepAt = 0;
  const denoised = await runStage(
    { stage: 'denoise', embeddings: encoded.embeddings, rows, columns },
    'denoised',
    signal,
    (step, steps) => {
      firstStepAt ||= performance.now();
      onProgress({
        stage: 2,
        step,
        steps,
        secondsPerStep: step > 0 ? (performance.now() - firstStepAt) / 1000 / step : undefined,
        share: ENCODED + ((DENOISED - ENCODED) * step) / steps,
      });
    },
  );

  onProgress({ stage: 3, share: DENOISED });
  const decoded = await runStage({ stage: 'decode', latent: denoised.latent, rows, columns }, 'decoded', signal);

  const canvas = new OffscreenCanvas(decoded.width, decoded.height);
  canvas.getContext('2d')!.putImageData(new ImageData(decoded.rgba as ImageDataArray, decoded.width, decoded.height), 0, 0);
  return canvas.convertToBlob({ type: 'image/png' });
}

function runStage<T extends ImageStageEvent['type']>(
  stage: ImageStage,
  expected: T,
  signal: AbortSignal,
  onStep?: (step: number, steps: number) => void,
): Promise<Extract<ImageStageEvent, { type: T }>> {
  const worker = new Worker(new URL('./image.worker', import.meta.url), { type: 'module' });
  return new Promise<Extract<ImageStageEvent, { type: T }>>((resolve, reject) => {
    signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
    worker.onerror = (event) => reject(new Error(event.message));
    worker.onmessage = ({ data }: MessageEvent<ImageStageEvent>) => {
      if (data.type === 'step') {
        onStep?.(data.step, data.steps);
      } else if (data.type === 'error') {
        reject(new Error(data.message));
      } else if (data.type === expected) {
        resolve(data as Extract<ImageStageEvent, { type: T }>);
      }
    };
    worker.postMessage(stage);
  }).finally(() => worker.terminate());
}
