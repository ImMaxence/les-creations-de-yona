export interface LocalModelFile {
  path: string;
  bytes: number;
}

export interface LocalModel {
  /** Shown to the admin, with who made it. */
  name: string;
  /** Another model it comes with. */
  companion?: string;
  repo: string;
  /** A commit, not "main": what was tested is what is downloaded. */
  revision: string;
  files: readonly LocalModelFile[];
}

/** Reads the pasted recipes (Gemma 4 E4B, Apache 2.0, about 5 GB). */
export const RECIPE_MODEL: LocalModel = {
  name: 'Gemma 4 E4B de Google',
  repo: 'onnx-community/gemma-4-E4B-it-ONNX',
  revision: '2b6d2e26a962f70a33da8f7cd81e1afdd8d9cfb2',
  files: [
    { path: 'chat_template.jinja', bytes: 16317 },
    { path: 'config.json', bytes: 5741 },
    { path: 'generation_config.json', bytes: 238 },
    { path: 'onnx/audio_encoder_q4f16.onnx', bytes: 260446 },
    { path: 'onnx/audio_encoder_q4f16.onnx_data', bytes: 172167424 },
    { path: 'onnx/decoder_model_merged_q4f16.onnx', bytes: 850610 },
    { path: 'onnx/decoder_model_merged_q4f16.onnx_data', bytes: 2074847232 },
    { path: 'onnx/decoder_model_merged_q4f16.onnx_data_1', bytes: 812318720 },
    { path: 'onnx/embed_tokens_q4f16.onnx', bytes: 5619 },
    { path: 'onnx/embed_tokens_q4f16.onnx_data', bytes: 2017460224 },
    { path: 'onnx/vision_encoder_q4f16.onnx', bytes: 189126 },
    { path: 'onnx/vision_encoder_q4f16.onnx_data', bytes: 100762304 },
    { path: 'preprocessor_config.json', bytes: 43 },
    { path: 'processor_config.json', bytes: 1689 },
    { path: 'tokenizer.json', bytes: 19439251 },
    { path: 'tokenizer_config.json', bytes: 18590 },
  ],
};

/**
 * Writes down what the admin says, in the windows of the AI (Whisper large-v3-turbo of OpenAI, MIT,
 * about 570 MB): very good in French, and quick on a graphics card, its decoder being small.
 */
export const SPEECH_MODEL: LocalModel = {
  name: 'Whisper large-v3-turbo d’OpenAI',
  repo: 'onnx-community/whisper-large-v3-turbo',
  revision: '360ebcde2559d60bb474678be3c1de9ef347d01a',
  files: [
    { path: 'config.json', bytes: 1332 },
    { path: 'generation_config.json', bytes: 3897 },
    { path: 'preprocessor_config.json', bytes: 340 },
    { path: 'tokenizer.json', bytes: 2480617 },
    { path: 'tokenizer_config.json', bytes: 282843 },
    { path: 'onnx/encoder_model_q4f16.onnx', bytes: 369974078 },
    { path: 'onnx/decoder_model_merged_q4f16.onnx', bytes: 193505017 },
  ],
};

/** Draws the images (FLUX.2 klein 4B and its Qwen3 text encoder, Apache 2.0, about 6.5 GB). */
export const IMAGE_MODEL: LocalModel = {
  name: 'FLUX.2 klein 4B de Black Forest Labs',
  companion: 'Qwen3 4B d’Alibaba',
  repo: 'cgb/flux2-klein-4b-onnx-webgpu',
  revision: '3bffc0efef1d9f84727036cdbc44df3b6ab51131',
  files: [
    { path: 'text_encoder_q4-00000.data', bytes: 1599733760 },
    { path: 'text_encoder_q4-00001.data', bytes: 594170880 },
    { path: 'text_encoder_q4.onnx', bytes: 5341471 },
    { path: 'tokenizer/chat_template.jinja', bytes: 4168 },
    { path: 'tokenizer/tokenizer.json', bytes: 11422654 },
    { path: 'tokenizer/tokenizer_config.json', bytes: 5404 },
    { path: 'transformer_q8-00000.data', bytes: 1585446912 },
    { path: 'transformer_q8-00001.data', bytes: 1566572544 },
    { path: 'transformer_q8-00002.data', bytes: 981258240 },
    { path: 'transformer_q8.onnx', bytes: 4991601 },
    { path: 'vae_decoder.onnx', bytes: 760826 },
    { path: 'vae_decoder.onnx.data', bytes: 198508544 },
  ],
};

export function modelBytes(model: LocalModel): number {
  return model.files.reduce((total, file) => total + file.bytes, 0);
}
