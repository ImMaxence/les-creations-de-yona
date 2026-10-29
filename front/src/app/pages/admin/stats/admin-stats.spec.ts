import { duration } from './admin-stats';

describe('duration', () => {
  it('says how long the backend has been running, shortly', () => {
    expect(duration(12 * 60 + 30)).toBe('12 min');
    expect(duration(2 * 3600 + 5 * 60)).toBe('2 h 05');
    expect(duration(3 * 86400 + 4 * 3600 + 59)).toBe('3 j 4 h');
  });
});
