/// <reference lib="webworker" />
import { PreTrainedTokenizer } from '@huggingface/transformers';
import * as ort from 'onnxruntime-web/webgpu';
import { TEXT_TOKENS, TOKEN_CHANNELS, gaussianNoise, imageIds, samplesToRgba, sigmas, textIds, unpackLatent } from './flux';
import { IMAGE_MODEL } from './local-models';
import { readModelFile } from './model-store';
import { ORT_WASM_PATH } from './transformers-setup';

export type ImageStage =
  | { stage: 'encode'; prompt: string }
  | { stage: 'denoise'; embeddings: Float16Array; rows: number; columns: number }
  | { stage: 'decode'; latent: Float32Array; rows: number; columns: number };

export type ImageStageEvent =
  | { type: 'step'; step: number; steps: number }
  | { type: 'encoded'; embeddings: Float16Array }
  | { type: 'denoised'; latent: Float32Array }
  | { type: 'decoded'; rgba: Uint8ClampedArray; width: number; height: number }
  | { type: 'error'; message: string };

const post = (event: ImageStageEvent, transfer: Transferable[] = []) => postMessage(event, transfer);

addEventListener('message', ({ data }: MessageEvent<ImageStage>) => {
  run(data).catch((error: unknown) => post({ type: 'error', message: String(error) }));
});

async function run(stage: ImageStage): Promise<void> {
  ort.env.wasm.wasmPaths = ORT_WASM_PATH;
  ort.env.logLevel = 'error';
  switch (stage.stage) {
    case 'encode':
      return encode(stage.prompt);
    case 'denoise':
      return denoise(stage.embeddings, stage.rows, stage.columns);
    case 'decode':
      return decode(stage.latent, stage.rows, stage.columns);
  }
}

async function session(graph: string, weights: string[]): Promise<ort.InferenceSession> {
  const externalData = await Promise.all(weights.map(async (path) => ({ path, data: await readModelFile(IMAGE_MODEL, path) })));
  return ort.InferenceSession.create(await readModelFile(IMAGE_MODEL, graph), { executionProviders: ['webgpu'], externalData });
}

async function loadTokenizer(): Promise<PreTrainedTokenizer> {
  const text = async (path: string) => new TextDecoder().decode(await readModelFile(IMAGE_MODEL, `tokenizer/${path}`));
  const [tokenizer, config, template] = await Promise.all([text('tokenizer.json'), text('tokenizer_config.json'), text('chat_template.jinja')]);
  return new PreTrainedTokenizer(JSON.parse(tokenizer), { ...JSON.parse(config), chat_template: template });
}

async function encode(prompt: string): Promise<void> {
  const tokenizer = await loadTokenizer();
  const text = tokenizer.apply_chat_template([{ role: 'user', content: prompt }], {
    tokenize: false,
    add_generation_prompt: true,
    enable_thinking: false,
  } as never) as unknown as string;
  const tokens = tokenizer(text, { padding: 'max_length', truncation: true, max_length: TEXT_TOKENS }) as unknown as {
    input_ids: { data: BigInt64Array<ArrayBuffer> };
    attention_mask: { data: BigInt64Array<ArrayBuffer> };
  };
  const encoder = await session('text_encoder_q4.onnx', ['text_encoder_q4-00000.data', 'text_encoder_q4-00001.data']);
  const dims = [1, TEXT_TOKENS];
  const output = await encoder.run({
    input_ids: new ort.Tensor('int64', tokens.input_ids.data, dims),
    attention_mask: new ort.Tensor('int64', tokens.attention_mask.data, dims),
  });
  const embeddings = (output['prompt_embeds'].data as unknown as Float16Array).slice();
  post({ type: 'encoded', embeddings }, [embeddings.buffer as ArrayBuffer]);
}

async function denoise(embeddings: Float16Array, rows: number, columns: number): Promise<void> {
  const transformer = await session('transformer_q8.onnx', [
    'transformer_q8-00000.data',
    'transformer_q8-00001.data',
    'transformer_q8-00002.data',
  ]);
  const tokens = rows * columns;
  const levels = sigmas(tokens);
  const latent = gaussianNoise(tokens * TOKEN_CHANNELS);
  const textEmbeddings = new ort.Tensor('float16', embeddings as never, [1, TEXT_TOKENS, embeddings.length / TEXT_TOKENS]);
  const imagePositions = new ort.Tensor('int64', imageIds(rows, columns), [1, tokens, 4]);
  const textPositions = new ort.Tensor('int64', textIds(), [1, TEXT_TOKENS, 4]);
  for (let step = 0; step < levels.length - 1; step++) {
    post({ type: 'step', step, steps: levels.length - 1 });
    const output = await transformer.run({
      hidden_states: new ort.Tensor('float16', new Float16Array(latent) as never, [1, tokens, TOKEN_CHANNELS]),
      encoder_hidden_states: textEmbeddings,
      timestep: new ort.Tensor('float16', new Float16Array([levels[step]]) as never, [1]),
      img_ids: imagePositions,
      txt_ids: textPositions,
    });
    const prediction = output['noise_pred'].data as unknown as Float16Array;
    const delta = levels[step + 1] - levels[step];
    for (let index = 0; index < latent.length; index++) {
      latent[index] += delta * prediction[index];
    }
  }
  post({ type: 'denoised', latent }, [latent.buffer]);
}

async function decode(latent: Float32Array, rows: number, columns: number): Promise<void> {
  const decoder = await session('vae_decoder.onnx', ['vae_decoder.onnx.data']);
  const output = await decoder.run({
    packed_latent: new ort.Tensor('float32', unpackLatent(latent, rows, columns), [1, TOKEN_CHANNELS, rows, columns]),
  });
  const [, , height, width] = output['sample'].dims;
  const rgba = samplesToRgba(output['sample'].data as Float32Array, width, height);
  post({ type: 'decoded', rgba, width, height }, [rgba.buffer]);
}
