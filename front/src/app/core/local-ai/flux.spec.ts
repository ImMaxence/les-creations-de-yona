import { describe, expect, it } from 'vitest';
import { imageIds, samplesToRgba, sigmas, textIds, unpackLatent } from './flux';

describe('FLUX.2 klein', () => {
  it('shifts the noise levels with the size of the image', () => {
    // The values published with the model, at 1024 tokens
    expect(sigmas(1024).map((sigma) => Math.round(sigma * 1000) / 1000)).toEqual([1, 0.849, 0.652, 0.385, 0]);
  });

  it('numbers the text tokens by their position', () => {
    expect([...textIds(2)]).toEqual([0n, 0n, 0n, 0n, 0n, 0n, 0n, 1n]);
  });

  it('numbers the image tokens by row and column', () => {
    expect([...imageIds(2, 2)]).toEqual([0n, 0n, 0n, 0n, 0n, 0n, 1n, 0n, 0n, 1n, 0n, 0n, 0n, 1n, 1n, 0n]);
  });

  it('puts the channels first', () => {
    // 2 tokens of 2 channels: [a0, a1, b0, b1] becomes [a0, b0, a1, b1]
    expect([...unpackLatent(new Float32Array([1, 2, 3, 4]), 1, 2, 2)]).toEqual([1, 3, 2, 4]);
  });

  it('turns samples from -1 to 1 into pixels', () => {
    expect([...samplesToRgba(new Float32Array([-1, 1, 0]), 1, 1)]).toEqual([0, 255, 128, 255]);
  });
});
