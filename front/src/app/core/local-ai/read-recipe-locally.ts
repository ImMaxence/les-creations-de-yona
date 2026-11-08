import type { RecipeReaderEvent, RecipeReaderRequest } from './recipe-reader.worker';

export type RecipeReaderProgress = Exclude<RecipeReaderEvent, { type: 'done' | 'error' }>;

/**
 * The recipe read by the model, in a worker of its own: the page stays usable, and ending the
 * worker gives all the memory back at once (the Mac it runs on has 16 GB, shared with the page).
 */
export function readRecipeLocally(
  request: RecipeReaderRequest,
  onProgress: (progress: RecipeReaderProgress) => void,
  signal: AbortSignal,
): Promise<string> {
  const worker = new Worker(new URL('./recipe-reader.worker', import.meta.url), { type: 'module' });
  return new Promise<string>((resolve, reject) => {
    signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
    worker.onerror = (event) => reject(new Error(event.message));
    worker.onmessage = ({ data }: MessageEvent<RecipeReaderEvent>) => {
      if (data.type === 'done') {
        resolve(data.answer);
      } else if (data.type === 'error') {
        reject(new Error(data.message));
      } else {
        onProgress(data);
      }
    };
    worker.postMessage(request);
  }).finally(() => worker.terminate());
}
