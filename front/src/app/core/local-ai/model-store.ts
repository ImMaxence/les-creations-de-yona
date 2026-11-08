import { isPhoneOrTablet } from './local-ai-format';
import { LocalModel, LocalModelFile, modelBytes } from './local-models';

export const PHONE_MESSAGE = 'L’IA locale demande un ordinateur : elle ne peut pas fonctionner sur un téléphone ou une tablette';

/** Kept by the browser in its Cache storage: a model is downloaded once per browser. */
const CACHE_NAME = 'yona-local-ai';

export function modelFileUrl(model: LocalModel, path: string): string {
  return `https://huggingface.co/${model.repo}/resolve/${model.revision}/${path}`;
}

/** Past the service worker: its own security policy would apply, and gigabytes have no reason to go through it. */
export function bypassServiceWorker(url: string): string {
  return `${url}${url.includes('?') ? '&' : '?'}ngsw-bypass=true`;
}

export async function missingFiles(model: LocalModel): Promise<LocalModelFile[]> {
  const cache = await caches.open(CACHE_NAME);
  const present = await Promise.all(model.files.map((file) => cache.match(modelFileUrl(model, file.path))));
  return model.files.filter((_, index) => !present[index]);
}

/**
 * File after file, each kept once complete: an interrupted download starts again at the file it
 * was in. Asks the browser not to evict the model when space runs short.
 */
export async function downloadModel(
  model: LocalModel,
  onProgress: (done: number, total: number) => void,
  signal: AbortSignal,
): Promise<void> {
  const missing = await missingFiles(model);
  const remaining = missing.reduce((total, file) => total + file.bytes, 0);
  const estimate = await navigator.storage?.estimate?.();
  if (estimate?.quota !== undefined && estimate.usage !== undefined && estimate.quota - estimate.usage < remaining) {
    throw new NotEnoughSpaceError();
  }
  void navigator.storage?.persist?.();
  const cache = await caches.open(CACHE_NAME);
  const total = modelBytes(model);
  let done = total - remaining;
  onProgress(done, total);
  for (const file of missing) {
    const url = modelFileUrl(model, file.path);
    // no-store: not a second copy in the browser's HTTP cache
    const response = await fetch(bypassServiceWorker(url), { signal, cache: 'no-store' });
    if (!response.ok || !response.body) {
      throw new Error(`${file.path}: ${response.status}`);
    }
    let received = 0;
    const counted = response.body.pipeThrough(
      new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, controller) {
          received += chunk.byteLength;
          onProgress(done + received, total);
          controller.enqueue(chunk);
        },
      }),
    );
    await cache.put(
      url,
      new Response(counted, { headers: { 'Content-Type': 'application/octet-stream', 'Content-Length': String(file.bytes) } }),
    );
    done += file.bytes;
  }
}

export async function deleteModel(model: LocalModel): Promise<void> {
  const cache = await caches.open(CACHE_NAME);
  await Promise.all(model.files.map((file) => cache.delete(modelFileUrl(model, file.path))));
}

export async function readModelFile(model: LocalModel, path: string): Promise<Uint8Array<ArrayBuffer>> {
  const response = await (await caches.open(CACHE_NAME)).match(modelFileUrl(model, path));
  if (!response) {
    throw new Error(`${path}: not downloaded`);
  }
  return new Uint8Array(await response.arrayBuffer());
}

/** The Cache storage as Transformers.js expects it: what it finds there is not fetched again. */
export const transformersCache = {
  match: async (url: string): Promise<Response | undefined> => (await caches.open(CACHE_NAME)).match(url),
  put: async (url: string, response: Response): Promise<void> => (await caches.open(CACHE_NAME)).put(url, response),
};

export class NotEnoughSpaceError extends Error {}

/** Why this browser cannot run the models, in French; null when it can. */
export async function webGpuProblem(): Promise<string | null> {
  if (isPhoneOrTablet()) {
    return PHONE_MESSAGE;
  }
  const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<{ features: Set<string> } | null> } }).gpu;
  if (!gpu || typeof caches === 'undefined') {
    return 'Ce navigateur ne permet pas de faire tourner l’IA locale : utilisez une version récente de Chrome, Edge ou Safari';
  }
  const adapter = await gpu.requestAdapter().catch(() => null);
  if (!adapter?.features.has('shader-f16')) {
    return 'La carte graphique de cet appareil ne permet pas de faire tourner l’IA locale';
  }
  return null;
}
