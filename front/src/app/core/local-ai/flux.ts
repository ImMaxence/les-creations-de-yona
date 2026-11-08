/** What FLUX.2 klein needs around its three networks, written after its scheduler and pipeline. */

/** The model is distilled for 4 steps: more would not improve it. */
export const STEPS = 4;
/** One token covers 16 × 16 pixels, and holds 128 values. */
export const TOKEN_PIXELS = 16;
export const TOKEN_CHANNELS = 128;
/** The prompt is always padded to this length. */
export const TEXT_TOKENS = 512;

const BASE_SHIFT = 0.5;
const MAX_SHIFT = 1.15;
const BASE_TOKENS = 256;
const MAX_TOKENS = 4096;

/** Noise levels from 1 to 0, shifted according to the size of the image. */
export function sigmas(imageTokens: number, steps = STEPS): number[] {
  const slope = (MAX_SHIFT - BASE_SHIFT) / (MAX_TOKENS - BASE_TOKENS);
  const shift = Math.exp(BASE_SHIFT + slope * (imageTokens - BASE_TOKENS));
  const levels = Array.from({ length: steps }, (_, step) => {
    const sigma = 1 - step / steps;
    return shift / (shift + 1 / sigma - 1);
  });
  return [...levels, 0];
}

/** [t, h, w, l] of each text token: only its position l counts. */
export function textIds(tokens = TEXT_TOKENS): BigInt64Array<ArrayBuffer> {
  const ids = new BigInt64Array(tokens * 4);
  for (let token = 0; token < tokens; token++) {
    ids[token * 4 + 3] = BigInt(token);
  }
  return ids;
}

/** [t, h, w, l] of each image token, row after row. */
export function imageIds(rows: number, columns: number): BigInt64Array<ArrayBuffer> {
  const ids = new BigInt64Array(rows * columns * 4);
  for (let token = 0; token < rows * columns; token++) {
    ids[token * 4 + 1] = BigInt(Math.floor(token / columns));
    ids[token * 4 + 2] = BigInt(token % columns);
  }
  return ids;
}

export function gaussianNoise(length: number): Float32Array<ArrayBuffer> {
  const noise = new Float32Array(length);
  for (let index = 0; index < length; index += 2) {
    const radius = Math.sqrt(-2 * Math.log(1 - Math.random()));
    const angle = 2 * Math.PI * Math.random();
    noise[index] = radius * Math.cos(angle);
    if (index + 1 < length) {
      noise[index + 1] = radius * Math.sin(angle);
    }
  }
  return noise;
}

/** Tokens [rows × columns, channels] to channel-first [channels, rows, columns]. */
export function unpackLatent(
  latent: Float32Array,
  rows: number,
  columns: number,
  channels = TOKEN_CHANNELS,
): Float32Array<ArrayBuffer> {
  const unpacked = new Float32Array(latent.length);
  for (let token = 0; token < rows * columns; token++) {
    for (let channel = 0; channel < channels; channel++) {
      unpacked[channel * rows * columns + token] = latent[token * channels + channel];
    }
  }
  return unpacked;
}

/** Channel-first [3, height, width] from -1 to 1, to RGBA. */
export function samplesToRgba(sample: Float32Array, width: number, height: number): Uint8ClampedArray<ArrayBuffer> {
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let pixel = 0; pixel < width * height; pixel++) {
    for (let channel = 0; channel < 3; channel++) {
      rgba[pixel * 4 + channel] = ((sample[channel * width * height + pixel] + 1) / 2) * 255;
    }
    rgba[pixel * 4 + 3] = 255;
  }
  return rgba;
}
