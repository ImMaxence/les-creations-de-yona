import { formatBytes, formatMinutes, formatQuantity, isoDuration, roundForKitchen } from './units';

describe('formatMinutes', () => {
  it('writes minutes, hours, and both', () => {
    expect(formatMinutes(20)).toBe('20 min');
    expect(formatMinutes(60)).toBe('1 h');
    expect(formatMinutes(75)).toBe('1 h 15');
    expect(formatMinutes(125)).toBe('2 h 05');
  });
});

describe('isoDuration', () => {
  it('writes an ISO 8601 duration for schema.org', () => {
    expect(isoDuration(75)).toBe('PT1H15M');
    expect(isoDuration(60)).toBe('PT1H');
    expect(isoDuration(0)).toBe('PT0M');
  });
});

describe('formatQuantity', () => {
  it('uses a French decimal comma, two decimals at most', () => {
    expect(formatQuantity(2.5)).toBe('2,5');
    expect(formatQuantity(1 / 3)).toBe('0,33');
  });
});

describe('roundForKitchen', () => {
  it('rounds to 5 g from 100', () => {
    expect(roundForKitchen(116.67)).toBe(115);
    expect(roundForKitchen(118)).toBe(120);
  });

  it('rounds to the unit from 10', () => {
    expect(roundForKitchen(46.67)).toBe(47);
  });

  it('rounds to halves, quarters under 0.5, never to 0', () => {
    expect(roundForKitchen(4.67)).toBe(4.5);
    expect(roundForKitchen(0.3)).toBe(0.25);
    expect(roundForKitchen(0.05)).toBe(0.25);
  });
});

describe('formatBytes', () => {
  it('counts in units of 1024', () => {
    expect(formatBytes(512)).toBe('512 octets');
    expect(formatBytes(274996)).toBe('268,6 Ko');
  });
});
