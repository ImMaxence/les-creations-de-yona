import { env } from '@huggingface/transformers';
import { bypassServiceWorker, transformersCache } from './model-store';

/** Where the build copies ONNX Runtime's WebAssembly (angular.json): served by the site, no CDN. */
export const ORT_WASM_PATH = '/ort/';

/** Inside a worker, before loading anything: the files downloaded by model-store, the runtime of the site. */
export function setUpTransformers(): void {
  env.allowLocalModels = false;
  env.useBrowserCache = false;
  env.useCustomCache = true;
  env.customCache = transformersCache;
  env.fetch = (input: string | URL, init?: RequestInit) => fetch(bypassServiceWorker(String(input)), init);
  if (env.backends.onnx.wasm) {
    env.backends.onnx.wasm.wasmPaths = ORT_WASM_PATH;
  }
}
