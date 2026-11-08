/** Hashes computed together: one by one, each await costs more than the hash itself. */
const BATCH = 256;

/**
 * "Je ne suis pas un robot": the number that, hashed after the backend's challenge, gives a SHA-256
 * starting with enough zero bits. Asynchronous, so the page stays responsive meanwhile.
 */
export async function solveChallenge(token: string, difficulty: number): Promise<string> {
  const encoder = new TextEncoder();
  for (let start = 0; ; start += BATCH) {
    const hashes = await Promise.all(
      Array.from({ length: BATCH }, (_, index) => crypto.subtle.digest('SHA-256', encoder.encode(`${token}:${start + index}`))),
    );
    const found = hashes.findIndex((hash) => leadingZeroBits(new Uint8Array(hash)) >= difficulty);
    if (found >= 0) {
      return String(start + found);
    }
  }
}

export function leadingZeroBits(hash: Uint8Array): number {
  let bits = 0;
  for (const value of hash) {
    if (value !== 0) {
      return bits + Math.clz32(value) - 24;
    }
    bits += 8;
  }
  return bits;
}
