import { describe, expect, it } from 'vitest';
import { leadingZeroBits, solveChallenge } from './solve-challenge';

describe('solveChallenge', () => {
  it('finds a number whose hash starts with enough zero bits', async () => {
    const solution = await solveChallenge('jeton', 8);

    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`jeton:${solution}`));
    expect(leadingZeroBits(new Uint8Array(hash))).toBeGreaterThanOrEqual(8);
  });

  it('counts the zero bits at the start of a hash', () => {
    expect(leadingZeroBits(new Uint8Array([0, 0x10, 0]))).toBe(11);
    expect(leadingZeroBits(new Uint8Array([0x80]))).toBe(0);
    expect(leadingZeroBits(new Uint8Array([0, 0]))).toBe(16);
  });
});
