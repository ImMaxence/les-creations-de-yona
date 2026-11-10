import { firstOfMonth } from './paris-time';
import { ParisDatePipe } from './paris-date.pipe';

describe('ParisDatePipe', () => {
  const pipe = new ParisDatePipe();

  it('writes the date in Paris, where the day may already have changed', () => {
    expect(pipe.transform('2026-10-21T22:30:00Z')).toBe('22 octobre 2026');
    expect(pipe.transform('2026-11-12')).toBe('12 novembre 2026');
  });

  it('writes the first of the month "1er"', () => {
    expect(pipe.transform('2026-11-01')).toBe('1er novembre 2026');
    expect(pipe.transform('2026-10-31T23:30:00Z')).toBe('1er novembre 2026');
  });

  it('keeps the 11th and the 21st as they are', () => {
    expect(pipe.transform('2026-11-11')).toBe('11 novembre 2026');
    expect(pipe.transform('2026-11-21')).toBe('21 novembre 2026');
  });
});

describe('firstOfMonth', () => {
  it('writes "1er" before the month, after a weekday too', () => {
    expect(firstOfMonth('1 novembre 2026')).toBe('1er novembre 2026');
    expect(firstOfMonth('samedi 1 novembre à 10:00')).toBe('samedi 1er novembre à 10:00');
  });

  it('leaves the other days and the hours alone', () => {
    expect(firstOfMonth('11 novembre 2026')).toBe('11 novembre 2026');
    expect(firstOfMonth('samedi 21 novembre à 1:05')).toBe('samedi 21 novembre à 1:05');
  });
});
