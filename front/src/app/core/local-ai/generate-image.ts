import { TOKEN_PIXELS } from './flux';
import type { ImageStage, ImageStageEvent } from './image.worker';

const LONG_SIDE = 1024;
const SHORT_SIDE = 768;

/** A worded request gives a dish; these words give a photograph of it. */
const STYLE = 'Professional food photography, natural light, appetizing, sharp focus, no text';

/** Shares of the whole for the three stages: the denoising takes most of the time. */
const ENCODED = 0.15;
const DENOISED = 0.92;

export interface ImageProgress {
  label: string;
  share: number;
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
  const width = portrait ? SHORT_SIDE : LONG_SIDE;
  const height = portrait ? LONG_SIDE : SHORT_SIDE;
  const rows = height / TOKEN_PIXELS;
  const columns = width / TOKEN_PIXELS;

  onProgress({ label: 'Lecture de la description…', share: 0 });
  const encoded = await runStage({ stage: 'encode', prompt: `${description}. ${STYLE}` }, 'encoded', signal);

  onProgress({ label: 'Chargement du modèle d’image…', share: ENCODED });
  const denoised = await runStage(
    { stage: 'denoise', embeddings: encoded.embeddings, rows, columns },
    'denoised',
    signal,
    (step, steps) =>
      onProgress({
        label: `Dessin de l’image, étape ${step + 1} sur ${steps}…`,
        share: ENCODED + ((DENOISED - ENCODED) * step) / steps,
      }),
  );

  onProgress({ label: 'Finition de l’image…', share: DENOISED });
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
