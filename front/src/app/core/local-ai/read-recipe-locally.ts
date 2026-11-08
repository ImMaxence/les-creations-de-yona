import type { RecipeReaderEvent, RecipeReaderRequest } from './recipe-reader.worker';

/**
 * The recipe read by the model, in a worker of its own: the page stays usable, and ending the
 * worker gives all the memory back at once (the Mac it runs on has 16 GB, shared with the page).
 */
export function readRecipeLocally(
  request: RecipeReaderRequest,
  onWriting: (characters: number) => void,
  signal: AbortSignal,
): Promise<string> {
  const worker = new Worker(new URL('./recipe-reader.worker', import.meta.url), { type: 'module' });
  return new Promise<string>((resolve, reject) => {
    signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
    worker.onerror = (event) => reject(new Error(event.message));
    worker.onmessage = ({ data }: MessageEvent<RecipeReaderEvent>) => {
      if (data.type === 'writing') {
        onWriting(data.characters);
      } else if (data.type === 'done') {
        resolve(data.answer);
      } else {
        reject(new Error(data.message));
      }
    };
    worker.postMessage(request);
  }).finally(() => worker.terminate());
}
