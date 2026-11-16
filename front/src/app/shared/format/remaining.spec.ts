import { remaining } from './remaining';

describe('remaining', () => {
  const now = Date.parse('2026-11-16T10:00:00Z');
  const inMs = (ms: number) => new Date(now + ms).toISOString();

  it('counts days, hours and minutes for a week', () => {
    expect(remaining(inMs(((6 * 24 + 23) * 60 + 5) * 60_000 + 7_000), now)).toBe('6 j 23 h 05 min');
  });

  it('shows the seconds within the last day', () => {
    expect(remaining(inMs(((23 * 60 + 5) * 60 + 7) * 1000), now)).toBe('23 h 05 min 07 s');
    expect(remaining(inMs((42 * 60 + 7) * 1000), now)).toBe('42 min 07 s');
    expect(remaining(inMs(7_000), now)).toBe('7 s');
  });

  it('has nothing left once the moment has passed', () => {
    expect(remaining(inMs(0), now)).toBeNull();
    expect(remaining(inMs(-5_000), now)).toBeNull();
    expect(remaining('pas une date', now)).toBeNull();
  });
});
