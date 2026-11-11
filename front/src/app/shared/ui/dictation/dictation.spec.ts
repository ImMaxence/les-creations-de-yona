import { microphoneProblem, spectrumBars } from './dictation';

describe('spectrumBars', () => {
  it('groups the bands of the voice into bars from 0 to 1, the hum left out', () => {
    const frequencies = new Uint8Array(128);
    frequencies[0] = 255;
    frequencies.fill(255, 1, 5);

    const bars = spectrumBars(frequencies, 4, 8);

    expect(bars).toEqual([1, 1, 0, 0]);
  });

  it('stays flat in silence', () => {
    expect(spectrumBars(new Uint8Array(128)).every((level) => level === 0)).toBe(true);
    expect(spectrumBars(new Uint8Array(128))).toHaveLength(28);
  });
});

describe('microphoneProblem', () => {
  it('says why the microphone could not be used', () => {
    expect(microphoneProblem(new DOMException('', 'NotAllowedError'))).toContain('refusé');
    expect(microphoneProblem(new DOMException('', 'NotFoundError'))).toContain('Aucun micro');
    expect(microphoneProblem(new Error('boom'))).toContain('réessayez');
  });
});
